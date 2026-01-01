# Stage 15: Avatar System

## Objective

Implement avatar customization with preloaded outfits, headwear, and accessories, plus an unlock system for earning items through gameplay achievements.

## Dependencies

`[Requires: Stage 03 complete]` - Needs companies for avatar assignment.
`[Requires: Stage 12 complete]` - Needs hero system for unlock triggers.
`[Requires: R2 bucket]` - For avatar asset storage (see below).

---

## R2 Storage Setup

### Bucket Configuration

| Property | Value |
|----------|-------|
| Bucket Name | `notropolis-avatars` |
| Worker Binding | `AVATARS_BUCKET` |
| Status | ✅ Created |

The R2 bucket is already configured in `worker/wrangler.toml`:

```toml
[[r2_buckets]]
binding = "AVATARS_BUCKET"
bucket_name = "notropolis-avatars"
```

### Public Access Setup

| Property | Value |
|----------|-------|
| Public URL | `https://pub-874867b18f8b4b4882277d8a2b7dfe80.r2.dev` |
| Status | ✅ Enabled |

Public access was enabled via CLI:
```bash
npx wrangler r2 bucket dev-url enable notropolis-avatars
```

**Optional:** Set up custom domain (e.g., `r2.notropolis.net`) via dashboard for cleaner URLs.

### Public URL Constant

The `R2_PUBLIC_URL` constant is used in avatar.js and frontend components:

```javascript
const R2_PUBLIC_URL = 'https://pub-874867b18f8b4b4882277d8a2b7dfe80.r2.dev';
```

Avatar images are accessed at: `${R2_PUBLIC_URL}/avatars/{category}/{name}.png`

---

## Complexity

**Medium** - Asset management, customization UI, and unlock system.

## Files to Create

| File | Purpose |
|------|---------|
| `src/pages/Avatar.tsx` | Avatar customization page |
| `src/components/avatar/AvatarPreview.tsx` | Avatar preview component |
| `src/components/avatar/UnlockNotification.tsx` | "New item unlocked!" popup |
| `src/hooks/useAvatar.ts` | Avatar hooks for API calls |
| `worker/src/routes/game/avatar.js` | Avatar API |
| `migrations/0022_create_avatar_tables.sql` | Avatar tables |

## Files to Modify

| File | Change |
|------|--------|
| `worker/src/routes/game/hero.js` | Call unlock checker after hero out |
| `worker/index.js` | Register avatar route handlers |
| `src/App.tsx` | Add /avatar route and import |

---

## App.tsx Changes

```typescript
// Add import at top of file with other page imports
import { Avatar } from './pages/Avatar';

// Add route after Casino Route, before Game Map Route:
              {/* Avatar Route */}
              <Route path="/avatar" element={
                <ProtectedRoute>
                  <Layout>
                    <Avatar />
                  </Layout>
                </ProtectedRoute>
              } />
```

---

## Unlock System Design

### Unlock Condition Types

Items can have `unlock_condition` as JSON specifying what's needed to unlock them:

```typescript
// Supported unlock condition types
interface UnlockCondition {
  type: 'hero_count';  // Number of times user has hero'd out
  count: number;       // Required count to unlock
}

// Future types (not implemented yet):
// - hero_location_type: Hero from specific location type (town/city/capital)
// - attack_count: Total attacks performed
// - buildings_owned: Max buildings owned at once
// - total_donated: Total donated to temples
// - offshore: Offshore balance threshold
// - level: Player level reached
```

### Unlock Flow

```
┌─────────────────────────────────────────────────────────────┐
│                    Player Heroes Out                         │
│                          ↓                                   │
│              checkAvatarUnlocks(userId)                     │
│                          ↓                                   │
│     ┌────────────────────────────────────────────┐          │
│     │  For each locked item with unlock_condition │          │
│     │                    ↓                        │          │
│     │  Evaluate condition against user stats      │          │
│     │                    ↓                        │          │
│     │  If met → INSERT into avatar_unlocks        │          │
│     │           Return newly unlocked items       │          │
│     └────────────────────────────────────────────┘          │
│                          ↓                                   │
│         Return unlocked items in API response               │
│                          ↓                                   │
│         Frontend shows UnlockNotification                   │
└─────────────────────────────────────────────────────────────┘
```

