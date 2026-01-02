import { Check } from 'lucide-react';
import { Achievement } from '../../hooks/useAchievements';
import {
  RARITY_COLORS,
  RARITY_BG_COLORS,
  RARITY_BORDER_COLORS,
  RARITY_TEXT_COLORS,
} from '../../utils/achievementConstants';

interface AchievementCardProps {
  achievement: Achievement;
}

export function AchievementCard({ achievement }: AchievementCardProps) {
  const {
    name,
    description,
    icon,
    rarity,
    points,
    progress,
    percentage,
    conditionValue,
    isCompleted,
    completedAt,
  } = achievement;

  const rarityBg = RARITY_BG_COLORS[rarity] || RARITY_BG_COLORS.common;
  const rarityBorder = RARITY_BORDER_COLORS[rarity] || RARITY_BORDER_COLORS.common;
  const rarityText = RARITY_TEXT_COLORS[rarity] || RARITY_TEXT_COLORS.common;
  const rarityColor = RARITY_COLORS[rarity] || RARITY_COLORS.common;

  const formatNumber = (num: number) => {
    if (num >= 1_000_000_000) return `${(num / 1_000_000_000).toFixed(1)}B`;
    if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`;
    if (num >= 1_000) return `${(num / 1_000).toFixed(1)}K`;
    return num.toLocaleString();
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  return (
    <div
      className={`relative rounded-lg border-2 p-4 transition-all ${
        isCompleted
          ? `${rarityBg} ${rarityBorder}`
          : 'bg-gray-800/50 border-gray-700 opacity-75'
      }`}
    >
      {/* Completed checkmark */}
      {isCompleted && (
        <div
          className="absolute -top-2 -right-2 w-6 h-6 rounded-full flex items-center justify-center"
          style={{ backgroundColor: rarityColor }}
        >
          <Check className="w-4 h-4 text-white" />
        </div>
      )}

      <div className="flex gap-4">
        {/* Icon */}
        <div
          className={`w-14 h-14 rounded-lg flex items-center justify-center text-2xl ${
            isCompleted ? rarityBg : 'bg-gray-700'
          }`}
        >
          {icon}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h3
              className={`font-semibold truncate ${
                isCompleted ? 'text-white' : 'text-gray-400'
              }`}
            >
              {name}
            </h3>
            <span className={`text-xs px-2 py-0.5 rounded capitalize ${rarityText} ${rarityBg}`}>
              {rarity}
            </span>
          </div>

          <p className="text-sm text-gray-400 mb-2">{description}</p>

          {/* Progress bar */}
          {!isCompleted && (
            <div className="mb-2">
              <div className="flex justify-between text-xs text-gray-500 mb-1">
                <span>
                  {formatNumber(progress)} / {formatNumber(conditionValue)}
                </span>
                <span>{percentage}%</span>
              </div>
              <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${percentage}%`,
                    backgroundColor: rarityColor,
                  }}
                />
              </div>
            </div>
          )}

          {/* Footer */}
          <div className="flex items-center justify-between">
            <span className={`text-sm ${isCompleted ? rarityText : 'text-gray-500'}`}>
              +{points} points
            </span>
            {isCompleted && completedAt && (
              <span className="text-xs text-gray-500">
                Completed {formatDate(completedAt)}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default AchievementCard;
