// worker/src/routes/game/social.js
// Social features: Message boards, Temple donations, Casino roulette

import { moderateMessage } from './moderation.js';

// ==================== MESSAGE BOARD ====================

// Get messages for a map (paginated)
export async function getMessages(env, mapId, page = 1) {
  const limit = 50;
  const offset = (page - 1) * limit;

  const messages = await env.DB.prepare(`
    SELECT m.*, c.name as company_name
    FROM messages m
    JOIN game_companies c ON m.company_id = c.id
    WHERE m.map_id = ?
    ORDER BY m.created_at DESC
    LIMIT ? OFFSET ?
  `).bind(mapId, limit, offset).all();

  return messages.results;
}

// Post a new message (with moderation from Stage 14a)
export async function postMessage(env, company, content) {
  if (company.in_prison) {
    throw new Error('Cannot post messages while in prison');
  }

  if (!content || content.trim().length === 0) {
    throw new Error('Message cannot be empty');
  }

  if (content.length > 500) {
    throw new Error('Message too long (max 500 characters)');
  }

  // Rate limit: 20 messages per minute, then 2-minute cooldown
  const now = Date.now();
  const oneMinuteAgo = new Date(now - 60000).toISOString();

  const recentMessages = await env.DB.prepare(`
    SELECT created_at FROM messages
    WHERE company_id = ? AND created_at > ?
    ORDER BY created_at DESC
  `).bind(company.id, oneMinuteAgo).all();

  if (recentMessages.results.length >= 20) {
    // User hit the limit - enforce 2-minute cooldown from last message
    const lastTime = new Date(recentMessages.results[0].created_at).getTime();
    const timeSinceLast = now - lastTime;
    const cooldownMs = 120000; // 2 minutes

    if (timeSinceLast < cooldownMs) {
      const secondsLeft = Math.ceil((cooldownMs - timeSinceLast) / 1000);
      throw new Error(`Rate limit exceeded. Please wait ${secondsLeft} seconds before posting again`);
    }
  }

  // === AI MODERATION (Stage 14a) ===
  const moderation = await moderateMessage(env, company.id, content.trim());
  if (!moderation.allowed) {
    throw new Error(moderation.reason || 'Message was rejected by moderation');
  }
  // Use censored version if provided, otherwise use original
  const finalContent = moderation.censored || content.trim();
  // === END MODERATION ===

  await env.DB.prepare(`
    INSERT INTO messages (id, map_id, company_id, content)
    VALUES (?, ?, ?, ?)
  `).bind(crypto.randomUUID(), company.current_map_id, company.id, finalContent).run();

  return { success: true };
}

// Get unread message count for current map
export async function getUnreadCount(env, company) {
  const result = await env.DB.prepare(`
    SELECT COUNT(*) as count
    FROM messages m
    LEFT JOIN message_read_status mrs
      ON mrs.company_id = ? AND mrs.map_id = m.map_id
    WHERE m.map_id = ?
      AND m.company_id != ?
      AND (mrs.last_read_at IS NULL OR m.created_at > mrs.last_read_at)
  `).bind(company.id, company.current_map_id, company.id).first();

  return { unread_count: result?.count || 0 };
}

// Mark messages as read (called when viewing message board)
export async function markMessagesAsRead(env, company) {
  await env.DB.prepare(`
    INSERT INTO message_read_status (company_id, map_id, last_read_at)
    VALUES (?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT (company_id, map_id)
    DO UPDATE SET last_read_at = CURRENT_TIMESTAMP
  `).bind(company.id, company.current_map_id).run();

  return { success: true };
}

// ==================== TEMPLE DONATIONS ====================

export async function donate(env, company, amount) {
  if (company.in_prison) {
    throw new Error('Cannot donate while in prison');
  }

  if (amount <= 0) throw new Error('Invalid amount');
  if (amount > company.cash) throw new Error('Insufficient funds');

  await env.DB.batch([
    // Deduct cash
    // NOTE: Does NOT reset ticks_since_action - temple donations are not strategic actions
    env.DB.prepare(
      'UPDATE game_companies SET cash = cash - ? WHERE id = ?'
    ).bind(amount, company.id),

    // Log donation
    env.DB.prepare(`
      INSERT INTO donations (id, company_id, amount)
      VALUES (?, ?, ?)
    `).bind(crypto.randomUUID(), company.id, amount),

    // Log transaction
    env.DB.prepare(`
      INSERT INTO game_transactions (id, company_id, action_type, amount)
      VALUES (?, ?, 'temple_donation', ?)
    `).bind(crypto.randomUUID(), company.id, amount),
  ]);

  return { success: true, amount };
}

export async function getDonationLeaderboard(env) {
  const leaderboard = await env.DB.prepare(`
    SELECT c.name, SUM(d.amount) as total_donated
    FROM donations d
    JOIN game_companies c ON d.company_id = c.id
    GROUP BY d.company_id
    ORDER BY total_donated DESC
    LIMIT 20
  `).all();

  return leaderboard.results;
}

// ==================== CASINO ROULETTE ====================

const MAX_BET = 10000;

const ROULETTE_PAYOUTS = {
  straight: 35, // Single number
  red: 1,
  black: 1,
  odd: 1,
  even: 1,
  low: 1,  // 1-18
  high: 1, // 19-36
};

const RED_NUMBERS = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36];

export async function playRoulette(env, company, bet_amount, bet_type, bet_value) {
  if (company.in_prison) {
    throw new Error('Cannot gamble while in prison');
  }

  if (bet_amount <= 0) throw new Error('Invalid bet amount');
  if (bet_amount > MAX_BET) throw new Error(`Maximum bet is $${MAX_BET.toLocaleString()}`);
  if (bet_amount > company.cash) throw new Error('Insufficient funds');

  // Spin the wheel (0-36)
  const result = Math.floor(Math.random() * 37);

  // Determine win
  let won = false;
  let payout = 0;

  switch (bet_type) {
    case 'straight':
      won = result === parseInt(bet_value);
      break;
    case 'red':
      won = RED_NUMBERS.includes(result);
      break;
    case 'black':
      won = result !== 0 && !RED_NUMBERS.includes(result);
      break;
    case 'odd':
      won = result !== 0 && result % 2 === 1;
      break;
    case 'even':
      won = result !== 0 && result % 2 === 0;
      break;
    case 'low':
      won = result >= 1 && result <= 18;
      break;
    case 'high':
      won = result >= 19 && result <= 36;
      break;
    default:
      throw new Error('Invalid bet type');
  }

  if (won) {
    payout = bet_amount * (ROULETTE_PAYOUTS[bet_type] + 1);
  }

  const netResult = won ? payout - bet_amount : -bet_amount;

  await env.DB.batch([
    // Update cash (win or loss)
    // NOTE: Does NOT reset ticks_since_action - casino gambling is not a strategic action
    env.DB.prepare(
      'UPDATE game_companies SET cash = cash + ? WHERE id = ?'
    ).bind(netResult, company.id),

    // Log game
    env.DB.prepare(`
      INSERT INTO casino_games (id, company_id, game_type, bet_amount, bet_type, bet_value, result, won, payout)
      VALUES (?, ?, 'roulette', ?, ?, ?, ?, ?, ?)
    `).bind(
      crypto.randomUUID(),
      company.id,
      bet_amount,
      bet_type,
      bet_value || null,
      result,
      won ? 1 : 0,
      payout
    ),
  ]);

  return {
    result,
    won,
    payout,
    new_balance: company.cash + netResult,
  };
}
