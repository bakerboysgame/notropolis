// worker/src/routes/game/blackjack.js
// Server-side blackjack game logic

const MAX_BET = 10000;

// Standard deck
const SUITS = ['hearts', 'diamonds', 'clubs', 'spades'];
const VALUES = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];

// Card value calculation
function getCardValue(card) {
  if (['J', 'Q', 'K'].includes(card.value)) return 10;
  if (card.value === 'A') return 11; // Aces handled specially in hand calculation
  return parseInt(card.value);
}

// Calculate hand value with ace optimization
function calculateHandValue(hand) {
  let value = 0;
  let aces = 0;

  for (const card of hand) {
    if (card.value === 'A') {
      aces++;
      value += 11;
    } else {
      value += getCardValue(card);
    }
  }

  // Convert aces from 11 to 1 as needed
  while (value > 21 && aces > 0) {
    value -= 10;
    aces--;
  }

  return value;
}

// Create and shuffle a deck
function createShuffledDeck() {
  const deck = [];
  for (const suit of SUITS) {
    for (const value of VALUES) {
      deck.push({ suit, value });
    }
  }

  // Fisher-Yates shuffle
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }

  return deck;
}

// Game states
const GameState = {
  BETTING: 'betting',
  PLAYER_TURN: 'player_turn',
  DEALER_TURN: 'dealer_turn',
  FINISHED: 'finished',
};

