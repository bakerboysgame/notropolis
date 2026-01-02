// src/components/assets/AssetPreviewModal.tsx
import { useState, useEffect } from 'react';
import {
  X,
  CheckCircle,
  XCircle,
  RefreshCw,
  Eraser,
  Upload,
  Loader2,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  Image as ImageIcon,
  Star,
  History,
  Link,
  Sparkles,
  Settings,
} from 'lucide-react';
import { clsx } from 'clsx';
import { Asset, assetApi, SPRITE_CATEGORIES, Rejection, AssetReferenceLink, GenerationSettings } from '../../services/assetApi';
import { useToast } from '../ui/Toast';
import RegenerateModal from './RegenerateModal';

interface AssetPreviewModalProps {
  asset: Asset;
  onClose: () => void;
  onUpdate: () => void;
}

// Status badge configuration
const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  pending: { label: 'Pending', color: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300' },
  generating: { label: 'Generating', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' },
  completed: { label: 'Ready for Review', color: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300' },
  review: { label: 'In Review', color: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300' },
  approved: { label: 'Approved', color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' },
  rejected: { label: 'Rejected', color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300' },
  failed: { label: 'Failed', color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300' },
};

const DEFAULT_STATUS = { label: 'Unknown', color: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300' };

type TabId = 'details' | 'references' | 'history';

export function AssetPreviewModal({ asset, onClose, onUpdate }: AssetPreviewModalProps) {
  const { showToast } = useToast();
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [loadingImage, setLoadingImage] = useState(true);
  const [imageError, setImageError] = useState(false);
  const [showPrompt, setShowPrompt] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [showRejectInput, setShowRejectInput] = useState(false);
  const [isPromptEditing, setIsPromptEditing] = useState(false);
  const [editedPrompt, setEditedPrompt] = useState(asset.prompt || '');

  // Tab state
  const [activeTab, setActiveTab] = useState<TabId>('details');
  const [rejections, setRejections] = useState<Rejection[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Stage 8: References and Regenerate
  const [referenceLinks, setReferenceLinks] = useState<AssetReferenceLink[]>([]);
  const [loadingReferences, setLoadingReferences] = useState(false);
  const [showRegenerateModal, setShowRegenerateModal] = useState(false);

  // Parse generation settings
  const generationSettings: GenerationSettings | null = asset.generation_settings
    ? (typeof asset.generation_settings === 'string'
      ? JSON.parse(asset.generation_settings)
      : asset.generation_settings)
    : null;

  // Action loading states
  const [approving, setApproving] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [removingBg, setRemovingBg] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [settingActive, setSettingActive] = useState(false);

  const statusConfig = STATUS_CONFIG[asset.status] || DEFAULT_STATUS;
  const isSprite = SPRITE_CATEGORIES.includes(asset.category);
  const canApprove = asset.status === 'completed' || asset.status === 'rejected' || asset.status === 'review';
  const canReject = asset.status === 'completed' || asset.status === 'approved' || asset.status === 'review';
  const canRegenerate = asset.status !== 'generating' && asset.status !== 'pending';
  const canRemoveBg = isSprite && asset.status === 'approved';
  const canPublish = isSprite && asset.status === 'approved';
  const canSetActive = asset.status === 'approved' && !asset.is_active;

  // Fetch preview URL
  useEffect(() => {
    let mounted = true;

    const fetchImage = async () => {
      if (asset.status === 'pending' || asset.status === 'generating') {
        setLoadingImage(false);
        return;
      }

      try {
        const { url } = await assetApi.getPreviewUrl(asset.id);
        if (mounted) {
          setImageUrl(url);
          setImageError(false);
        }
      } catch {
        if (mounted) {
          setImageError(true);
        }
      } finally {
        if (mounted) {
          setLoadingImage(false);
        }
      }
    };

    fetchImage();
    return () => { mounted = false; };
  }, [asset.id, asset.status]);

  // Handle escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  // Load rejection history when history tab is selected
  useEffect(() => {
    if (activeTab === 'history' && rejections.length === 0) {
      loadRejectionHistory();
    }
  }, [activeTab]);

  // Stage 8: Load reference links when references tab is selected
  useEffect(() => {
    if (activeTab === 'references' && referenceLinks.length === 0) {
      loadReferenceLinks();
    }
  }, [activeTab]);

  const loadReferenceLinks = async () => {
    setLoadingReferences(true);
    try {
      const links = await assetApi.getReferenceLinks(asset.id);
      setReferenceLinks(links);
    } catch {
      // Silently fail - references may not exist
      setReferenceLinks([]);
    } finally {
      setLoadingReferences(false);
    }
  };

  const loadRejectionHistory = async () => {
    setLoadingHistory(true);
    try {
      const data = await assetApi.getRejections(asset.id);
      setRejections(data);
    } catch {
      // Silently fail - history may not exist
      setRejections([]);
    } finally {
      setLoadingHistory(false);
    }
  };

  // Format asset key for display
  const formatAssetKey = (key: string) => {
    return key
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  // Format date
  const formatDate = (date: string) => {
    return new Date(date).toLocaleString();
  };

  // Action handlers
  const handleApprove = async () => {
    setApproving(true);
    try {
      await assetApi.approve(asset.id);
      showToast('Asset approved', 'success');

      // Auto-remove background and publish for sprites
      if (isSprite) {
        showToast('Removing background...', 'info');
        try {
          await assetApi.removeBackground(asset.id);
          showToast('Background removed. Publishing...', 'info');
          try {
            await assetApi.publish(asset.id);
            showToast('Published to public bucket', 'success');
          } catch {
            showToast('Background removed, but publish failed. Try manually.', 'warning');
          }
        } catch {
          showToast('Approved, but background removal failed. Try manually.', 'warning');
        }
      }

      onUpdate();
      onClose();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to approve', 'error');
    } finally {
      setApproving(false);
    }
  };

  const handleReject = async () => {
    if (!rejectReason.trim()) {
      showToast('Please enter a rejection reason', 'warning');
      return;
    }

    setRejecting(true);
    try {
      await assetApi.reject(asset.id, rejectReason);
      showToast('Asset rejected', 'success');
      onUpdate();
      onClose();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to reject', 'error');
    } finally {
      setRejecting(false);
    }
  };

  // Stage 8: Open RegenerateModal instead of direct API call
  const handleRegenerate = () => {
    setShowRegenerateModal(true);
  };

  // Stage 8: Handle regeneration completion
  const handleRegenerateComplete = (newAssetId: number) => {
    setShowRegenerateModal(false);
    showToast(`Created new version (Asset #${newAssetId})`, 'success');
    onUpdate();
    onClose();
  };

  const handleRemoveBackground = async () => {
    setRemovingBg(true);
    try {
      await assetApi.removeBackground(asset.id);
      showToast('Background removal started', 'success');
      onUpdate();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to remove background', 'error');
    } finally {
      setRemovingBg(false);
    }
  };

  const handlePublish = async () => {
    setPublishing(true);
    try {
      await assetApi.publish(asset.id);
      showToast('Asset published to public bucket', 'success');
      onUpdate();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to publish', 'error');
    } finally {
      setPublishing(false);
    }
  };

  const handleSetActive = async () => {
    setSettingActive(true);
    try {
      await assetApi.setActive(asset.id);
      showToast('Asset set as active', 'success');
      onUpdate();
      onClose();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to set active', 'error');
    } finally {
      setSettingActive(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">
              {formatAssetKey(asset.asset_key)}
            </h2>
            <span className="text-sm text-gray-500 dark:text-gray-400">
              v{asset.variant}
            </span>
            <span className={clsx(
              'px-2 py-0.5 rounded-full text-xs font-medium',
              statusConfig.color
            )}>
              {statusConfig.label}
            </span>
            {asset.is_active && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700">
                <Star className="w-3 h-3 fill-current" />
                Active
              </span>
            )}
            {asset.auto_created && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300 border border-purple-300 dark:border-purple-700">
                <Sparkles className="w-3 h-3" />
                Auto-created
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200 dark:border-gray-700 px-4">
          <button
            onClick={() => setActiveTab('details')}
            className={clsx(
              'px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors',
              activeTab === 'details'
                ? 'border-purple-500 text-purple-600 dark:text-purple-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
            )}
          >
            Details
          </button>
          <button
            onClick={() => setActiveTab('references')}
            className={clsx(
              'px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors flex items-center gap-1',
              activeTab === 'references'
                ? 'border-purple-500 text-purple-600 dark:text-purple-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
            )}
          >
            <Link className="w-4 h-4" />
            References
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={clsx(
              'px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors flex items-center gap-1',
              activeTab === 'history'
                ? 'border-purple-500 text-purple-600 dark:text-purple-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
            )}
          >
            <History className="w-4 h-4" />
            History
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {activeTab === 'details' ? (
          <div className="grid md:grid-cols-2 gap-6 p-6">
            {/* Image */}
            <div className="aspect-square bg-gray-100 dark:bg-gray-900 rounded-lg overflow-hidden relative">
              {loadingImage ? (
                <div className="absolute inset-0 flex items-center justify-center">
                  <Loader2 className="w-12 h-12 animate-spin text-gray-400" />
                </div>
              ) : imageError || !imageUrl ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-400">
                  <ImageIcon className="w-16 h-16 mb-3" />
                  <span className="text-sm">
                    {asset.status === 'generating' ? 'Generating...' : 'No preview available'}
                  </span>
                </div>
              ) : (
                <img
                  src={imageUrl}
                  alt={`${asset.asset_key} v${asset.variant}`}
                  className="w-full h-full object-contain"
                />
              )}

              {/* Generating overlay */}
              {asset.status === 'generating' && (
                <div className="absolute inset-0 bg-blue-500/20 flex items-center justify-center">
                  <div className="bg-blue-600 text-white px-4 py-2 rounded-full flex items-center gap-2">
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Generating...
                  </div>
                </div>
              )}
            </div>

            {/* Details & Actions */}
            <div className="space-y-4">
              {/* Metadata */}
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-gray-500 dark:text-gray-400 w-24">Category:</span>
                  <span className="text-gray-900 dark:text-gray-100">{asset.category}</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-gray-500 dark:text-gray-400 w-24">Asset Key:</span>
                  <span className="text-gray-900 dark:text-gray-100">{asset.asset_key}</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-gray-500 dark:text-gray-400 w-24">Created:</span>
                  <span className="text-gray-900 dark:text-gray-100">{formatDate(asset.created_at)}</span>
                </div>
                {asset.approved_at && (
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-gray-500 dark:text-gray-400 w-24">Approved:</span>
                    <span className="text-gray-900 dark:text-gray-100">{formatDate(asset.approved_at)}</span>
                  </div>
                )}
                {asset.parent_asset_id && (
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-gray-500 dark:text-gray-400 w-24">Parent ID:</span>
                    <span className="text-gray-900 dark:text-gray-100 font-mono text-xs">
                      {asset.parent_asset_id}
                    </span>
                  </div>
                )}
                {asset.used_reference_image && (
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-purple-600 dark:text-purple-400">
                      Uses approved reference sheet
                    </span>
                  </div>
                )}
              </div>

              {/* Stage 8: Generation Settings */}
              {generationSettings && (
                <div className="p-3 bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 rounded-lg">
                  <div className="flex items-center gap-2 text-gray-700 dark:text-gray-300 text-sm font-medium mb-2">
                    <Settings className="w-4 h-4" />
                    Generation Settings
                  </div>
                  <div className="flex flex-wrap gap-3 text-sm text-gray-600 dark:text-gray-400">
                    {generationSettings.temperature !== undefined && (
                      <span className="px-2 py-1 bg-white dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-600">
                        Temperature: {generationSettings.temperature}
                      </span>
                    )}
                    {generationSettings.topK !== undefined && (
                      <span className="px-2 py-1 bg-white dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-600">
                        Top K: {generationSettings.topK}
                      </span>
                    )}
                    {generationSettings.topP !== undefined && (
                      <span className="px-2 py-1 bg-white dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-600">
                        Top P: {generationSettings.topP}
                      </span>
                    )}
                  </div>
                </div>
              )}

              {/* Rejection reason */}
              {asset.status === 'rejected' && asset.rejection_reason && (
                <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                  <div className="flex items-center gap-2 text-red-700 dark:text-red-300 text-sm font-medium mb-1">
                    <AlertTriangle className="w-4 h-4" />
                    Rejection Reason
                  </div>
                  <p className="text-red-600 dark:text-red-400 text-sm">
                    {asset.rejection_reason}
                  </p>
                </div>
              )}

              {/* Error message */}
              {asset.status === 'failed' && asset.error_message && (
                <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                  <div className="flex items-center gap-2 text-red-700 dark:text-red-300 text-sm font-medium mb-1">
                    <AlertTriangle className="w-4 h-4" />
                    Error
                  </div>
                  <p className="text-red-600 dark:text-red-400 text-sm font-mono">
                    {asset.error_message}
                  </p>
                </div>
              )}

              {/* Stage 8: Prompt (collapsible with edit toggle) */}
              {asset.prompt && (
                <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                  <div className="w-full flex items-center justify-between p-3 text-left text-sm font-medium text-gray-700 dark:text-gray-300">
                    <button
                      onClick={() => setShowPrompt(!showPrompt)}
                      className="flex items-center gap-2 hover:text-gray-900 dark:hover:text-gray-100 transition-colors"
                    >
                      <span>Generation Prompt</span>
                      {showPrompt ? (
                        <ChevronUp className="w-4 h-4" />
                      ) : (
                        <ChevronDown className="w-4 h-4" />
                      )}
                    </button>
                    {showPrompt && (
                      <button
                        onClick={() => setIsPromptEditing(!isPromptEditing)}
                        className="text-xs text-blue-500 hover:text-blue-600 dark:text-blue-400 dark:hover:text-blue-300"
                      >
                        {isPromptEditing ? 'Done' : 'Edit'}
                      </button>
                    )}
                  </div>
                  {showPrompt && (
                    <div className="p-3 bg-gray-50 dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700">
                      {isPromptEditing ? (
                        <textarea
                          value={editedPrompt}
                          onChange={(e) => setEditedPrompt(e.target.value)}
                          className="w-full h-48 p-2 text-xs font-mono text-gray-600 dark:text-gray-400 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded resize-none"
                        />
                      ) : (
                        <p className="text-xs text-gray-600 dark:text-gray-400 font-mono whitespace-pre-wrap">
                          {asset.prompt}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Reject reason input */}
              {showRejectInput && (
                <div className="space-y-2">
                  <textarea
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                    placeholder="Enter rejection reason..."
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={handleReject}
                      disabled={rejecting || !rejectReason.trim()}
                      className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-50 transition-colors"
                    >
                      {rejecting ? <Loader2 className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4" />}
                      Confirm Reject
                    </button>
                    <button
                      onClick={() => {
                        setShowRejectInput(false);
                        setRejectReason('');
                      }}
                      className="px-3 py-2 text-gray-600 dark:text-gray-400 text-sm hover:text-gray-800 dark:hover:text-gray-200"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {/* Primary Actions */}
              {!showRejectInput && (
                <div className="space-y-3 pt-2">
                  {/* Approve / Reject row */}
                  <div className="flex gap-2">
                    {canApprove && (
                      <button
                        onClick={handleApprove}
                        disabled={approving}
                        className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50 transition-colors"
                      >
                        {approving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                        Approve
                      </button>
                    )}
                    {canReject && (
                      <button
                        onClick={() => setShowRejectInput(true)}
                        className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 transition-colors"
                      >
                        <XCircle className="w-4 h-4" />
                        Reject
                      </button>
                    )}
                  </div>

                  {/* Secondary actions */}
                  <div className="flex gap-2">
                    {canRegenerate && (
                      <button
                        onClick={handleRegenerate}
                        className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300 rounded-lg text-sm font-medium hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                      >
                        <RefreshCw className="w-4 h-4" />
                        Regenerate
                      </button>
                    )}
                  </div>

                  {/* Sprite-specific actions */}
                  {isSprite && (
                    <div className="flex gap-2">
                      {canRemoveBg && (
                        <button
                          onClick={handleRemoveBackground}
                          disabled={removingBg}
                          className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300 rounded-lg text-sm font-medium hover:bg-purple-200 dark:hover:bg-purple-900/50 disabled:opacity-50 transition-colors"
                        >
                          {removingBg ? <Loader2 className="w-4 h-4 animate-spin" /> : <Eraser className="w-4 h-4" />}
                          Remove BG
                        </button>
                      )}
                      {canPublish && (
                        <button
                          onClick={handlePublish}
                          disabled={publishing}
                          className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
                        >
                          {publishing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                          Publish
                        </button>
                      )}
                    </div>
                  )}

                  {/* Set Active button */}
                  {canSetActive && (
                    <div className="flex gap-2">
                      <button
                        onClick={handleSetActive}
                        disabled={settingActive}
                        className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 disabled:opacity-50 transition-colors"
                      >
                        {settingActive ? <Loader2 className="w-4 h-4 animate-spin" /> : <Star className="w-4 h-4" />}
                        Set as Active
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
          ) : activeTab === 'references' ? (
            /* Stage 8: References Tab Content */
            <div className="p-6">
              <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-4">
                Reference Images Used
              </h3>

              {/* Parent Reference */}
              {asset.parent_asset_id && (
                <div className="mb-4 p-3 bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg">
                  <div className="flex items-center gap-2 text-purple-700 dark:text-purple-300 text-sm font-medium">
                    <Link className="w-4 h-4" />
                    Parent Reference
                  </div>
                  <p className="text-sm text-purple-600 dark:text-purple-400 mt-1">
                    Generated from reference sheet #{asset.parent_asset_id}
                  </p>
                </div>
              )}

              {loadingReferences ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
                </div>
              ) : referenceLinks.length === 0 ? (
                <div className="text-center py-12 text-gray-500 dark:text-gray-400">
                  <ImageIcon className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>No additional reference images used</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-4">
                  {referenceLinks.map((link) => (
                    <div
                      key={link.id}
                      className="border border-gray-200 dark:border-gray-700 rounded-lg p-3 flex items-center gap-3"
                    >
                      <div className="w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded overflow-hidden flex-shrink-0">
                        {link.thumbnailUrl ? (
                          <img
                            src={link.thumbnailUrl}
                            alt={link.name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <ImageIcon className="w-6 h-6 text-gray-400" />
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                          {link.name}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {link.link_type === 'library' ? 'Library' : 'Approved Asset'}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            /* History Tab Content */
            <div className="p-6">
              <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-4">
                Rejection History
              </h3>

              {loadingHistory ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
                </div>
              ) : rejections.length === 0 ? (
                <div className="text-center py-12 text-gray-500 dark:text-gray-400">
                  <History className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>No rejection history for this asset</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {rejections.map((rejection, index) => (
                    <div
                      key={rejection.id}
                      className="border border-gray-200 dark:border-gray-700 rounded-lg p-4"
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-0.5 bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300 rounded text-xs font-medium">
                            Rejection #{rejections.length - index}
                          </span>
                          <span className="text-xs text-gray-500 dark:text-gray-400">
                            v{rejection.prompt_version}
                          </span>
                        </div>
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                          {new Date(rejection.created_at).toLocaleString()}
                        </span>
                      </div>

                      <div className="mb-3">
                        <div className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                          Reason:
                        </div>
                        <p className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 rounded p-2">
                          {rejection.rejection_reason}
                        </p>
                      </div>

                      {rejection.prompt_at_rejection && (
                        <details className="text-sm">
                          <summary className="cursor-pointer text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200">
                            View prompt at rejection
                          </summary>
                          <pre className="mt-2 p-3 bg-gray-50 dark:bg-gray-900 rounded text-xs text-gray-600 dark:text-gray-400 whitespace-pre-wrap overflow-x-auto">
                            {rejection.prompt_at_rejection}
                          </pre>
                        </details>
                      )}

                      <div className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                        Rejected by: {rejection.rejected_by}
                      </div>
                    </div>
                  ))}

                  {/* Current prompt comparison */}
                  {asset.prompt && (
                    <div className="mt-6 border-t border-gray-200 dark:border-gray-700 pt-4">
                      <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-2">
                        Current Prompt
                      </h4>
                      <pre className="p-3 bg-gray-50 dark:bg-gray-900 rounded text-xs text-gray-600 dark:text-gray-400 whitespace-pre-wrap overflow-x-auto">
                        {asset.prompt}
                      </pre>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Stage 8: Regenerate Modal */}
      {showRegenerateModal && (
        <RegenerateModal
          isOpen={showRegenerateModal}
          asset={asset}
          currentPrompt={editedPrompt || asset.prompt || ''}
          currentReferences={referenceLinks}
          currentSettings={generationSettings}
          onClose={() => setShowRegenerateModal(false)}
          onRegenerate={handleRegenerateComplete}
        />
      )}
    </div>
  );
}
