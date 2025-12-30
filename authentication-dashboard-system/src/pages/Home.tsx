import { useState, useEffect, useCallback } from 'react';

// Grid cell types
type CellType = 'empty' | 'building' | 'water' | 'tree' | 'road';

// Colors for each cell type
const cellColors: Record<CellType, string> = {
  empty: '#e5e7eb',      // Gray
  building: '#6b7280',   // Dark gray
  water: '#3b82f6',      // Blue
  tree: '#22c55e',       // Green
  road: '#374151',       // Dark slate
};

// Generate a procedural map
function generateMap(width: number, height: number): CellType[][] {
  const map: CellType[][] = [];

  for (let y = 0; y < height; y++) {
    const row: CellType[] = [];
    for (let x = 0; x < width; x++) {
      // Create some patterns
      const rand = Math.random();

      // Roads - horizontal and vertical main roads
      if (y === Math.floor(height / 2) || x === Math.floor(width / 2)) {
        row.push('road');
      }
      // Secondary roads
      else if (y % 8 === 0 || x % 10 === 0) {
        row.push('road');
      }
      // Water - create a river/lake area
      else if (x > width * 0.7 && y > height * 0.6 && rand > 0.3) {
        row.push('water');
      }
      // Forest area
      else if (x < width * 0.25 && y < height * 0.4 && rand > 0.4) {
        row.push('tree');
      }
      // Buildings - scattered in urban areas
      else if (rand > 0.7 && x > width * 0.2 && x < width * 0.8) {
        row.push('building');
      }
      // Random trees
      else if (rand > 0.85) {
        row.push('tree');
      }
      // Empty space
      else {
        row.push('empty');
      }
    }
    map.push(row);
  }

  return map;
}

export default function Home() {
  const [gridSize] = useState({ width: 50, height: 30 });
  const [map, setMap] = useState<CellType[][]>([]);
  const [hoveredCell, setHoveredCell] = useState<{ x: number; y: number } | null>(null);

  // Generate map on mount and when size changes
  useEffect(() => {
    setMap(generateMap(gridSize.width, gridSize.height));
  }, [gridSize.width, gridSize.height]);

  // Regenerate map
  const regenerateMap = useCallback(() => {
    setMap(generateMap(gridSize.width, gridSize.height));
  }, [gridSize.width, gridSize.height]);

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Notropolis</h1>
          <p className="text-gray-600 dark:text-gray-400">City Overview Map</p>
        </div>
        <div className="flex items-center gap-4">
          {/* Legend */}
          <div className="flex items-center gap-3 bg-white dark:bg-gray-800 rounded-lg px-4 py-2 shadow-sm">
            {Object.entries(cellColors).map(([type, color]) => (
              <div key={type} className="flex items-center gap-1.5">
                <div
                  className="w-4 h-4 rounded-sm"
                  style={{ backgroundColor: color }}
                />
                <span className="text-xs text-gray-600 dark:text-gray-400 capitalize">{type}</span>
              </div>
            ))}
          </div>
          <button
            onClick={regenerateMap}
            className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg text-sm font-medium transition-colors"
          >
            Regenerate
          </button>
        </div>
      </div>

      {/* Map Container */}
      <div className="flex-1 bg-white dark:bg-gray-800 rounded-lg shadow-sm overflow-hidden relative">
        {/* Grid Map */}
        <div
          className="absolute inset-0 overflow-auto p-4"
          style={{
            display: 'grid',
            gridTemplateColumns: `repeat(${gridSize.width}, 1fr)`,
            gridTemplateRows: `repeat(${gridSize.height}, 1fr)`,
            gap: '1px',
            backgroundColor: '#1f2937',
          }}
        >
          {map.flat().map((cell, index) => {
            const x = index % gridSize.width;
            const y = Math.floor(index / gridSize.width);
            const isHovered = hoveredCell?.x === x && hoveredCell?.y === y;

            return (
              <div
                key={index}
                className="transition-all duration-75 cursor-pointer"
                style={{
                  backgroundColor: cellColors[cell],
                  opacity: isHovered ? 0.7 : 1,
                  transform: isHovered ? 'scale(1.1)' : 'scale(1)',
                  zIndex: isHovered ? 10 : 1,
                }}
                onMouseEnter={() => setHoveredCell({ x, y })}
                onMouseLeave={() => setHoveredCell(null)}
                title={`${cell} (${x}, ${y})`}
              />
            );
          })}
        </div>

        {/* Coordinates overlay */}
        {hoveredCell && (
          <div className="absolute bottom-4 left-4 bg-black/70 text-white px-3 py-1.5 rounded-lg text-sm">
            <span className="font-mono">
              ({hoveredCell.x}, {hoveredCell.y}) - {map[hoveredCell.y]?.[hoveredCell.x] || 'unknown'}
            </span>
          </div>
        )}

        {/* Stats overlay */}
        <div className="absolute top-4 right-4 bg-black/70 text-white px-4 py-3 rounded-lg text-sm space-y-1">
          <div className="font-semibold mb-2">Map Stats</div>
          <div className="flex justify-between gap-8">
            <span className="text-gray-300">Buildings:</span>
            <span className="font-mono">{map.flat().filter(c => c === 'building').length}</span>
          </div>
          <div className="flex justify-between gap-8">
            <span className="text-gray-300">Trees:</span>
            <span className="font-mono">{map.flat().filter(c => c === 'tree').length}</span>
          </div>
          <div className="flex justify-between gap-8">
            <span className="text-gray-300">Water:</span>
            <span className="font-mono">{map.flat().filter(c => c === 'water').length}</span>
          </div>
          <div className="flex justify-between gap-8">
            <span className="text-gray-300">Roads:</span>
            <span className="font-mono">{map.flat().filter(c => c === 'road').length}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
