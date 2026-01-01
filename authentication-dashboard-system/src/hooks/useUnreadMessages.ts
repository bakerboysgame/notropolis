import { useState, useEffect, useCallback, useRef } from 'react';
import { useActiveCompany } from '../contexts/CompanyContext';
import { api } from '../services/api';

interface UseUnreadMessagesReturn {
  unreadCount: number;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useUnreadMessages(): UseUnreadMessagesReturn {
  const { activeCompany } = useActiveCompany();
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const fetchUnreadCount = useCallback(async () => {
    if (!activeCompany) {
      setUnreadCount(0);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await api.get('/api/game/messages/unread', {
        params: { company_id: activeCompany.id },
      });

      if (response.data.success) {
        setUnreadCount(response.data.unread_count || 0);
      }
    } catch (err: any) {
      const errorMessage = err.response?.data?.error || err.message || 'Failed to fetch unread count';
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, [activeCompany]);

  // Fetch on mount and when active company changes
  useEffect(() => {
    fetchUnreadCount();
  }, [fetchUnreadCount]);

  // Poll every 30 seconds
  useEffect(() => {
    if (!activeCompany) return;

    intervalRef.current = setInterval(() => {
      fetchUnreadCount();
    }, 30000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [activeCompany, fetchUnreadCount]);

  return {
    unreadCount,
    isLoading,
    error,
    refetch: fetchUnreadCount,
  };
}
