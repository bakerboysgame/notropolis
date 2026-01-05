import { useState, useRef } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { ArrowLeft, Dice6, AlertCircle } from 'lucide-react';
import { useActiveCompany } from '../contexts/CompanyContext';
import { api, apiHelpers } from '../services/api';
import { Wheel } from 'react-custom-roulette';

const RED_NUMBERS = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36];

// European roulette wheel order
const WHEEL_ORDER = [
  0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10,
  5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26
];

// Create wheel data with proper colors
const wheelData = WHEEL_ORDER.map((num) => ({
  option: String(num),
  style: {
    backgroundColor: num === 0 ? '#16a34a' : RED_NUMBERS.includes(num) ? '#dc2626' : '#1f2937',
    textColor: 'white',
  },
}));

interface SpinResult {
  result: number;
  won: boolean;
  payout: number;
  new_balance: number;
}

type BetType = 'red' | 'black' | 'odd' | 'even' | 'low' | 'high' | 'straight';

const BET_LABELS: Record<BetType, string> = {
  red: 'Red',
  black: 'Black',
  odd: 'Odd',
  even: 'Even',
  low: 'Low (1-18)',
  high: 'High (19-36)',
  straight: 'Straight',
};

function getNumberColor(num: number): 'red' | 'black' | 'green' {
  if (num === 0) return 'green';
  return RED_NUMBERS.includes(num) ? 'red' : 'black';
}