---

## Database Migration

```sql
-- 0022_create_avatar_tables.sql

-- Avatar items catalog
CREATE TABLE avatar_items (
  id TEXT PRIMARY KEY,
  category TEXT NOT NULL,
  -- Categories: base, skin, hair, outfit, headwear, accessory, background
  name TEXT NOT NULL,
  r2_key TEXT NOT NULL,
  rarity TEXT DEFAULT 'common',
  -- Rarities: common, uncommon, rare, epic, legendary
  unlock_condition TEXT,
  -- NULL = always available, or JSON like {"type":"hero_count","count":10000}
  sort_order INTEGER DEFAULT 0,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_avatar_items_category ON avatar_items(category);

-- Company avatar selections
CREATE TABLE company_avatars (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL UNIQUE,
  base_id TEXT,
  skin_id TEXT,
  hair_id TEXT,
  outfit_id TEXT,
  headwear_id TEXT,
  accessory_id TEXT,
  background_id TEXT,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (company_id) REFERENCES game_companies(id)
);

-- Unlocked items per user (user-level, not company-level)
CREATE TABLE avatar_unlocks (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  item_id TEXT NOT NULL,
  unlocked_at TEXT DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (item_id) REFERENCES avatar_items(id),
  UNIQUE(user_id, item_id)
);

CREATE INDEX idx_avatar_unlocks_user ON avatar_unlocks(user_id);
```

---

## Seed Data

```sql
-- Seed avatar items
-- Common items (always available - unlock_condition is NULL)
INSERT INTO avatar_items (id, category, name, r2_key, rarity, unlock_condition, sort_order) VALUES
-- Base bodies
('base_1', 'base', 'Standard', 'avatars/base/standard.png', 'common', NULL, 1),
('base_2', 'base', 'Athletic', 'avatars/base/athletic.png', 'common', NULL, 2),

-- Skin tones
('skin_1', 'skin', 'Light', 'avatars/skin/light.png', 'common', NULL, 1),
('skin_2', 'skin', 'Medium', 'avatars/skin/medium.png', 'common', NULL, 2),
('skin_3', 'skin', 'Dark', 'avatars/skin/dark.png', 'common', NULL, 3),

-- Hair
('hair_1', 'hair', 'Short', 'avatars/hair/short.png', 'common', NULL, 1),
('hair_2', 'hair', 'Long', 'avatars/hair/long.png', 'common', NULL, 2),
('hair_3', 'hair', 'Mohawk', 'avatars/hair/mohawk.png', 'uncommon', NULL, 3),

-- Outfits (common)
('outfit_1', 'outfit', 'Business Suit', 'avatars/outfit/suit.png', 'common', NULL, 1),
('outfit_2', 'outfit', 'Casual', 'avatars/outfit/casual.png', 'common', NULL, 2),

-- Headwear (common)
('head_1', 'headwear', 'Top Hat', 'avatars/headwear/tophat.png', 'uncommon', NULL, 1),
('head_2', 'headwear', 'Baseball Cap', 'avatars/headwear/cap.png', 'common', NULL, 2),

-- Accessories (common)
('acc_1', 'accessory', 'Sunglasses', 'avatars/accessory/sunglasses.png', 'common', NULL, 1),
('acc_2', 'accessory', 'Watch', 'avatars/accessory/watch.png', 'common', NULL, 2),

-- Backgrounds (common)
('bg_1', 'background', 'City Skyline', 'avatars/background/city.png', 'common', NULL, 1),
('bg_2', 'background', 'Office', 'avatars/background/office.png', 'common', NULL, 2),

-- ============================================================
-- UNLOCKABLE ITEMS (with unlock_condition)
-- These have unreachable conditions for now - logic is in place
-- ============================================================

-- Legendary Crown - Requires 10,000 hero completions (unreachable placeholder)
('head_legendary_crown', 'headwear', 'Legendary Crown', 'avatars/headwear/legendary_crown.png', 'legendary', '{"type":"hero_count","count":10000}', 100),

-- Mythic Gold Suit - Requires 500,000 hero completions (unreachable placeholder)
('outfit_mythic_gold', 'outfit', 'Mythic Gold Suit', 'avatars/outfit/mythic_gold.png', 'legendary', '{"type":"hero_count","count":500000}', 100);
```

