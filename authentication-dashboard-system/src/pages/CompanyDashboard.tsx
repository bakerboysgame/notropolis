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
  Edit2,
  Trash2,
  LogOut
} from 'lucide-react';
import { useCompanies } from '../hooks/useCompanies';
import { useActiveCompany } from '../contexts/CompanyContext';
import { LocationPicker } from '../components/game/LocationPicker';
import { LevelProgress } from '../components/game/LevelProgress';
import { GameCompany } from '../types/game';

export function CompanyDashboard() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { getCompany, updateCompany, deleteCompany, joinLocation, leaveLocation } = useCompanies();
  const { activeCompany, setActiveCompany } = useActiveCompany();

  const [company, setCompany] = useState<GameCompany | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Edit mode
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState('');

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
        setEditName(data.name);
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

  const handleSaveName = async () => {
    if (!company || !editName.trim()) return;
    setIsSubmitting(true);
    const updated = await updateCompany(company.id, editName.trim());
    if (updated) {
      setCompany(updated);
      setActiveCompany(updated);
      setIsEditing(false);
    }
    setIsSubmitting(false);
  };

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
      <button
        onClick={() => navigate('/companies')}
        className="flex items-center gap-2 text-neutral-400 hover:text-white mb-6"
      >
        <ArrowLeft className="w-5 h-5" />
        All Companies
      </button>

      {/* Company Header */}
      <div className="bg-neutral-800 rounded-lg p-6 mb-6">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 bg-primary-600 rounded-lg flex items-center justify-center">
              <Building2 className="w-8 h-8 text-white" />
            </div>
            <div>
              {isEditing ? (
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="text-2xl font-bold bg-neutral-700 text-white px-3 py-1 rounded border border-neutral-600 focus:border-primary-500 focus:outline-none"
                    maxLength={30}
                  />
                  <button
                    onClick={handleSaveName}
                    disabled={isSubmitting || !editName.trim()}
                    className="px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
                  >
                    Save
                  </button>
                  <button
                    onClick={() => {
                      setIsEditing(false);
                      setEditName(company.name);
                    }}
                    className="px-3 py-1 bg-neutral-600 text-white rounded hover:bg-neutral-500"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <h1 className="text-2xl font-bold text-white">{company.name}</h1>
                  <button
                    onClick={() => setIsEditing(true)}
                    className="p-1 text-neutral-400 hover:text-white"
                    title="Edit name"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                </div>
              )}
              <p className="text-neutral-400 mt-1">
                Level {company.level} • Created {new Date(company.created_at).toLocaleDateString()}
              </p>
            </div>
          </div>

          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="p-2 text-red-400 hover:text-red-300 hover:bg-red-900/30 rounded"
            title="Delete company"
          >
            <Trash2 className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Level Progress */}
      <LevelProgress
        cash={company.cash}
        totalActions={company.total_actions}
        level={company.level}
      />

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
                <p className="text-white font-medium capitalize">{company.location_type}</p>
                <p className="text-neutral-400 text-sm">Currently active in this location</p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => navigate(`/map/${company.current_map_id}`)}
                  className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded hover:bg-primary-700"
                >
                  <MapPin className="w-4 h-4" />
                  View Map
                </button>
                <button
                  onClick={handleLeaveLocation}
                  disabled={isSubmitting}
                  className="flex items-center gap-2 px-4 py-2 bg-orange-600 text-white rounded hover:bg-orange-700 disabled:opacity-50"
                >
                  <LogOut className="w-4 h-4" />
                  Leave Location
                </button>
              </div>
            </div>
            <p className="text-sm text-neutral-500 mt-3">
              Note: Leaving a location will reset your cash to the lobby state (future feature: sell buildings first).
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
