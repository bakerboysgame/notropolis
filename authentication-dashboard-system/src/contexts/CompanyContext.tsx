import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { api } from '../services/api';
import { GameCompany } from '../types/game';

interface CompanyContextType {
  activeCompany: GameCompany | null;
  setActiveCompany: (company: GameCompany | null) => void;
  refreshCompany: () => Promise<void>;
  clearActiveCompany: () => void;
}

const CompanyContext = createContext<CompanyContextType | null>(null);

const STORAGE_KEY = 'notropolis_active_company_id';

export function CompanyProvider({ children }: { children: React.ReactNode }) {
  const [activeCompany, setActiveCompanyState] = useState<GameCompany | null>(null);

  // Fetch company by ID
  const fetchCompany = useCallback(async (companyId: string): Promise<GameCompany | null> => {
    try {
      const response = await api.get(`/api/game/companies/${companyId}`);
      if (response.data.success) {
        return response.data.data.company;
      }
      return null;
    } catch {
      return null;
    }
  }, []);

  // Set active company and persist to localStorage
  const setActiveCompany = useCallback((company: GameCompany | null) => {
    setActiveCompanyState(company);
    if (company) {
      localStorage.setItem(STORAGE_KEY, company.id);
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  }, []);

  // Clear active company
  const clearActiveCompany = useCallback(() => {
    setActiveCompanyState(null);
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  // Refresh the active company from API
  const refreshCompany = useCallback(async () => {
    if (!activeCompany) return;
    const updated = await fetchCompany(activeCompany.id);
    if (updated) {
      setActiveCompanyState(updated);
    } else {
      // Company no longer exists or user lost access
      clearActiveCompany();
    }
  }, [activeCompany, fetchCompany, clearActiveCompany]);

  // Restore active company from localStorage on mount
  useEffect(() => {
    const storedCompanyId = localStorage.getItem(STORAGE_KEY);
    if (storedCompanyId) {
      fetchCompany(storedCompanyId).then(company => {
        if (company) {
          setActiveCompanyState(company);
        } else {
          // Company no longer exists, clear storage
          localStorage.removeItem(STORAGE_KEY);
        }
      });
    }
  }, [fetchCompany]);

  return (
    <CompanyContext.Provider
      value={{
        activeCompany,
        setActiveCompany,
        refreshCompany,
        clearActiveCompany,
      }}
    >
      {children}
    </CompanyContext.Provider>
  );
}

export function useActiveCompany() {
  const context = useContext(CompanyContext);
  if (!context) {
    throw new Error('useActiveCompany must be used within a CompanyProvider');
  }
  return context;
}
