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
 */
export function useGameMap(mapId: string | undefined): UseGameMapReturn {
  const [mapData, setMapData] = useState<MapData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchMapData = useCallback(async () => {
    if (!mapId) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
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
      setMapData(null);
    } finally {
      setIsLoading(false);
    }
  }, [mapId]);

  useEffect(() => {
    fetchMapData();
  }, [fetchMapData]);

  return {
    mapData,
    isLoading,
    error,
    refetch: fetchMapData,
  };
}
