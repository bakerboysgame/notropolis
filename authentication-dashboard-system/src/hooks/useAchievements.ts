import { useState, useEffect, useCallback } from 'react';
import { api } from '../services/api';
import { Rarity } from '../utils/achievementConstants';

export interface Achievement {
  id: string;
  category: string;
  name: string;
  description: string;
  icon: string;
  rarity: Rarity;
  points: number;
  conditionType: string;
  conditionValue: number;
  rewardType: string | null;
  rewardId: string | null;
  progress: number;
  percentage: number;
  isCompleted: boolean;
  completedAt: string | null;
}

export interface AchievementSummary {
  total: number;
  completed: number;
  points: number;
}

interface AchievementsData {
  achievements: Achievement[];
  summary: AchievementSummary;
}

export function useAchievements() {
  const [data, setData] = useState<AchievementsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAchievements = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await api.get('/api/game/achievements');
      if (response.data.success) {
        setData({
          achievements: response.data.achievements,
          summary: response.data.summary,
        });
      } else {
        throw new Error(response.data.error || 'Failed to fetch achievements');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to fetch achievements');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAchievements();
  }, [fetchAchievements]);

  return { data, isLoading, error, refetch: fetchAchievements };
}

export interface Badge {
  id: string;
  name: string;
  description: string;
  icon: string;
  rarity: Rarity;
  earned_at: string;
}

interface BadgesData {
  badges: Badge[];
}

export function useBadges() {
  const [data, setData] = useState<BadgesData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchBadges = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await api.get('/api/game/achievements/badges');
      if (response.data.success) {
        setData({
          badges: response.data.badges,
        });
      } else {
        throw new Error(response.data.error || 'Failed to fetch badges');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to fetch badges');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBadges();
  }, [fetchBadges]);

  return { data, isLoading, error, refetch: fetchBadges };
}

interface CheckAchievementsResult {
  newlyUnlocked: Achievement[];
  totalUnlocked: number;
}

export function useCheckAchievements() {
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const checkAchievements = useCallback(async (): Promise<CheckAchievementsResult | null> => {
    setIsPending(true);
    setError(null);
    try {
      const response = await api.post('/api/game/achievements/check');
      if (response.data.success) {
        return {
          newlyUnlocked: response.data.newlyUnlocked,
          totalUnlocked: response.data.totalUnlocked,
        };
      } else {
        throw new Error(response.data.error || 'Failed to check achievements');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to check achievements');
      return null;
    } finally {
      setIsPending(false);
    }
  }, []);

  return { checkAchievements, isPending, error };
}
