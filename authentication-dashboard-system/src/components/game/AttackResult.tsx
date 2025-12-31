import { X, CheckCircle, AlertCircle, Flame, TrendingDown } from 'lucide-react';
import { DIRTY_TRICKS, type TrickType } from '../../utils/dirtyTricks';

interface AttackResultProps {
  isOpen: boolean;
  onClose: () => void;
  result: {
    success: boolean;
    damage_dealt: number;
    total_damage: number;
    was_caught: boolean;
    caught_by: string | null;
    fine_amount: number;
    building_collapsed: boolean;
    set_fire: boolean;
    security_active: boolean;
    police_active: boolean;
    police_strike: boolean;
    trick_type?: TrickType;
  } | null;
}

export function AttackResult({ isOpen, onClose, result }: AttackResultProps) {
  if (!isOpen || !result) return null;

  const trickType = result.trick_type || 'graffiti';
  const trick = DIRTY_TRICKS[trickType];

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-gray-800 rounded-lg p-6 w-full max-w-md border border-gray-700">
        {/* Header */}
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold text-white">
            {result.was_caught ? '🚨 Caught!' : '✅ Success!'}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Result Content */}
        <div className="space-y-4">
          {/* Attack Summary */}
          <div
            className={`p-4 rounded-lg border ${
              result.was_caught
                ? 'bg-red-900/20 border-red-800'
                : 'bg-green-900/20 border-green-800'
            }`}
          >
            <div className="flex items-center gap-3 mb-3">
              <span className="text-4xl">{trick?.icon || '💥'}</span>
              <div>
                <p className="font-bold text-white text-lg">{trick?.name || 'Attack'}</p>
                <p className="text-sm text-gray-400">
                  {result.was_caught ? 'You were caught!' : 'You escaped!'}
                </p>
              </div>
            </div>

            {/* Damage Stats */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-gray-400 text-sm flex items-center gap-1">
                  <TrendingDown className="w-4 h-4" />
                  Damage Dealt:
                </span>
                <span className="text-red-400 font-bold">{result.damage_dealt}%</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-400 text-sm">Total Building Damage:</span>
                <span className="text-orange-400 font-bold">{result.total_damage}%</span>
              </div>
            </div>

            {/* Fire Indicator */}
            {result.set_fire && (
              <div className="mt-3 p-2 bg-orange-900/30 rounded border border-orange-700">
                <p className="text-orange-400 text-sm font-bold flex items-center gap-2">
                  <Flame className="w-4 h-4" />
                  Building is on fire! Fire will spread on the next tick.
                </p>
              </div>
            )}

            {/* Collapse Indicator */}
            {result.building_collapsed && (
              <div className="mt-3 p-2 bg-red-900/30 rounded border border-red-700">
                <p className="text-red-400 text-sm font-bold flex items-center gap-2">
                  <AlertCircle className="w-4 h-4" />
                  Building has collapsed!
                </p>
              </div>
            )}
          </div>

          {/* Caught Details */}
          {result.was_caught && (
            <div className="p-4 bg-gray-700 rounded-lg">
              <div className="mb-3">
                <p className="text-red-400 font-bold flex items-center gap-2 mb-2">
                  <AlertCircle className="w-5 h-5" />
                  Caught by {result.caught_by === 'security' ? 'Security Systems' : 'Police'}
                </p>
                <p className="text-sm text-gray-400">
                  {result.caught_by === 'security'
                    ? 'The building\'s security systems detected your attack!'
                    : 'The police caught you in the act!'}
                </p>
              </div>

              <div className="p-3 bg-gray-800 rounded">
                <div className="flex items-center justify-between">
                  <span className="text-gray-400">Fine Amount:</span>
                  <span className="text-red-400 font-mono font-bold text-xl">
                    ${result.fine_amount.toLocaleString()}
                  </span>
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  You are now in prison. Pay the fine to continue playing.
                </p>
              </div>
            </div>
          )}

          {/* Success Details */}
          {!result.was_caught && (
            <div className="p-4 bg-green-900/20 rounded-lg border border-green-800">
              <p className="text-green-400 font-bold flex items-center gap-2 mb-2">
                <CheckCircle className="w-5 h-5" />
                Attack Successful!
              </p>
              <p className="text-sm text-gray-400">
                You successfully executed the attack and escaped undetected!
              </p>
            </div>
          )}

          {/* Close Button */}
          <button
            onClick={onClose}
            className={`w-full py-3 rounded font-bold transition-colors ${
              result.was_caught
                ? 'bg-red-600 hover:bg-red-500 text-white'
                : 'bg-green-600 hover:bg-green-500 text-white'
            }`}
          >
            {result.was_caught ? 'Go to Prison' : 'Continue'}
          </button>
        </div>
      </div>
    </div>
  );
}
