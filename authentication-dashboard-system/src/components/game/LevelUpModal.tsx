import { Modal } from '../ui/Modal';
import { Star, Sparkles } from 'lucide-react';
import { type LevelUnlocks } from '../../utils/levels';
import { BUILDING_TYPES } from '../../utils/buildingTypes';

interface LevelUpModalProps {
  isOpen: boolean;
  onClose: () => void;
  newLevel: number;
  unlocks: LevelUnlocks;
}

export function LevelUpModal({ isOpen, onClose, newLevel, unlocks }: LevelUpModalProps) {
  const hasBuildings = unlocks.buildings.length > 0;
  const hasTricks = unlocks.tricks.length > 0;
  const hasUnlocks = hasBuildings || hasTricks;

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="md">
      <div className="text-center">
        {/* Celebration header */}
        <div className="relative mb-6">
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-32 h-32 bg-gradient-to-br from-yellow-500/20 to-amber-600/20 rounded-full animate-pulse" />
          </div>
          <div className="relative inline-flex items-center justify-center w-24 h-24 bg-gradient-to-br from-yellow-500 to-amber-600 rounded-full shadow-lg shadow-amber-500/30">
            <Star className="w-12 h-12 text-white" fill="white" />
          </div>
          <div className="absolute -top-2 -right-2">
            <Sparkles className="w-8 h-8 text-yellow-400 animate-bounce" />
          </div>
        </div>

        {/* Level announcement */}
        <h2 className="text-3xl font-bold text-white mb-2">Level Up!</h2>
        <p className="text-xl text-amber-400 font-semibold mb-6">
          You reached Level {newLevel}
        </p>

        {/* Unlocks section */}
        {hasUnlocks && (
          <div className="bg-neutral-800 rounded-lg p-4 mb-6 text-left">
            <h3 className="text-sm font-semibold text-neutral-400 uppercase tracking-wide mb-3">
              New Unlocks
            </h3>

            <div className="space-y-3">
              {/* Building unlocks */}
              {hasBuildings && (
                <div>
                  <p className="text-xs text-neutral-500 mb-2">Buildings</p>
                  <div className="flex flex-wrap gap-2">
                    {unlocks.buildings.map((building) => {
                      const buildingInfo = BUILDING_TYPES[building.id];
                      return (
                        <div
                          key={building.id}
                          className="flex items-center gap-2 px-3 py-2 bg-neutral-700 rounded-lg"
                        >
                          <span className="text-xl">{buildingInfo?.icon || '🏢'}</span>
                          <div>
                            <p className="text-white font-medium text-sm">{building.name}</p>
                            {building.description && (
                              <p className="text-neutral-400 text-xs">{building.description}</p>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Trick unlocks */}
              {hasTricks && (
                <div>
                  <p className="text-xs text-neutral-500 mb-2">Dirty Tricks</p>
                  <div className="flex flex-wrap gap-2">
                    {unlocks.tricks.map((trick) => (
                      <div
                        key={trick.id}
                        className="flex items-center gap-2 px-3 py-2 bg-red-900/30 border border-red-500/30 rounded-lg"
                      >
                        <span className="text-xl">💣</span>
                        <div>
                          <p className="text-red-300 font-medium text-sm">{trick.name}</p>
                          {trick.description && (
                            <p className="text-red-400/70 text-xs">{trick.description}</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Close button */}
        <button
          onClick={onClose}
          className="w-full px-6 py-3 bg-gradient-to-r from-amber-500 to-yellow-500 text-black font-bold rounded-lg hover:from-amber-400 hover:to-yellow-400 transition-colors"
        >
          Continue
        </button>
      </div>
    </Modal>
  );
}

export default LevelUpModal;
