import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { brand } from '../brand';

// Grid cell types matching the game screenshot
type CellType = 'grass' | 'building' | 'building_light' | 'road' | 'dirt_road' | 'water' | 'owned' | 'special';

// Colors using brand palette where appropriate
const cellColors: Record<CellType, string> = {
  grass: '#4a7c23',           // Green grass (border)
  building: '#c41e1e',        // Red buildings
  building_light: '#d4a574',  // Light tan/beige buildings
  road: '#6b6b6b',            // Grey paved roads
  dirt_road: '#8b7355',       // Brown dirt tracks
  water: '#4a90d9',           // Blue water
  owned: brand.colors.primary[500],  // Brand green - your properties
  special: '#9b59b6',         // Purple - special buildings
};

// Seeded random for consistent map generation
function seededRandom(seed: number) {
  const x = Math.sin(seed++) * 10000;
  return x - Math.floor(x);
}

// Generate a map that looks like the screenshot
function generateMap(width: number, height: number, seed: number = 12345): CellType[][] {
  const map: CellType[][] = [];
  let seedCounter = seed;

  const rand = () => seededRandom(seedCounter++);

  // Pre-calculate road positions for a grid pattern
  const mainRoads = new Set<string>();
  const dirtRoads = new Set<string>();

  // Main road grid (every 6-8 tiles)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      // Vertical main roads
      if (x === 8 || x === 18 || x === 28 || x === 38 || x === 48) {
        mainRoads.add(`${x},${y}`);
      }
      // Horizontal main roads
      if (y === 6 || y === 14 || y === 22 || y === 30 || y === 38 || y === 46) {
        mainRoads.add(`${x},${y}`);
      }
      // Some diagonal/curved roads
      if (Math.abs(x - y) < 2 && x > 10 && x < 40 && y > 10 && y < 40) {
        if (rand() > 0.5) mainRoads.add(`${x},${y}`);
      }
    }
  }

  // Dirt roads (connecting areas)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if ((x === 4 || x === 12 || x === 24 || x === 34 || x === 44) && rand() > 0.3) {
        dirtRoads.add(`${x},${y}`);
      }
      if ((y === 3 || y === 10 || y === 18 || y === 26 || y === 34 || y === 42) && rand() > 0.3) {
        dirtRoads.add(`${x},${y}`);
      }
    }
  }

  // Water areas (river/ponds)
  const waterAreas: { x: number; y: number; radius: number }[] = [
    { x: 45, y: 12, radius: 3 },
    { x: 10, y: 35, radius: 2 },
    { x: 30, y: 25, radius: 2 },
  ];

  for (let y = 0; y < height; y++) {
    const row: CellType[] = [];
    for (let x = 0; x < width; x++) {
      const key = `${x},${y}`;
      const r = rand();

      // Grass border (2 tiles thick on edges)
      if (x < 2 || x >= width - 2 || y < 2 || y >= height - 2) {
        row.push('grass');
        continue;
      }

      // Check for water
      let isWater = false;
      for (const area of waterAreas) {
        const dist = Math.sqrt((x - area.x) ** 2 + (y - area.y) ** 2);
        if (dist < area.radius) {
          isWater = true;
          break;
        }
      }
      if (isWater) {
        row.push('water');
        continue;
      }

      // Roads
      if (mainRoads.has(key)) {
        row.push('road');
        continue;
      }

      // Dirt roads
      if (dirtRoads.has(key)) {
        row.push('dirt_road');
        continue;
      }

      // Special buildings (rare purple)
      if (r > 0.995) {
        row.push('special');
        continue;
      }

      // Owned properties (scattered green) - ~3% of tiles
      if (r > 0.97) {
        row.push('owned');
        continue;
      }

      // Light buildings (tan areas) - create clusters
      const lightBuildingZone = (
        (x > 15 && x < 25 && y > 8 && y < 18) ||
        (x > 35 && x < 45 && y > 25 && y < 35) ||
        (x > 5 && x < 15 && y > 20 && y < 30)
      );
      if (lightBuildingZone && r > 0.3) {
        row.push('building_light');
        continue;
      }

      // Regular red buildings (majority)
      if (r > 0.15) {
        row.push('building');
        continue;
      }

      // Some scattered light buildings elsewhere
      if (r > 0.08) {
        row.push('building_light');
        continue;
      }

      // Remaining is grass patches within city
      row.push('grass');
    }
    map.push(row);
  }

  return map;
}

