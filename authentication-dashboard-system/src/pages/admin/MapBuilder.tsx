import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useMapBuilder, CreateMapRequest } from '../../hooks/useMapBuilder';
import { TerrainPalette } from '../../components/admin/TerrainPalette';
import { MapGrid } from '../../components/admin/MapGrid';
import { MapSettings } from '../../components/admin/MapSettings';
import { api } from '../../services/api';
import { Plus, ArrowLeft, Trash2, Map as MapIcon, AlertCircle } from 'lucide-react';

interface MapListItem {
  id: string;
  name: string;
  country: string;
  location_type: string;
  width: number;
  height: number;
  is_active: boolean;
  created_at: string;
}

export function MapBuilder() {
  const { mapId } = useParams<{ mapId?: string }>();
  const navigate = useNavigate();
  const [maps, setMaps] = useState<MapListItem[]>([]);
  const [loadingMaps, setLoadingMaps] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createForm, setCreateForm] = useState<CreateMapRequest>({
    name: '',
    country: 'UK',
    location_type: 'town',
    width: 20,
    height: 20,
    hero_net_worth: 5500000,
    hero_cash: 4000000,
    hero_land_percentage: 6.0,
    police_strike_day: 3,
  });

  const {
    map,
    tiles,
    tileMap,
    selectedTool,
    brushSize,
    zoom,
    offset,
    isLoading,
    isSaving,
    error,
    hasUnsavedChanges,
    specialBuildings,
    setTool,
    setBrushSize,
    paint,
    saveMap,
    createMap,
    deleteMap,
    setZoom,
    setOffset,
  } = useMapBuilder(mapId);

  // Load maps list
  useEffect(() => {
    const fetchMaps = async () => {
      setLoadingMaps(true);
      try {
        const response = await api.get('/api/admin/maps');
        if (response.data.success) {
          setMaps(response.data.data);
        }
      } catch (err) {
        console.error('Failed to load maps:', err);
      } finally {
        setLoadingMaps(false);
      }
    };

    fetchMaps();
  }, [map]); // Refresh when map changes (after create/delete)

  const handleCreateMap = async () => {
    if (!createForm.name.trim()) return;

    const newMapId = await createMap(createForm);
    if (newMapId) {
      setShowCreateModal(false);
      navigate(`/admin/maps/${newMapId}`);
      // Reset form
      setCreateForm({
        name: '',
        country: 'UK',
        location_type: 'town',
        width: 20,
        height: 20,
        hero_net_worth: 5500000,
        hero_cash: 4000000,
        hero_land_percentage: 6.0,
        police_strike_day: 3,
      });
    }
  };

  const handleDeleteMap = async () => {
    if (!map) return;
    if (!confirm(`Are you sure you want to delete "${map.name}"? This cannot be undone.`)) return;

    const success = await deleteMap(map.id);
    if (success) {
      navigate('/admin/maps');
    }
  };

  // If no mapId, show the map list
  if (!mapId) {
    return (
      <div className="h-full bg-neutral-950 text-neutral-100 p-6">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-2xl font-bold">Map Builder</h1>
            <button
              onClick={() => setShowCreateModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Create Map
            </button>
          </div>

          {loadingMaps ? (
            <div className="flex items-center justify-center py-20">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500" />
            </div>
          ) : maps.length === 0 ? (
            <div className="text-center py-20">
              <MapIcon className="w-12 h-12 text-neutral-600 mx-auto mb-4" />
              <h2 className="text-xl font-semibold text-neutral-400 mb-2">No Maps Yet</h2>
              <p className="text-neutral-500 mb-4">Create your first map to get started.</p>
              <button
                onClick={() => setShowCreateModal(true)}
                className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 transition-colors"
              >
                <Plus className="w-4 h-4" />
                Create Map
              </button>
            </div>
          ) : (
            <div className="grid gap-4">
              {maps.map((m) => (
                <div
                  key={m.id}
                  onClick={() => navigate(`/admin/maps/${m.id}`)}
                  className="flex items-center justify-between p-4 bg-neutral-900 border border-neutral-700 rounded-lg cursor-pointer hover:border-primary-500 transition-colors"
                >
                  <div>
                    <h3 className="font-semibold text-lg">{m.name}</h3>
                    <p className="text-neutral-400 text-sm">
                      {m.country} - {m.location_type.charAt(0).toUpperCase() + m.location_type.slice(1)} - {m.width}x{m.height} tiles
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span
                      className={`px-2 py-1 rounded text-xs ${
                        m.is_active ? 'bg-green-900 text-green-300' : 'bg-neutral-800 text-neutral-400'
                      }`}
                    >
                      {m.is_active ? 'Active' : 'Inactive'}
                    </span>
                    <ArrowLeft className="w-5 h-5 text-neutral-500 rotate-180" />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Create Modal */}
        {showCreateModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-neutral-900 border border-neutral-700 rounded-lg p-6 w-full max-w-md">
              <h2 className="text-xl font-bold mb-4">Create New Map</h2>

              <div className="space-y-4">
                <label className="block">
                  <span className="text-neutral-300 text-sm font-medium">Name</span>
                  <input
                    type="text"
                    value={createForm.name}
                    onChange={(e) => setCreateForm((f) => ({ ...f, name: e.target.value }))}
                    className="mt-1 w-full p-2 rounded-md bg-neutral-800 border border-neutral-600 text-neutral-100 focus:ring-2 focus:ring-primary-500"
                    placeholder="My Town"
                    autoFocus
                  />
                </label>

                <div className="grid grid-cols-2 gap-4">
                  <label className="block">
                    <span className="text-neutral-300 text-sm font-medium">Country</span>
                    <input
                      type="text"
                      value={createForm.country}
                      onChange={(e) => setCreateForm((f) => ({ ...f, country: e.target.value }))}
                      className="mt-1 w-full p-2 rounded-md bg-neutral-800 border border-neutral-600 text-neutral-100 focus:ring-2 focus:ring-primary-500"
                    />
                  </label>

                  <label className="block">
                    <span className="text-neutral-300 text-sm font-medium">Type</span>
                    <select
                      value={createForm.location_type}
                      onChange={(e) =>
                        setCreateForm((f) => ({
                          ...f,
                          location_type: e.target.value as 'town' | 'city' | 'capital',
                        }))
                      }
                      className="mt-1 w-full p-2 rounded-md bg-neutral-800 border border-neutral-600 text-neutral-100 focus:ring-2 focus:ring-primary-500"
                    >
                      <option value="town">Town</option>
                      <option value="city">City</option>
                      <option value="capital">Capital</option>
                    </select>
                  </label>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <label className="block">
                    <span className="text-neutral-300 text-sm font-medium">Width (1-100)</span>
                    <input
                      type="number"
                      min={1}
                      max={100}
                      value={createForm.width}
                      onChange={(e) =>
                        setCreateForm((f) => ({
                          ...f,
                          width: Math.min(100, Math.max(1, Number(e.target.value))),
                        }))
                      }
                      className="mt-1 w-full p-2 rounded-md bg-neutral-800 border border-neutral-600 text-neutral-100 focus:ring-2 focus:ring-primary-500"
                    />
                  </label>

                  <label className="block">
                    <span className="text-neutral-300 text-sm font-medium">Height (1-100)</span>
                    <input
                      type="number"
                      min={1}
                      max={100}
                      value={createForm.height}
                      onChange={(e) =>
                        setCreateForm((f) => ({
                          ...f,
                          height: Math.min(100, Math.max(1, Number(e.target.value))),
                        }))
                      }
                      className="mt-1 w-full p-2 rounded-md bg-neutral-800 border border-neutral-600 text-neutral-100 focus:ring-2 focus:ring-primary-500"
                    />
                  </label>
                </div>

                <p className="text-neutral-500 text-xs">
                  Total tiles: {createForm.width * createForm.height}
                </p>
              </div>

              <div className="flex justify-end gap-3 mt-6">
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 text-neutral-400 hover:text-neutral-100 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreateMap}
                  disabled={!createForm.name.trim() || isLoading}
                  className="px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {isLoading ? 'Creating...' : 'Create Map'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Loading state
  if (isLoading) {
    return (
      <div className="h-full bg-neutral-950 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500 mx-auto" />
          <p className="mt-4 text-neutral-400">Loading map...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error && !map) {
    return (
      <div className="h-full bg-neutral-950 flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-neutral-200 mb-2">Failed to Load Map</h2>
          <p className="text-neutral-400 mb-4">{error}</p>
          <button
            onClick={() => navigate('/admin/maps')}
            className="inline-flex items-center gap-2 px-4 py-2 bg-neutral-800 text-neutral-200 rounded-md hover:bg-neutral-700 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Maps
          </button>
        </div>
      </div>
    );
  }

  // Map editor
  return (
    <div className="h-full bg-neutral-950 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-neutral-900 border-b border-neutral-700">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/admin/maps')}
            className="p-2 rounded hover:bg-neutral-700 text-neutral-400 hover:text-neutral-100 transition-colors"
            title="Back to Maps"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-lg font-semibold text-neutral-100">{map?.name || 'Map Editor'}</h1>
            <p className="text-xs text-neutral-500">
              {map?.country} - {map?.location_type} - {map?.width}x{map?.height}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {error && (
            <span className="text-red-400 text-sm flex items-center gap-1">
              <AlertCircle className="w-4 h-4" />
              {error}
            </span>
          )}
          <button
            onClick={handleDeleteMap}
            className="p-2 rounded hover:bg-red-900/50 text-red-400 hover:text-red-300 transition-colors"
            title="Delete Map"
          >
            <Trash2 className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Main Editor Area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left: Terrain Palette */}
        <TerrainPalette
          selectedTool={selectedTool}
          onSelectTool={setTool}
          brushSize={brushSize}
          onBrushSizeChange={setBrushSize}
          specialBuildings={specialBuildings}
        />

        {/* Center: Map Grid */}
        {map && (
          <MapGrid
            width={map.width}
            height={map.height}
            tiles={tiles}
            tileMap={tileMap}
            selectedTool={selectedTool}
            brushSize={brushSize}
            zoom={zoom}
            offset={offset}
            onPaint={paint}
            onZoomChange={setZoom}
            onOffsetChange={setOffset}
            isSaving={isSaving}
          />
        )}

        {/* Right: Map Settings */}
        <MapSettings
          map={map}
          onSave={saveMap}
          isSaving={isSaving}
          hasUnsavedChanges={hasUnsavedChanges}
        />
      </div>
    </div>
  );
}