---

## Avatar Categories

```typescript
// utils/avatar.ts
export const AVATAR_CATEGORIES = [
  { id: 'base', name: 'Base', required: true },
  { id: 'skin', name: 'Skin Tone', required: true },
  { id: 'hair', name: 'Hair', required: false },
  { id: 'outfit', name: 'Outfit', required: true },
  { id: 'headwear', name: 'Headwear', required: false },
  { id: 'accessory', name: 'Accessory', required: false },
  { id: 'background', name: 'Background', required: false },
] as const;

export type AvatarCategory = typeof AVATAR_CATEGORIES[number]['id'];

export interface AvatarSelection {
  base_id: string | null;
  skin_id: string | null;
  hair_id: string | null;
  outfit_id: string | null;
  headwear_id: string | null;
  accessory_id: string | null;
  background_id: string | null;
}

export const RARITY_COLORS = {
  common: '#9ca3af',
  uncommon: '#22c55e',
  rare: '#3b82f6',
  epic: '#a855f7',
  legendary: '#f59e0b',
};

// Unlock condition types
export interface UnlockCondition {
  type: 'hero_count';
  count: number;
}
```

---

## Avatar API

```javascript
// worker/src/routes/game/avatar.js

// R2 public URL for avatar assets
const R2_PUBLIC_URL = 'https://pub-874867b18f8b4b4882277d8a2b7dfe80.r2.dev';

// Get all items with unlock status for a user
export async function getAvatarItems(env, userId, companyId) {
  // Get all items
  const items = await env.DB.prepare(
    'SELECT * FROM avatar_items ORDER BY category, sort_order'
  ).all();

  // Get unlocked items for this user
  const unlocks = await env.DB.prepare(
    'SELECT item_id FROM avatar_unlocks WHERE user_id = ?'
  ).bind(userId).all();

  const unlockedIds = new Set(unlocks.results.map(u => u.item_id));

  // Get current selection for this company
  const selection = await env.DB.prepare(
    'SELECT * FROM company_avatars WHERE company_id = ?'
  ).bind(companyId).first();

  // Mark items as available/locked
  const itemsWithStatus = items.results.map(item => ({
    ...item,
    isUnlocked: item.unlock_condition === null || unlockedIds.has(item.id),
    isSelected: selection && Object.values(selection).includes(item.id),
    // Parse unlock condition for display
    unlockRequirement: item.unlock_condition ? JSON.parse(item.unlock_condition) : null,
  }));

  return {
    items: itemsWithStatus,
    selection: selection || {},
  };
}

// Update avatar selection
export async function updateAvatar(env, userId, companyId, category, itemId) {
  const VALID_CATEGORIES = ['base', 'skin', 'hair', 'outfit', 'headwear', 'accessory', 'background'];

  if (!VALID_CATEGORIES.includes(category)) {
    throw new Error('Invalid category');
  }

  // Validate item if provided
  if (itemId) {
    const item = await env.DB.prepare(
      'SELECT * FROM avatar_items WHERE id = ? AND category = ?'
    ).bind(itemId, category).first();

    if (!item) throw new Error('Item not found');

    // Check if unlocked (if has unlock condition)
    if (item.unlock_condition) {
      const unlock = await env.DB.prepare(
        'SELECT * FROM avatar_unlocks WHERE user_id = ? AND item_id = ?'
      ).bind(userId, itemId).first();

      if (!unlock) throw new Error('Item is locked');
    }
  }

  // Check if avatar record exists
  const existing = await env.DB.prepare(
    'SELECT id FROM company_avatars WHERE company_id = ?'
  ).bind(companyId).first();

  const column = `${category}_id`;

  if (existing) {
    await env.DB.prepare(`
      UPDATE company_avatars SET ${column} = ?, updated_at = CURRENT_TIMESTAMP WHERE company_id = ?
    `).bind(itemId, companyId).run();
  } else {
    await env.DB.prepare(`
      INSERT INTO company_avatars (id, company_id, ${column}, updated_at)
      VALUES (?, ?, ?, CURRENT_TIMESTAMP)
    `).bind(crypto.randomUUID(), companyId, itemId).run();
  }

  return { success: true };
}

// Get avatar layers for rendering
export async function getAvatarImage(env, companyId) {
  const selection = await env.DB.prepare(
    'SELECT * FROM company_avatars WHERE company_id = ?'
  ).bind(companyId).first();

  if (!selection) {
    return { layers: [] };
  }

  // Get R2 keys for selected items
  const itemIds = [
    selection.background_id,
    selection.base_id,
    selection.skin_id,
    selection.outfit_id,
    selection.hair_id,
    selection.headwear_id,
    selection.accessory_id,
  ].filter(Boolean);

  if (itemIds.length === 0) {
    return { layers: [] };
  }

  const placeholders = itemIds.map(() => '?').join(',');
  const items = await env.DB.prepare(`
    SELECT id, r2_key, category FROM avatar_items WHERE id IN (${placeholders})
  `).bind(...itemIds).all();

  // Return layers in correct order for compositing
  const categoryOrder = ['background', 'base', 'skin', 'outfit', 'hair', 'headwear', 'accessory'];
  const layers = categoryOrder
    .map(cat => {
      const item = items.results.find(i => i.category === cat);
      if (item) {
        return {
          category: cat,
          url: `${R2_PUBLIC_URL}/${item.r2_key}`,
        };
      }
      return null;
    })
    .filter(Boolean);

  return { layers };
}

// ============================================================
// UNLOCK SYSTEM
// ============================================================

// Check and grant any newly unlocked items for a user
// Called after hero_out action
export async function checkAvatarUnlocks(env, userId) {
  // Get all items with unlock conditions that user hasn't unlocked yet
  const lockedItems = await env.DB.prepare(`
    SELECT ai.* FROM avatar_items ai
    WHERE ai.unlock_condition IS NOT NULL
    AND ai.id NOT IN (
      SELECT item_id FROM avatar_unlocks WHERE user_id = ?
    )
  `).bind(userId).all();

  if (lockedItems.results.length === 0) {
    return { newlyUnlocked: [] };
  }

  // Get user stats for condition evaluation
  const stats = await getUserStats(env, userId);

  const newlyUnlocked = [];

  for (const item of lockedItems.results) {
    const condition = JSON.parse(item.unlock_condition);
    const isMet = evaluateUnlockCondition(condition, stats);

    if (isMet) {
      // Grant the unlock
      await env.DB.prepare(`
        INSERT INTO avatar_unlocks (id, user_id, item_id, unlocked_at)
        VALUES (?, ?, ?, CURRENT_TIMESTAMP)
      `).bind(crypto.randomUUID(), userId, item.id).run();

      newlyUnlocked.push({
        id: item.id,
        name: item.name,
        category: item.category,
        rarity: item.rarity,
        r2_key: item.r2_key,
      });
    }
  }

  return { newlyUnlocked };
}

// Get user stats for unlock condition evaluation
async function getUserStats(env, userId) {
  // Count total hero completions across all user's companies
  const heroCount = await env.DB.prepare(`
    SELECT COUNT(*) as count FROM game_transactions t
    JOIN game_companies c ON t.company_id = c.id
    WHERE c.user_id = ? AND t.action_type = 'hero_out'
  `).bind(userId).first();

  return {
    hero_count: heroCount?.count || 0,
    // Add more stats here as needed for future unlock types:
    // attack_count: ...,
    // total_donated: ...,
    // etc.
  };
}

// Evaluate a single unlock condition against user stats
function evaluateUnlockCondition(condition, stats) {
  switch (condition.type) {
    case 'hero_count':
      return stats.hero_count >= condition.count;

    // Add more condition types here as needed:
    // case 'attack_count':
    //   return stats.attack_count >= condition.count;
    // case 'total_donated':
    //   return stats.total_donated >= condition.amount;

    default:
      // Unknown condition type - don't unlock
      return false;
  }
}
```

