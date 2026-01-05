import { useState } from 'react';
import { X, Skull, AlertTriangle } from 'lucide-react';
import { api, apiHelpers } from '../../services/api';
import { DIRTY_TRICKS, getAvailableTricks, isPoliceStrike, calculateTrickCost, type TrickType } from '../../utils/dirtyTricks';

interface AttackModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (result: any) => void;
  building: any;
  buildingType: any;
  map: any;
  mapId: string;
  x: number;
  y: number;
  activeCompanyId: string;
  companyLevel: number;
  companyCash: number;
}

export function AttackModal({
  isOpen,
  onClose,
  onSuccess,
  building,
  buildingType,
  map,
  mapId,
  x,
  y,
  activeCompanyId,
  companyLevel,
  companyCash,
}: AttackModalProps) {
  const [selectedTrick, setSelectedTrick] = useState<TrickType | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState('');

  // Check if police are on strike today
  const policeOnStrike = map ? isPoliceStrike(map.police_strike_day) : false;

  // Get available tricks based on company level
  const availableTricks = getAvailableTricks(companyLevel);

  // Get building value for cost calculation (use calculated_value if available, fall back to type cost)
  const buildingValue = building?.calculated_value || buildingType?.cost || 0;

  // Helper to get cost for a trick
  const getTrickCost = (trickType: TrickType) => calculateTrickCost(trickType, buildingValue);

  const handleAttack = async () => {
    if (!selectedTrick) return;

    setLoading(true);
    setError(null);

    try {
      const response = await api.post('/api/game/attacks', {
        company_id: activeCompanyId,
        building_id: building.id,
        trick_type: selectedTrick,
        map_id: mapId,
        x,
        y,
        message: message.trim() || undefined,
      });

      if (response.data.success) {
        onSuccess(response.data);
        onClose();
      } else {
        setError('Attack failed');
      }
    } catch (err) {
      setError(apiHelpers.handleError(err));
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const selectedTrickData = selectedTrick ? DIRTY_TRICKS[selectedTrick] : null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-gray-800 rounded-lg p-6 w-full max-w-2xl border border-gray-700 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-4">
          <div>
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <Skull className="w-6 h-6 text-red-400" />
              Dirty Tricks Attack
            </h2>
            <p className="text-sm text-gray-400 mt-1">
              Target: {buildingType?.name || 'Building'} owned by {building?.owner_name || 'Unknown'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white"
            disabled={loading}
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Police Strike Warning */}
        {policeOnStrike && (
          <div className="mb-4 p-3 bg-yellow-900/30 rounded border border-yellow-700">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-yellow-400" />
              <p className="text-yellow-400 text-sm font-bold">
                POLICE STRIKE DAY! Police catch rate is 0% (security systems still active)
              </p>
            </div>
          </div>
        )}

        {/* Error message */}
        {error && (
          <div className="mb-4 p-3 bg-red-900/30 rounded border border-red-700">
            <p className="text-red-400 text-sm">{error}</p>
          </div>
        )}

        {/* Trick Selection */}
        {!selectedTrick && (
          <div className="space-y-3">
            <p className="text-gray-400 text-sm mb-3">
              Select a dirty trick to use. Higher damage means higher catch risk!
            </p>
            {availableTricks.map((trick) => {
              const trickCost = getTrickCost(trick.id);
              const canAfford = companyCash >= trickCost;
              return (
                <button
                  key={trick.id}
                  onClick={() => setSelectedTrick(trick.id)}
                  disabled={!canAfford}
                  className={`w-full p-4 rounded-lg text-left transition-colors ${
                    canAfford
                      ? 'bg-gray-700 hover:bg-gray-600'
                      : 'bg-gray-800 opacity-50 cursor-not-allowed'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-2xl">{trick.icon}</span>
                        <p className="font-bold text-white">{trick.name}</p>
                        {!canAfford && (
                          <span className="text-xs text-red-400 font-bold">
                            (Insufficient funds)
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-400 mb-2">{trick.description}</p>
                      <div className="grid grid-cols-3 gap-2 text-xs">
                        <div>
                          <span className="text-gray-500">Cost:</span>{' '}
                          <span className="text-yellow-400 font-mono">
                            ${trickCost.toLocaleString()}
                          </span>
                          <span className="text-gray-600 ml-1">
                            ({Math.round(trick.costPercent * 100)}%)
                          </span>
                        </div>
                        <div>
                          <span className="text-gray-500">Damage:</span>{' '}
                          <span className="text-red-400 font-bold">{trick.damage}%</span>
                        </div>
                        <div>
                          <span className="text-gray-500">
                            {policeOnStrike ? 'Security' : 'Catch'} Rate:
                          </span>{' '}
                          <span className="text-orange-400 font-bold">
                            {policeOnStrike
                              ? `${Math.round(trick.securityCatchRate * 100)}%`
                              : `${Math.round(trick.policeCatchRate * 100)}%`}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {/* Confirmation View */}
        {selectedTrick && selectedTrickData && (
          <div className="space-y-4">
            {(() => {
              const selectedTrickCost = getTrickCost(selectedTrick);
              return (
                <div className="p-4 bg-gray-700 rounded-lg">
                  <div className="flex items-center gap-3 mb-3">
                    <span className="text-4xl">{selectedTrickData.icon}</span>
                    <div>
                      <p className="text-xl font-bold text-white">{selectedTrickData.name}</p>
                      <p className="text-sm text-gray-400">{selectedTrickData.description}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 mb-3">
                    <div className="p-2 bg-gray-800 rounded">
                      <p className="text-xs text-gray-500">Cost ({Math.round(selectedTrickData.costPercent * 100)}% of value)</p>
                      <p className="text-lg text-yellow-400 font-mono font-bold">
                        ${selectedTrickCost.toLocaleString()}
                      </p>
                    </div>
                    <div className="p-2 bg-gray-800 rounded">
                      <p className="text-xs text-gray-500">Damage Dealt</p>
                      <p className="text-lg text-red-400 font-bold">{selectedTrickData.damage}%</p>
                    </div>
                    <div className="p-2 bg-gray-800 rounded">
                      <p className="text-xs text-gray-500">
                        {policeOnStrike ? 'Security Catch' : 'Police Catch'}
                      </p>
                      <p className="text-lg text-orange-400 font-bold">
                        {policeOnStrike
                          ? `${Math.round(selectedTrickData.securityCatchRate * 100)}%`
                          : `${Math.round(selectedTrickData.policeCatchRate * 100)}%`}
                      </p>
                    </div>
                    <div className="p-2 bg-gray-800 rounded">
                      <p className="text-xs text-gray-500">Your Cash After</p>
                      <p className="text-lg text-green-400 font-mono font-bold">
                        ${(companyCash - selectedTrickCost).toLocaleString()}
                      </p>
                    </div>
                  </div>

                  <div className="p-3 bg-red-900/20 rounded border border-red-800">
                    <p className="text-xs text-red-400 font-bold flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4" />
                      If caught, you'll be sent to prison and fined 8x the trick cost!
                    </p>
                  </div>
                </div>
              );
            })()}

            {/* Optional message to leave on the building */}
            <div className="space-y-2">
              <label className="block text-sm text-gray-400">
                Leave a message on the building (optional)
              </label>
              <input
                type="text"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                maxLength={100}
                placeholder="Tag your territory..."
                className="w-full p-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:border-red-500 focus:outline-none"
              />
              <p className="text-xs text-gray-500">
                {message.length}/100 characters. Messages require moderation before appearing.
              </p>
            </div>

            <div className="flex gap-4">
              <button
                onClick={() => {
                  setSelectedTrick(null);
                  setMessage('');
                }}
                className="flex-1 py-2 bg-gray-600 text-white rounded hover:bg-gray-500 transition-colors"
                disabled={loading}
              >
                Back
              </button>
              <button
                onClick={handleAttack}
                className="flex-1 py-2 bg-red-600 text-white rounded hover:bg-red-500 transition-colors disabled:opacity-50 font-bold"
                disabled={loading}
              >
                {loading ? 'Attacking...' : `Execute Attack`}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
