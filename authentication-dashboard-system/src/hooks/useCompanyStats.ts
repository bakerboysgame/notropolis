import { useState, useEffect, useCallback } from 'react';
import { api } from '../services/api';

export interface CompanyStats {
  companyId: string;
  companyName: string;
  mapId: string | null;
  mapName: string | null;
  locationType: 'town' | 'city' | 'capital' | null;
  buildingsOwned: number;
  monthlyProfit: number;
  netWorth: number;
  buildingsValue: number;
  cash: number;
  offshore: number;
  joinedLocationAt: string | null;
}

interface UseCompanyStatsReturn {
  stats: CompanyStats | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useCompanyStats(companyId: string | undefined): UseCompanyStatsReturn {
  const [stats, setStats] = useState<CompanyStats | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = useCallback(async () => {
    if (!companyId) {
      setStats(null);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await api.get(`/api/game/companies/${companyId}/stats`);
      if (response.data.success) {
        setStats(response.data.data);
      } else {
        throw new Error(response.data.error || 'Failed to fetch company stats');
      }
    } catch (err: any) {
      const errorMessage = err.response?.data?.error || err.message || 'Failed to fetch company stats';
      setError(errorMessage);
      setStats(null);
    } finally {
      setIsLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  return {
    stats,
    isLoading,
    error,
    refetch: fetchStats,
  };
}

// Hook to fetch stats for multiple companies at once
interface UseMultipleCompanyStatsReturn {
  statsMap: Map<string, CompanyStats>;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useMultipleCompanyStats(companyIds: string[]): UseMultipleCompanyStatsReturn {
  const [statsMap, setStatsMap] = useState<Map<string, CompanyStats>>(new Map());
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchAllStats = useCallback(async () => {
    if (companyIds.length === 0) {
      setStatsMap(new Map());
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const results = await Promise.all(
        companyIds.map(async (id) => {
          try {
            const response = await api.get(`/api/game/companies/${id}/stats`);
            if (response.data.success) {
              return { id, stats: response.data.data as CompanyStats };
            }
            return { id, stats: null };
          } catch {
            return { id, stats: null };
          }
        })
      );

      const newMap = new Map<string, CompanyStats>();
      results.forEach(({ id, stats }) => {
        if (stats) {
          newMap.set(id, stats);
        }
      });
      setStatsMap(newMap);
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to fetch company stats';
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, [companyIds.join(',')]);

  useEffect(() => {
    fetchAllStats();
  }, [fetchAllStats]);

  return {
    statsMap,
    isLoading,
    error,
    refetch: fetchAllStats,
  };
}