---

## useAvatar Hook

```typescript
// src/hooks/useAvatar.ts
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
```

---

## Hero.js Integration

Add unlock check call after hero_out:

```javascript
// worker/src/routes/game/hero.js

// Add import at top of file
import { checkAvatarUnlocks } from './avatar.js';

// Modify the heroOut function to call unlock check at the end:
// After the await env.DB.batch(statements); line, add:

  // Check for avatar unlocks after hero out
  // Note: Use company.user_id since heroOut receives company, not user
  const { newlyUnlocked } = await checkAvatarUnlocks(env, company.user_id);

  return {
    success: true,
    path: status.qualifiedPath,
    buildings_sold: buildings.length,
    building_value: totalBuildingValue,
    building_sell_value: buildingSellValue,
    cash_added: company.cash,
    total_to_offshore: totalToOffshore,
    new_offshore: company.offshore + totalToOffshore,
    unlocks: status.unlocks,
    // Include newly unlocked avatar items
    unlocked_items: newlyUnlocked,
  };
}
```

---

## Route Registration

```javascript
// worker/index.js - Add to imports
import {
  getAvatarItems,
  updateAvatar,
  getAvatarImage,
} from './src/routes/game/avatar.js';

// Add to switch statement:

        // ==================== AVATAR ENDPOINTS ====================
        case path === '/api/game/avatar/items' && method === 'GET': {
          const authHeader = request.headers.get('Authorization');
          const token = authHeader.split(' ')[1];
          const { user } = await authService.getUserFromToken(token);
          const url = new URL(request.url);
          const companyId = url.searchParams.get('company_id');
          if (!companyId) throw new Error('company_id is required');

          const result = await getAvatarItems(env, user.id, companyId);
          return new Response(JSON.stringify({ success: true, data: result }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        case path === '/api/game/avatar/update' && method === 'POST': {
          const authHeader = request.headers.get('Authorization');
          const token = authHeader.split(' ')[1];
          const { user } = await authService.getUserFromToken(token);
          const { company_id, category, item_id } = await request.json();
          if (!company_id) throw new Error('company_id is required');

          // Verify company belongs to user
          const company = await env.DB.prepare(
            'SELECT id FROM game_companies WHERE id = ? AND user_id = ?'
          ).bind(company_id, user.id).first();
          if (!company) throw new Error('Company not found');

          const result = await updateAvatar(env, user.id, company_id, category, item_id);
          return new Response(JSON.stringify({ success: true, data: result }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        case path === '/api/game/avatar/image' && method === 'GET': {
          const url = new URL(request.url);
          const companyId = url.searchParams.get('company_id');
          if (!companyId) throw new Error('company_id is required');

          const result = await getAvatarImage(env, companyId);
          return new Response(JSON.stringify({ success: true, data: result }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
```

