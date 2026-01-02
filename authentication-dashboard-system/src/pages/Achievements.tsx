import { useState } from 'react';
import { Trophy, Medal, Star } from 'lucide-react';
import { useAchievements, useBadges } from '../hooks/useAchievements';
import { AchievementCard } from '../components/game/AchievementCard';
import { ACHIEVEMENT_CATEGORIES, RARITY_COLORS, Rarity } from '../utils/achievementConstants';

export function Achievements() {
  const { data, isLoading, error } = useAchievements();
  const { data: badgesData } = useBadges();
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [showCompleted, setShowCompleted] = useState<'all' | 'completed' | 'incomplete'>('all');

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-900">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-900">
        <div className="text-center">
          <p className="text-red-400 mb-4">{error || 'Failed to load achievements'}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  const { achievements, summary } = data;
  const badges = badgesData?.badges || [];

  // Filter achievements
  const filteredAchievements = achievements.filter((a) => {
    const categoryMatch = selectedCategory === 'all' || a.category === selectedCategory;
    const completedMatch =
      showCompleted === 'all' ||
      (showCompleted === 'completed' && a.isCompleted) ||
      (showCompleted === 'incomplete' && !a.isCompleted);
    return categoryMatch && completedMatch;
  });

  const completionPercentage = summary.total > 0
    ? Math.floor((summary.completed / summary.total) * 100)
    : 0;

  return (
    <div className="min-h-screen bg-gray-900 p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white flex items-center gap-3">
            <Trophy className="w-8 h-8 text-amber-400" />
            Achievements
          </h1>
          <p className="text-gray-400 mt-2">
            Track your progress and earn rewards for your accomplishments
          </p>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          {/* Completion */}
          <div className="bg-gray-800 rounded-lg p-4">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 bg-blue-500/20 rounded-lg flex items-center justify-center">
                <Medal className="w-5 h-5 text-blue-400" />
              </div>
              <div>
                <p className="text-sm text-gray-400">Completion</p>
                <p className="text-xl font-bold text-white">
                  {summary.completed} / {summary.total}
                </p>
              </div>
            </div>
            <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-500 rounded-full transition-all"
                style={{ width: `${completionPercentage}%` }}
              />
            </div>
            <p className="text-xs text-gray-500 mt-1">{completionPercentage}% complete</p>
          </div>

          {/* Points */}
          <div className="bg-gray-800 rounded-lg p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-amber-500/20 rounded-lg flex items-center justify-center">
                <Star className="w-5 h-5 text-amber-400" />
              </div>
              <div>
                <p className="text-sm text-gray-400">Achievement Points</p>
                <p className="text-xl font-bold text-white">{summary.points.toLocaleString()}</p>
              </div>
            </div>
          </div>

          {/* Badges */}
          <div className="bg-gray-800 rounded-lg p-4">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 bg-purple-500/20 rounded-lg flex items-center justify-center">
                <Trophy className="w-5 h-5 text-purple-400" />
              </div>
              <div>
                <p className="text-sm text-gray-400">Badges Earned</p>
                <p className="text-xl font-bold text-white">{badges.length}</p>
              </div>
            </div>
            {badges.length > 0 && (
              <div className="flex gap-2 flex-wrap">
                {badges.map((badge) => (
                  <div
                    key={badge.id}
                    className="px-2 py-1 rounded text-xs flex items-center gap-1"
                    style={{
                      backgroundColor: `${RARITY_COLORS[badge.rarity as Rarity]}20`,
                      color: RARITY_COLORS[badge.rarity as Rarity],
                    }}
                    title={badge.description}
                  >
                    {badge.icon} {badge.name}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-4 mb-6">
          {/* Category filter */}
          <div className="flex gap-2 flex-wrap">
            {ACHIEVEMENT_CATEGORIES.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={`px-4 py-2 rounded-lg transition-colors flex items-center gap-2 ${
                  selectedCategory === cat.id
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
              >
                <span>{cat.icon}</span>
                <span>{cat.name}</span>
              </button>
            ))}
          </div>

          {/* Completion filter */}
          <div className="flex gap-2 ml-auto">
            <button
              onClick={() => setShowCompleted('all')}
              className={`px-3 py-2 rounded-lg text-sm transition-colors ${
                showCompleted === 'all'
                  ? 'bg-gray-600 text-white'
                  : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
              }`}
            >
              All
            </button>
            <button
              onClick={() => setShowCompleted('completed')}
              className={`px-3 py-2 rounded-lg text-sm transition-colors ${
                showCompleted === 'completed'
                  ? 'bg-green-600 text-white'
                  : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
              }`}
            >
              Completed
            </button>
            <button
              onClick={() => setShowCompleted('incomplete')}
              className={`px-3 py-2 rounded-lg text-sm transition-colors ${
                showCompleted === 'incomplete'
                  ? 'bg-orange-600 text-white'
                  : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
              }`}
            >
              In Progress
            </button>
          </div>
        </div>

        {/* Achievement Grid */}
        {filteredAchievements.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <Trophy className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>No achievements match your filters</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredAchievements.map((achievement) => (
              <AchievementCard key={achievement.id} achievement={achievement} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default Achievements;
