import { useState, useEffect, useMemo } from 'react';
import {
  Trophy,
  DollarSign,
  Landmark,
  Map,
  Clock,
  ChevronRight,
  Loader2,
} from 'lucide-react';
import {
  getHeroProgress,
  formatHeroAmount,
  getLocationDisplayName,
  HERO_REQUIREMENTS,
} from '../../utils/heroRequirements';
import { HeroModal } from './HeroModal';

interface HeroStatusProps {
  companyId: string;
  locationType: 'town' | 'city' | 'capital' | null;
  cash: number;
  landPercentage: number;
  landOwnershipStreak: number;
  onHeroSuccess?: () => void;
}

interface HeroApiResponse {
  success: boolean;
  current: {
    buildingValue: number;
  };
  buildings: Array<{
    id: string;
    name: string;
    cost: number;
  }>;
}

export function HeroStatus({
  companyId,
  locationType,
  cash,
  landPercentage,
  landOwnershipStreak,
  onHeroSuccess,
}: HeroStatusProps) {
  const [showModal, setShowModal] = useState(false);
  const [heroData, setHeroData] = useState<HeroApiResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Don't render if not in a location
  if (!locationType) {
    return null;
  }

  // Calculate progress using utility
  const progress = useMemo(() => {
    return getHeroProgress(
      locationType,
      cash,
      heroData?.current?.buildingValue || 0,
      landPercentage,
      landOwnershipStreak
    );
  }, [locationType, cash, heroData?.current?.buildingValue, landPercentage, landOwnershipStreak]);

  // Fetch hero status from API
  const fetchHeroStatus = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch(
        `https://api.notropolis.net/api/game/hero/status?company_id=${companyId}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );
      const data = await response.json();
      if (data.success) {
        setHeroData(data);
      } else {
        setError(data.error || 'Failed to fetch hero status');
      }
    } catch (err) {
      setError('Failed to connect to server');
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch on mount
  useEffect(() => {
    if (companyId && locationType) {
      fetchHeroStatus();
    }
  }, [companyId, locationType]);

  const handleHeroClick = () => {
    fetchHeroStatus().then(() => setShowModal(true));
  };

  const requirements = HERO_REQUIREMENTS[locationType];
  const nextLocation = requirements.unlocks;

  return (
    <>
      <div className="bg-gradient-to-br from-purple-900/50 to-purple-800/30 border border-purple-500/30 rounded-lg p-6 mb-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-purple-700 rounded-lg flex items-center justify-center">
              <Trophy className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Hero Progress</h2>
              <p className="text-purple-300 text-sm">
                {nextLocation
                  ? `Unlock ${getLocationDisplayName(nextLocation)}`
                  : 'Final Location'}
              </p>
            </div>
          </div>

          {progress.canHero && (
            <button
              onClick={handleHeroClick}
              disabled={isLoading}
              className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50"
            >
              {isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  Hero Out
                  <ChevronRight className="w-4 h-4" />
                </>
              )}
            </button>
          )}
        </div>

        {/* Three paths */}
        <div className="space-y-4">
          {/* Path 1: Net Worth */}
          <PathProgress
            icon={<Landmark className="w-4 h-4" />}
            label="Net Worth"
            current={formatHeroAmount(progress.currentNetWorth)}
            required={formatHeroAmount(requirements.netWorth)}
            progress={progress.netWorthProgress}
            isMet={progress.canHeroNetWorth}
            color="green"
            sublabel="Cash + 50% building value"
          />

          {/* Path 2: Cash Only */}
          <PathProgress
            icon={<DollarSign className="w-4 h-4" />}
            label="Cash Only"
            current={formatHeroAmount(progress.currentCash)}
            required={formatHeroAmount(requirements.cash)}
            progress={progress.cashProgress}
            isMet={progress.canHeroCash}
            color="blue"
          />

          {/* Path 3: Land Ownership */}
          <div className="bg-neutral-800/50 rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2 text-neutral-400 text-sm">
                <Map className="w-4 h-4" />
                <span>Land Ownership</span>
              </div>
              <span
                className={`text-sm font-medium ${
                  progress.canHeroLand ? 'text-amber-400' : 'text-neutral-300'
                }`}
              >
                {progress.canHeroLand ? 'Ready!' : 'In Progress'}
              </span>
            </div>

            {/* Land percentage */}
            <div className="mb-3">
              <div className="flex justify-between text-xs text-neutral-400 mb-1">
                <span>Own {requirements.landPercentage}% of land</span>
                <span>{progress.currentLandPercentage.toFixed(1)}%</span>
              </div>
              <div className="h-2 bg-neutral-700 rounded-full overflow-hidden">
                <div
                  className={`h-full transition-all duration-500 ${
                    progress.landPercentageProgress >= 100
                      ? 'bg-amber-500'
                      : 'bg-amber-600/50'
                  }`}
                  style={{ width: `${Math.min(100, progress.landPercentageProgress)}%` }}
                />
              </div>
            </div>

            {/* Streak */}
            <div>
              <div className="flex justify-between text-xs text-neutral-400 mb-1">
                <div className="flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  <span>Hold for {requirements.landStreakTicks} ticks</span>
                </div>
                <span>{progress.currentStreak} / {requirements.landStreakTicks}</span>
              </div>
              <div className="h-2 bg-neutral-700 rounded-full overflow-hidden">
                <div
                  className={`h-full transition-all duration-500 ${
                    progress.streakProgress >= 100 ? 'bg-amber-500' : 'bg-amber-600/50'
                  }`}
                  style={{ width: `${Math.min(100, progress.streakProgress)}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Info text */}
        <p className="text-xs text-neutral-500 text-center mt-4">
          Meet any one of the three requirements to hero out
        </p>

        {error && (
          <p className="text-xs text-red-400 text-center mt-2">{error}</p>
        )}
      </div>

      {/* Hero Modal */}
      {showModal && heroData && (
        <HeroModal
          companyId={companyId}
          locationType={locationType}
          progress={progress}
          buildings={heroData.buildings}
          currentCash={cash}
          onClose={() => setShowModal(false)}
          onSuccess={() => {
            setShowModal(false);
            onHeroSuccess?.();
          }}
        />
      )}
    </>
  );
}

