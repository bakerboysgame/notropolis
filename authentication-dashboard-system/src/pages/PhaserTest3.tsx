import { useState, useRef } from 'react';
import { PhaserGameTopDown } from '../components/game/phaser/PhaserGameTopDown';
import type { PhaserGameHandle } from '../components/game/phaser/types';
import type { GameMap, Tile, TerrainType } from '../types/game';

// Mock map data - 50×50 top-down view test map
const mockMap: GameMap = {
  id: 'test-map-topdown',
  name: 'Top-Down Test City',
  country: 'UK',
  location_type: 'city',
  width: 50,
  height: 50,
  hero_net_worth: 1000000,
  hero_cash: 500000,
  hero_land_percentage: 51,
  police_strike_day: 7,
  forced_hero_after_ticks: null,
  created_at: new Date().toISOString(),
  is_active: true,
};

// Generate 50×50 top-down map with road grid and random terrain
function generateMockTiles(): Tile[] {
  const tiles: Tile[] = [];

  for (let y = 0; y < 50; y++) {
    for (let x = 0; x < 50; x++) {
      let terrainType: TerrainType = 'free_land';

      // Create road grid every 10 tiles
      const isHorizontalRoad = y % 10 === 0 || y % 10 === 1;
      const isVerticalRoad = x % 10 === 0 || x % 10 === 1;

      if (isHorizontalRoad || isVerticalRoad) {
        terrainType = 'road';
      } else {
        // Random terrain for non-road tiles
        const rand = Math.random();
        if (rand < 0.6) terrainType = 'free_land';      // 60%
        else if (rand < 0.7) terrainType = 'trees';     // 10%
        else if (rand < 0.8) terrainType = 'dirt_track'; // 10%
        else if (rand < 0.85) terrainType = 'water';    // 5%
        else if (rand < 0.92) terrainType = 'snow';     // 7%
        else terrainType = 'sand';                      // 8%
      }

      tiles.push({
        id: `tile-${x}-${y}`,
        map_id: mockMap.id,
        x,
        y,
        terrain_type: terrainType,
        special_building: null,
        owner_company_id: null,
        purchased_at: null,
      });
    }
  }
  return tiles;
}

const mockTiles = generateMockTiles();

export function PhaserTest3() {
  const [selectedTile, setSelectedTile] = useState<{ x: number; y: number } | null>(null);
  const [centerTile, setCenterTile] = useState({ x: 25, y: 25 });
  const [characterCount, setCharacterCount] = useState(0);
  const [carCount, setCarCount] = useState(0);
  const [zoom, setZoom] = useState(0.5);
  const gameRef = useRef<PhaserGameHandle>(null);

  const handleTileClick = (coords: { x: number; y: number }) => {
    console.log('Tile clicked:', coords);
    setSelectedTile(coords);
  };

  const handleSpawnCharacter = () => {
    const success = gameRef.current?.spawnCharacter();
    if (success) {
      setCharacterCount(gameRef.current?.getCharacterCount() ?? 0);
    }
  };

  const handleSpawnCar = () => {
    const success = gameRef.current?.spawnCar();
    if (success) {
      setCarCount(gameRef.current?.getCarCount() ?? 0);
    }
  };

  const handleClearAll = () => {
    gameRef.current?.clearCharacters();
    gameRef.current?.clearCars();
    setCharacterCount(0);
    setCarCount(0);
  };

  const handleSpawn10 = () => {
    for (let i = 0; i < 10; i++) {
      gameRef.current?.spawnCharacter();
      gameRef.current?.spawnCar();
    }
    setCharacterCount(gameRef.current?.getCharacterCount() ?? 0);
    setCarCount(gameRef.current?.getCarCount() ?? 0);
  };

  const handleZoomIn = () => {
    const newZoom = Math.min(zoom * 1.5, 2.0);
    setZoom(newZoom);
    gameRef.current?.setZoom(newZoom);
  };

  const handleZoomOut = () => {
    const newZoom = Math.max(zoom / 1.5, 0.1);
    setZoom(newZoom);
    gameRef.current?.setZoom(newZoom);
  };

  const handleZoomReset = () => {
    const newZoom = 1.0;
    setZoom(newZoom);
    gameRef.current?.setZoom(newZoom);
  };

  return (
    <div className="w-screen h-screen bg-gray-900 relative">
      <PhaserGameTopDown
        ref={gameRef}
        map={mockMap}
        tiles={mockTiles}
        buildings={[]}
        activeCompanyId="company-1"
        centerTile={centerTile}
        selectedTile={selectedTile}
        onTileClick={handleTileClick}
        onCenterChange={(coords) => {
          console.log('Center changed:', coords);
          setCenterTile(coords);
        }}
      />

      {/* Debug overlay */}
      <div className="absolute top-4 left-4 bg-black/70 text-white p-4 rounded-lg text-sm font-mono">
        <div className="text-green-400 font-bold mb-2">TOP-DOWN TEST</div>
        <div>Map: 50×50 (top-down view)</div>
        <div>Selected: {selectedTile ? `(${selectedTile.x}, ${selectedTile.y})` : 'None'}</div>
        <div>Center: ({centerTile.x}, {centerTile.y})</div>
        <div>Zoom: {zoom.toFixed(2)}x</div>
        <div className="mt-2 text-purple-400 text-xs">
          Testing NPCs and vehicles in top-down perspective
        </div>
      </div>

      {/* Zoom Controls */}
      <div className="absolute bottom-4 left-4 bg-black/70 text-white p-4 rounded-lg text-sm font-mono">
        <div className="text-yellow-400 font-bold mb-2">Zoom Controls</div>
        <div className="flex flex-col gap-2">
          <button
            onClick={handleZoomIn}
            className="px-3 py-1 bg-blue-600 hover:bg-blue-700 rounded text-xs"
          >
            Zoom In (+)
          </button>
          <button
            onClick={handleZoomOut}
            className="px-3 py-1 bg-blue-600 hover:bg-blue-700 rounded text-xs"
          >
            Zoom Out (-)
          </button>
          <button
            onClick={handleZoomReset}
            className="px-3 py-1 bg-gray-600 hover:bg-gray-700 rounded text-xs"
          >
            Reset (1.0x)
          </button>
        </div>
      </div>

      {/* Characters & Vehicles Controls */}
      <div className="absolute top-4 right-4 bg-black/70 text-white p-4 rounded-lg text-sm font-mono">
        <div className="text-yellow-400 font-bold mb-2">Characters & Vehicles</div>
        <div className="mb-2">Characters: {characterCount}</div>
        <div className="mb-3">Cars: {carCount}</div>
        <div className="flex flex-col gap-2">
          <button
            onClick={handleSpawnCharacter}
            className="px-3 py-1 bg-green-600 hover:bg-green-700 rounded text-xs"
          >
            Spawn Character
          </button>
          <button
            onClick={handleSpawnCar}
            className="px-3 py-1 bg-blue-600 hover:bg-blue-700 rounded text-xs"
          >
            Spawn Car
          </button>
          <button
            onClick={handleSpawn10}
            className="px-3 py-1 bg-purple-600 hover:bg-purple-700 rounded text-xs"
          >
            Spawn 10 Each
          </button>
          <button
            onClick={handleClearAll}
            className="px-3 py-1 bg-red-600 hover:bg-red-700 rounded text-xs"
          >
            Clear All
          </button>
        </div>
      </div>
    </div>
  );
}
