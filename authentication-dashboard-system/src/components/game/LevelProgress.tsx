import { useMemo } from 'react';
import { Star, TrendingUp, DollarSign, Lock, Unlock } from 'lucide-react';
import {
  getLevelProgress,
  getNextLevelUnlocks,
  formatCash,
  formatActions,
  MAX_LEVEL,
  type LevelUnlocks,
} from '../../utils/levels';
import { BUILDING_TYPES } from '../../utils/buildingTypes';

interface LevelProgressProps {
  cash: number;
  totalActions: number;
  level: number;
}

export function LevelProgress({ cash, totalActions, level }: LevelProgressProps) {
  const progress = useMemo(
    () => getLevelProgress(cash, totalActions),
    [cash, totalActions]
  );

  const nextUnlocks = useMemo(
    () => getNextLevelUnlocks(level),
    [level]
  );

  return (
    <div className="bg-neutral-800 rounded-lg p-6 mb-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-gradient-to-br from-yellow-500 to-amber-600 rounded-lg flex items-center justify-center">
            <Star className="w-6 h-6 text-white" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white">Level {progress.currentLevel}</h2>
            {progress.isMaxLevel ? (
              <p className="text-amber-400 text-sm font-medium">Max Level Reached</p>
            ) : (
              <p className="text-neutral-400 text-sm">
                Progress to Level {progress.nextLevel}
              </p>
            )}
          </div>
        </div>

        {/* Level badge */}
        <div className="flex items-center gap-1">
          {Array.from({ length: MAX_LEVEL }).map((_, i) => (
            <div
              key={i}
              className={`w-3 h-3 rounded-full ${
                i < progress.currentLevel
                  ? 'bg-amber-500'
                  : 'bg-neutral-700'
              }`}
            />
          ))}
        </div>
      </div>

      {/* Progress bars (only show if not max level) */}
      {!progress.isMaxLevel && (
        <div className="space-y-4 mb-6">
          {/* Cash Progress */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2 text-neutral-400 text-sm">
                <DollarSign className="w-4 h-4" />
                <span>Cash</span>
              </div>
              <span className="text-sm text-neutral-300">
                {formatCash(progress.cashCurrent)} / {formatCash(progress.cashRequired)}
              </span>
            </div>
            <div className="h-3 bg-neutral-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-green-600 to-green-400 transition-all duration-500"
                style={{ width: `${progress.cashProgress}%` }}
              />
            </div>
          </div>

          {/* Actions Progress */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2 text-neutral-400 text-sm">
                <TrendingUp className="w-4 h-4" />
                <span>Actions</span>
              </div>
              <span className="text-sm text-neutral-300">
                {formatActions(progress.actionsCurrent)} / {formatActions(progress.actionsRequired)}
              </span>
            </div>
            <div className="h-3 bg-neutral-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-blue-600 to-blue-400 transition-all duration-500"
                style={{ width: `${progress.actionsProgress}%` }}
              />
            </div>
          </div>

          <p className="text-xs text-neutral-500 text-center">
            Both requirements must be met to level up
          </p>
        </div>
      )}

      {/* Next Level Unlocks Preview */}
      {nextUnlocks && (
        <UnlocksPreview unlocks={nextUnlocks} />
      )}

      {/* Max level message */}
      {progress.isMaxLevel && (
        <div className="text-center py-4">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-amber-500/20 text-amber-400 rounded-lg">
            <Unlock className="w-5 h-5" />
            <span className="font-medium">All content unlocked!</span>
          </div>
        </div>
      )}
    </div>
  );
}

interface UnlocksPreviewProps {
  unlocks: LevelUnlocks;
}

function UnlocksPreview({ unlocks }: UnlocksPreviewProps) {
  const hasUnlocks = unlocks.buildings.length > 0 || unlocks.tricks.length > 0;

  if (!hasUnlocks) {
    return null;
  }

  return (
    <div className="border-t border-neutral-700 pt-4">
      <div className="flex items-center gap-2 mb-3">
        <Lock className="w-4 h-4 text-neutral-500" />
        <span className="text-sm text-neutral-400">
          Unlocks at Level {unlocks.level}:
        </span>
      </div>

      <div className="flex flex-wrap gap-2">
        {/* Building unlocks */}
        {unlocks.buildings.map((building) => {
          const buildingInfo = BUILDING_TYPES[building.id];
          return (
            <div
              key={building.id}
              className="flex items-center gap-2 px-3 py-1.5 bg-neutral-700/50 rounded-lg text-sm"
              title={building.description}
            >
              <span>{buildingInfo?.icon || '🏢'}</span>
              <span className="text-neutral-300">{building.name}</span>
            </div>
          );
        })}

        {/* Trick unlocks */}
        {unlocks.tricks.map((trick) => (
          <div
            key={trick.id}
            className="flex items-center gap-2 px-3 py-1.5 bg-red-900/30 border border-red-500/30 rounded-lg text-sm"
            title={trick.description}
          >
            <span>💣</span>
            <span className="text-red-300">{trick.name}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default LevelProgress;
