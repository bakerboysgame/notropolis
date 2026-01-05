import { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { TERRAIN_COLORS, SPECIAL_COLORS } from '../../utils/mapRenderer';
import { useHighlights } from '../../contexts/HighlightContext';

/**
 * Legend overlay showing terrain and ownership color codes
 * Positioned in the bottom-left corner of the map
 * Collapsible - hidden by default, expands on click
 */
export function MapLegend(): JSX.Element {
  const [isExpanded, setIsExpanded] = useState(false);
  const { highlightedCompanies } = useHighlights();
  const highlightedList = Array.from(highlightedCompanies.values());

  return (
    <div className="absolute bottom-4 left-4 bg-gray-800/95 backdrop-blur-sm rounded-lg text-sm shadow-lg border border-gray-700">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between p-3 text-white font-bold text-xs uppercase tracking-wide hover:bg-gray-700/50 rounded-lg transition-colors"
      >
        <span>Legend</span>
        {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
      </button>

      {isExpanded && (
        <div className="px-3 pb-3">
          <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
            <div className="flex items-center gap-2">
              <div
                className="w-4 h-4 rounded border border-gray-600"
                style={{ backgroundColor: TERRAIN_COLORS.free_land }}
              />
              <span className="text-gray-300 text-xs">Free Land</span>
            </div>
            <div className="flex items-center gap-2">
              <div
                className="w-4 h-4 rounded border border-gray-600"
                style={{ backgroundColor: TERRAIN_COLORS.water }}
              />
              <span className="text-gray-300 text-xs">Water</span>
            </div>
            <div className="flex items-center gap-2">
              <div
                className="w-4 h-4 rounded border border-gray-600"
                style={{ backgroundColor: TERRAIN_COLORS.road }}
              />
              <span className="text-gray-300 text-xs">Road</span>
            </div>
            <div className="flex items-center gap-2">
              <div
                className="w-4 h-4 rounded border border-gray-600"
                style={{ backgroundColor: TERRAIN_COLORS.trees }}
              />
              <span className="text-gray-300 text-xs">Trees</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded border border-blue-600" style={{ backgroundColor: '#3b82f6' }} />
              <span className="text-gray-300 text-xs">Your Land</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded border border-red-600" style={{ backgroundColor: '#ef4444' }} />
              <span className="text-gray-300 text-xs">Rival Land</span>
            </div>
            <div className="flex items-center gap-2 col-span-2">
              <div className="w-4 h-4 rounded bg-gray-700 border border-gray-600 flex items-center justify-center">
                <div className="w-2 h-2 rounded-full bg-white"></div>
              </div>
              <span className="text-gray-300 text-xs">Building</span>
            </div>
          </div>

          {/* Special Buildings */}
          <div className="border-t border-gray-600 my-2" />
          <h4 className="text-white font-bold mb-2 text-xs uppercase tracking-wide">Special</h4>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
            <div className="flex items-center gap-2">
              <div
                className="w-4 h-4 rounded border border-gray-600"
                style={{ backgroundColor: SPECIAL_COLORS.temple }}
              />
              <span className="text-gray-300 text-xs">Temple</span>
            </div>
            <div className="flex items-center gap-2">
              <div
                className="w-4 h-4 rounded border border-gray-600"
                style={{ backgroundColor: SPECIAL_COLORS.bank }}
              />
              <span className="text-gray-300 text-xs">Bank</span>
            </div>
            <div className="flex items-center gap-2">
              <div
                className="w-4 h-4 rounded border border-gray-600"
                style={{ backgroundColor: SPECIAL_COLORS.police_station }}
              />
              <span className="text-gray-300 text-xs">Police Station</span>
            </div>
            <div className="flex items-center gap-2">
              <div
                className="w-4 h-4 rounded border border-gray-600"
                style={{ backgroundColor: SPECIAL_COLORS.casino }}
              />
              <span className="text-gray-300 text-xs">Casino</span>
            </div>
          </div>

          {/* Highlighted companies section */}
          {highlightedList.length > 0 && (
            <>
              <div className="border-t border-gray-600 my-2" />
              <h4 className="text-white font-bold mb-2 text-xs uppercase tracking-wide">Tracked</h4>
              <div className="flex flex-col gap-1.5">
                {highlightedList.map((company) => (
                  <div key={company.companyId} className="flex items-center gap-2">
                    <div
                      className="w-4 h-4 rounded border border-gray-600"
                      style={{ backgroundColor: company.color }}
                    />
                    <span className="text-gray-300 text-xs truncate max-w-[120px]" title={company.companyName}>
                      {company.companyName}
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
