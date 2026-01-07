import { useEffect, useRef } from 'react';
import * as PIXI from 'pixi.js';

interface PixiGameProps {
  width: number;
  height: number;
  tiles: Array<{ x: number; y: number; type: 'building' | 'road' | 'water' | 'dirt_track' | 'grass'; buildingType?: string }>;
  tileSize: number;
  onTileClick?: (x: number, y: number) => void;
}

export function PixiGame({ width, height, tiles, tileSize, onTileClick }: PixiGameProps) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const appRef = useRef<PIXI.Application | null>(null);

  useEffect(() => {
    if (!canvasRef.current) return;

    // Create PixiJS application
    const app = new PIXI.Application();
    appRef.current = app;

    // Initialize the app
    (async () => {
      await app.init({
        width,
        height,
        backgroundColor: 0x1a1a1a,
        resolution: window.devicePixelRatio || 1,
        autoDensity: true,
      });

      canvasRef.current?.appendChild(app.canvas);

      // Create a container for all tiles
      const tilesContainer = new PIXI.Container();
      app.stage.addChild(tilesContainer);

      // Load grass texture
      const grassTexture = await PIXI.Assets.load('/Tiles/1x1grass.png');

      // Fetch building sprites from Asset Manager API
      const buildingTextures = new Map<string, PIXI.Texture>();
      try {
        const token = localStorage.getItem('token');
        const headers: HeadersInit = token ? { 'Authorization': `Bearer ${token}` } : {};

        const response = await fetch('https://api.notropolis.net/api/assets/buildings/published', {
          headers,
        });

        if (response.ok) {
          const data = await response.json();
          if (data.success && data.sprites) {
            console.log(`Loading ${Object.keys(data.sprites).length} building sprites from R2...`);
            // Load all building sprite textures
            const loadPromises = Object.entries(data.sprites).map(async ([buildingType, sprite]: [string, any]) => {
              if (sprite.url) {
                try {
                  const texture = await PIXI.Assets.load(sprite.url);
                  buildingTextures.set(buildingType, texture);
                  console.log(`✓ Loaded ${buildingType} from ${sprite.url}`);
                } catch (err) {
                  console.warn(`Failed to load sprite for ${buildingType}:`, err);
                }
              }
            });
            await Promise.all(loadPromises);
            console.log(`Successfully loaded ${buildingTextures.size} building sprites`);
          }
        }
      } catch (err) {
        console.warn('Failed to fetch building sprites from API:', err);
      }

      // Fallback to local burger bar if no sprites loaded
      if (buildingTextures.size === 0) {
        const burgerBarTexture = await PIXI.Assets.load('/Tiles/bbar.webp');
        buildingTextures.set('burger_bar', burgerBarTexture);
      }

      // Create extended grass background (larger than map for edge overflow)
      const bgPadding = 10; // tiles of padding around the map

      for (let y = -bgPadding; y < 50 + bgPadding; y++) {
        for (let x = -bgPadding; x < 50 + bgPadding; x++) {
          const bgGrass = new PIXI.Sprite(grassTexture);
          bgGrass.x = x * tileSize;
          bgGrass.y = y * tileSize;
          bgGrass.width = tileSize;
          bgGrass.height = tileSize;
          tilesContainer.addChild(bgGrass);
        }
      }


      // Render each tile
      for (const tile of tiles) {
        const x = tile.x * tileSize;
        const y = tile.y * tileSize;

        switch (tile.type) {
          case 'water':
            // Water: blue with slight variation
            const water = new PIXI.Graphics();
            water.rect(x, y, tileSize, tileSize);
            water.fill(0x2b5797);
            water.stroke({ width: 1, color: 0x1a3a5c, alpha: 0.3 });
            tilesContainer.addChild(water);
            break;

          case 'road':
            // Road: gray rectangle
            const road = new PIXI.Graphics();
            road.rect(x, y, tileSize, tileSize);
            road.fill(0x444444);
            road.stroke({ width: 1, color: 0x000000, alpha: 0.2 });
            tilesContainer.addChild(road);
            break;

          case 'dirt_track':
            // Dirt track: brown/tan color
            const dirt = new PIXI.Graphics();
            dirt.rect(x, y, tileSize, tileSize);
            dirt.fill(0x8b7355);
            dirt.stroke({ width: 1, color: 0x6b5335, alpha: 0.3 });
            tilesContainer.addChild(dirt);
            break;

          case 'grass':
            // Grass: use grass texture
            const grass = new PIXI.Sprite(grassTexture);
            grass.x = x;
            grass.y = y;
            grass.width = tileSize;
            grass.height = tileSize;
            tilesContainer.addChild(grass);
            break;

          case 'building':
            // Building: grass + building sprite
            // 1. Grass layer
            const grassBg = new PIXI.Sprite(grassTexture);
            grassBg.x = x;
            grassBg.y = y;
            grassBg.width = tileSize;
            grassBg.height = tileSize;
            tilesContainer.addChild(grassBg);

            // 2. Building layer (80% size, centered)
            const buildingType = tile.buildingType || 'burger_bar';
            const buildingTexture = buildingTextures.get(buildingType) || buildingTextures.values().next().value;

            if (buildingTexture) {
              const buildingSize = tileSize * 0.8; // Changed from 0.9 to 0.8
              const offset = (tileSize - buildingSize) / 2;
              const building = new PIXI.Sprite(buildingTexture);
              building.x = x + offset;
              building.y = y + offset;
              building.width = buildingSize;
              building.height = buildingSize;
              tilesContainer.addChild(building);
            }
            break;
        }
      }

      // Map boundaries and camera controls
      const mapWidth = 50 * tileSize;
      const mapHeight = 50 * tileSize;
      const bgPaddingPixels = 10 * tileSize; // Extended grass background

      // Get map boundaries with current zoom (allows some overflow into grass background)
      const getBounds = () => {
        const scale = tilesContainer.scale.x;
        const maxX = bgPaddingPixels * scale * 0.5; // Allow some overflow on top/left
        const minX = width - (mapWidth + bgPaddingPixels * 0.5) * scale; // Allow some overflow on bottom/right
        const maxY = bgPaddingPixels * scale * 0.5;
        const minY = height - (mapHeight + bgPaddingPixels * 0.5) * scale;
        return { minX, maxX, minY, maxY };
      };

      // Apply bounds with soft bounce (more lenient - 0.7 allows more overflow)
      const applyBounds = (x: number, y: number, bounce = 0.7) => {
        const bounds = getBounds();
        let newX = x;
        let newY = y;

        // Horizontal bounds
        if (newX > bounds.maxX) {
          newX = bounds.maxX + (newX - bounds.maxX) * bounce;
        } else if (newX < bounds.minX) {
          newX = bounds.minX + (newX - bounds.minX) * bounce;
        }

        // Vertical bounds
        if (newY > bounds.maxY) {
          newY = bounds.maxY + (newY - bounds.maxY) * bounce;
        } else if (newY < bounds.minY) {
          newY = bounds.minY + (newY - bounds.minY) * bounce;
        }

        return { x: newX, y: newY };
      };

      // Camera state
      let isDragging = false;
      let dragStart = { x: 0, y: 0 };
      let cameraStart = { x: 0, y: 0 };
      let dragDistance = 0;
      let velocity = { x: 0, y: 0 };
      let lastPos = { x: 0, y: 0, time: 0 };

      // Touch state for pinch zoom
      const touches = new Map<number, { x: number; y: number }>();
      let initialPinchDistance = 0;
      let initialScale = 1;

      // Mouse/touch down
      app.canvas.addEventListener('pointerdown', (e) => {
        isDragging = true;
        dragStart = { x: e.clientX, y: e.clientY };
        cameraStart = { x: tilesContainer.x, y: tilesContainer.y };
        dragDistance = 0;
        velocity = { x: 0, y: 0 };
        lastPos = { x: e.clientX, y: e.clientY, time: Date.now() };

        touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
      });

      // Mouse/touch move
      app.canvas.addEventListener('pointermove', (e) => {
        touches.set(e.pointerId, { x: e.clientX, y: e.clientY });

        // Pinch to zoom (two fingers)
        if (touches.size === 2) {
          const touchArray = Array.from(touches.values());
          const dx = touchArray[1].x - touchArray[0].x;
          const dy = touchArray[1].y - touchArray[0].y;
          const distance = Math.sqrt(dx * dx + dy * dy);

          if (initialPinchDistance === 0) {
            initialPinchDistance = distance;
            initialScale = tilesContainer.scale.x;
          } else {
            const scale = (distance / initialPinchDistance) * initialScale;
            const newScale = Math.max(0.1, Math.min(3, scale));
            tilesContainer.scale.set(newScale);
          }
          return;
        }

        if (!isDragging) return;

        const dx = e.clientX - dragStart.x;
        const dy = e.clientY - dragStart.y;
        dragDistance = Math.sqrt(dx * dx + dy * dy);

        // Calculate velocity for momentum
        const now = Date.now();
        const dt = now - lastPos.time;
        if (dt > 0) {
          velocity.x = (e.clientX - lastPos.x) / dt * 16;
          velocity.y = (e.clientY - lastPos.y) / dt * 16;
        }
        lastPos = { x: e.clientX, y: e.clientY, time: now };

        // Apply movement with bounds
        const newPos = applyBounds(
          cameraStart.x + dx,
          cameraStart.y + dy
        );
        tilesContainer.x = newPos.x;
        tilesContainer.y = newPos.y;
      });

      // Mouse/touch up
      app.canvas.addEventListener('pointerup', (e) => {
        touches.delete(e.pointerId);

        if (touches.size === 0) {
          initialPinchDistance = 0;
        }

        if (isDragging && dragDistance < 10 && onTileClick) {
          // Click, not drag - calculate tile coordinates
          const canvasX = e.clientX - app.canvas.getBoundingClientRect().left;
          const canvasY = e.clientY - app.canvas.getBoundingClientRect().top;

          const worldX = (canvasX - tilesContainer.x) / tilesContainer.scale.x;
          const worldY = (canvasY - tilesContainer.y) / tilesContainer.scale.y;

          const tileX = Math.floor(worldX / tileSize);
          const tileY = Math.floor(worldY / tileSize);

          onTileClick(tileX, tileY);
        }

        isDragging = false;
      });

      app.canvas.addEventListener('pointercancel', (e) => {
        touches.delete(e.pointerId);
        if (touches.size === 0) {
          initialPinchDistance = 0;
        }
      });


      // Minimap
      const minimapSize = 150;
      const minimapContainer = new PIXI.Container();
      minimapContainer.x = width - minimapSize - 20;
      minimapContainer.y = 20;
      app.stage.addChild(minimapContainer);

      // Minimap background
      const minimapBg = new PIXI.Graphics();
      minimapBg.rect(0, 0, minimapSize, minimapSize);
      minimapBg.fill({ color: 0x1a1a1a, alpha: 0.8 });
      minimapBg.stroke({ width: 2, color: 0x0194F9 });
      minimapContainer.addChild(minimapBg);

      // Minimap content (simplified map view)
      const minimapContent = new PIXI.Graphics();
      const minimapScale = minimapSize / mapWidth;

      // Draw simplified tiles
      for (const tile of tiles) {
        const mx = tile.x * tileSize * minimapScale;
        const my = tile.y * tileSize * minimapScale;
        const ms = tileSize * minimapScale;

        let color = 0x2d5016; // grass
        if (tile.type === 'water') color = 0x2b5797;
        else if (tile.type === 'road') color = 0x444444;
        else if (tile.type === 'building') color = 0xff0000;

        minimapContent.rect(mx, my, ms, ms);
        minimapContent.fill(color);
      }
      minimapContainer.addChild(minimapContent);

      // Viewport indicator on minimap
      const viewportIndicator = new PIXI.Graphics();
      minimapContainer.addChild(viewportIndicator);

      // Update viewport indicator
      const updateViewportIndicator = () => {
        viewportIndicator.clear();
        const viewWidth = width / tilesContainer.scale.x;
        const viewHeight = height / tilesContainer.scale.x;
        const viewX = -tilesContainer.x / tilesContainer.scale.x;
        const viewY = -tilesContainer.y / tilesContainer.scale.x;

        viewportIndicator.rect(
          viewX * minimapScale,
          viewY * minimapScale,
          viewWidth * minimapScale,
          viewHeight * minimapScale
        );
        viewportIndicator.stroke({ width: 2, color: 0xffffff, alpha: 0.8 });
      };

      // Momentum physics (throw gesture)
      app.ticker.add(() => {
        // Update viewport indicator
        updateViewportIndicator();

        if (!isDragging && (Math.abs(velocity.x) > 0.1 || Math.abs(velocity.y) > 0.1)) {
          tilesContainer.x += velocity.x;
          tilesContainer.y += velocity.y;

          // Check bounds and bounce back if needed (softer bounce)
          const bounds = getBounds();
          if (tilesContainer.x > bounds.maxX || tilesContainer.x < bounds.minX) {
            velocity.x *= -0.3; // Softer bounce with more energy loss
            tilesContainer.x = Math.max(bounds.minX, Math.min(bounds.maxX, tilesContainer.x));
          }
          if (tilesContainer.y > bounds.maxY || tilesContainer.y < bounds.minY) {
            velocity.y *= -0.3; // Softer bounce
            tilesContainer.y = Math.max(bounds.minY, Math.min(bounds.maxY, tilesContainer.y));
          }

          // Apply friction
          velocity.x *= 0.95;
          velocity.y *= 0.95;

          // Stop when velocity is very small
          if (Math.abs(velocity.x) < 0.1) velocity.x = 0;
          if (Math.abs(velocity.y) < 0.1) velocity.y = 0;
        }
      });

      // Mouse wheel zoom
      app.canvas.addEventListener('wheel', (e) => {
        e.preventDefault();
        const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
        const newScale = tilesContainer.scale.x * zoomFactor;

        if (newScale >= 0.1 && newScale <= 3) {
          tilesContainer.scale.set(newScale);
        }
      });

      // Center the view
      tilesContainer.x = width / 2 - (tiles.length > 0 ? 25 * tileSize / 2 : 0);
      tilesContainer.y = height / 2 - (tiles.length > 0 ? 25 * tileSize / 2 : 0);
      tilesContainer.scale.set(1.0);
    })();

    return () => {
      app.destroy(true, { children: true });
      appRef.current = null;
    };
  }, [width, height, tiles, tileSize, onTileClick]);

  return <div ref={canvasRef} className="absolute inset-0 w-full h-full" />;
}
