import { useMemo } from 'react';
import { useMaps } from '../../hooks/useCompanies';
import { GameMap } from '../../types/game';

interface LocationPickerProps {
  locationType?: 'town' | 'city' | 'capital';
  selectedMap: string | null;
  onSelect: (mapId: string) => void;
}

export function LocationPicker({ locationType, selectedMap, onSelect }: LocationPickerProps) {
  const { maps, isLoading, error } = useMaps({ type: locationType });

  // Group maps by country
  const byCountry = useMemo(() => {
    return maps.reduce((acc, map) => {
      if (!acc[map.country]) acc[map.country] = [];
      acc[map.country].push(map);
      return acc;
    }, {} as Record<string, GameMap[]>);
  }, [maps]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500"></div>
        <span className="ml-3 text-neutral-400">Loading locations...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-red-400 p-4 bg-red-900/20 rounded-lg">
        Failed to load locations: {error}
      </div>
    );
  }

  if (maps.length === 0) {
    return (
      <div className="text-neutral-400 p-4 bg-neutral-800 rounded-lg text-center">
        No {locationType ? `${locationType}s` : 'locations'} available yet.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {Object.entries(byCountry).map(([country, countryMaps]) => (
        <div key={country}>
          <h3 className="text-lg font-bold text-white mb-3">{country}</h3>
          <div className="grid gap-3 md:grid-cols-2">
            {countryMaps.map(map => (
              <div
                key={map.id}
                onClick={() => onSelect(map.id)}
                className={`p-4 rounded-lg cursor-pointer transition ${
                  selectedMap === map.id
                    ? 'bg-primary-600 ring-2 ring-primary-400'
                    : 'bg-neutral-700 hover:bg-neutral-600'
                }`}
              >
                <p className="font-bold text-white">{map.name}</p>
                <p className="text-sm text-neutral-300 mt-1">
                  <span className="capitalize">{map.location_type}</span>
                  <span className="mx-2">•</span>
                  {map.width}x{map.height}
                </p>
                <p className="text-sm text-neutral-400 mt-1">
                  Hero: ${map.hero_net_worth.toLocaleString()}
                </p>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
