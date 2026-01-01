import { useState, useEffect, useCallback } from 'react';
import { api } from '../services/api';

interface AvatarItem {
  id: string;
  category: string;
  name: string;
  r2_key: string;
  rarity: string;
  isUnlocked: boolean;
  isSelected: boolean;
  unlockRequirement: { type: string; count: number } | null;
}

interface AvatarSelection {
  base_id: string | null;
  skin_id: string | null;
  hair_id: string | null;
  outfit_id: string | null;
  headwear_id: string | null;
  accessory_id: string | null;
  background_id: string | null;
}

interface AvatarItemsData {
  items: AvatarItem[];
  selection: AvatarSelection;
}

export function useAvatarItems(companyId: string | undefined) {
  const [data, setData] = useState<AvatarItemsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchItems = useCallback(async () => {
    if (!companyId) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    try {
      const response = await api.get(`/api/game/avatar/items?company_id=${companyId}`);
      if (response.data.success) {
        setData(response.data.data);
      } else {
        throw new Error(response.data.error || 'Failed to fetch avatar items');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to fetch avatar items');
    } finally {
      setIsLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  return { data, isLoading, error, refetch: fetchItems };
}

export function useUpdateAvatar() {
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mutate = useCallback(
    async (
      { companyId, category, itemId }: { companyId: string; category: string; itemId: string | null },
      options?: { onSuccess?: () => void }
    ) => {
      setIsPending(true);
      setError(null);
      try {
        const response = await api.post('/api/game/avatar/update', {
          company_id: companyId,
          category,
          item_id: itemId,
        });
        if (response.data.success) {
          options?.onSuccess?.();
        } else {
          throw new Error(response.data.error || 'Failed to update avatar');
        }
      } catch (err: any) {
        setError(err.message || 'Failed to update avatar');
      } finally {
        setIsPending(false);
      }
    },
    []
  );

  return { mutate, isPending, error };
}

interface AvatarLayer {
  category: string;
  url: string;
}

interface AvatarImageData {
  layers: AvatarLayer[];
}

export function useAvatarImage(companyId: string | undefined) {
  const [data, setData] = useState<AvatarImageData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchImage = useCallback(async () => {
    if (!companyId) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    try {
      const response = await api.get(`/api/game/avatar/image?company_id=${companyId}`);
      if (response.data.success) {
        setData(response.data.data);
      } else {
        throw new Error(response.data.error || 'Failed to fetch avatar image');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to fetch avatar image');
    } finally {
      setIsLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    fetchImage();
  }, [fetchImage]);

  return { data, isLoading, error, refetch: fetchImage };
}