export default function Home() {
  const [gridSize] = useState({ width: 55, height: 50 });
  const [map, setMap] = useState<CellType[][]>([]);
  const [hoveredCell, setHoveredCell] = useState<{ x: number; y: number } | null>(null);
  const [seed, setSeed] = useState(12345);
  const [zoom, setZoom] = useState(1);
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });

  // Drag-to-pan state
  const [isDragging, setIsDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0, scrollLeft: 0, scrollTop: 0 });

  // Measure container size
  useEffect(() => {
    const updateSize = () => {
      if (containerRef.current) {
        setContainerSize({
          width: containerRef.current.clientWidth,
          height: containerRef.current.clientHeight,
        });
      }
    };
    updateSize();
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, []);

  // Generate map on mount and when seed changes
  useEffect(() => {
    setMap(generateMap(gridSize.width, gridSize.height, seed));
  }, [gridSize.width, gridSize.height, seed]);

  // Regenerate with new seed
  const regenerateMap = useCallback(() => {
    setSeed(Math.floor(Math.random() * 100000));
  }, []);

  // Calculate stats
  const stats = useMemo(() => {
    const flat = map.flat();
    return {
      buildings: flat.filter(c => c === 'building' || c === 'building_light').length,
      owned: flat.filter(c => c === 'owned').length,
      water: flat.filter(c => c === 'water').length,
      roads: flat.filter(c => c === 'road' || c === 'dirt_road').length,
    };
  }, [map]);

  // Calculate cell size to fill available space
  const baseCellSize = useMemo(() => {
    if (containerSize.width === 0 || containerSize.height === 0) return 10;
    // Account for padding and gaps (1px gap between each cell = gridSize - 1 gaps)
    const availableWidth = containerSize.width - 32 - (gridSize.width - 1); // padding + gaps
    const availableHeight = containerSize.height - 32 - (gridSize.height - 1);
    const cellWidth = availableWidth / gridSize.width;
    const cellHeight = availableHeight / gridSize.height;
    // Use the smaller dimension to fit, minimum 4px for mobile
    return Math.max(4, Math.floor(Math.min(cellWidth, cellHeight)));
  }, [containerSize, gridSize]);

  const cellSize = Math.max(4, Math.floor(baseCellSize * zoom));

  // Drag-to-pan handlers
  const handleDragStart = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    if (!containerRef.current) return;
    setIsDragging(true);

    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

    dragStart.current = {
      x: clientX,
      y: clientY,
      scrollLeft: containerRef.current.scrollLeft,
      scrollTop: containerRef.current.scrollTop,
    };
  }, []);

  const handleDragMove = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    if (!isDragging || !containerRef.current) return;

    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

    const deltaX = clientX - dragStart.current.x;
    const deltaY = clientY - dragStart.current.y;

    containerRef.current.scrollLeft = dragStart.current.scrollLeft - deltaX;
    containerRef.current.scrollTop = dragStart.current.scrollTop - deltaY;
  }, [isDragging]);

  const handleDragEnd = useCallback(() => {
    setIsDragging(false);
  }, []);

  return (
    <div className="h-screen w-screen overflow-hidden bg-neutral-950 flex flex-col">
      {/* Floating Header */}
      <div className="absolute top-4 left-4 right-4 z-20 flex items-center justify-between pointer-events-none">
        <div className="pointer-events-auto bg-neutral-950/80 backdrop-blur-sm rounded-lg px-4 py-2 border border-neutral-800">
          <h1 className="text-xl font-bold text-white">Notropolis</h1>
          <p className="text-neutral-400 text-sm">City Map</p>
        </div>

        <div className="flex items-center gap-3 pointer-events-auto">
          {/* Zoom controls */}
          <div className="bg-neutral-950/80 backdrop-blur-sm rounded-lg px-3 py-2 flex items-center gap-2 border border-neutral-800">
            <button
              onClick={() => setZoom(z => Math.max(0.5, z - 0.25))}
              className="w-8 h-8 flex items-center justify-center text-white hover:bg-neutral-800 rounded transition-colors"
            >
              −
            </button>
            <span className="text-white text-sm w-12 text-center">{Math.round(zoom * 100)}%</span>
            <button
              onClick={() => setZoom(z => Math.min(2, z + 0.25))}
              className="w-8 h-8 flex items-center justify-center text-white hover:bg-neutral-800 rounded transition-colors"
            >
              +
            </button>
          </div>

          <button
            onClick={regenerateMap}
            className="bg-primary-500 hover:bg-primary-400 text-white rounded-lg px-4 py-2 text-sm font-medium transition-colors"
          >
            New Map
          </button>
        </div>
      </div>

      {/* Legend - bottom left */}
      <div className="absolute bottom-4 left-4 z-20 bg-neutral-950/80 backdrop-blur-sm rounded-lg px-4 py-3 pointer-events-auto border border-neutral-800">
        <div className="text-white text-xs font-semibold mb-2">Legend</div>
        <div className="grid grid-cols-2 gap-x-4 gap-y-1">
          {[
            { type: 'building', label: 'Buildings' },
            { type: 'building_light', label: 'Light Buildings' },
            { type: 'road', label: 'Roads' },
            { type: 'dirt_road', label: 'Dirt Tracks' },
            { type: 'water', label: 'Water' },
            { type: 'owned', label: 'Your Properties' },
            { type: 'special', label: 'Special' },
            { type: 'grass', label: 'Grass' },
          ].map(({ type, label }) => (
            <div key={type} className="flex items-center gap-2">
              <div
                className="w-3 h-3 rounded-sm border border-neutral-700"
                style={{ backgroundColor: cellColors[type as CellType] }}
              />
              <span className="text-neutral-300 text-xs">{label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Stats - bottom right */}
      <div className="absolute bottom-4 right-4 z-20 bg-neutral-950/80 backdrop-blur-sm rounded-lg px-4 py-3 pointer-events-auto border border-neutral-800">
        <div className="text-white text-xs font-semibold mb-2">Stats</div>
        <div className="space-y-1 text-xs">
          <div className="flex justify-between gap-6">
            <span className="text-neutral-400">Buildings:</span>
            <span className="text-white font-mono">{stats.buildings.toLocaleString()}</span>
          </div>
          <div className="flex justify-between gap-6">
            <span className="text-primary-400">Your Properties:</span>
            <span className="text-primary-400 font-mono">{stats.owned}</span>
          </div>
          <div className="flex justify-between gap-6">
            <span className="text-neutral-400">Roads:</span>
            <span className="text-white font-mono">{stats.roads}</span>
          </div>
          <div className="flex justify-between gap-6">
            <span className="text-neutral-400">Water:</span>
            <span className="text-white font-mono">{stats.water}</span>
          </div>
        </div>
      </div>

      {/* Coordinates overlay */}
      {hoveredCell && (
        <div className="absolute top-20 left-4 z-20 bg-neutral-950/80 backdrop-blur-sm text-white px-3 py-2 rounded-lg text-sm border border-neutral-800">
          <span className="font-mono">
            ({hoveredCell.x}, {hoveredCell.y})
          </span>
          <span className="ml-2 text-neutral-400">
            {map[hoveredCell.y]?.[hoveredCell.x] || 'unknown'}
          </span>
        </div>
      )}

      {/* Map Container - Full screen with drag-to-pan */}
      <div
        ref={containerRef}
        className={`flex-1 overflow-auto flex items-center justify-center p-4 ${isDragging ? 'cursor-grabbing' : 'cursor-grab'}`}
        onMouseDown={handleDragStart}
        onMouseMove={handleDragMove}
        onMouseUp={handleDragEnd}
        onMouseLeave={handleDragEnd}
        onTouchStart={handleDragStart}
        onTouchMove={handleDragMove}
        onTouchEnd={handleDragEnd}
      >
        <div
          className="rounded-lg overflow-hidden shadow-2xl"
          style={{
            display: 'grid',
            gridTemplateColumns: `repeat(${gridSize.width}, ${cellSize}px)`,
            gridTemplateRows: `repeat(${gridSize.height}, ${cellSize}px)`,
            gap: '1px',
            backgroundColor: brand.colors.neutral[950],
          }}
        >
          {map.flat().map((cell, index) => {
            const x = index % gridSize.width;
            const y = Math.floor(index / gridSize.width);
            const isHovered = hoveredCell?.x === x && hoveredCell?.y === y;
            const isOwned = cell === 'owned';

            return (
              <div
                key={index}
                className="transition-all duration-75 select-none"
                style={{
                  backgroundColor: cellColors[cell],
                  opacity: isHovered && !isDragging ? 0.7 : 1,
                  boxShadow: isOwned ? `inset 0 0 0 1px ${brand.colors.primary[300]}` : 'none',
                }}
                onMouseEnter={() => !isDragging && setHoveredCell({ x, y })}
                onMouseLeave={() => setHoveredCell(null)}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}
