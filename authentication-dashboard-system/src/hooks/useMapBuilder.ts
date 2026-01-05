import { useState, useEffect, useCallback, useMemo } from 'react';
import { api } from '../services/api';
import { GameMap, Tile, TerrainType, SpecialBuilding } from '../types/game';

export type ToolType = TerrainType | SpecialBuilding;

interface MapBuilderState {
  map: GameMap | null;
  tiles: Tile[];
  selectedTool: ToolType;
  brushSize: number;
  zoom: number;
  offset: { x: number; y: number };
  isLoading: boolean;
  isSaving: boolean;
  error: string | null;
  hasUnsavedChanges: boolean;
}

interface UseMapBuilderReturn extends MapBuilderState {
  // Tile lookup for O(1) access
  tileMap: Map<string, Tile>;
  // Tool actions
  setTool: (tool: ToolType) => void;
  setBrushSize: (size: number) => void;
  // Painting
  paint: (x: number, y: number) => void;
  // Map actions
  saveMap: (settings: Partial<GameMap>) => Promise<void>;
  saveTiles: () => Promise<void>;
  loadMap: (mapId: string) => Promise<void>;
  createMap: (settings: CreateMapRequest) => Promise<string | null>;
  deleteMap: (mapId: string) => Promise<boolean>;
  // Zoom/pan
  setZoom: (zoom: number) => void;
  setOffset: (offset: { x: number; y: number }) => void;
  // Get special buildings info
  specialBuildings: { temple: { x: number; y: number } | null; bank: { x: number; y: number } | null; police_station: { x: number; y: number } | null; casino: { x: number; y: number } | null };
}

export interface CreateMapRequest {
  name: string;
  country: string;
  location_type: 'town' | 'city' | 'capital';
  width: number;
  height: number;
  hero_net_worth?: number;
  hero_cash?: number;
  hero_land_percentage?: number;
  police_strike_day?: number;
}

// Batch tile updates for better performance
const BATCH_DELAY = 500; // ms

