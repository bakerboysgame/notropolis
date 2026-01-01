// src/components/assets/QueueStatus.tsx
import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Clock,
  Loader2,
  RefreshCw,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { clsx } from 'clsx';
import { QueueItem, assetApi } from '../../services/assetApi';

interface QueueStatusProps {
  onQueueChange?: (hasItems: boolean) => void;
  refreshInterval?: number;
}

export function QueueStatus({
  onQueueChange,
  refreshInterval = 5000,
}: QueueStatusProps) {
  const [pending, setPending] = useState(0);
  const [generating, setGenerating] = useState(0);
  const [items, setItems] = useState<QueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);

  // Track previous counts to only trigger onQueueChange when something actually changes
  const prevCountsRef = useRef<{ pending: number; generating: number } | null>(null);

  const fetchQueue = useCallback(async () => {
    try {
      const data = await assetApi.getQueue();
      setPending(data.pending);
      setGenerating(data.generating);
      setItems(data.items || []);

      // Only call onQueueChange if the counts actually changed
      const prevCounts = prevCountsRef.current;
      if (!prevCounts || prevCounts.pending !== data.pending || prevCounts.generating !== data.generating) {
        prevCountsRef.current = { pending: data.pending, generating: data.generating };
        onQueueChange?.(data.pending > 0 || data.generating > 0);
      }
    } catch (err) {
      console.error('Failed to fetch queue:', err);
    } finally {
      setLoading(false);
    }
  }, [onQueueChange]);

  // Initial fetch
  useEffect(() => {
    fetchQueue();
  }, [fetchQueue]);

  // Polling
  useEffect(() => {
    const interval = setInterval(fetchQueue, refreshInterval);
    return () => clearInterval(interval);
  }, [fetchQueue, refreshInterval]);

  const total = pending + generating;

  // Format asset key for display
  const formatKey = (key: string) => {
    return key
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  // Format time ago
  const formatTimeAgo = (date: string) => {
    const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
    if (seconds < 60) return `${seconds}s ago`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    return `${hours}h ago`;
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-100 dark:bg-gray-700 rounded-lg text-sm text-gray-500">
        <Loader2 className="w-4 h-4 animate-spin" />
        Loading queue...
      </div>
    );
  }

  if (total === 0) {
    return (
      <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-100 dark:bg-gray-700 rounded-lg text-sm text-gray-500 dark:text-gray-400">
        <Clock className="w-4 h-4" />
        Queue empty
        <button
          onClick={fetchQueue}
          className="ml-1 p-1 hover:bg-gray-200 dark:hover:bg-gray-600 rounded transition-colors"
          title="Refresh"
        >
          <RefreshCw className="w-3 h-3" />
        </button>
      </div>
    );
  }

  return (
    <div className="relative">
      <button
        onClick={() => setExpanded(!expanded)}
        className={clsx(
          'flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors',
          generating > 0
            ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
            : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300'
        )}
      >
        {generating > 0 ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <Clock className="w-4 h-4" />
        )}
        <span>
          {generating > 0 && `${generating} generating`}
          {generating > 0 && pending > 0 && ', '}
          {pending > 0 && `${pending} pending`}
        </span>
        {expanded ? (
          <ChevronUp className="w-4 h-4" />
        ) : (
          <ChevronDown className="w-4 h-4" />
        )}
      </button>

      {/* Expanded dropdown */}
      {expanded && items.length > 0 && (
        <div className="absolute top-full right-0 mt-2 w-72 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-10 overflow-hidden">
          <div className="p-3 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
            <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
              Generation Queue
            </span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                fetchQueue();
              }}
              className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
              title="Refresh"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
          <div className="max-h-64 overflow-y-auto">
            {items.map((item) => (
              <div
                key={item.id}
                className="px-3 py-2 border-b border-gray-100 dark:border-gray-700 last:border-b-0"
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-900 dark:text-gray-100">
                    {formatKey(item.asset_key)}
                  </span>
                  <span className={clsx(
                    'text-xs px-1.5 py-0.5 rounded',
                    item.status === 'generating'
                      ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
                      : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
                  )}>
                    {item.status === 'generating' ? (
                      <span className="flex items-center gap-1">
                        <Loader2 className="w-3 h-3 animate-spin" />
                        Generating
                      </span>
                    ) : (
                      'Pending'
                    )}
                  </span>
                </div>
                <div className="flex items-center justify-between mt-1">
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    {item.category}
                  </span>
                  <span className="text-xs text-gray-400 dark:text-gray-500">
                    {formatTimeAgo(item.created_at)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
