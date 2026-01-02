import { useState, useEffect } from 'react';
import { X, Trophy } from 'lucide-react';
import { Achievement } from '../../hooks/useAchievements';
import { RARITY_COLORS, RARITY_BG_COLORS, Rarity } from '../../utils/achievementConstants';

interface AchievementUnlockProps {
  achievement: Achievement;
  onClose: () => void;
  autoHideDuration?: number;
}

export function AchievementUnlock({
  achievement,
  onClose,
  autoHideDuration = 5000,
}: AchievementUnlockProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [isLeaving, setIsLeaving] = useState(false);

  const rarityColor = RARITY_COLORS[achievement.rarity as Rarity] || RARITY_COLORS.common;
  const rarityBg = RARITY_BG_COLORS[achievement.rarity as Rarity] || RARITY_BG_COLORS.common;

  useEffect(() => {
    // Trigger enter animation
    const enterTimer = setTimeout(() => setIsVisible(true), 50);

    // Auto-hide after duration
    const hideTimer = setTimeout(() => {
      handleClose();
    }, autoHideDuration);

    return () => {
      clearTimeout(enterTimer);
      clearTimeout(hideTimer);
    };
  }, [autoHideDuration]);

  const handleClose = () => {
    setIsLeaving(true);
    setTimeout(onClose, 300);
  };

  return (
    <div
      className={`fixed top-4 right-4 z-50 transition-all duration-300 ${
        isVisible && !isLeaving
          ? 'translate-x-0 opacity-100'
          : 'translate-x-full opacity-0'
      }`}
    >
      <div
        className={`relative overflow-hidden rounded-lg shadow-xl border-2 ${rarityBg}`}
        style={{ borderColor: rarityColor, minWidth: '320px' }}
      >
        {/* Glow effect */}
        <div
          className="absolute inset-0 opacity-20"
          style={{
            background: `radial-gradient(circle at center, ${rarityColor}, transparent 70%)`,
          }}
        />

        {/* Content */}
        <div className="relative p-4">
          {/* Close button */}
          <button
            onClick={handleClose}
            className="absolute top-2 right-2 p-1 text-gray-400 hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>

          {/* Header */}
          <div className="flex items-center gap-2 mb-3">
            <Trophy className="w-5 h-5" style={{ color: rarityColor }} />
            <span className="text-sm font-medium uppercase tracking-wide" style={{ color: rarityColor }}>
              Achievement Unlocked!
            </span>
          </div>

          {/* Achievement info */}
          <div className="flex gap-3">
            <div
              className={`w-12 h-12 rounded-lg flex items-center justify-center text-xl ${rarityBg}`}
            >
              {achievement.icon}
            </div>
            <div>
              <h4 className="font-bold text-white">{achievement.name}</h4>
              <p className="text-sm text-gray-400">{achievement.description}</p>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-xs px-2 py-0.5 rounded capitalize" style={{ color: rarityColor, backgroundColor: `${rarityColor}20` }}>
                  {achievement.rarity}
                </span>
                <span className="text-xs text-gray-500">+{achievement.points} points</span>
              </div>
            </div>
          </div>

          {/* Reward info if any */}
          {achievement.rewardType && (
            <div className="mt-3 pt-3 border-t border-gray-700">
              <p className="text-xs text-gray-400">
                Reward: {achievement.rewardType === 'avatar_item' ? 'New avatar item unlocked!' : 'New badge earned!'}
              </p>
            </div>
          )}
        </div>

        {/* Progress bar animation */}
        <div className="h-1 bg-gray-800">
          <div
            className="h-full transition-all"
            style={{
              backgroundColor: rarityColor,
              width: '100%',
              animation: `shrink ${autoHideDuration}ms linear forwards`,
            }}
          />
        </div>
      </div>

      <style>{`
        @keyframes shrink {
          from { width: 100%; }
          to { width: 0%; }
        }
      `}</style>
    </div>
  );
}

export default AchievementUnlock;
