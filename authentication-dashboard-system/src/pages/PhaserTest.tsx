import { useState, useRef } from 'react';
import { PhaserGame, PhaserGameHandle } from '../components/game/phaser/PhaserGame';
import type { GameMap, Tile, BuildingInstance, TerrainType } from '../types/game';

// Mock map data
const mockMap: GameMap = {
  id: 'test-map-1',
  name: 'Test Town',
  country: 'UK',
  location_type: 'town',
  width: 15,
  height: 15,
  hero_net_worth: 1000000,
  hero_cash: 500000,
  hero_land_percentage: 51,
  police_strike_day: 7,
  forced_hero_after_ticks: null,
  created_at: new Date().toISOString(),
  is_active: true,
};

// Generate mock tiles with all terrain types for testing
function generateMockTiles(): Tile[] {
  const tiles: Tile[] = [];

  for (let y = 0; y < 15; y++) {
    for (let x = 0; x < 15; x++) {
      // Create varied terrain for visual testing
      let terrainType: TerrainType = 'free_land';

      // Water on edges
      if (x === 0 || y === 0 || x === 14 || y === 14) {
        terrainType = 'water';
      }
      // Roads through center
      else if (x === 7 || y === 7) {
        terrainType = 'road';
      }
      // Dirt track diagonal
      else if (x === y && x > 1 && x < 13) {
        terrainType = 'dirt_track';
      }
      // Trees scattered
      else if ((x + y) % 5 === 0) {
        terrainType = 'trees';
      }

      tiles.push({
        id: `tile-${x}-${y}`,
        map_id: mockMap.id,
        x,
        y,
        terrain_type: terrainType,
        special_building: null,
        owner_company_id: x >= 3 && x <= 5 && y >= 3 && y <= 5 ? 'company-1' : null,
        purchased_at: null,
      });
    }
  }
  return tiles;
}