---

## Unlock Notification Component

```tsx
// components/avatar/UnlockNotification.tsx
import { useEffect, useState } from 'react';
import { X, Gift } from 'lucide-react';

interface UnlockedItem {
  id: string;
  name: string;
  category: string;
  rarity: string;
  r2_key: string;
}

interface UnlockNotificationProps {
  items: UnlockedItem[];
  onDismiss: () => void;
}

const RARITY_COLORS = {
  common: '#9ca3af',
  uncommon: '#22c55e',
  rare: '#3b82f6',
  epic: '#a855f7',
  legendary: '#f59e0b',
};

// R2 public URL for avatar assets
const R2_PUBLIC_URL = 'https://pub-874867b18f8b4b4882277d8a2b7dfe80.r2.dev';

export function UnlockNotification({ items, onDismiss }: UnlockNotificationProps) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setVisible(false);
      setTimeout(onDismiss, 500); // Wait for fade out
    }, 5000);

    return () => clearTimeout(timer);
  }, [onDismiss]);

  if (items.length === 0) return null;

  return (
    <div
      className={`fixed top-4 right-4 z-50 transition-opacity duration-500 ${
        visible ? 'opacity-100' : 'opacity-0'
      }`}
    >
      <div className="bg-gray-800 border-2 border-yellow-500 rounded-lg p-4 shadow-2xl max-w-sm">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-2 text-yellow-400">
            <Gift className="w-5 h-5" />
            <span className="font-bold">New Item Unlocked!</span>
          </div>
          <button
            onClick={() => {
              setVisible(false);
              setTimeout(onDismiss, 500);
            }}
            className="text-gray-500 hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {items.map((item) => (
          <div key={item.id} className="flex items-center gap-3 p-2 bg-gray-700/50 rounded">
            <div className="w-12 h-12 bg-gray-600 rounded overflow-hidden">
              <img
                src={`${R2_PUBLIC_URL}/${item.r2_key}`}
                alt={item.name}
                className="w-full h-full object-contain"
              />
            </div>
            <div>
              <p className="text-white font-bold">{item.name}</p>
              <p
                className="text-sm capitalize"
                style={{ color: RARITY_COLORS[item.rarity as keyof typeof RARITY_COLORS] }}
              >
                {item.rarity} {item.category}
              </p>
            </div>
          </div>
        ))}

        <p className="text-gray-400 text-xs mt-3 text-center">
          Visit Avatar to equip your new item!
        </p>
      </div>
    </div>
  );
}
```

