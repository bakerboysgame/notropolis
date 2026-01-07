import { useState } from 'react';
import { PixiGame } from '../components/game/pixijs/PixiGame';
import { PropertyModal } from '../components/game/PropertyModal';
import type { GameMap } from '../types/game';

// Available building types from Asset Manager
const BUILDING_TYPES = [
  'market_stall', 'hot_dog_stand', 'campsite', 'shop',          // Level 1
  'burger_bar', 'motel',                                         // Level 2
  'high_street_store', 'restaurant',                             // Level 3
  'manor',                                                       // Level 4
  'casino',                                                      // Level 5
  'bank', 'temple', 'police_station',                            // Special
];

// Generate 50×50 tile grid with varied terrain
function generateTiles() {
  const tiles: Array<{ x: number; y: number; type: 'building' | 'road' | 'water' | 'dirt_track' | 'grass'; buildingType?: string }> = [];
  const mapSize = 50;

  // First pass: Create base terrain (all grass)
  for (let y = 0; y < mapSize; y++) {
    for (let x = 0; x < mapSize; x++) {
      tiles.push({ x, y, type: 'grass' });
    }
  }

  // Helper to get/set tile type
  const getTile = (x: number, y: number) => tiles.find(t => t.x === x && t.y === y);
  const setTileType = (x: number, y: number, type: typeof tiles[0]['type']) => {
    const tile = getTile(x, y);
    if (tile) tile.type = type;
  };

  // Add river (vertical, meandering)
  let riverX = 15;
  for (let y = 0; y < mapSize; y++) {
    // Meander the river
    if (y % 8 === 0 && Math.random() > 0.5) {
      riverX += Math.random() > 0.5 ? 1 : -1;
      riverX = Math.max(12, Math.min(18, riverX));
    }

    // River is 2-3 tiles wide
    const riverWidth = 2 + (Math.random() > 0.7 ? 1 : 0);
    for (let dx = 0; dx < riverWidth; dx++) {
      if (riverX + dx < mapSize) {
        setTileType(riverX + dx, y, 'water');
      }
    }
  }

  // Add a lake in the corner
  for (let y = 35; y < 45; y++) {
    for (let x = 35; x < 45; x++) {
      const distFromCenter = Math.sqrt(Math.pow(x - 40, 2) + Math.pow(y - 40, 2));
      if (distFromCenter < 6) {
        setTileType(x, y, 'water');
      }
    }
  }

  // Add roads (grid every 10 tiles, 2 tiles wide)
  for (let y = 0; y < mapSize; y++) {
    for (let x = 0; x < mapSize; x++) {
      const isHorizontalRoad = y % 10 === 0 || y % 10 === 1;
      const isVerticalRoad = x % 10 === 0 || x % 10 === 1;

      if ((isHorizontalRoad || isVerticalRoad) && getTile(x, y)?.type !== 'water') {
        setTileType(x, y, 'road');
      }
    }
  }

  // Add some dirt tracks (connecting areas)
  for (let i = 0; i < 3; i++) {
    const startX = Math.floor(Math.random() * mapSize);
    const startY = Math.floor(Math.random() * mapSize);
    let trackX = startX;
    let trackY = startY;

    for (let j = 0; j < 15; j++) {
      const tile = getTile(trackX, trackY);
      if (tile && tile.type === 'grass') {
        setTileType(trackX, trackY, 'dirt_track');
      }

      // Random walk
      if (Math.random() > 0.5) {
        trackX += Math.random() > 0.5 ? 1 : -1;
      } else {
        trackY += Math.random() > 0.5 ? 1 : -1;
      }
      trackX = Math.max(0, Math.min(mapSize - 1, trackX));
      trackY = Math.max(0, Math.min(mapSize - 1, trackY));
    }
  }

  // Add buildings (spaced out with grass around them)
  for (let y = 3; y < mapSize - 1; y += 5) {
    for (let x = 3; x < mapSize - 1; x += 5) {
      const tile = getTile(x, y);
      // Only place building if on grass and not too close to water
      if (tile && tile.type === 'grass') {
        // Check if there's water nearby
        let hasWaterNearby = false;
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            const nearTile = getTile(x + dx, y + dy);
            if (nearTile?.type === 'water') hasWaterNearby = true;
          }
        }

        if (!hasWaterNearby && Math.random() > 0.3) {
          setTileType(x, y, 'building');
          // Assign random building type
          const randomBuildingType = BUILDING_TYPES[Math.floor(Math.random() * BUILDING_TYPES.length)];
          const buildingTile = getTile(x, y);
          if (buildingTile) {
            (buildingTile as any).buildingType = randomBuildingType;
          }
        }
      }
    }
  }

  return tiles;
}

const mockTiles = generateTiles();

// Mock map for PropertyModal
const mockMap: GameMap = {
  id: 'pixijs-test-map',
  name: 'PixiJS Test City',
  country: 'UK',
  location_type: 'city',
  width: 50,
  height: 50,
  hero_net_worth: 0,
  hero_cash: 0,
  hero_land_percentage: 0,
  police_strike_day: 0,
  forced_hero_after_ticks: null,
  created_at: new Date().toISOString(),
  is_active: true,
};

export function PixiJSTest1() {
  const [selectedTile, setSelectedTile] = useState<{ x: number; y: number } | null>(null);

  const handleTileClick = (x: number, y: number) => {
    console.log('Tile clicked:', x, y);
    setSelectedTile({ x, y });
  };

  const handleCloseModal = () => {
    setSelectedTile(null);
  };

  const handleRefresh = () => {
    // In a real implementation, this would refresh the map data
    console.log('Refresh requested');
  };

  return (
    <div className="w-screen h-screen bg-gray-900 relative">
      <PixiGame
        width={window.innerWidth}
        height={window.innerHeight}
        tiles={mockTiles}
        tileSize={64}
        onTileClick={handleTileClick}
      />

      {/* Debug overlay */}
      <div className="absolute top-4 left-4 bg-black/70 text-white p-4 rounded-lg text-sm font-mono">
        <div className="text-purple-400 font-bold mb-2">PixiJS TEST</div>
        <div>Map: 50×50 tiles</div>
        <div>Engine: PixiJS v8</div>
        <div>Tile Size: 64px</div>
        <div className="mt-2 text-gray-400 text-xs">
          Drag to pan • Scroll to zoom
        </div>
      </div>

      {/* Info panel */}
      <div className="absolute top-4 right-4 bg-black/70 text-white p-4 rounded-lg text-sm font-mono">
        <div className="text-yellow-400 font-bold mb-2">Controls</div>
        <div className="text-xs space-y-1">
          <div>🖱️ Drag: Pan camera</div>
          <div>🖱️ Scroll: Zoom in/out</div>
        </div>
      </div>

      {/* Comparison info */}
      <div className="absolute bottom-4 left-4 bg-black/70 text-white p-4 rounded-lg text-sm font-mono">
        <div className="text-green-400 font-bold mb-2">PixiJS vs Phaser</div>
        <div className="text-xs space-y-1">
          <div>Bundle: ~400KB (vs 2.5MB)</div>
          <div>Setup: Simpler API</div>
          <div>Depth: Manual Y-sort</div>
          <div>Assets: Direct loading</div>
          <div className="mt-2 text-yellow-400">Click tiles to interact!</div>
        </div>
      </div>

      {/* PropertyModal */}
      {selectedTile && (
        <PropertyModal
          mapId={mockMap.id}
          x={selectedTile.x}
          y={selectedTile.y}
          map={mockMap}
          onClose={handleCloseModal}
          onRefresh={handleRefresh}
        />
      )}
    </div>
  );
}
