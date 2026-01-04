import { useState, useEffect, useCallback } from 'react';
import { api } from '../services/api';
import { GameCompany, GameMap } from '../types/game';

interface UseCompaniesReturn {
  companies: GameCompany[];
  maxCompanies: number;
  isLoading: boolean;
  error: string | null;
  fetchCompanies: () => Promise<void>;
  createCompany: (name: string, bossName: string) => Promise<GameCompany | null>;
  updateCompany: (id: string, name: string) => Promise<GameCompany | null>;
  deleteCompany: (id: string) => Promise<boolean>;
  joinLocation: (companyId: string, mapId: string) => Promise<GameCompany | null>;
  leaveLocation: (companyId: string) => Promise<GameCompany | null>;
  getCompany: (id: string) => Promise<GameCompany | null>;
}

export function useCompanies(): UseCompaniesReturn {
  const [companies, setCompanies] = useState<GameCompany[]>([]);
  const [maxCompanies, setMaxCompanies] = useState(3);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCompanies = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await api.get('/api/game/companies');
      if (response.data.success) {
        setCompanies(response.data.data.companies || []);
        setMaxCompanies(response.data.data.max_companies || 3);
      } else {
        throw new Error(response.data.error || 'Failed to fetch companies');
      }
    } catch (err: any) {
      const errorMessage = err.response?.data?.error || err.message || 'Failed to fetch companies';
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const createCompany = useCallback(async (name: string, bossName: string): Promise<GameCompany | null> => {
    setError(null);
    try {
      const response = await api.post('/api/game/companies', { name, boss_name: bossName });
      if (response.data.success) {
        const newCompany = response.data.data.company;
        setCompanies(prev => [newCompany, ...prev]);
        return newCompany;
      } else {
        throw new Error(response.data.error || 'Failed to create company');
      }
    } catch (err: any) {
      const errorMessage = err.response?.data?.error || err.message || 'Failed to create company';
      setError(errorMessage);
      return null;
    }
  }, []);

  const updateCompany = useCallback(async (id: string, name: string): Promise<GameCompany | null> => {
    setError(null);
    try {
      const response = await api.put(`/api/game/companies/${id}`, { name });
      if (response.data.success) {
        const updatedCompany = response.data.data.company;
        setCompanies(prev => prev.map(c => c.id === id ? updatedCompany : c));
        return updatedCompany;
      } else {
        throw new Error(response.data.error || 'Failed to update company');
      }
    } catch (err: any) {
      const errorMessage = err.response?.data?.error || err.message || 'Failed to update company';
      setError(errorMessage);
      return null;
    }
  }, []);

  const deleteCompany = useCallback(async (id: string): Promise<boolean> => {
    setError(null);
    try {
      const response = await api.delete(`/api/game/companies/${id}`);
      if (response.data.success) {
        setCompanies(prev => prev.filter(c => c.id !== id));
        return true;
      } else {
        throw new Error(response.data.error || 'Failed to delete company');
      }
    } catch (err: any) {
      const errorMessage = err.response?.data?.error || err.message || 'Failed to delete company';
      setError(errorMessage);
      return false;
    }
  }, []);

  const joinLocation = useCallback(async (companyId: string, mapId: string): Promise<GameCompany | null> => {
    setError(null);
    try {
      const response = await api.post(`/api/game/companies/${companyId}/join-location`, { map_id: mapId });
      if (response.data.success) {
        const updatedCompany = response.data.data.company;
        setCompanies(prev => prev.map(c => c.id === companyId ? updatedCompany : c));
        return updatedCompany;
      } else {
        throw new Error(response.data.error || 'Failed to join location');
      }
    } catch (err: any) {
      const errorMessage = err.response?.data?.error || err.message || 'Failed to join location';
      setError(errorMessage);
      return null;
    }
  }, []);

  const leaveLocation = useCallback(async (companyId: string): Promise<GameCompany | null> => {
    setError(null);
    try {
      const response = await api.post(`/api/game/companies/${companyId}/leave-location`);
      if (response.data.success) {
        const updatedCompany = response.data.data.company;
        setCompanies(prev => prev.map(c => c.id === companyId ? updatedCompany : c));
        return updatedCompany;
      } else {
        throw new Error(response.data.error || 'Failed to leave location');
      }
    } catch (err: any) {
      const errorMessage = err.response?.data?.error || err.message || 'Failed to leave location';
      setError(errorMessage);
      return null;
    }
  }, []);

  const getCompany = useCallback(async (id: string): Promise<GameCompany | null> => {
    setError(null);
    try {
      const response = await api.get(`/api/game/companies/${id}`);
      if (response.data.success) {
        return response.data.data.company;
      } else {
        throw new Error(response.data.error || 'Failed to get company');
      }
    } catch (err: any) {
      const errorMessage = err.response?.data?.error || err.message || 'Failed to get company';
      setError(errorMessage);
      return null;
    }
  }, []);

  // Fetch companies on mount
  useEffect(() => {
    fetchCompanies();
  }, [fetchCompanies]);

  return {
    companies,
    maxCompanies,
    isLoading,
    error,
    fetchCompanies,
    createCompany,
    updateCompany,
    deleteCompany,
    joinLocation,
    leaveLocation,
    getCompany,
  };
}

// Separate hook for fetching game maps
interface UseMapsOptions {
  type?: 'town' | 'city' | 'capital';
}

interface UseMapsReturn {
  maps: GameMap[];
  isLoading: boolean;
  error: string | null;
  fetchMaps: () => Promise<void>;
}

export function useMaps(options?: UseMapsOptions): UseMapsReturn {
  const [maps, setMaps] = useState<GameMap[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchMaps = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await api.get('/api/game/maps');
      if (response.data.success) {
        let allMaps = response.data.data || [];
        // Filter by type if specified
        if (options?.type) {
          allMaps = allMaps.filter((m: GameMap) => m.location_type === options.type);
        }
        setMaps(allMaps);
      } else {
        throw new Error(response.data.error || 'Failed to fetch maps');
      }
    } catch (err: any) {
      const errorMessage = err.response?.data?.error || err.message || 'Failed to fetch maps';
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, [options?.type]);

  useEffect(() => {
    fetchMaps();
  }, [fetchMaps]);

  return { maps, isLoading, error, fetchMaps };
}
