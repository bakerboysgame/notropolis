import { useState, useEffect, useCallback } from 'react';
import { api } from '../services/api';
import { Tile, BuildingInstance, BuildingSecurity, BuildingType } from '../types/game';

interface TileDetailData {
  tile: Tile;
  building: (BuildingInstance & BuildingType) | null;
  owner: { name: string } | null;
  security: BuildingSecurity | null;
}

interface UseTileDetailReturn {
  data: TileDetailData | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

/**
 * Hook to fetch detailed information about a specific tile
 * Uses the GET /api/game/maps/:id/tile/:x/:y endpoint
 */
export function useTileDetail(
  mapId: string | undefined,
  x: number | undefined,
  y: number | undefined
): UseTileDetailReturn {
  const [data, setData] = useState<TileDetailData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchTileDetail = useCallback(async () => {
    if (!mapId || x === undefined || y === undefined) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const response = await api.get(`/api/game/maps/${mapId}/tile/${x}/${y}`);
      if (response.data.success) {
        setData(response.data.data);
      } else {
        throw new Error(response.data.error || 'Failed to fetch tile details');
      }
    } catch (err: any) {
      const errorMessage = err.response?.data?.error || err.message || 'Failed to fetch tile details';
      setError(errorMessage);
      setData(null);
    } finally {
      setIsLoading(false);
    }
  }, [mapId, x, y]);

  useEffect(() => {
    fetchTileDetail();
  }, [fetchTileDetail]);

  return {
    data,
    isLoading,
    error,
    refetch: fetchTileDetail,
  };
}
