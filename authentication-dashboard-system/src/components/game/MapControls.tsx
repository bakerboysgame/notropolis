interface MapControlsProps {
  zoom: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onReset: () => void;
}

/**
 * Map controls overlay for zoom in/out and reset view
 * Positioned in the top-right corner of the map
 */
export function MapControls({ zoom, onZoomIn, onZoomOut, onReset }: MapControlsProps): JSX.Element {
  return (
    <div className="absolute top-4 right-4 bg-gray-800/95 backdrop-blur-sm rounded-lg shadow-lg border border-gray-700 overflow-hidden">
      <div className="flex flex-col">
        <button
          onClick={onZoomIn}
          disabled={zoom >= 4}
          className="px-4 py-2 text-white hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors border-b border-gray-700"
          title="Zoom In"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
        </button>

        <div className="px-4 py-2 text-center text-white text-sm border-b border-gray-700 bg-gray-900/50">
          {Math.round(zoom * 100)}%
        </div>

        <button
          onClick={onZoomOut}
          disabled={zoom <= 0.5}
          className="px-4 py-2 text-white hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors border-b border-gray-700"
          title="Zoom Out"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
          </svg>
        </button>

        <button
          onClick={onReset}
          className="px-4 py-2 text-white hover:bg-gray-700 transition-colors"
          title="Reset View"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        </button>
      </div>
    </div>
  );
}
