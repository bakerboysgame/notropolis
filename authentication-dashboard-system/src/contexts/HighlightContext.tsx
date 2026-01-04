import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';

export const HIGHLIGHT_COLORS = [
  { name: 'Orange', hex: '#F97316' },
  { name: 'Yellow', hex: '#EAB308' },
  { name: 'Pink', hex: '#EC4899' },
  { name: 'Purple', hex: '#A855F7' },
  { name: 'Cyan', hex: '#06B6D4' },
  { name: 'Lime', hex: '#84CC16' },
  { name: 'Fuchsia', hex: '#D946EF' },
  { name: 'Amber', hex: '#F59E0B' },
] as const;

export interface HighlightedCompany {
  companyId: string;
  companyName: string;
  color: string;
}

interface HighlightContextType {
  highlightedCompanies: Map<string, HighlightedCompany>;
  setCompanyHighlight: (companyId: string, companyName: string, color: string | null) => void;
  getCompanyHighlight: (companyId: string) => string | null;
  clearAllHighlights: () => void;
}

const HighlightContext = createContext<HighlightContextType | undefined>(undefined);

const STORAGE_KEY = 'notropolis_company_highlights';

function loadFromStorage(): Map<string, HighlightedCompany> {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved) as HighlightedCompany[];
      return new Map(parsed.map(h => [h.companyId, h]));
    }
  } catch {
    // Ignore parse errors
  }
  return new Map();
}

function saveToStorage(highlights: Map<string, HighlightedCompany>): void {
  const arr = Array.from(highlights.values());
  localStorage.setItem(STORAGE_KEY, JSON.stringify(arr));
}

export function HighlightProvider({ children }: { children: ReactNode }) {
  const [highlightedCompanies, setHighlightedCompanies] = useState<Map<string, HighlightedCompany>>(() => loadFromStorage());

  useEffect(() => {
    saveToStorage(highlightedCompanies);
  }, [highlightedCompanies]);

  const setCompanyHighlight = useCallback((companyId: string, companyName: string, color: string | null) => {
    setHighlightedCompanies(prev => {
      const next = new Map(prev);
      if (color === null) {
        next.delete(companyId);
      } else {
        next.set(companyId, { companyId, companyName, color });
      }
      return next;
    });
  }, []);

  const getCompanyHighlight = useCallback((companyId: string): string | null => {
    return highlightedCompanies.get(companyId)?.color ?? null;
  }, [highlightedCompanies]);

  const clearAllHighlights = useCallback(() => {
    setHighlightedCompanies(new Map());
  }, []);

  return (
    <HighlightContext.Provider value={{ highlightedCompanies, setCompanyHighlight, getCompanyHighlight, clearAllHighlights }}>
      {children}
    </HighlightContext.Provider>
  );
}

export function useHighlights() {
  const context = useContext(HighlightContext);
  if (!context) throw new Error('useHighlights must be used within HighlightProvider');
  return context;
}
