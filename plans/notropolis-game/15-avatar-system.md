# Stage 15: Avatar System

## Objective

Implement avatar customization with preloaded outfits, headwear, and accessories.

## Dependencies

`[Requires: Stage 03 complete]` - Needs companies for avatar assignment.
`[Requires: R2 bucket]` - For avatar asset storage.

## Complexity

**Medium** - Asset management and customization UI.

## Files to Create

| File | Purpose |
|------|---------|
| `authentication-dashboard-system/src/pages/Avatar.tsx` | Avatar customization page |
| `authentication-dashboard-system/src/components/avatar/AvatarPreview.tsx` | Avatar preview component |
| `authentication-dashboard-system/src/components/avatar/CategoryPicker.tsx` | Category selection |
| `authentication-dashboard-system/src/components/avatar/ItemGrid.tsx` | Item selection grid |
| `authentication-dashboard-system/src/worker/routes/game/avatar.ts` | Avatar API |
| `authentication-dashboard-system/migrations/0019_create_avatar_tables.sql` | Avatar tables |

## Implementation Details

### Database Migration

```sql
-- 0019_create_avatar_tables.sql

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
  -- NULL = always available, or JSON with conditions
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

-- Unlocked items per company
CREATE TABLE avatar_unlocks (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL,
  item_id TEXT NOT NULL,
  unlocked_at TEXT DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (company_id) REFERENCES game_companies(id),
  FOREIGN KEY (item_id) REFERENCES avatar_items(id),
  UNIQUE(company_id, item_id)
);
```

### Avatar Categories

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
```

### Avatar API

```typescript
// worker/routes/game/avatar.ts
export async function getAvatarItems(env: Env, companyId: string) {
  // Get all items
  const items = await env.DB.prepare(
    'SELECT * FROM avatar_items ORDER BY category, sort_order'
  ).all();

  // Get unlocked items for this company
  const unlocks = await env.DB.prepare(
    'SELECT item_id FROM avatar_unlocks WHERE company_id = ?'
  ).bind(companyId).all();

  const unlockedIds = new Set(unlocks.results.map(u => u.item_id));

  // Get current selection
  const selection = await env.DB.prepare(
    'SELECT * FROM company_avatars WHERE company_id = ?'
  ).bind(companyId).first();

  // Mark items as available/locked
  const itemsWithStatus = items.results.map(item => ({
    ...item,
    isUnlocked: item.unlock_condition === null || unlockedIds.has(item.id),
    isSelected: selection && Object.values(selection).includes(item.id),
  }));

  return {
    items: itemsWithStatus,
    selection: selection || {},
  };
}

export async function updateAvatar(request: Request, env: Env, company: GameCompany) {
  const { category, item_id } = await request.json();

  // Validate category
  const validCategory = AVATAR_CATEGORIES.find(c => c.id === category);
  if (!validCategory) throw new Error('Invalid category');

  // Validate item
  if (item_id) {
    const item = await env.DB.prepare(
      'SELECT * FROM avatar_items WHERE id = ? AND category = ?'
    ).bind(item_id, category).first();

    if (!item) throw new Error('Item not found');

    // Check if unlocked
    if (item.unlock_condition) {
      const unlock = await env.DB.prepare(
        'SELECT * FROM avatar_unlocks WHERE company_id = ? AND item_id = ?'
      ).bind(company.id, item_id).first();

      if (!unlock) throw new Error('Item is locked');
    }
  }

  // Check if avatar record exists
  const existing = await env.DB.prepare(
    'SELECT id FROM company_avatars WHERE company_id = ?'
  ).bind(company.id).first();

  const column = `${category}_id`;

  if (existing) {
    await env.DB.prepare(`
      UPDATE company_avatars SET ${column} = ?, updated_at = ? WHERE company_id = ?
    `).bind(item_id, new Date().toISOString(), company.id).run();
  } else {
    await env.DB.prepare(`
      INSERT INTO company_avatars (id, company_id, ${column}, updated_at)
      VALUES (?, ?, ?, ?)
    `).bind(crypto.randomUUID(), company.id, item_id, new Date().toISOString()).run();
  }

  return { success: true };
}

