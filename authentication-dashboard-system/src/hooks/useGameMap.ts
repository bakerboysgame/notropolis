import { useState, useEffect, useCallback } from 'react';
import { api } from '../services/api';
import { GameMap, Tile, BuildingInstance } from '../types/game';

interface MapData {
  map: GameMap;
  tiles: Tile[];
  buildings: (BuildingInstance & { name?: string; base_profit?: number; cost?: number })[];
  playerTileCount: number;
  totalFreeLand: number;
}

interface UseGameMapReturn {
  mapData: MapData | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

/**
 * Hook to fetch and cache map data with all tiles and buildings
 * Uses the GET /api/game/maps/:id endpoint
 * Uses stale-while-revalidate pattern - only shows loading on initial fetch
 */
export function useGameMap(mapId: string | undefined): UseGameMapReturn {
  const [mapData, setMapData] = useState<MapData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchMapData = useCallback(async (isInitialLoad = false) => {
    if (!mapId) {
      setIsLoading(false);
      return;
    }

    // Only show loading spinner on initial load, not on refetch
    if (isInitialLoad || !mapData) {
      setIsLoading(true);
    }
    setError(null);
    try {
      const response = await api.get(`/api/game/maps/${mapId}`);
      if (response.data.success) {
        setMapData(response.data.data);
      } else {
        throw new Error(response.data.error || 'Failed to fetch map data');
      }
    } catch (err: any) {
      const errorMessage = err.response?.data?.error || err.message || 'Failed to fetch map data';
      setError(errorMessage);
      // Don't clear existing data on refetch error
      if (isInitialLoad || !mapData) {
        setMapData(null);
      }
    } finally {
      setIsLoading(false);
    }
  }, [mapId, mapData]);

  useEffect(() => {
    fetchMapData(true); // Initial load
  }, [mapId]); // Only re-run on mapId change, not on fetchMapData change

  // Refetch without showing loading spinner
  const refetch = useCallback(async () => {
    await fetchMapData(false);
  }, [fetchMapData]);

  return {
    mapData,
    isLoading,
    error,
    refetch,
  };
}