---

## Avatar Customization Page

```tsx
// pages/Avatar.tsx
import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { ArrowLeft, Lock } from 'lucide-react';
import { useActiveCompany } from '../contexts/CompanyContext';
import { useAvatarItems, useUpdateAvatar } from '../hooks/useAvatar';
import { AvatarPreview } from '../components/avatar/AvatarPreview';

const AVATAR_CATEGORIES = [
  { id: 'base', name: 'Base', required: true },
  { id: 'skin', name: 'Skin Tone', required: true },
  { id: 'hair', name: 'Hair', required: false },
  { id: 'outfit', name: 'Outfit', required: true },
  { id: 'headwear', name: 'Headwear', required: false },
  { id: 'accessory', name: 'Accessory', required: false },
  { id: 'background', name: 'Background', required: false },
];

const RARITY_COLORS = {
  common: '#9ca3af',
  uncommon: '#22c55e',
  rare: '#3b82f6',
  epic: '#a855f7',
  legendary: '#f59e0b',
};

// R2 public URL for avatar assets
const R2_PUBLIC_URL = 'https://pub-874867b18f8b4b4882277d8a2b7dfe80.r2.dev';

export function Avatar() {
  const { activeCompany } = useActiveCompany();
  const navigate = useNavigate();
  const { data, isLoading, refetch } = useAvatarItems(activeCompany?.id);
  const { mutate: updateAvatar, isPending } = useUpdateAvatar();
  const [selectedCategory, setSelectedCategory] = useState('base');

  if (!activeCompany) {
    return <Navigate to="/companies" replace />;
  }

  if (isLoading || !data) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-900">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  const categoryItems = data.items.filter((i: any) => i.category === selectedCategory);
  const currentCategory = AVATAR_CATEGORIES.find((c) => c.id === selectedCategory);

  const handleSelectItem = async (itemId: string | null) => {
    updateAvatar(
      { companyId: activeCompany.id, category: selectedCategory, itemId },
      { onSuccess: () => refetch() }
    );
  };

  const formatUnlockRequirement = (req: any) => {
    if (!req) return '';
    if (req.type === 'hero_count') {
      return `Hero ${req.count.toLocaleString()} times to unlock`;
    }
    return 'Complete special requirements to unlock';
  };

  return (
    <div className="min-h-screen bg-gray-900 p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <button
            onClick={() => navigate(`/companies/${activeCompany.id}`)}
            className="flex items-center gap-2 text-neutral-400 hover:text-white mb-4"
          >
            <ArrowLeft className="w-5 h-5" />
            Back to {activeCompany.name}
          </button>
          <h1 className="text-2xl font-bold text-white">Avatar Customization</h1>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Preview */}
          <div className="lg:col-span-1">
            <div className="bg-gray-800 rounded-lg p-4 sticky top-4">
              <AvatarPreview companyId={activeCompany.id} size={250} />
              <p className="text-center text-gray-400 mt-4">{activeCompany.name}</p>
            </div>
          </div>

          {/* Customization */}
          <div className="lg:col-span-2">
            {/* Category tabs */}
            <div className="flex gap-2 mb-6 flex-wrap">
              {AVATAR_CATEGORIES.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`px-4 py-2 rounded transition-colors ${
                    selectedCategory === cat.id
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                  }`}
                >
                  {cat.name}
                </button>
              ))}
            </div>

            {/* Items grid */}
            <div className="grid grid-cols-4 gap-4">
              {/* None option for optional categories */}
              {!currentCategory?.required && (
                <div
                  onClick={() => handleSelectItem(null)}
                  className={`aspect-square bg-gray-800 rounded-lg flex items-center justify-center cursor-pointer hover:bg-gray-700 border-2 transition-colors ${
                    !data.selection[`${selectedCategory}_id`]
                      ? 'border-blue-500'
                      : 'border-transparent'
                  }`}
                >
                  <span className="text-gray-500">None</span>
                </div>
              )}

              {categoryItems.map((item: any) => (
                <div
                  key={item.id}
                  onClick={() => item.isUnlocked && !isPending && handleSelectItem(item.id)}
                  className={`aspect-square bg-gray-800 rounded-lg overflow-hidden cursor-pointer relative border-2 transition-all ${
                    data.selection[`${selectedCategory}_id`] === item.id
                      ? 'border-blue-500'
                      : 'border-transparent'
                  } ${
                    !item.isUnlocked
                      ? 'opacity-60 cursor-not-allowed'
                      : 'hover:bg-gray-700'
                  }`}
                  title={item.isUnlocked ? item.name : formatUnlockRequirement(item.unlockRequirement)}
                >
                  <img
                    src={`${R2_PUBLIC_URL}/${item.r2_key}`}
                    alt={item.name}
                    className="w-full h-full object-contain"
                  />

                  {/* Rarity indicator */}
                  <div
                    className="absolute top-1 right-1 w-3 h-3 rounded-full border border-white/30"
                    style={{ backgroundColor: RARITY_COLORS[item.rarity as keyof typeof RARITY_COLORS] }}
                  />

                  {/* Lock overlay */}
                  {!item.isUnlocked && (
                    <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center p-2">
                      <Lock className="w-6 h-6 text-gray-400 mb-1" />
                      <p className="text-xs text-gray-400 text-center">
                        {item.unlockRequirement?.type === 'hero_count'
                          ? `Hero ${item.unlockRequirement.count.toLocaleString()}x`
                          : 'Locked'}
                      </p>
                    </div>
                  )}

                  {/* Name tooltip */}
                  <div className="absolute bottom-0 left-0 right-0 bg-black/70 p-1 text-xs text-center text-white truncate">
                    {item.name}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Avatar;
```