interface PathProgressProps {
  icon: React.ReactNode;
  label: string;
  current: string;
  required: string;
  progress: number;
  isMet: boolean;
  color: 'green' | 'blue' | 'amber';
  sublabel?: string;
}

function PathProgress({
  icon,
  label,
  current,
  required,
  progress,
  isMet,
  color,
  sublabel,
}: PathProgressProps) {
  const colorClasses = {
    green: {
      bar: isMet ? 'bg-green-500' : 'bg-green-600/50',
      text: isMet ? 'text-green-400' : 'text-neutral-300',
    },
    blue: {
      bar: isMet ? 'bg-blue-500' : 'bg-blue-600/50',
      text: isMet ? 'text-blue-400' : 'text-neutral-300',
    },
    amber: {
      bar: isMet ? 'bg-amber-500' : 'bg-amber-600/50',
      text: isMet ? 'text-amber-400' : 'text-neutral-300',
    },
  };

  const colors = colorClasses[color];

  return (
    <div className="bg-neutral-800/50 rounded-lg p-4">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2 text-neutral-400 text-sm">
          {icon}
          <span>{label}</span>
          {sublabel && (
            <span className="text-xs text-neutral-500">({sublabel})</span>
          )}
        </div>
        <span className={`text-sm ${colors.text}`}>
          {current} / {required}
        </span>
      </div>
      <div className="h-3 bg-neutral-700 rounded-full overflow-hidden">
        <div
          className={`h-full transition-all duration-500 ${colors.bar}`}
          style={{ width: `${Math.min(100, progress)}%` }}
        />
      </div>
      {isMet && (
        <p className={`text-xs ${colors.text} mt-1 text-right font-medium`}>
          Ready to Hero!
        </p>
      )}
    </div>
  );
}

export default HeroStatus;