export function useMapBuilder(mapId?: string): UseMapBuilderReturn {
  const [state, setState] = useState<MapBuilderState>({
    map: null,
    tiles: [],
    selectedTool: 'free_land',
    brushSize: 1,
    zoom: 1,
    offset: { x: 0, y: 0 },
    isLoading: false,
    isSaving: false,
    error: null,
    hasUnsavedChanges: false,
  });

  // Pending tile updates for batching
  const [pendingUpdates, setPendingUpdates] = useState<Map<string, { x: number; y: number; terrain_type?: TerrainType; special_building?: SpecialBuilding }>>(new Map());

  // Convert tiles array to 2D lookup for O(1) access
  const tileMap = useMemo(() => {
    const map = new Map<string, Tile>();
    state.tiles.forEach(t => map.set(`${t.x},${t.y}`, t));
    return map;
  }, [state.tiles]);

  // Get special buildings positions
  const specialBuildings = useMemo(() => {
    const result = {
      temple: null as { x: number; y: number } | null,
      bank: null as { x: number; y: number } | null,
      police_station: null as { x: number; y: number } | null,
      casino: null as { x: number; y: number } | null,
    };
    state.tiles.forEach(t => {
      if (t.special_building === 'temple') result.temple = { x: t.x, y: t.y };
      if (t.special_building === 'bank') result.bank = { x: t.x, y: t.y };
      if (t.special_building === 'police_station') result.police_station = { x: t.x, y: t.y };
      if (t.special_building === 'casino') result.casino = { x: t.x, y: t.y };
    });
    return result;
  }, [state.tiles]);

  // Load map data
  const loadMap = useCallback(async (id: string) => {
    setState(s => ({ ...s, isLoading: true, error: null }));
    try {
      const response = await api.get(`/api/admin/maps/${id}`);
      if (response.data.success) {
        setState(s => ({
          ...s,
          map: response.data.data.map,
          tiles: response.data.data.tiles,
          isLoading: false,
          hasUnsavedChanges: false,
        }));
      } else {
        throw new Error(response.data.error || 'Failed to load map');
      }
    } catch (error: any) {
      setState(s => ({
        ...s,
        isLoading: false,
        error: error.response?.data?.error || error.message || 'Failed to load map',
      }));
    }
  }, []);

  // Create new map
  const createMap = useCallback(async (settings: CreateMapRequest): Promise<string | null> => {
    setState(s => ({ ...s, isLoading: true, error: null }));
    try {
      const response = await api.post('/api/admin/maps', settings);
      if (response.data.success) {
        const newMapId = response.data.data.map.id;
        setState(s => ({
          ...s,
          map: response.data.data.map,
          isLoading: false,
        }));
        // Load the full map with tiles
        await loadMap(newMapId);
        return newMapId;
      } else {
        throw new Error(response.data.error || 'Failed to create map');
      }
    } catch (error: any) {
      setState(s => ({
        ...s,
        isLoading: false,
        error: error.response?.data?.error || error.message || 'Failed to create map',
      }));
      return null;
    }
  }, [loadMap]);

  // Delete map
  const deleteMap = useCallback(async (id: string): Promise<boolean> => {
    setState(s => ({ ...s, isLoading: true, error: null }));
    try {
      const response = await api.delete(`/api/admin/maps/${id}`);
      if (response.data.success) {
        setState(s => ({
          ...s,
          map: null,
          tiles: [],
          isLoading: false,
        }));
        return true;
      } else {
        throw new Error(response.data.error || 'Failed to delete map');
      }
    } catch (error: any) {
      setState(s => ({
        ...s,
        isLoading: false,
        error: error.response?.data?.error || error.message || 'Failed to delete map',
      }));
      return false;
    }
  }, []);

  // Save map settings
  const saveMap = useCallback(async (settings: Partial<GameMap>) => {
    if (!state.map) return;
    setState(s => ({ ...s, isSaving: true, error: null }));
    try {
      const response = await api.put(`/api/admin/maps/${state.map.id}`, settings);
      if (response.data.success) {
        setState(s => ({
          ...s,
          map: response.data.data,
          isSaving: false,
        }));
      } else {
        throw new Error(response.data.error || 'Failed to save map');
      }
    } catch (error: any) {
      setState(s => ({
        ...s,
        isSaving: false,
        error: error.response?.data?.error || error.message || 'Failed to save map',
      }));
    }
  }, [state.map]);

  // Save pending tile updates to server
  const saveTiles = useCallback(async () => {
    if (!state.map || pendingUpdates.size === 0) return;

    const tilesToSave = Array.from(pendingUpdates.values());
    setPendingUpdates(new Map());

    setState(s => ({ ...s, isSaving: true, error: null }));
    try {
      const response = await api.put(`/api/admin/maps/${state.map.id}/tiles`, {
        tiles: tilesToSave,
      });
      if (response.data.success) {
        setState(s => ({
          ...s,
          isSaving: false,
          hasUnsavedChanges: false,
        }));
      } else {
        throw new Error(response.data.error || 'Failed to save tiles');
      }
    } catch (error: any) {
      setState(s => ({
        ...s,
        isSaving: false,
        error: error.response?.data?.error || error.message || 'Failed to save tiles',
      }));
    }
  }, [state.map, pendingUpdates]);

  // Auto-save tiles after delay
  useEffect(() => {
    if (pendingUpdates.size === 0) return;

    const timer = setTimeout(() => {
      saveTiles();
    }, BATCH_DELAY);

    return () => clearTimeout(timer);
  }, [pendingUpdates, saveTiles]);

  // Paint at a position with current tool and brush size
  const paint = useCallback((centerX: number, centerY: number) => {
    if (!state.map) return;

    const { selectedTool, brushSize } = state;
    const isSpecialBuilding = ['temple', 'bank', 'police_station', 'casino'].includes(selectedTool as string);

    // Calculate brush area
    const halfBrush = Math.floor(brushSize / 2);
    const updates: Map<string, { x: number; y: number; terrain_type?: TerrainType; special_building?: SpecialBuilding }> = new Map();
    const newTiles = [...state.tiles];

    if (isSpecialBuilding) {
      // Special buildings: only place one at the center, ignore brush size
      const key = `${centerX},${centerY}`;
      const existingTile = tileMap.get(key);

      if (existingTile) {
        // Remove existing special building of same type from other tiles
        const buildingType = selectedTool as SpecialBuilding;
        newTiles.forEach((t, idx) => {
          if (t.special_building === buildingType && !(t.x === centerX && t.y === centerY)) {
            newTiles[idx] = { ...t, special_building: null };
            updates.set(`${t.x},${t.y}`, { x: t.x, y: t.y, special_building: null });
          }
        });

        // Place the new building
        const tileIdx = newTiles.findIndex(t => t.x === centerX && t.y === centerY);
        if (tileIdx >= 0) {
          newTiles[tileIdx] = { ...newTiles[tileIdx], special_building: buildingType };
          updates.set(key, { x: centerX, y: centerY, special_building: buildingType });
        }
      }
    } else {
      // Terrain painting with brush size
      for (let dx = -halfBrush; dx <= halfBrush; dx++) {
        for (let dy = -halfBrush; dy <= halfBrush; dy++) {
          const x = centerX + dx;
          const y = centerY + dy;

          // Skip out of bounds
          if (x < 0 || x >= state.map.width || y < 0 || y >= state.map.height) continue;

          const key = `${x},${y}`;
          const tileIdx = newTiles.findIndex(t => t.x === x && t.y === y);
          if (tileIdx >= 0) {
            const terrainType = selectedTool as TerrainType;
            newTiles[tileIdx] = { ...newTiles[tileIdx], terrain_type: terrainType };
            updates.set(key, { x, y, terrain_type: terrainType });
          }
        }
      }
    }

    setState(s => ({ ...s, tiles: newTiles, hasUnsavedChanges: true }));
    setPendingUpdates(prev => {
      const next = new Map(prev);
      updates.forEach((v, k) => next.set(k, v));
      return next;
    });
  }, [state.map, state.selectedTool, state.brushSize, state.tiles, tileMap]);

  // Tool setters
  const setTool = useCallback((tool: ToolType) => {
    setState(s => ({ ...s, selectedTool: tool }));
  }, []);

  const setBrushSize = useCallback((size: number) => {
    setState(s => ({ ...s, brushSize: Math.max(1, Math.min(5, size)) }));
  }, []);

  const setZoom = useCallback((zoom: number) => {
    setState(s => ({ ...s, zoom: Math.max(0.25, Math.min(3, zoom)) }));
  }, []);

  const setOffset = useCallback((offset: { x: number; y: number }) => {
    setState(s => ({ ...s, offset }));
  }, []);

  // Load map on mount if mapId provided
  useEffect(() => {
    if (mapId) {
      loadMap(mapId);
    }
  }, [mapId, loadMap]);

  return {
    ...state,
    tileMap,
    specialBuildings,
    setTool,
    setBrushSize,
    paint,
    saveMap,
    saveTiles,
    loadMap,
    createMap,
    deleteMap,
    setZoom,
    setOffset,
  };
}
