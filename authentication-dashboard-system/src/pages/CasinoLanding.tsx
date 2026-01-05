import { Navigate, useNavigate } from 'react-router-dom';
import { ArrowLeft, Dices } from 'lucide-react';
import { useActiveCompany } from '../contexts/CompanyContext';

export function CasinoLanding(): JSX.Element {
  const { activeCompany } = useActiveCompany();
  const navigate = useNavigate();

  if (!activeCompany) {
    return <Navigate to="/companies" replace />;
  }

  return (
    <div className="min-h-screen bg-gray-900 p-6">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <button
            onClick={() => navigate(`/map/${activeCompany.current_map_id}`)}
            className="flex items-center gap-2 text-neutral-400 hover:text-white"
          >
            <ArrowLeft className="w-5 h-5" />
            Back to Map
          </button>
        </div>

        {/* Title */}
        <div className="text-center mb-12">
          <Dices className="w-16 h-16 text-amber-500 mx-auto mb-4" />
          <h1 className="text-4xl font-bold text-white mb-2">Casino</h1>
          <p className="text-gray-400">Choose your game</p>
        </div>

        {/* Game Selection */}
        <div className="grid gap-6">
          <button
            onClick={() => navigate('/casino/roulette')}
            className="p-8 bg-gradient-to-br from-red-900/50 to-gray-800 rounded-xl border border-red-700/50 hover:border-red-500 transition-all hover:scale-[1.02] group"
          >
            <div className="text-6xl mb-4">🎰</div>
            <h2 className="text-2xl font-bold text-white mb-2">Roulette</h2>
            <p className="text-gray-400">Spin the wheel and bet on your lucky number</p>
            <div className="mt-4 text-sm text-amber-400">Up to 36x payout</div>
          </button>

          <button
            onClick={() => navigate('/casino/blackjack')}
            className="p-8 bg-gradient-to-br from-green-900/50 to-gray-800 rounded-xl border border-green-700/50 hover:border-green-500 transition-all hover:scale-[1.02] group"
          >
            <div className="text-6xl mb-4">🃏</div>
            <h2 className="text-2xl font-bold text-white mb-2">Blackjack</h2>
            <p className="text-gray-400">Beat the dealer to 21</p>
            <div className="mt-4 text-sm text-amber-400">Up to 2.5x payout</div>
          </button>
        </div>

        {/* Balance */}
        <div className="mt-8 bg-gray-800 rounded-lg p-4 text-center border border-gray-700">
          <p className="text-gray-400 text-sm">Your Cash</p>
          <p className="text-2xl font-mono text-green-400">
            ${activeCompany.cash.toLocaleString()}
          </p>
        </div>
      </div>
    </div>
  );
}

export default CasinoLanding;
