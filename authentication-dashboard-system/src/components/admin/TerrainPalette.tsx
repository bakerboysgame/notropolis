import { clsx } from 'clsx';
import { ToolType } from '../../hooks/useMapBuilder';

interface Tool {
  id: ToolType;
  label: string;
  color: string;
  special?: boolean;
}

const TERRAIN_TOOLS: Tool[] = [
  { id: 'free_land', label: 'Free Land', color: '#90EE90' },
  { id: 'water', label: 'Water', color: '#4169E1' },
  { id: 'road', label: 'Road', color: '#696969' },
  { id: 'dirt_track', label: 'Dirt Track', color: '#8B4513' },
  { id: 'trees', label: 'Trees', color: '#228B22' },
];

const SPECIAL_BUILDING_TOOLS: Tool[] = [
  { id: 'temple', label: 'Temple', color: '#FFD700', special: true },
  { id: 'bank', label: 'Bank', color: '#C0C0C0', special: true },
  { id: 'police_station', label: 'Police Station', color: '#0000FF', special: true },
];

interface TerrainPaletteProps {
  selectedTool: ToolType;
  onSelectTool: (tool: ToolType) => void;
  brushSize: number;
  onBrushSizeChange: (size: number) => void;
  specialBuildings: {
    temple: { x: number; y: number } | null;
    bank: { x: number; y: number } | null;
    police_station: { x: number; y: number } | null;
  };
}

export function TerrainPalette({
  selectedTool,
  onSelectTool,
  brushSize,
  onBrushSizeChange,
  specialBuildings,
}: TerrainPaletteProps) {
  const isSpecialTool = ['temple', 'bank', 'police_station'].includes(selectedTool as string);

  return (
    <div className="w-56 bg-neutral-900 border-r border-neutral-700 p-4 flex flex-col gap-4 overflow-y-auto">
      {/* Terrain Section */}
      <div>
        <h3 className="text-neutral-300 font-semibold text-sm mb-2 uppercase tracking-wide">
          Terrain
        </h3>
        <div className="flex flex-col gap-1">
          {TERRAIN_TOOLS.map((tool) => (
            <button
              key={tool.id}
              onClick={() => onSelectTool(tool.id)}
              className={clsx(
                'p-2 rounded-md flex items-center gap-3 transition-all text-left',
                selectedTool === tool.id
                  ? 'ring-2 ring-white ring-offset-2 ring-offset-neutral-900'
                  : 'hover:brightness-110'
              )}
              style={{ backgroundColor: tool.color }}
            >
              <div
                className="w-5 h-5 rounded border border-black/20"
                style={{ backgroundColor: tool.color }}
              />
              <span className="text-sm font-medium text-black/80">{tool.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Special Buildings Section */}
      <div>
        <h3 className="text-neutral-300 font-semibold text-sm mb-2 uppercase tracking-wide">
          Special Buildings
        </h3>
        <p className="text-neutral-500 text-xs mb-2">Max 1 of each per map</p>
        <div className="flex flex-col gap-1">
          {SPECIAL_BUILDING_TOOLS.map((tool) => {
            const buildingKey = tool.id as keyof typeof specialBuildings;
            const hasBuilding = specialBuildings[buildingKey] !== null;

            return (
              <button
                key={tool.id}
                onClick={() => onSelectTool(tool.id)}
                className={clsx(
                  'p-2 rounded-md flex items-center gap-3 transition-all text-left relative',
                  selectedTool === tool.id
                    ? 'ring-2 ring-white ring-offset-2 ring-offset-neutral-900'
                    : 'hover:brightness-110'
                )}
                style={{ backgroundColor: tool.color }}
              >
                <div
                  className="w-5 h-5 rounded border border-black/20"
                  style={{ backgroundColor: tool.color }}
                />
                <span className="text-sm font-medium text-black/80">{tool.label}</span>
                {hasBuilding && (
                  <span className="absolute right-2 text-xs bg-black/30 text-white px-1.5 py-0.5 rounded">
                    Placed
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Brush Size Section */}
      <div>
        <h3 className="text-neutral-300 font-semibold text-sm mb-2 uppercase tracking-wide">
          Brush Size
        </h3>
        {isSpecialTool ? (
          <p className="text-neutral-500 text-xs">N/A for special buildings</p>
        ) : (
          <>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-neutral-400 text-sm">{brushSize}x{brushSize}</span>
            </div>
            <input
              type="range"
              min={1}
              max={5}
              value={brushSize}
              onChange={(e) => onBrushSizeChange(Number(e.target.value))}
              className="w-full h-2 bg-neutral-700 rounded-lg appearance-none cursor-pointer accent-primary-500"
            />
            <div className="flex justify-between mt-1">
              <span className="text-xs text-neutral-500">1</span>
              <span className="text-xs text-neutral-500">5</span>
            </div>
          </>
        )}
      </div>

      {/* Color Legend */}
      <div className="mt-auto pt-4 border-t border-neutral-700">
        <h3 className="text-neutral-300 font-semibold text-sm mb-2 uppercase tracking-wide">
          Legend
        </h3>
        <div className="grid grid-cols-2 gap-1 text-xs">
          {[...TERRAIN_TOOLS, ...SPECIAL_BUILDING_TOOLS].map((tool) => (
            <div key={tool.id} className="flex items-center gap-1">
              <div
                className="w-3 h-3 rounded border border-black/20"
                style={{ backgroundColor: tool.color }}
              />
              <span className="text-neutral-400 truncate">{tool.label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
