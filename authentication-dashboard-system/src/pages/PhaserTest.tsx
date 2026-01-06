import { useState, useRef } from 'react';
import { PhaserGame, PhaserGameHandle } from '../components/game/phaser/PhaserGame';
import type { GameMap, Tile, BuildingInstance, TerrainType } from '../types/game';
import { AVAILABLE_BUILDING_TYPES } from '../components/game/phaser/utils/assetLoader';

// Mock map data - 200×200 phaser tiles for 50×50 notropolis tiles (1 notropolis tile = 4×4 phaser tiles)
const mockMap: GameMap = {
  id: 'test-map-1',
  name: 'Notropolis City',
  country: 'UK',
  location_type: 'city',
  width: 200,
  height: 200,
  hero_net_worth: 1000000,
  hero_cash: 500000,
  hero_land_percentage: 51,
  police_strike_day: 7,
  forced_hero_after_ticks: null,
  created_at: new Date().toISOString(),
  is_active: true,
};

// Generate 200×200 map with random terrain
function generateMockTiles(): Tile[] {
  const tiles: Tile[] = [];

  for (let y = 0; y < 200; y++) {
    for (let x = 0; x < 200; x++) {
      // Random terrain with weighted distribution
      let terrainType: TerrainType = 'free_land';
      const rand = Math.random();

      if (rand < 0.5) terrainType = 'free_land';      // 50%
      else if (rand < 0.6) terrainType = 'road';      // 10%
      else if (rand < 0.7) terrainType = 'trees';     // 10%
      else if (rand < 0.8) terrainType = 'dirt_track'; // 10%
      else if (rand < 0.85) terrainType = 'water';    // 5%
      else if (rand < 0.9) terrainType = 'snow';      // 5%
      else terrainType = 'sand';                      // 10%

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

// Initial buildings - place motels in 50×50 notropolis grid (1 per 4 phaser tiles)
function generateInitialBuildings(): BuildingInstance[] {
  const buildings: BuildingInstance[] = [];
  let buildingId = 1;

  // Place motels in a 50×50 grid (every 4 phaser tiles = 1 notropolis tile)
  for (let y = 2; y < 200; y += 4) {
    for (let x = 2; x < 200; x += 4) {
      buildings.push({
        id: `building-${buildingId}`,
        tile_id: `tile-${x}-${y}`,
        building_type_id: 'motel',
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
      });
      buildingId++;
    }
  }
  return buildings;
}

const initialBuildings: BuildingInstance[] = generateInitialBuildings();

export function PhaserTest() {
  const [selectedTile, setSelectedTile] = useState<{ x: number; y: number } | null>(null);
  const [centerTile, setCenterTile] = useState({ x: 100, y: 100 });
  const [characterCount, setCharacterCount] = useState(0);
  const [carCount, setCarCount] = useState(0);
  const [buildings, setBuildings] = useState<BuildingInstance[]>(initialBuildings);
  const [selectedBuildingType, setSelectedBuildingType] = useState(AVAILABLE_BUILDING_TYPES[0]);
  const [placementMode, setPlacementMode] = useState(true);
  const [buildingIdCounter, setBuildingIdCounter] = useState(1);
  const [zoom, setZoom] = useState(0.3);
  const gameRef = useRef<PhaserGameHandle>(null);

  const handleTileClick = (coords: { x: number; y: number }) => {
    console.log('Tile clicked:', coords);
    setSelectedTile(coords);

    if (placementMode) {
      // Check if there's already a building at this tile
      const tileId = `tile-${coords.x}-${coords.y}`;
      const existingBuilding = buildings.find((b) => b.tile_id === tileId);

      if (existingBuilding) {
        // Remove existing building
        setBuildings(buildings.filter((b) => b.tile_id !== tileId));
      } else {
        // Place new building
        const newBuilding: BuildingInstance = {
          id: `building-${buildingIdCounter}`,
          tile_id: tileId,
          building_type_id: selectedBuildingType,
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
        };
        setBuildings([...buildings, newBuilding]);
        setBuildingIdCounter(buildingIdCounter + 1);
      }
    }
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

  const handleClearBuildings = () => {
    setBuildings([]);
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
      <PhaserGame
        ref={gameRef}
        map={mockMap}
        tiles={mockTiles}
        buildings={buildings}
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
        <div>Selected: {selectedTile ? `(${selectedTile.x}, ${selectedTile.y})` : 'None'}</div>
        <div>Center: ({centerTile.x}, {centerTile.y})</div>
        <div>Buildings: {buildings.length}</div>
        <div>Zoom: {zoom.toFixed(2)}x</div>
        <div className="mt-2 text-gray-400 text-xs">
          Click to {placementMode ? 'place/remove building' : 'select tile'}
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

      {/* Building Placement Controls */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-black/70 text-white p-4 rounded-lg text-sm font-mono">
        <div className="text-yellow-400 font-bold mb-2">Building Placement</div>
        <div className="flex items-center gap-2 mb-3">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={placementMode}
              onChange={(e) => setPlacementMode(e.target.checked)}
              className="w-4 h-4"
            />
            <span>Placement Mode</span>
          </label>
        </div>
        <div className="mb-3">
          <label className="block text-xs text-gray-400 mb-1">Building Type:</label>
          <select
            value={selectedBuildingType}
            onChange={(e) => setSelectedBuildingType(e.target.value)}
            className="bg-gray-800 text-white px-2 py-1 rounded text-xs w-full"
          >
            {AVAILABLE_BUILDING_TYPES.map((type) => (
              <option key={type} value={type}>
                {type.replace(/_/g, ' ')}
              </option>
            ))}
          </select>
        </div>
        <button
          onClick={handleClearBuildings}
          className="px-3 py-1 bg-red-600 hover:bg-red-700 rounded text-xs w-full"
        >
          Clear All Buildings
        </button>
      </div>

      {/* Stage 4 Test Controls */}
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