export function Casino(): JSX.Element {
  const { activeCompany, setActiveCompany } = useActiveCompany();
  const navigate = useNavigate();
  const [betAmount, setBetAmount] = useState('1000');
  const [betType, setBetType] = useState<BetType>('red');
  const [straightNumber, setStraightNumber] = useState<number>(0);
  const [mustSpin, setMustSpin] = useState(false);
  const [prizeNumber, setPrizeNumber] = useState(0);
  const [lastResult, setLastResult] = useState<SpinResult | null>(null);
  const [showResult, setShowResult] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pendingResultRef = useRef<SpinResult | null>(null);

  const handleSpinComplete = async () => {
    setMustSpin(false);
    setShowResult(true);

    if (pendingResultRef.current) {
      setLastResult(pendingResultRef.current);
      pendingResultRef.current = null;

      // Update active company with new cash balance
      if (activeCompany) {
        try {
          const companyResponse = await api.get(`/api/game/companies/${activeCompany.id}`);
          if (companyResponse.data.success && companyResponse.data.company) {
            setActiveCompany(companyResponse.data.company);
          }
        } catch {
          // Silently fail - balance will update on next action
        }
      }
    }
  };

  const handleSpin = async () => {
    if (!activeCompany || mustSpin) return;

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

    setError(null);
    setShowResult(false);
    setLastResult(null);

    try {
      const response = await api.post('/api/game/casino/roulette', {
        company_id: activeCompany.id,
        bet_amount: amount,
        bet_type: betType,
        ...(betType === 'straight' && { bet_value: straightNumber }),
      });

      if (response.data.success) {
        // Store the result and trigger wheel animation
        pendingResultRef.current = response.data.data;
        // Find the index of the result in the wheel order
        const resultIndex = WHEEL_ORDER.indexOf(response.data.data.result);
        setPrizeNumber(resultIndex);
        setMustSpin(true);
      } else {
        setError(response.data.error || 'Spin failed');
      }
    } catch (err) {
      setError(apiHelpers.handleError(err));
    }
  };

  // Redirect if no active company
  if (!activeCompany) {
    return <Navigate to="/companies" replace />;
  }

  const betValue = parseInt(betAmount || '0');
  const resultColor = lastResult ? getNumberColor(lastResult.result) : null;

  return (
    <div className="min-h-screen bg-gray-900 p-6">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <button
            onClick={() => navigate(`/companies/${activeCompany.id}`)}
            className="flex items-center gap-2 text-neutral-400 hover:text-white mb-4"
          >
            <ArrowLeft className="w-5 h-5" />
            Back to {activeCompany.name}
          </button>
        </div>

        {/* Game Selector */}
        <div className="flex justify-center gap-2 mb-6">
          <button
            className="px-4 py-2 bg-yellow-600 text-white rounded-lg font-medium"
          >
            Roulette
          </button>
          <button
            onClick={() => navigate('/blackjack')}
            className="px-4 py-2 bg-gray-700 text-gray-300 rounded-lg font-medium hover:bg-gray-600"
          >
            Blackjack
          </button>
        </div>

        {/* Casino Banner */}
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold text-white mb-2">Roulette</h1>
          <p className="text-gray-400">Max bet: $10,000</p>
        </div>

        {/* Roulette Wheel */}
        <div className="flex justify-center mb-6">
          <Wheel
            mustStartSpinning={mustSpin}
            prizeNumber={prizeNumber}
            data={wheelData}
            onStopSpinning={handleSpinComplete}
            backgroundColors={['#dc2626', '#1f2937']}
            textColors={['white']}
            outerBorderColor="#d4a574"
            outerBorderWidth={8}
            innerBorderColor="#2d1810"
            innerBorderWidth={15}
            innerRadius={20}
            radiusLineColor="#d4a574"
            radiusLineWidth={1}
            fontSize={12}
            spinDuration={0.5}
          />
        </div>

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
        <div className="bg-gray-800 rounded-lg p-4 mb-6 text-center border border-gray-700">
          <p className="text-gray-400 text-sm">Your Cash</p>
          <p className="text-3xl font-mono text-green-400">
            ${activeCompany.cash.toLocaleString()}
          </p>
        </div>

        {/* Last result */}
        {showResult && lastResult && (
          <div
            className={`rounded-lg p-6 mb-6 text-center border ${
              lastResult.won
                ? 'bg-green-900/30 border-green-700'
                : 'bg-red-900/30 border-red-700'
            }`}
          >
            <div className="flex items-center justify-center gap-4 mb-2">
              <div
                className={`w-16 h-16 rounded-full flex items-center justify-center text-2xl font-bold text-white ${
                  resultColor === 'red'
                    ? 'bg-red-600'
                    : resultColor === 'black'
                    ? 'bg-gray-800 border-2 border-gray-600'
                    : 'bg-green-600'
                }`}
              >
                {lastResult.result}
              </div>
            </div>
            <p
              className={`text-xl font-bold ${
                lastResult.won ? 'text-green-400' : 'text-red-400'
              }`}
            >
              {lastResult.won
                ? `Won $${lastResult.payout.toLocaleString()}!`
                : 'Lost'}
            </p>
          </div>
        )}

        {/* Betting */}
        {!activeCompany.is_in_prison && (
          <div className="bg-gray-800 rounded-lg p-4 mb-6 border border-gray-700">
            <div className="mb-4">
              <label className="block text-gray-400 text-sm mb-2">Bet Amount <span className="text-gray-500">(max 9,999 per bet)</span></label>
              <input
                type="number"
                value={betAmount}
                onChange={(e) => setBetAmount(e.target.value)}
                min="1"
                max="10000"
                className="w-full p-3 bg-gray-700 text-white rounded focus:outline-none focus:ring-2 focus:ring-yellow-500"
              />
            </div>

            <div className="mb-4">
              <label className="block text-gray-400 text-sm mb-2">Bet Type</label>
              <div className="grid grid-cols-3 gap-2">
                {(['red', 'black', 'odd', 'even', 'low', 'high'] as BetType[]).map((type) => (
                  <button
                    key={type}
                    onClick={() => setBetType(type)}
                    className={`p-3 rounded text-sm font-medium transition-colors ${
                      betType === type
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                    } ${
                      type === 'red'
                        ? 'border-2 border-red-500'
                        : type === 'black'
                        ? 'border-2 border-gray-500'
                        : ''
                    }`}
                  >
                    {BET_LABELS[type]}
                  </button>
                ))}
              </div>
              <button
                onClick={() => setBetType('straight')}
                className={`w-full mt-2 p-3 rounded text-sm font-medium transition-colors border-2 border-green-600 ${
                  betType === 'straight'
                    ? 'bg-green-600 text-white'
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
              >
                Straight (Single Number) - 36x Payout
              </button>
            </div>

            {/* Number selector for straight bets */}
            {betType === 'straight' && (
              <div className="mb-4">
                <label className="block text-gray-400 text-sm mb-2">Select Number (0-36)</label>
                <div className="grid grid-cols-10 gap-1">
                  {Array.from({ length: 37 }, (_, i) => i).map((num) => (
                    <button
                      key={num}
                      onClick={() => setStraightNumber(num)}
                      className={`p-2 rounded text-xs font-bold transition-colors ${
                        straightNumber === num
                          ? 'ring-2 ring-yellow-400 ring-offset-1 ring-offset-gray-800'
                          : ''
                      } ${
                        num === 0
                          ? 'bg-green-600 text-white hover:bg-green-500'
                          : RED_NUMBERS.includes(num)
                          ? 'bg-red-600 text-white hover:bg-red-500'
                          : 'bg-gray-800 text-white hover:bg-gray-700 border border-gray-600'
                      }`}
                    >
                      {num}
                    </button>
                  ))}
                </div>
                <p className="text-center text-gray-400 text-sm mt-2">
                  Selected: <span className={`font-bold ${
                    straightNumber === 0
                      ? 'text-green-400'
                      : RED_NUMBERS.includes(straightNumber)
                      ? 'text-red-400'
                      : 'text-gray-300'
                  }`}>{straightNumber}</span>
                </p>
              </div>
            )}

            {error && <p className="text-red-400 text-sm mb-4">{error}</p>}

            <button
              onClick={handleSpin}
              disabled={mustSpin || betValue > activeCompany.cash || betValue <= 0}
              className="w-full py-4 bg-yellow-600 text-white font-bold rounded-lg hover:bg-yellow-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-lg"
            >
              <Dice6 className="w-6 h-6" />
              {mustSpin ? 'Spinning...' : 'Spin!'}
            </button>
          </div>
        )}

        {/* Payout Info */}
        <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
          <h3 className="font-bold text-white mb-3">Payouts</h3>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div className="flex justify-between text-gray-400">
              <span>Red/Black</span>
              <span className="text-white">2x</span>
            </div>
            <div className="flex justify-between text-gray-400">
              <span>Odd/Even</span>
              <span className="text-white">2x</span>
            </div>
            <div className="flex justify-between text-gray-400">
              <span>Low/High</span>
              <span className="text-white">2x</span>
            </div>
            <div className="flex justify-between text-gray-400">
              <span>Straight</span>
              <span className="text-white">36x</span>
            </div>
          </div>
          <p className="text-xs text-gray-500 mt-3">
            Note: 0 is green and loses all outside bets (red/black, odd/even, low/high)
          </p>
        </div>
      </div>
    </div>
  );
}

export default Casino;
