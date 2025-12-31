import { useState, useEffect } from 'react';
import { api } from '../services/api';

interface Session {
  id: string;
  device_info: string;
  ip_address: string;
  last_active_at: string;
  created_at: string;
  is_current: boolean;
}

export function useSessions() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSessions = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.get<{ success: boolean; sessions: Session[] }>(
        '/api/auth/sessions'
      );

      if (response.data.success) {
        setSessions(response.data.sessions);
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load sessions');
    } finally {
      setLoading(false);
    }
  };

  const deleteSession = async (sessionId: string) => {
    try {
      await api.delete(`/api/auth/sessions/${sessionId}`);
      await fetchSessions(); // Refresh list
      return { success: true };
    } catch (err: any) {
      return {
        success: false,
        error: err.response?.data?.error || 'Failed to delete session'
      };
    }
  };

  const deleteAllSessions = async () => {
    try {
      await api.delete('/api/auth/sessions/all');
      await fetchSessions(); // Refresh list
      return { success: true };
    } catch (err: any) {
      return {
        success: false,
        error: err.response?.data?.error || 'Failed to delete sessions'
      };
    }
  };

  useEffect(() => {
    fetchSessions();
  }, []);

  return {
    sessions,
    loading,
    error,
    refetch: fetchSessions,
    deleteSession,
    deleteAllSessions,
  };
}
