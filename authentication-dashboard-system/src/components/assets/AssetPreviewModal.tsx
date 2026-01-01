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
} from 'lucide-react';
import { clsx } from 'clsx';
import { Asset, AssetStatus, assetApi, SPRITE_CATEGORIES } from '../../services/assetApi';
import { useToast } from '../ui/Toast';

interface AssetPreviewModalProps {
  asset: Asset;
  onClose: () => void;
  onUpdate: () => void;
}

// Status badge configuration
const STATUS_CONFIG: Record<AssetStatus, { label: string; color: string }> = {
  pending: { label: 'Pending', color: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300' },
  generating: { label: 'Generating', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' },
  completed: { label: 'Ready for Review', color: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300' },
  approved: { label: 'Approved', color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' },
  rejected: { label: 'Rejected', color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300' },
  failed: { label: 'Failed', color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300' },
};

export function AssetPreviewModal({ asset, onClose, onUpdate }: AssetPreviewModalProps) {
  const { showToast } = useToast();
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [loadingImage, setLoadingImage] = useState(true);
  const [imageError, setImageError] = useState(false);
  const [showPrompt, setShowPrompt] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [showRejectInput, setShowRejectInput] = useState(false);

  // Action loading states
  const [approving, setApproving] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [removingBg, setRemovingBg] = useState(false);
  const [publishing, setPublishing] = useState(false);

  const statusConfig = STATUS_CONFIG[asset.status];
  const isSprite = SPRITE_CATEGORIES.includes(asset.category);
  const canApprove = asset.status === 'completed' || asset.status === 'rejected';
  const canReject = asset.status === 'completed' || asset.status === 'approved';
  const canRegenerate = asset.status !== 'generating' && asset.status !== 'pending';
  const canRemoveBg = isSprite && asset.status === 'approved';
  const canPublish = isSprite && asset.status === 'approved';

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

  const handleRegenerate = async () => {
    setRegenerating(true);
    try {
      await assetApi.regenerate(asset.id);
      showToast('Regeneration started', 'success');
      onUpdate();
      onClose();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to regenerate', 'error');
    } finally {
      setRegenerating(false);
    }
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
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
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

              {/* Prompt (collapsible) */}
              {asset.prompt && (
                <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                  <button
                    onClick={() => setShowPrompt(!showPrompt)}
                    className="w-full flex items-center justify-between p-3 text-left text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                  >
                    <span>Generation Prompt</span>
                    {showPrompt ? (
                      <ChevronUp className="w-4 h-4" />
                    ) : (
                      <ChevronDown className="w-4 h-4" />
                    )}
                  </button>
                  {showPrompt && (
                    <div className="p-3 bg-gray-50 dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700">
                      <p className="text-xs text-gray-600 dark:text-gray-400 font-mono whitespace-pre-wrap">
                        {asset.prompt}
                      </p>
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
                        disabled={regenerating}
                        className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300 rounded-lg text-sm font-medium hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50 transition-colors"
                      >
                        {regenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
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
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
