import { useState, useEffect, useMemo } from 'react';
import {
  SPRITE_BASE_URL,
  GRASS_BACKGROUND,
  FALLBACK_BUILDING_SPRITES,
  TERRAIN_SPRITES,
  getBuildingSpriteUrl,
  setPublishedBuildingSprites,
  PublishedBuildingSprite,
} from '../utils/isometricRenderer';

// API base URL for fetching assets
const API_BASE_URL = import.meta.env.VITE_API_URL || '';

interface UseIsometricAssetsReturn {
  sprites: Map<string, HTMLImageElement>;
  grassBackground: HTMLImageElement | null;
  isLoading: boolean;
  loadingProgress: number;
  error: string | null;
}

/**
 * Load a single image and return a promise
 */
async function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load: ${url}`));
    img.src = url;
  });
}

/**
 * Hook to preload all sprites needed for isometric rendering
 * Fetches published building sprites from API, falls back to hardcoded for unpublished
 */
export function useIsometricAssets(): UseIsometricAssetsReturn {
  const [sprites, setSprites] = useState<Map<string, HTMLImageElement>>(new Map());
  const [grassBackground, setGrassBackground] = useState<HTMLImageElement | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [publishedSprites, setPublishedSpritesState] = useState<Record<string, PublishedBuildingSprite>>({});

  // Fetch published building sprites from API (requires auth)
  useEffect(() => {
    const fetchPublishedSprites = async () => {
      try {
        const token = localStorage.getItem('token');
        if (!token) {
          console.warn('No auth token, using fallback building sprites');
          return;
        }
        const response = await fetch(`${API_BASE_URL}/api/assets/buildings/published`, {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });
        if (response.ok) {
          const data = await response.json();
          if (data.success && data.sprites) {
            setPublishedBuildingSprites(data.sprites);
            setPublishedSpritesState(data.sprites);
          }
        }
      } catch (err) {
        console.warn('Failed to fetch published building sprites, using fallbacks');
      }
    };
    fetchPublishedSprites();
  }, []);

  // Collect all unique sprite URLs needed (depends on published sprites)
  const spriteUrls = useMemo(() => {
    const urls = new Set<string>();

    // Add all building type sprites (preload all, not just visible ones)
    // This now uses published sprites where available, fallback otherwise
    Object.keys(FALLBACK_BUILDING_SPRITES).forEach((buildingType) => {
      const url = getBuildingSpriteUrl(buildingType);
      if (url) urls.add(url);
    });

    // Add terrain sprites
    Object.values(TERRAIN_SPRITES).forEach((path) => {
      urls.add(`${SPRITE_BASE_URL}/${path}`);
    });

    return Array.from(urls);
  }, [publishedSprites]);

  useEffect(() => {
    let cancelled = false;

    const loadAllSprites = async () => {
      setIsLoading(true);
      setError(null);
      setLoadingProgress(0);

      const loaded = new Map<string, HTMLImageElement>();
      let loadedCount = 0;
      const totalCount = spriteUrls.length + 1; // +1 for grass background

      // Load grass background - first try to get active base ground from API
      try {
        let grassUrl = `${SPRITE_BASE_URL}/${GRASS_BACKGROUND}`; // Default fallback

        // Try to fetch active base ground from API
        try {
          const response = await fetch(`${API_BASE_URL}/api/assets/base-ground/active`);
          if (response.ok) {
            const data = await response.json();
            if (data.success && data.base_ground?.sprite_url) {
              grassUrl = data.base_ground.sprite_url;
            }
          }
        } catch (apiErr) {
          console.warn('Failed to fetch active base ground, using default');
        }

        const grassImg = await loadImage(grassUrl);
        if (!cancelled) {
          setGrassBackground(grassImg);
          loadedCount++;
          setLoadingProgress(loadedCount / totalCount);
        }
      } catch (err) {
        console.warn('Failed to load grass background, will use fallback color');
      }

      // Load all sprite images in parallel with progress tracking
      const loadPromises = spriteUrls.map(async (url) => {
        try {
          const img = await loadImage(url);
          if (!cancelled) {
            loaded.set(url, img);
            loadedCount++;
            setLoadingProgress(loadedCount / totalCount);
          }
        } catch (err) {
          // Log warning but don't fail - some sprites may be optional
          console.warn(`Failed to load sprite: ${url}`);
        }
      });

      await Promise.all(loadPromises);

      if (!cancelled) {
        setSprites(loaded);
        setIsLoading(false);
      }
    };

    loadAllSprites().catch((err) => {
      if (!cancelled) {
        setError(err.message);
        setIsLoading(false);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [spriteUrls]);

  return {
    sprites,
    grassBackground,
    isLoading,
    loadingProgress,
    error,
  };
}

/**
 * Get a sprite from the loaded sprites map by building type ID
 */
export function getSprite(
  sprites: Map<string, HTMLImageElement>,
  buildingTypeId: string
): HTMLImageElement | null {
  const url = getBuildingSpriteUrl(buildingTypeId);
  if (!url) return null;
  return sprites.get(url) || null;
}

/**
 * Get terrain sprite from the loaded sprites map
 */
export function getTerrainSprite(
  sprites: Map<string, HTMLImageElement>,
  terrainType: string
): HTMLImageElement | null {
  const path = TERRAIN_SPRITES[terrainType];
  if (!path) return null;
  const url = `${SPRITE_BASE_URL}/${path}`;
  return sprites.get(url) || null;
}
