import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Building2,
  MapPin,
  DollarSign,
  Landmark,
  TrendingUp,
  Clock,
  Trash2,
  LogOut,
  ArrowRightLeft,
  Map
} from 'lucide-react';
import { useCompanies } from '../hooks/useCompanies';
import { useActiveCompany } from '../contexts/CompanyContext';
import { LocationPicker } from '../components/game/LocationPicker';
import { LevelProgress } from '../components/game/LevelProgress';
import { HeroStatus } from '../components/game/HeroStatus';
import { GameCompany, GameMap } from '../types/game';
import { api } from '../services/api';

export function CompanyDashboard() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { getCompany, deleteCompany, joinLocation, leaveLocation } = useCompanies();
  const { activeCompany, setActiveCompany } = useActiveCompany();

  const [company, setCompany] = useState<GameCompany | null>(null);
  const [mapInfo, setMapInfo] = useState<GameMap | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Location picker
  const [showLocationPicker, setShowLocationPicker] = useState(false);
  const [selectedMap, setSelectedMap] = useState<string | null>(null);

  // Delete confirmation
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);

  // Load company data
  useEffect(() => {
    if (!id) return;

    const loadCompany = async () => {
      setIsLoading(true);
      const data = await getCompany(id);
      if (data) {
        setCompany(data);
        if (activeCompany?.id !== data.id) {
          setActiveCompany(data);
        }
      } else {
        setError('Company not found');
      }
      setIsLoading(false);
    };

    loadCompany();
  }, [id, getCompany, activeCompany?.id, setActiveCompany]);

  // Fetch map info when company is in a location
  useEffect(() => {
    if (!company?.current_map_id) {
      setMapInfo(null);
      return;
    }

    const fetchMapInfo = async () => {
      try {
        const response = await api.get(`/api/game/maps/${company.current_map_id}`);
        if (response.data.success) {
          setMapInfo(response.data.data.map);
        }
      } catch (err) {
        console.error('Failed to fetch map info:', err);
      }
    };

    fetchMapInfo();
  }, [company?.current_map_id]);

  const handleJoinLocation = async () => {
    if (!company || !selectedMap) return;
    setIsSubmitting(true);
    const updated = await joinLocation(company.id, selectedMap);
    if (updated) {
      setCompany(updated);
      setActiveCompany(updated);
      setShowLocationPicker(false);
      setSelectedMap(null);
    }
    setIsSubmitting(false);
  };

  const handleLeaveLocation = async () => {
    if (!company) return;
    setIsSubmitting(true);
    const updated = await leaveLocation(company.id);
    if (updated) {
      setCompany(updated);
      setActiveCompany(updated);
    }
    setIsSubmitting(false);
  };

  const handleDelete = async () => {
    if (!company || deleteConfirmText !== company.name) return;
    setIsSubmitting(true);
    const success = await deleteCompany(company.id);
    if (success) {
      setActiveCompany(null);
      navigate('/companies');
    }
    setIsSubmitting(false);
  };

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500"></div>
        </div>
      </div>
    );
  }

  if (error || !company) {
    return (
      <div className="p-6">
        <div className="bg-red-900/20 border border-red-500/50 rounded-lg p-6 text-center">
          <p className="text-red-400">{error || 'Company not found'}</p>
          <button
            onClick={() => navigate('/companies')}
            className="mt-4 px-4 py-2 bg-neutral-700 text-white rounded hover:bg-neutral-600"
          >
            Back to Companies
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* Top Navigation - Go to Map button, Celebration, or Back to Companies */}
      {company.hero_celebration_pending ? (
        <button
          onClick={() => navigate(`/hero-celebration/${company.id}`)}
          className="w-full flex items-center justify-center gap-3 px-6 py-4 bg-yellow-600 hover:bg-yellow-700 text-white rounded-lg mb-6 transition-colors shadow-lg animate-pulse"
        >
          <Map className="w-6 h-6" />
          <div className="text-left">
            <span className="text-lg font-bold">View Celebration</span>
            <span className="ml-2 text-yellow-200">— You've Hero'd Out!</span>
          </div>
        </button>
      ) : company.current_map_id ? (
        <button
          onClick={() => navigate(`/map/${company.current_map_id}`)}
          className="w-full flex items-center justify-center gap-3 px-6 py-4 bg-primary-600 hover:bg-primary-700 text-white rounded-lg mb-6 transition-colors shadow-lg"
        >
          <Map className="w-6 h-6" />
          <div className="text-left">
            <span className="text-lg font-bold">Go to Map</span>
            {mapInfo && (
              <span className="ml-2 text-primary-200">— {mapInfo.name}</span>
            )}
          </div>
        </button>
      ) : (
        <button
          onClick={() => navigate('/companies')}
          className="flex items-center gap-2 text-neutral-400 hover:text-white mb-6"
        >
          <ArrowLeft className="w-5 h-5" />
          All Companies
        </button>
      )}

      {/* Company Header */}
      <div className="bg-neutral-800 rounded-lg p-6 mb-6">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 bg-primary-600 rounded-lg flex items-center justify-center">
              <Building2 className="w-8 h-8 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">{company.name}</h1>
              <p className="text-neutral-400 mt-1">
                Level {company.level} • Created {new Date(company.created_at).toLocaleDateString()}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate('/companies')}
              className="p-2 text-neutral-400 hover:text-white hover:bg-neutral-700 rounded"
              title="Back to companies"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="p-2 text-red-400 hover:text-red-300 hover:bg-red-900/30 rounded"
              title="Delete company"
            >
              <Trash2 className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      {/* Level Progress */}
      <LevelProgress
        cash={company.cash}
        totalActions={company.total_actions}
        level={company.level}
      />

      {/* Hero Status (only show when in a location) */}
      {company.current_map_id && company.location_type && (
        <HeroStatus
          companyId={company.id}
          locationType={company.location_type}
          cash={company.cash}
          landPercentage={company.land_percentage || 0}
          landOwnershipStreak={company.land_ownership_streak || 0}
          onHeroSuccess={async () => {
            // Reload company data after hero
            const updated = await getCompany(company.id);
            if (updated) {
              setCompany(updated);
              setActiveCompany(updated);
            }
          }}
        />
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-neutral-800 rounded-lg p-4">
          <div className="flex items-center gap-2 text-neutral-400 mb-2">
            <DollarSign className="w-5 h-5" />
            <span className="text-sm">Cash</span>
          </div>
          <p className="text-2xl font-bold text-green-400 font-mono">
            ${company.cash.toLocaleString()}
          </p>
        </div>

        <div className="bg-neutral-800 rounded-lg p-4">
          <div className="flex items-center gap-2 text-neutral-400 mb-2">
            <Landmark className="w-5 h-5" />
            <span className="text-sm">Offshore</span>
          </div>
          <p className="text-2xl font-bold text-blue-400 font-mono">
            ${company.offshore.toLocaleString()}
          </p>
        </div>

        <div className="bg-neutral-800 rounded-lg p-4">
          <div className="flex items-center gap-2 text-neutral-400 mb-2">
            <TrendingUp className="w-5 h-5" />
            <span className="text-sm">Total Actions</span>
          </div>
          <p className="text-2xl font-bold text-white">
            {company.total_actions.toLocaleString()}
          </p>
        </div>

        <div className="bg-neutral-800 rounded-lg p-4">
          <div className="flex items-center gap-2 text-neutral-400 mb-2">
            <Clock className="w-5 h-5" />
            <span className="text-sm">Ticks Idle</span>
          </div>
          <p className="text-2xl font-bold text-white">
            {company.ticks_since_action}
          </p>
        </div>
      </div>

      {/* Bank Transfer Button */}
      <div className="mb-6">
        <button
          onClick={() => navigate('/bank')}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white rounded-lg p-4 flex items-center justify-center gap-3 transition-colors"
        >
          <ArrowRightLeft className="w-5 h-5" />
          <span className="font-bold">Bank Transfers</span>
          <span className="text-blue-200 text-sm">Transfer cash between your companies</span>
        </button>
      </div>

      {/* Location Section */}
      <div className="bg-neutral-800 rounded-lg p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <MapPin className="w-5 h-5 text-primary-500" />
            <h2 className="text-lg font-bold text-white">Location</h2>
          </div>
        </div>

        {company.current_map_id ? (
          <div>
            <div className="flex items-center justify-between bg-neutral-700 rounded-lg p-4">
              <div>
                <p className="text-white font-medium">
                  {mapInfo?.name || <span className="capitalize">{company.location_type}</span>}
                </p>
                <p className="text-neutral-400 text-sm">
                  {mapInfo?.country && `${mapInfo.country} • `}
                  <span className="capitalize">{company.location_type}</span>
                </p>
              </div>
              <button
                onClick={handleLeaveLocation}
                disabled={isSubmitting}
                className="flex items-center gap-2 px-4 py-2 bg-orange-600 text-white rounded hover:bg-orange-700 disabled:opacity-50"
              >
                <LogOut className="w-4 h-4" />
                Leave Location
              </button>
            </div>
            <p className="text-sm text-red-400 mt-3">
              Warning: Leaving a location will forfeit ALL cash and building value. Your land and buildings will be permanently lost.
            </p>
          </div>
        ) : showLocationPicker ? (
          <div>
            <LocationPicker
              locationType="town"
              selectedMap={selectedMap}
              onSelect={setSelectedMap}
            />
            <div className="flex gap-3 mt-4">
              <button
                onClick={() => setShowLocationPicker(false)}
                className="px-4 py-2 bg-neutral-700 text-white rounded hover:bg-neutral-600"
              >
                Cancel
              </button>
              <button
                onClick={handleJoinLocation}
                disabled={!selectedMap || isSubmitting}
                className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
              >
                {isSubmitting ? 'Joining...' : 'Join Location'}
              </button>
            </div>
          </div>
        ) : (
          <div className="text-center py-8">
            <MapPin className="w-12 h-12 text-neutral-600 mx-auto mb-3" />
            <p className="text-neutral-400 mb-4">Your company is not in any location yet.</p>
            <button
              onClick={() => setShowLocationPicker(true)}
              className="px-6 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
            >
              Choose a Town to Join
            </button>
          </div>
        )}
      </div>

      {/* Prison Status */}
      {company.is_in_prison && (
        <div className="bg-red-900/30 border border-red-500/50 rounded-lg p-6 mb-6">
          <h2 className="text-lg font-bold text-red-400 mb-2">In Prison</h2>
          <p className="text-neutral-300">
            Your company has been caught. Pay the fine to continue operations.
          </p>
          <p className="text-xl font-bold text-red-400 mt-2">
            Fine: ${company.prison_fine.toLocaleString()}
          </p>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-neutral-800 rounded-lg p-6 max-w-md w-full">
            <h2 className="text-xl font-bold text-white mb-4">Delete Company</h2>
            <p className="text-neutral-300 mb-4">
              Are you sure you want to delete <strong>{company.name}</strong>? This action cannot be undone.
            </p>
            <p className="text-neutral-400 text-sm mb-4">
              Type the company name to confirm:
            </p>
            <input
              type="text"
              value={deleteConfirmText}
              onChange={(e) => setDeleteConfirmText(e.target.value)}
              placeholder={company.name}
              className="w-full p-3 rounded bg-neutral-700 text-white border border-neutral-600 focus:border-red-500 focus:outline-none mb-4"
            />
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowDeleteConfirm(false);
                  setDeleteConfirmText('');
                }}
                className="flex-1 px-4 py-2 bg-neutral-700 text-white rounded hover:bg-neutral-600"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleteConfirmText !== company.name || isSubmitting}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50"
              >
                {isSubmitting ? 'Deleting...' : 'Delete Company'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default CompanyDashboard;
