import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { ArrowLeft, AlertCircle } from 'lucide-react';
import { useActiveCompany } from '../contexts/CompanyContext';
import { api, apiHelpers } from '../services/api';
import { GameSelector } from '../components/GameSelector';

interface Card {
  suit: string;
  value: string;
  hidden?: boolean;
}

interface GameState {
  gameId: string;
  playerHand: Card[];
  dealerHand: Card[];
  playerValue: number;
  dealerValue: number;
  state: 'betting' | 'player_turn' | 'dealer_turn' | 'finished';
  result: string | null;
  payout: number | null;
  canDouble: boolean;
  betAmount?: number;
  new_balance?: number;
}

const SUIT_SYMBOLS: Record<string, string> = {
  hearts: '♥',
  diamonds: '♦',
  clubs: '♣',
  spades: '♠',
};

const SUIT_COLORS: Record<string, string> = {
  hearts: 'text-red-500',
  diamonds: 'text-red-500',
  clubs: 'text-gray-900',
  spades: 'text-gray-900',
};

function PlayingCard({ card, delay = 0 }: { card: Card; delay?: number }): JSX.Element {
  if (card.hidden) {
    return (
      <div
        className="w-16 h-24 sm:w-20 sm:h-28 rounded-lg bg-gradient-to-br from-blue-800 to-blue-900 border-2 border-blue-600 shadow-lg flex items-center justify-center"
        style={{ animationDelay: `${delay}ms` }}
      >
        <div className="w-12 h-18 sm:w-14 sm:h-20 rounded border border-blue-500 bg-blue-700/50 flex items-center justify-center">
          <span className="text-2xl sm:text-3xl text-blue-300">?</span>
        </div>
      </div>
    );
  }

  const suitSymbol = SUIT_SYMBOLS[card.suit];
  const colorClass = SUIT_COLORS[card.suit];

  return (
    <div
      className="w-16 h-24 sm:w-20 sm:h-28 rounded-lg bg-white border border-gray-300 shadow-lg flex flex-col p-1 sm:p-1.5 animate-deal"
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className={`text-xs sm:text-sm font-bold ${colorClass}`}>
        {card.value}
        <span className="ml-0.5">{suitSymbol}</span>
      </div>
      <div className={`flex-1 flex items-center justify-center text-2xl sm:text-4xl ${colorClass}`}>
        {suitSymbol}
      </div>
      <div className={`text-xs sm:text-sm font-bold ${colorClass} rotate-180`}>
        {card.value}
        <span className="ml-0.5">{suitSymbol}</span>
      </div>
    </div>
  );
}

function Hand({
  cards,
  label,
  value,
  isDealer = false,
}: {
  cards: Card[];
  label: string;
  value: number;
  isDealer?: boolean;
}): JSX.Element {
  return (
    <div className="text-center mb-4">
      <div className="text-gray-400 text-sm mb-2">
        {label}: <span className="text-white font-bold">{value}</span>
      </div>
      <div className="flex justify-center gap-2 flex-wrap">
        {cards.map((card, i) => (
          <PlayingCard key={i} card={card} delay={isDealer ? i * 100 : i * 100 + 200} />
        ))}
      </div>
    </div>
  );
}

const RESULT_MESSAGES: Record<string, { text: string; color: string }> = {
  blackjack: { text: 'BLACKJACK! 🎉', color: 'text-yellow-400' },
  win: { text: 'You Win!', color: 'text-green-400' },
  dealer_bust: { text: 'Dealer Busts! You Win!', color: 'text-green-400' },
  lose: { text: 'Dealer Wins', color: 'text-red-400' },
  dealer_blackjack: { text: 'Dealer Blackjack', color: 'text-red-400' },
  bust: { text: 'Bust!', color: 'text-red-400' },
  push: { text: 'Push - Bet Returned', color: 'text-yellow-400' },
};