// Mock buildings for testing depth sorting, outlines, and damage
const mockBuildings: BuildingInstance[] = [
  // Building at (3,3) - owned by active company, no damage
  {
    id: 'building-1',
    tile_id: 'tile-3-3',
    building_type_id: 'corner_shop',
    company_id: 'company-1',
    variant: null,
    damage_percent: 0,
    is_on_fire: false,
    is_collapsed: false,
    is_for_sale: false,
    sale_price: null,
    calculated_profit: 100,
    profit_modifiers: {},
    calculated_value: 5000,
    value_modifiers: {},
    needs_profit_recalc: false,
    built_at: new Date().toISOString(),
  },
  // Building at (4,4) - owned by active company, 50% damage
  {
    id: 'building-2',
    tile_id: 'tile-4-4',
    building_type_id: 'corner_shop',
    company_id: 'company-1',
    variant: null,
    damage_percent: 50,
    is_on_fire: false,
    is_collapsed: false,
    is_for_sale: false,
    sale_price: null,
    calculated_profit: 50,
    profit_modifiers: {},
    calculated_value: 2500,
    value_modifiers: {},
    needs_profit_recalc: false,
    built_at: new Date().toISOString(),
  },
  // Building at (5,5) - owned by active company, collapsed
  {
    id: 'building-3',
    tile_id: 'tile-5-5',
    building_type_id: 'corner_shop',
    company_id: 'company-1',
    variant: null,
    damage_percent: 100,
    is_on_fire: false,
    is_collapsed: true,
    is_for_sale: false,
    sale_price: null,
    calculated_profit: 0,
    profit_modifiers: {},
    calculated_value: 0,
    value_modifiers: {},
    needs_profit_recalc: false,
    built_at: new Date().toISOString(),
  },
  // Building at (8,8) - owned by different company (no outline)
  {
    id: 'building-4',
    tile_id: 'tile-8-8',
    building_type_id: 'corner_shop',
    company_id: 'company-2',
    variant: null,
    damage_percent: 0,
    is_on_fire: false,
    is_collapsed: false,
    is_for_sale: true, // For sale to test for-sale overlay
    sale_price: 10000,
    calculated_profit: 100,
    profit_modifiers: {},
    calculated_value: 5000,
    value_modifiers: {},
    needs_profit_recalc: false,
    built_at: new Date().toISOString(),
  },
  // Building at (9,9) - on fire to test fire effect
  {
    id: 'building-5',
    tile_id: 'tile-9-9',
    building_type_id: 'corner_shop',
    company_id: 'company-2',
    variant: null,
    damage_percent: 25,
    is_on_fire: true, // On fire to test fire overlay
    is_collapsed: false,
    is_for_sale: false,
    sale_price: null,
    calculated_profit: 75,
    profit_modifiers: {},
    calculated_value: 3750,
    value_modifiers: {},
    needs_profit_recalc: false,
    built_at: new Date().toISOString(),
  },
  // Buildings for depth sorting test
  {
    id: 'building-6',
    tile_id: 'tile-10-10',
    building_type_id: 'corner_shop',
    company_id: 'company-2',
    variant: null,
    damage_percent: 0,
    is_on_fire: false,
    is_collapsed: false,
    is_for_sale: false,
    sale_price: null,
    calculated_profit: 100,
    profit_modifiers: {},
    calculated_value: 5000,
    value_modifiers: {},
    needs_profit_recalc: false,
    built_at: new Date().toISOString(),
  },
  {
    id: 'building-7',
    tile_id: 'tile-11-11',
    building_type_id: 'corner_shop',
    company_id: 'company-2',
    variant: null,
    damage_percent: 0,
    is_on_fire: false,
    is_collapsed: false,
    is_for_sale: false,
    sale_price: null,
    calculated_profit: 100,
    profit_modifiers: {},
    calculated_value: 5000,
    value_modifiers: {},
    needs_profit_recalc: false,
    built_at: new Date().toISOString(),
  },
  {
    id: 'building-8',
    tile_id: 'tile-12-12',
    building_type_id: 'corner_shop',
    company_id: 'company-2',
    variant: null,
    damage_percent: 0,
    is_on_fire: false,
    is_collapsed: false,
    is_for_sale: false,
    sale_price: null,
    calculated_profit: 100,
    profit_modifiers: {},
    calculated_value: 5000,
    value_modifiers: {},
    needs_profit_recalc: false,
    built_at: new Date().toISOString(),
  },
];

const mockTiles = generateMockTiles();

export function PhaserTest() {
  const [selectedTile, setSelectedTile] = useState<{ x: number; y: number } | null>(null);
  const [centerTile, setCenterTile] = useState({ x: 7, y: 7 });
  const [characterCount, setCharacterCount] = useState(0);
  const [carCount, setCarCount] = useState(0);
  const gameRef = useRef<PhaserGameHandle>(null);

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

  return (
    <div className="w-screen h-screen bg-gray-900 relative">
      <PhaserGame
        ref={gameRef}
        map={mockMap}
        tiles={mockTiles}
        buildings={mockBuildings}
        activeCompanyId="company-1"
        centerTile={centerTile}
        selectedTile={selectedTile}
        onTileClick={(coords) => {
          console.log('Tile clicked:', coords);
          setSelectedTile(coords);
        }}
        onCenterChange={(coords) => {
          console.log('Center changed:', coords);
          setCenterTile(coords);
        }}
      />
      {/* Debug overlay */}
      <div className="absolute top-4 left-4 bg-black/70 text-white p-4 rounded-lg text-sm font-mono">
        <div>Selected: {selectedTile ? `(${selectedTile.x}, ${selectedTile.y})` : 'None'}</div>
        <div>Center: ({centerTile.x}, {centerTile.y})</div>
        <div className="mt-2 text-gray-400 text-xs">
          Click to select tile, drag to pan, scroll to zoom
        </div>
      </div>

      {/* Stage 4 Test Controls */}
      <div className="absolute top-4 right-4 bg-black/70 text-white p-4 rounded-lg text-sm font-mono">
        <div className="text-yellow-400 font-bold mb-2">Stage 4: Characters & Vehicles</div>
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
