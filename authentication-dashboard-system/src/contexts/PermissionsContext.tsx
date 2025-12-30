import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useAuth } from './AuthContext';
import { api } from '../services/api';

interface PermissionsContextType {
  accessiblePages: string[];
  isLoading: boolean;
  hasPageAccess: (pageKey: string) => boolean;
  refreshPermissions: () => Promise<void>;
}

const PermissionsContext = createContext<PermissionsContextType | undefined>(undefined);

export function PermissionsProvider({ children }: { children: ReactNode }) {
  const { user, token } = useAuth();
  const [accessiblePages, setAccessiblePages] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchPermissions = async () => {
    if (!token || !user) {
      setAccessiblePages([]);
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      const response = await api.get('/api/user/permissions');
      if (response.data.success) {
        setAccessiblePages(response.data.accessible_pages || []);
      }
    } catch (error) {
      console.error('Failed to fetch permissions:', error);
      setAccessiblePages([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchPermissions();
  }, [user, token]);

  const hasPageAccess = (pageKey: string): boolean => {
    // Master admins always have access to all pages
    if (user?.role === 'master_admin') return true;
    // Other users check their accessible pages list
    return accessiblePages.includes(pageKey);
  };

  return (
    <PermissionsContext.Provider
      value={{
        accessiblePages,
        isLoading,
        hasPageAccess,
        refreshPermissions: fetchPermissions
      }}
    >
      {children}
    </PermissionsContext.Provider>
  );
}

export function usePermissions() {
  const context = useContext(PermissionsContext);
  if (context === undefined) {
    throw new Error('usePermissions must be used within a PermissionsProvider');
  }
  return context;
}