export function Blackjack(): JSX.Element {
  const { activeCompany, setActiveCompany } = useActiveCompany();
  const navigate = useNavigate();
  const [betAmount, setBetAmount] = useState('1000');
  const [game, setGame] = useState<GameState | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const updateBalance = (newBalance: number | undefined) => {
    if (activeCompany && newBalance !== undefined) {
      setActiveCompany({
        ...activeCompany,
        cash: newBalance,
      });
    }
  };

  const handleDeal = async () => {
    if (!activeCompany) return;

    const amount = parseInt(betAmount);
    if (isNaN(amount) || amount <= 0) {
      setError('Please enter a valid bet amount');
      return;
    }

    if (amount > 10000) {
      setError('Maximum bet is $10,000');
      return;
    }

    if (amount > activeCompany.cash) {
      setError('Insufficient funds');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await api.post('/api/game/casino/blackjack/start', {
        company_id: activeCompany.id,
        bet_amount: amount,
      });

      if (response.data.success) {
        setGame(response.data.data);
        updateBalance(response.data.data.new_balance);
      } else {
        setError(response.data.error || 'Failed to start game');
      }
    } catch (err) {
      setError(apiHelpers.handleError(err));
    } finally {
      setLoading(false);
    }
  };

  const handleHit = async () => {
    if (!game) return;
    setLoading(true);
    setError(null);

    try {
      const response = await api.post('/api/game/casino/blackjack/hit', {
        company_id: activeCompany?.id,
        game_id: game.gameId,
      });

      if (response.data.success) {
        setGame(response.data.data);
        if (response.data.data.state === 'finished') {
          updateBalance(response.data.data.new_balance);
        }
      } else {
        setError(response.data.error || 'Failed to hit');
      }
    } catch (err) {
      setError(apiHelpers.handleError(err));
    } finally {
      setLoading(false);
    }
  };

  const handleStand = async () => {
    if (!game) return;
    setLoading(true);
    setError(null);

    try {
      const response = await api.post('/api/game/casino/blackjack/stand', {
        company_id: activeCompany?.id,
        game_id: game.gameId,
      });

      if (response.data.success) {
        setGame(response.data.data);
        updateBalance(response.data.data.new_balance);
      } else {
        setError(response.data.error || 'Failed to stand');
      }
    } catch (err) {
      setError(apiHelpers.handleError(err));
    } finally {
      setLoading(false);
    }
  };

  const handleDouble = async () => {
    if (!game) return;
    setLoading(true);
    setError(null);

    try {
      const response = await api.post('/api/game/casino/blackjack/double', {
        company_id: activeCompany?.id,
        game_id: game.gameId,
      });

      if (response.data.success) {
        setGame(response.data.data);
        updateBalance(response.data.data.new_balance);
      } else {
        setError(response.data.error || 'Failed to double');
      }
    } catch (err) {
      setError(apiHelpers.handleError(err));
    } finally {
      setLoading(false);
    }
  };

  const handleNewGame = () => {
    setGame(null);
    setError(null);
  };

  if (!activeCompany) {
    return <Navigate to="/companies" replace />;
  }

  const betValue = parseInt(betAmount || '0');
  const resultInfo = game?.result ? RESULT_MESSAGES[game.result] : null;

  return (
    <div className="min-h-screen bg-gray-900 p-4 sm:p-6">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <button
            onClick={() => navigate(`/companies/${activeCompany.id}`)}
            className="flex items-center gap-2 text-neutral-400 hover:text-white"
          >
            <ArrowLeft className="w-5 h-5" />
            Back
          </button>
          <GameSelector />
        </div>
        <p className="text-center text-gray-500 text-sm mb-4">Max bet: $10,000 • Blackjack pays 3:2</p>

        {/* Prison Warning */}
        {activeCompany.is_in_prison && (
          <div className="p-4 bg-red-900/30 rounded-lg border border-red-700 mb-6 flex items-start gap-3">
            <AlertCircle className="w-6 h-6 text-red-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-red-400 font-bold">Cannot Gamble</p>
              <p className="text-red-300 text-sm">
                Your company is in prison. You cannot gamble until you pay your fine.
              </p>
            </div>
          </div>
        )}

        {/* Balance */}
        <div className="bg-gray-800 rounded-lg p-4 mb-4 sm:mb-6 text-center border border-gray-700">
          <p className="text-gray-400 text-sm">Your Cash</p>
          <p className="text-2xl sm:text-3xl font-mono text-green-400">
            ${activeCompany.cash.toLocaleString()}
          </p>
        </div>

        {/* Game Table */}
        <div className="bg-gradient-to-b from-green-900 to-green-950 rounded-xl p-4 sm:p-6 mb-4 sm:mb-6 border-4 border-amber-800 shadow-2xl min-h-[300px] sm:min-h-[350px]">
          {!game ? (
            // Betting Phase
            <div className="flex flex-col items-center justify-center h-full py-8">
              <div className="text-6xl sm:text-8xl mb-4">🃏</div>
              <p className="text-green-200 text-lg mb-6">Place your bet to begin</p>
            </div>
          ) : (
            // Game in progress
            <>
              {/* Dealer Hand */}
              <Hand
                cards={game.dealerHand}
                label="Dealer"
                value={game.dealerValue}
                isDealer
              />

              {/* Divider */}
              <div className="border-t border-green-700 my-4" />

              {/* Player Hand */}
              <Hand cards={game.playerHand} label="You" value={game.playerValue} />

              {/* Result */}
              {game.state === 'finished' && resultInfo && (
                <div className="text-center mt-4">
                  <p className={`text-2xl font-bold ${resultInfo.color}`}>{resultInfo.text}</p>
                  {game.payout !== null && game.payout > 0 && (
                    <p className="text-green-400 text-lg mt-1">
                      Won ${game.payout.toLocaleString()}
                    </p>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        {/* Controls */}
        {!activeCompany.is_in_prison && (
          <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
            {!game ? (
              // Betting controls
              <>
                <div className="mb-4">
                  <label className="block text-gray-400 text-sm mb-2">Bet Amount</label>
                  <input
                    type="number"
                    value={betAmount}
                    onChange={(e) => setBetAmount(e.target.value)}
                    min="1"
                    max="10000"
                    className="w-full p-3 bg-gray-700 text-white rounded focus:outline-none focus:ring-2 focus:ring-green-500"
                    disabled={loading}
                  />
                </div>

                {error && <p className="text-red-400 text-sm mb-4">{error}</p>}

                <button
                  onClick={handleDeal}
                  disabled={loading || betValue > activeCompany.cash || betValue <= 0}
                  className="w-full py-4 bg-green-600 text-white font-bold rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed text-lg"
                >
                  {loading ? 'Dealing...' : 'Deal'}
                </button>
              </>
            ) : game.state === 'player_turn' ? (
              // Game controls
              <>
                {error && <p className="text-red-400 text-sm mb-4">{error}</p>}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <button
                    onClick={handleHit}
                    disabled={loading}
                    className="py-4 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-lg"
                  >
                    Hit
                  </button>
                  <button
                    onClick={handleStand}
                    disabled={loading}
                    className="py-4 bg-yellow-600 text-white font-bold rounded-lg hover:bg-yellow-700 disabled:opacity-50 disabled:cursor-not-allowed text-lg"
                  >
                    Stand
                  </button>
                  {game.canDouble && (
                    <button
                      onClick={handleDouble}
                      disabled={loading}
                      className="py-4 bg-purple-600 text-white font-bold rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed text-lg col-span-2 sm:col-span-1"
                    >
                      Double
                    </button>
                  )}
                </div>
              </>
            ) : (
              // Game finished
              <button
                onClick={handleNewGame}
                className="w-full py-4 bg-green-600 text-white font-bold rounded-lg hover:bg-green-700 text-lg"
              >
                New Game
              </button>
            )}
          </div>
        )}

        {/* Rules */}
        <div className="bg-gray-800 rounded-lg p-4 border border-gray-700 mt-4 sm:mt-6">
          <h3 className="font-bold text-white mb-3">Rules</h3>
          <ul className="text-sm text-gray-400 space-y-1">
            <li>• Dealer stands on 17</li>
            <li>• Blackjack pays 3:2</li>
            <li>• Double down on first two cards only</li>
            <li>• Push returns your bet</li>
          </ul>
        </div>
      </div>

      <style>{`
        @keyframes deal {
          from {
            opacity: 0;
            transform: translateY(-20px) rotate(-5deg);
          }
          to {
            opacity: 1;
            transform: translateY(0) rotate(0);
          }
        }
        .animate-deal {
          animation: deal 0.3s ease-out forwards;
        }
      `}</style>
    </div>
  );
}

export default Blackjack;
