import { useState } from 'react';
import {
  Trophy,
  Building2,
  DollarSign,
  ArrowRight,
  AlertTriangle,
  X,
  Loader2,
  CheckCircle,
} from 'lucide-react';
import {
  formatHeroAmount,
  getLocationDisplayName,
  calculateHeroSummary,
  type HeroProgress,
} from '../../utils/heroRequirements';

interface HeroModalProps {
  companyId: string;
  locationType: 'town' | 'city' | 'capital';
  progress: HeroProgress;
  buildings: Array<{ id: string; name: string; cost: number }>;
  currentCash: number;
  onClose: () => void;
  onSuccess: () => void;
}

export function HeroModal({
  companyId,
  locationType,
  progress,
  buildings,
  currentCash,
  onClose,
  onSuccess,
}: HeroModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [result, setResult] = useState<{
    total_to_offshore: number;
    buildings_sold: number;
    unlocks: string | null;
  } | null>(null);

  const summary = calculateHeroSummary(
    buildings,
    currentCash,
    progress.requirements.unlocks
  );

  const handleHeroOut = async () => {
    setIsSubmitting(true);
    setError(null);

    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch('https://api.notropolis.net/api/game/hero/hero-out', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ company_id: companyId }),
      });

      const data = await response.json();

      if (data.success) {
        setSuccess(true);
        setResult(data);
      } else {
        setError(data.error || 'Failed to hero out');
      }
    } catch (err) {
      setError('Failed to connect to server');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Success state
  if (success && result) {
    return (
      <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
        <div className="bg-neutral-800 rounded-lg p-8 max-w-md w-full text-center">
          <div className="w-20 h-20 bg-gradient-to-br from-purple-500 to-purple-700 rounded-full flex items-center justify-center mx-auto mb-6">
            <Trophy className="w-10 h-10 text-white" />
          </div>

          <h2 className="text-2xl font-bold text-white mb-2">Hero Complete!</h2>
          <p className="text-purple-400 text-lg mb-6">
            {formatHeroAmount(result.total_to_offshore)} added to offshore
          </p>

          <div className="bg-neutral-700/50 rounded-lg p-4 mb-6">
            <div className="flex justify-between text-sm mb-2">
              <span className="text-neutral-400">Buildings Sold</span>
              <span className="text-white">{result.buildings_sold}</span>
            </div>
            <div className="flex justify-between text-sm mb-2">
              <span className="text-neutral-400">Total Added</span>
              <span className="text-green-400 font-bold">
                {formatHeroAmount(result.total_to_offshore)}
              </span>
            </div>
            {result.unlocks && (
              <div className="flex justify-between text-sm pt-2 border-t border-neutral-600">
                <span className="text-neutral-400">Unlocked</span>
                <span className="text-purple-400 font-bold">
                  {getLocationDisplayName(result.unlocks as 'city' | 'capital')}
                </span>
              </div>
            )}
          </div>

          <p className="text-neutral-400 text-sm mb-6">
            Your company has been reset to Level 1.
            {result.unlocks && ` You can now join a ${getLocationDisplayName(result.unlocks as 'city' | 'capital')}!`}
          </p>

          <button
            onClick={onSuccess}
            className="w-full py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-medium"
          >
            Continue
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-neutral-800 rounded-lg max-w-lg w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-neutral-700">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-purple-700 rounded-lg flex items-center justify-center">
              <Trophy className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">Hero Out</h2>
              <p className="text-neutral-400 text-sm">
                Leave {getLocationDisplayName(locationType)}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-neutral-400 hover:text-white rounded-lg hover:bg-neutral-700"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Warning */}
          <div className="bg-amber-900/30 border border-amber-500/30 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-amber-200 font-medium">This action is permanent</p>
                <p className="text-amber-300/80 text-sm mt-1">
                  All your buildings will be sold at 50% value. Your company will be reset to Level 1 with no location.
                </p>
              </div>
            </div>
          </div>

          {/* Building Summary */}
          {buildings.length > 0 && (
            <div>
              <h3 className="text-white font-medium mb-3 flex items-center gap-2">
                <Building2 className="w-4 h-4 text-neutral-400" />
                Buildings to Sell ({buildings.length})
              </h3>
              <div className="bg-neutral-700/50 rounded-lg divide-y divide-neutral-600/50 max-h-48 overflow-y-auto">
                {buildings.slice(0, 10).map((building) => (
                  <div key={building.id} className="flex justify-between p-3">
                    <span className="text-neutral-300">{building.name}</span>
                    <div className="text-right">
                      <p className="text-neutral-500 text-xs line-through">
                        ${building.cost.toLocaleString()}
                      </p>
                      <p className="text-green-400 text-sm">
                        ${Math.floor(building.cost * 0.5).toLocaleString()}
                      </p>
                    </div>
                  </div>
                ))}
                {buildings.length > 10 && (
                  <div className="p-3 text-center text-neutral-400 text-sm">
                    +{buildings.length - 10} more buildings
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Financial Summary */}
          <div>
            <h3 className="text-white font-medium mb-3 flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-neutral-400" />
              Financial Summary
            </h3>
            <div className="bg-neutral-700/50 rounded-lg p-4 space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-neutral-400">Current Cash</span>
                <span className="text-white">{formatHeroAmount(currentCash)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-neutral-400">Building Value</span>
                <span className="text-green-400">
                  +{formatHeroAmount(summary.totalBuildingValue)}
                </span>
              </div>
              <div className="border-t border-neutral-600 pt-3 flex justify-between">
                <span className="text-white font-medium">Total to Offshore</span>
                <span className="text-purple-400 font-bold text-lg">
                  {formatHeroAmount(summary.totalToOffshore)}
                </span>
              </div>
            </div>
          </div>

          {/* Unlock Info */}
          {summary.newLocation && (
            <div className="bg-purple-900/30 border border-purple-500/30 rounded-lg p-4">
              <div className="flex items-center gap-3">
                <CheckCircle className="w-5 h-5 text-purple-400" />
                <div>
                  <p className="text-purple-200 font-medium">
                    Unlocks {getLocationDisplayName(summary.newLocation)}
                  </p>
                  <p className="text-purple-300/80 text-sm">
                    You'll be able to join {summary.newLocation === 'city' ? 'Cities' : 'the Capital'} after heroing out.
                  </p>
                </div>
              </div>
            </div>
          )}

          {error && (
            <div className="bg-red-900/30 border border-red-500/30 rounded-lg p-4">
              <p className="text-red-400 text-sm">{error}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-3 p-6 border-t border-neutral-700">
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="flex-1 py-3 bg-neutral-700 text-white rounded-lg hover:bg-neutral-600 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleHeroOut}
            disabled={isSubmitting}
            className="flex-1 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Processing...
              </>
            ) : (
              <>
                Hero Out
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

export default HeroModal;