// Start a new blackjack game
export async function startBlackjackGame(env, company, betAmount) {
  if (company.in_prison) {
    throw new Error('Cannot gamble while in prison');
  }

  if (betAmount <= 0) throw new Error('Invalid bet amount');
  if (betAmount > MAX_BET) throw new Error(`Maximum bet is $${MAX_BET.toLocaleString()}`);
  if (betAmount > company.cash) throw new Error('Insufficient funds');

  // Create deck and deal initial cards
  const deck = createShuffledDeck();

  const playerHand = [deck.pop(), deck.pop()];
  const dealerHand = [deck.pop(), deck.pop()];

  const playerValue = calculateHandValue(playerHand);
  const dealerValue = calculateHandValue(dealerHand);

  // Check for blackjacks
  const playerBlackjack = playerValue === 21 && playerHand.length === 2;
  const dealerBlackjack = dealerValue === 21 && dealerHand.length === 2;

  let gameState = GameState.PLAYER_TURN;
  let result = null;
  let payout = 0;

  if (playerBlackjack || dealerBlackjack) {
    gameState = GameState.FINISHED;

    if (playerBlackjack && dealerBlackjack) {
      result = 'push';
      payout = betAmount; // Return bet
    } else if (playerBlackjack) {
      result = 'blackjack';
      payout = betAmount + Math.floor(betAmount * 1.5); // 3:2 payout
    } else {
      result = 'dealer_blackjack';
      payout = 0;
    }
  }

  // Store game state in KV or return it
  const gameId = crypto.randomUUID();
  const gameData = {
    id: gameId,
    companyId: company.id,
    betAmount,
    deck: JSON.stringify(deck),
    playerHand: JSON.stringify(playerHand),
    dealerHand: JSON.stringify(dealerHand),
    state: gameState,
    result,
    createdAt: new Date().toISOString(),
  };

  // Store game in D1
  await env.DB.prepare(`
    INSERT INTO blackjack_games (id, company_id, bet_amount, deck, player_hand, dealer_hand, state, result, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    gameId,
    company.id,
    betAmount,
    gameData.deck,
    gameData.playerHand,
    gameData.dealerHand,
    gameState,
    result,
    gameData.createdAt
  ).run();

  // Deduct bet immediately
  await env.DB.prepare(
    'UPDATE game_companies SET cash = cash - ? WHERE id = ?'
  ).bind(betAmount, company.id).run();

  // If game finished immediately (blackjack), process payout
  if (gameState === GameState.FINISHED) {
    await finishGame(env, company.id, gameId, result, betAmount, payout);
  }

  // Calculate new balance: bet was deducted, payout added if game finished
  const newBalance = company.cash - betAmount + (gameState === GameState.FINISHED ? payout : 0);

  return {
    gameId,
    playerHand,
    dealerHand: gameState === GameState.FINISHED ? dealerHand : [dealerHand[0], { hidden: true }],
    playerValue,
    dealerValue: gameState === GameState.FINISHED ? dealerValue : getCardValue(dealerHand[0]),
    state: gameState,
    result,
    payout: gameState === GameState.FINISHED ? payout : null,
    canDouble: playerHand.length === 2 && betAmount <= company.cash - betAmount,
    new_balance: newBalance,
  };
}

// Player hits
export async function blackjackHit(env, company, gameId) {
  const game = await env.DB.prepare(
    'SELECT * FROM blackjack_games WHERE id = ? AND company_id = ?'
  ).bind(gameId, company.id).first();

  if (!game) throw new Error('Game not found');
  if (game.state !== GameState.PLAYER_TURN) throw new Error('Cannot hit now');

  const deck = JSON.parse(game.deck);
  const playerHand = JSON.parse(game.player_hand);
  const dealerHand = JSON.parse(game.dealer_hand);

  // Deal card to player
  playerHand.push(deck.pop());
  const playerValue = calculateHandValue(playerHand);

  let state = GameState.PLAYER_TURN;
  let result = null;
  let payout = 0;

  // Check for bust
  if (playerValue > 21) {
    state = GameState.FINISHED;
    result = 'bust';
    payout = 0;
  }

  // Update game
  await env.DB.prepare(`
    UPDATE blackjack_games
    SET deck = ?, player_hand = ?, state = ?, result = ?
    WHERE id = ?
  `).bind(JSON.stringify(deck), JSON.stringify(playerHand), state, result, gameId).run();

  if (state === GameState.FINISHED) {
    await finishGame(env, company.id, gameId, result, game.bet_amount, payout);
  }

  // Get current balance from DB (bet was already deducted at game start)
  const updatedCompany = await env.DB.prepare(
    'SELECT cash FROM game_companies WHERE id = ?'
  ).bind(company.id).first();

  return {
    gameId,
    playerHand,
    dealerHand: state === GameState.FINISHED ? dealerHand : [dealerHand[0], { hidden: true }],
    playerValue,
    dealerValue: state === GameState.FINISHED ? calculateHandValue(dealerHand) : getCardValue(dealerHand[0]),
    state,
    result,
    payout: state === GameState.FINISHED ? payout : null,
    canDouble: false,
    new_balance: updatedCompany.cash,
  };
}

// Player stands - dealer plays
export async function blackjackStand(env, company, gameId) {
  const game = await env.DB.prepare(
    'SELECT * FROM blackjack_games WHERE id = ? AND company_id = ?'
  ).bind(gameId, company.id).first();

  if (!game) throw new Error('Game not found');
  if (game.state !== GameState.PLAYER_TURN) throw new Error('Cannot stand now');

  const deck = JSON.parse(game.deck);
  const playerHand = JSON.parse(game.player_hand);
  const dealerHand = JSON.parse(game.dealer_hand);

  const playerValue = calculateHandValue(playerHand);

  // Dealer draws until 17+
  let dealerValue = calculateHandValue(dealerHand);
  while (dealerValue < 17) {
    dealerHand.push(deck.pop());
    dealerValue = calculateHandValue(dealerHand);
  }

  // Determine winner
  let result;
  let payout = 0;

  if (dealerValue > 21) {
    result = 'dealer_bust';
    payout = game.bet_amount * 2;
  } else if (playerValue > dealerValue) {
    result = 'win';
    payout = game.bet_amount * 2;
  } else if (playerValue < dealerValue) {
    result = 'lose';
    payout = 0;
  } else {
    result = 'push';
    payout = game.bet_amount; // Return bet
  }

  // Update game
  await env.DB.prepare(`
    UPDATE blackjack_games
    SET deck = ?, dealer_hand = ?, state = ?, result = ?
    WHERE id = ?
  `).bind(JSON.stringify(deck), JSON.stringify(dealerHand), GameState.FINISHED, result, gameId).run();

  await finishGame(env, company.id, gameId, result, game.bet_amount, payout);

  // Get current balance from DB
  const updatedCompany = await env.DB.prepare(
    'SELECT cash FROM game_companies WHERE id = ?'
  ).bind(company.id).first();

  return {
    gameId,
    playerHand,
    dealerHand,
    playerValue,
    dealerValue,
    state: GameState.FINISHED,
    result,
    payout,
    canDouble: false,
    new_balance: updatedCompany.cash,
  };
}

// Player doubles down
export async function blackjackDouble(env, company, gameId) {
  const game = await env.DB.prepare(
    'SELECT * FROM blackjack_games WHERE id = ? AND company_id = ?'
  ).bind(gameId, company.id).first();

  if (!game) throw new Error('Game not found');
  if (game.state !== GameState.PLAYER_TURN) throw new Error('Cannot double now');

  const playerHand = JSON.parse(game.player_hand);
  if (playerHand.length !== 2) throw new Error('Can only double on first two cards');

  // Check if player can afford to double
  const currentCompany = await env.DB.prepare(
    'SELECT cash FROM game_companies WHERE id = ?'
  ).bind(company.id).first();

  if (currentCompany.cash < game.bet_amount) {
    throw new Error('Insufficient funds to double down');
  }

  // Deduct additional bet
  await env.DB.prepare(
    'UPDATE game_companies SET cash = cash - ? WHERE id = ?'
  ).bind(game.bet_amount, company.id).run();

  // Update bet amount
  const newBetAmount = game.bet_amount * 2;
  await env.DB.prepare(
    'UPDATE blackjack_games SET bet_amount = ? WHERE id = ?'
  ).bind(newBetAmount, gameId).run();

  const deck = JSON.parse(game.deck);
  const dealerHand = JSON.parse(game.dealer_hand);

  // Deal one card to player
  playerHand.push(deck.pop());
  const playerValue = calculateHandValue(playerHand);

  let result;
  let payout = 0;

  // Check for bust
  if (playerValue > 21) {
    result = 'bust';
    payout = 0;

    await env.DB.prepare(`
      UPDATE blackjack_games
      SET deck = ?, player_hand = ?, state = ?, result = ?
      WHERE id = ?
    `).bind(JSON.stringify(deck), JSON.stringify(playerHand), GameState.FINISHED, result, gameId).run();

    await finishGame(env, company.id, gameId, result, newBetAmount, payout);

    // Get current balance from DB
    const updatedCompanyBust = await env.DB.prepare(
      'SELECT cash FROM game_companies WHERE id = ?'
    ).bind(company.id).first();

    return {
      gameId,
      playerHand,
      dealerHand,
      playerValue,
      dealerValue: calculateHandValue(dealerHand),
      state: GameState.FINISHED,
      result,
      payout,
      canDouble: false,
      new_balance: updatedCompanyBust.cash,
    };
  }

  // Dealer plays
  let dealerValue = calculateHandValue(dealerHand);
  while (dealerValue < 17) {
    dealerHand.push(deck.pop());
    dealerValue = calculateHandValue(dealerHand);
  }

  // Determine winner
  if (dealerValue > 21) {
    result = 'dealer_bust';
    payout = newBetAmount * 2;
  } else if (playerValue > dealerValue) {
    result = 'win';
    payout = newBetAmount * 2;
  } else if (playerValue < dealerValue) {
    result = 'lose';
    payout = 0;
  } else {
    result = 'push';
    payout = newBetAmount;
  }

  await env.DB.prepare(`
    UPDATE blackjack_games
    SET deck = ?, player_hand = ?, dealer_hand = ?, state = ?, result = ?
    WHERE id = ?
  `).bind(JSON.stringify(deck), JSON.stringify(playerHand), JSON.stringify(dealerHand), GameState.FINISHED, result, gameId).run();

  await finishGame(env, company.id, gameId, result, newBetAmount, payout);

  // Get current balance from DB
  const updatedCompany = await env.DB.prepare(
    'SELECT cash FROM game_companies WHERE id = ?'
  ).bind(company.id).first();

  return {
    gameId,
    playerHand,
    dealerHand,
    playerValue,
    dealerValue,
    state: GameState.FINISHED,
    result,
    payout,
    canDouble: false,
    new_balance: updatedCompany.cash,
  };
}

// Finish game and process payout
async function finishGame(env, companyId, gameId, result, betAmount, payout) {
  if (payout > 0) {
    await env.DB.prepare(
      'UPDATE game_companies SET cash = cash + ? WHERE id = ?'
    ).bind(payout, companyId).run();
  }

  // Log the game
  await env.DB.prepare(`
    INSERT INTO casino_games (id, company_id, game_type, bet_amount, bet_type, result, won, payout)
    VALUES (?, ?, 'blackjack', ?, ?, ?, ?, ?)
  `).bind(
    crypto.randomUUID(),
    companyId,
    betAmount,
    result,
    result,
    ['win', 'blackjack', 'dealer_bust'].includes(result) ? 1 : (result === 'push' ? 0 : 0),
    payout
  ).run();
}

// Get current game state (for reconnection)
export async function getBlackjackGame(env, company, gameId) {
  const game = await env.DB.prepare(
    'SELECT * FROM blackjack_games WHERE id = ? AND company_id = ?'
  ).bind(gameId, company.id).first();

  if (!game) throw new Error('Game not found');

  const playerHand = JSON.parse(game.player_hand);
  const dealerHand = JSON.parse(game.dealer_hand);
  const playerValue = calculateHandValue(playerHand);

  return {
    gameId: game.id,
    playerHand,
    dealerHand: game.state === GameState.FINISHED ? dealerHand : [dealerHand[0], { hidden: true }],
    playerValue,
    dealerValue: game.state === GameState.FINISHED ? calculateHandValue(dealerHand) : getCardValue(dealerHand[0]),
    state: game.state,
    result: game.result,
    payout: game.state === GameState.FINISHED ? game.payout : null,
    canDouble: game.state === GameState.PLAYER_TURN && playerHand.length === 2,
    betAmount: game.bet_amount,
  };
}