---

## Avatar Preview Component

```tsx
// components/avatar/AvatarPreview.tsx
import { useAvatarImage } from '../../hooks/useAvatar';

interface AvatarPreviewProps {
  companyId: string;
  size?: number;
}

export function AvatarPreview({ companyId, size = 200 }: AvatarPreviewProps) {
  const { data: avatar, isLoading } = useAvatarImage(companyId);

  if (isLoading) {
    return (
      <div
        className="bg-gray-700 rounded-lg flex items-center justify-center animate-pulse"
        style={{ width: size, height: size }}
      />
    );
  }

  if (!avatar?.layers || avatar.layers.length === 0) {
    return (
      <div
        className="bg-gray-700 rounded-lg flex items-center justify-center mx-auto"
        style={{ width: size, height: size }}
      >
        <span className="text-4xl">👤</span>
      </div>
    );
  }

  return (
    <div
      className="relative bg-gray-700 rounded-lg overflow-hidden mx-auto"
      style={{ width: size, height: size }}
    >
      {avatar.layers.map((layer: any, i: number) => (
        <img
          key={layer.category}
          src={layer.url}
          alt={layer.category}
          className="absolute inset-0 w-full h-full object-contain"
          style={{ zIndex: i }}
        />
      ))}
    </div>
  );
}

// Smaller version for lists/thumbnails
export function AvatarThumbnail({ companyId }: { companyId: string }) {
  return <AvatarPreview companyId={companyId} size={40} />;
}
```

---

## Test Cases

| Test | Input | Expected Output |
|------|-------|-----------------|
| Get items | User with no unlocks | All common items unlocked, legendary locked |
| Get items | User with unlock | Item shows as unlocked |
| Select unlocked | Click unlocked item | Avatar updated |
| Select locked | Click locked item | Error: Item is locked |
| Clear optional | Headwear = null | Headwear removed |
| Hero unlock check | User with 9999 heroes | No unlock (need 10000) |
| Hero unlock check | User with 10000 heroes | Crown unlocked |
| Get avatar image | Company with selections | Layer URLs returned |
| Unlock notification | New item unlocked | Popup shows item |

