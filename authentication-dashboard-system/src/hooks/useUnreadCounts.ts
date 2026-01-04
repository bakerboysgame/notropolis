import { useState, useEffect, useCallback, useRef } from 'react';
import { api } from '../services/api';

interface UseUnreadCountsReturn {
  unreadCounts: Record<string, number>;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useUnreadCounts(): UseUnreadCountsReturn {
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const fetchUnreadCounts = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await api.get('/api/game/messages/unread-all');
      if (response.data.success) {
        setUnreadCounts(response.data.unread_counts || {});
      }
    } catch (err: any) {
      const errorMessage = err.response?.data?.error || err.message || 'Failed to fetch unread counts';
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Fetch on mount
  useEffect(() => {
    fetchUnreadCounts();
  }, [fetchUnreadCounts]);

  // Poll every 30 seconds
  useEffect(() => {
    intervalRef.current = setInterval(() => {
      fetchUnreadCounts();
    }, 30000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [fetchUnreadCounts]);

  return {
    unreadCounts,
    isLoading,
    error,
    refetch: fetchUnreadCounts,
  };
}