export async function getAvatarImage(env: Env, companyId: string) {
  const selection = await env.DB.prepare(
    'SELECT * FROM company_avatars WHERE company_id = ?'
  ).bind(companyId).first();

  if (!selection) {
    return { url: '/default-avatar.png' };
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

  const items = await env.DB.prepare(`
    SELECT id, r2_key, category FROM avatar_items WHERE id IN (${itemIds.map(() => '?').join(',')})
  `).bind(...itemIds).all();

  // Return layers for client-side compositing
  const layers = AVATAR_CATEGORIES.map(cat => {
    const item = items.results.find(i => i.category === cat.id);
    if (item) {
      return {
        category: cat.id,
        url: `https://r2.notropolis.net/${item.r2_key}`,
      };
    }
    return null;
  }).filter(Boolean);

  return { layers };
}
```

### Avatar Customization Page

```tsx
// pages/Avatar.tsx
export function Avatar() {
  const { activeCompany } = useCompany();
  const { data, refetch } = useAvatarItems(activeCompany?.id);
  const [selectedCategory, setSelectedCategory] = useState<AvatarCategory>('base');

  const handleSelectItem = async (itemId: string | null) => {
    await api.avatar.update(selectedCategory, itemId);
    refetch();
  };

  if (!data) return <LoadingSpinner />;

  const categoryItems = data.items.filter(i => i.category === selectedCategory);

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-white mb-6">Avatar Customization</h1>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Preview */}
        <div className="lg:col-span-1">
          <div className="bg-gray-800 rounded-lg p-4 sticky top-4">
            <AvatarPreview companyId={activeCompany?.id} />
            <p className="text-center text-gray-400 mt-4">{activeCompany?.name}</p>
          </div>
        </div>

        {/* Customization */}
        <div className="lg:col-span-2">
          {/* Category tabs */}
          <div className="flex gap-2 mb-6 flex-wrap">
            {AVATAR_CATEGORIES.map(cat => (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={`px-4 py-2 rounded ${
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
            {!AVATAR_CATEGORIES.find(c => c.id === selectedCategory)?.required && (
              <div
                onClick={() => handleSelectItem(null)}
                className={`aspect-square bg-gray-800 rounded-lg flex items-center justify-center cursor-pointer hover:bg-gray-700 ${
                  !data.selection[`${selectedCategory}_id`] ? 'ring-2 ring-blue-500' : ''
                }`}
              >
                <span className="text-gray-500">None</span>
              </div>
            )}

            {categoryItems.map(item => (
              <div
                key={item.id}
                onClick={() => item.isUnlocked && handleSelectItem(item.id)}
                className={`aspect-square bg-gray-800 rounded-lg overflow-hidden cursor-pointer relative ${
                  data.selection[`${selectedCategory}_id`] === item.id ? 'ring-2 ring-blue-500' : ''
                } ${!item.isUnlocked ? 'opacity-50 cursor-not-allowed' : 'hover:bg-gray-700'}`}
              >
                <img
                  src={`https://r2.notropolis.net/${item.r2_key}`}
                  alt={item.name}
                  className="w-full h-full object-contain"
                />

                {/* Rarity indicator */}
                <div
                  className="absolute top-1 right-1 w-3 h-3 rounded-full"
                  style={{ backgroundColor: RARITY_COLORS[item.rarity] }}
                />

                {/* Lock overlay */}
                {!item.isUnlocked && (
                  <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                    <span className="text-2xl">🔒</span>
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
  );
}
```

### Avatar Preview Component

```tsx
// components/avatar/AvatarPreview.tsx
export function AvatarPreview({ companyId, size = 200 }) {
  const { data: avatar } = useAvatarImage(companyId);

  if (!avatar?.layers) {
    return (
      <div
        className="bg-gray-700 rounded-lg flex items-center justify-center"
        style={{ width: size, height: size }}
      >
        <span className="text-4xl">👤</span>
      </div>
    );
  }

  return (
    <div
      className="relative bg-gray-700 rounded-lg overflow-hidden"
      style={{ width: size, height: size }}
    >
      {avatar.layers.map((layer, i) => (
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

// Smaller version for lists
export function AvatarThumbnail({ companyId }) {
  return <AvatarPreview companyId={companyId} size={40} />;
}
```

### Seed Avatar Items

```sql
-- Example seed data for avatar items
INSERT INTO avatar_items (id, category, name, r2_key, rarity, sort_order) VALUES
-- Base bodies
('base_1', 'base', 'Standard', 'avatars/base/standard.png', 'common', 1),
('base_2', 'base', 'Athletic', 'avatars/base/athletic.png', 'common', 2),

-- Skin tones
('skin_1', 'skin', 'Light', 'avatars/skin/light.png', 'common', 1),
('skin_2', 'skin', 'Medium', 'avatars/skin/medium.png', 'common', 2),
('skin_3', 'skin', 'Dark', 'avatars/skin/dark.png', 'common', 3),

-- Hair
('hair_1', 'hair', 'Short', 'avatars/hair/short.png', 'common', 1),
('hair_2', 'hair', 'Long', 'avatars/hair/long.png', 'common', 2),
('hair_3', 'hair', 'Mohawk', 'avatars/hair/mohawk.png', 'uncommon', 3),

-- Outfits
('outfit_1', 'outfit', 'Business Suit', 'avatars/outfit/suit.png', 'common', 1),
('outfit_2', 'outfit', 'Casual', 'avatars/outfit/casual.png', 'common', 2),
('outfit_3', 'outfit', 'Gold Suit', 'avatars/outfit/gold_suit.png', 'legendary', 3),

-- Headwear
('head_1', 'headwear', 'Top Hat', 'avatars/headwear/tophat.png', 'uncommon', 1),
('head_2', 'headwear', 'Crown', 'avatars/headwear/crown.png', 'legendary', 2),

-- Accessories
('acc_1', 'accessory', 'Sunglasses', 'avatars/accessory/sunglasses.png', 'common', 1),
('acc_2', 'accessory', 'Monocle', 'avatars/accessory/monocle.png', 'rare', 2),

-- Backgrounds
('bg_1', 'background', 'City Skyline', 'avatars/background/city.png', 'common', 1),
('bg_2', 'background', 'Money Pile', 'avatars/background/money.png', 'epic', 2);
```

## Database Changes

- New `avatar_items` table (catalog)
- New `company_avatars` table (selections)
- New `avatar_unlocks` table (unlocked items)

## Test Cases

| Test | Input | Expected Output |
|------|-------|-----------------|
| Get items | Company ID | Items with unlock status |
| Select base | Valid base item | Avatar updated |
| Select locked | Locked item | Error |
| Clear optional | Headwear = null | Headwear removed |
| Get avatar image | Company with selections | Layer URLs returned |

## Acceptance Checklist

- [ ] All category tabs work
- [ ] Items display in grid
- [ ] Can select/deselect items
- [ ] Locked items show lock icon
- [ ] Rarity colors displayed
- [ ] Preview updates immediately
- [ ] Avatar layers composite correctly
- [ ] Optional items can be cleared
- [ ] Required items cannot be cleared

## Deployment

```bash
CLOUDFLARE_API_TOKEN="..." npx wrangler d1 execute notropolis-database --file=migrations/0019_create_avatar_tables.sql --remote

# Upload avatar assets to R2
# (This would be done via admin tool or manually)

npm run build
CLOUDFLARE_API_TOKEN="..." CLOUDFLARE_ACCOUNT_ID="..." npx wrangler pages deploy ./dist --project-name=notropolis-dashboard
```

## Handoff Notes

- Avatar images are composited client-side (layered images)
- R2 bucket stores individual layer images
- Unlock system prepared but conditions TBD
- Consider adding hero rewards that unlock items [See: Stage 17]
- Consider adding purchasable items in future
- Asset format: PNG with transparency