---

## Acceptance Checklist

- [ ] All category tabs work
- [ ] Items display in grid
- [ ] Can select/deselect items
- [ ] Locked items show lock icon with requirement text
- [ ] Rarity colors displayed
- [ ] Preview updates immediately
- [ ] Avatar layers composite correctly
- [ ] Optional items can be cleared (None option)
- [ ] Required items cannot be cleared
- [ ] Unlock checker runs after hero_out
- [ ] Newly unlocked items returned in hero response
- [ ] Unlock notification displays for new items
- [ ] Unlocks are per-user (shared across companies)

---

## Deployment

```bash
cd /Users/riki/notropolis/authentication-dashboard-system

# 1. Run migration
CLOUDFLARE_API_TOKEN="..." npx wrangler d1 execute notropolis-database --file=migrations/0022_create_avatar_tables.sql --remote

# 2. Deploy worker
cd worker && CLOUDFLARE_API_TOKEN="..." npx wrangler deploy && cd ..

# 3. Upload avatar assets to R2
# (Manual upload or via admin tool)

# 4. Build and deploy frontend
npm run build
CLOUDFLARE_API_TOKEN="..." CLOUDFLARE_ACCOUNT_ID="..." npx wrangler pages deploy ./dist --project-name=notropolis-dashboard
```

---

---

## Avatar Composite Caching

When a user saves their avatar customization, we cache a pre-rendered composite for use in scene compositing (arrest scenes, prison scenes, etc.).

### Composite Generation Flow

```
┌─────────────────────────────────────────────────────────────┐
│                   User Saves Avatar                          │
│                          ↓                                   │
│              updateAvatar() completes                        │
│                          ↓                                   │
│         Client composites layers using Canvas                │
│                          ↓                                   │
│    Client uploads composite via POST /avatar/composite/:id   │
│                          ↓                                   │
│         Server stores in R2, records hash                    │
│                          ↓                                   │
│      Any cached scene compositions are invalidated           │
└─────────────────────────────────────────────────────────────┘
```

### Frontend Integration

Add to the Avatar page to cache composite after save:

```typescript
// In Avatar.tsx - after successful avatar update
const handleSaveAndCacheComposite = async () => {
    // 1. Get current layers
    const avatarData = await api.get(`/api/game/avatar/image?company_id=${companyId}`);
    const layers = avatarData.data.data.layers;

    if (layers.length === 0) return;

    // 2. Composite layers client-side
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d')!;

    for (const layer of layers) {
        const img = await loadImage(layer.url);
        ctx.drawImage(img, 0, 0, 512, 512);
    }

    // 3. Upload composite
    const imageData = canvas.toDataURL('image/png');
    await api.post(`/api/admin/assets/avatar/composite/${companyId}`, {
        context: 'main',
        imageData
    });
};

// Call after avatar update success
updateAvatar(
    { companyId: activeCompany.id, category: selectedCategory, itemId },
    {
        onSuccess: async () => {
            await refetch();
            // Cache the new composite
            await handleSaveAndCacheComposite();
        }
    }
);
```

### API Endpoint

See [17-asset-pipeline/01-infrastructure.md](17-asset-pipeline/01-infrastructure.md) for the composite API routes:
- `POST /api/admin/assets/avatar/composite/:companyId` - Upload composite
- `GET /api/admin/assets/avatar/composite/:companyId` - Get cached URL or layer info

---

## Handoff Notes

- Avatar images are composited client-side (layered images)
- R2 bucket stores individual layer images at `avatars/{category}/{name}.png`
- **Unlocks are USER-level**, not company-level (earned items shared across all companies)
- Current unlock conditions are **intentionally unreachable** (10,000 and 500,000 hero completions)
- To add reachable unlocks later, just update the `unlock_condition` values in the database
- Future unlock types can be added by extending `evaluateUnlockCondition()` in avatar.js
- Asset format: PNG with transparency, consistent size per category
- **Avatar composites** are cached when user saves for use in scene compositing
- Scene compositing API at `/api/admin/assets/scenes/compose/:sceneId/:companyId`
