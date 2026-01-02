# Stage 10: Asset Manager (Enhanced Building Manager)

## Objective

Expand the Building Manager into a full Asset Manager that handles all asset types, adds price/profitability editing for buildings, and provides configuration management for NPCs, effects, terrain, and other asset categories.

## Dependencies

- **Requires:** [See: Stage 01-09] - All previous stages complete
- **Requires:** Approved assets exist for each category

## Complexity

**Medium** - Extend existing BuildingManager component and backend, add editing forms.

---

## Files to Modify

| File | Changes |
|------|---------|
| `src/components/assets/BuildingManager.tsx` | Rename to AssetManager, add price editing, expand to other types |
| `src/pages/AssetAdminPage.tsx` | Update tab name and references |
| `worker/src/routes/admin/assets.js` | Add endpoints for other asset type configurations |
| `src/services/assetApi.ts` | Add API methods for asset configuration |

## Files to Create

| File | Purpose |
|------|---------|
| `migrations/0028_create_asset_configurations.sql` | Generic asset config table for non-building types |

---

## Implementation Details

### Database: Generic Asset Configuration Table

```sql
-- 0028_create_asset_configurations.sql
-- Generic configuration for non-building asset types

CREATE TABLE IF NOT EXISTS asset_configurations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    category TEXT NOT NULL,              -- 'npc', 'effect', 'terrain', etc.
    asset_key TEXT NOT NULL,             -- e.g., 'pedestrian_male', 'fire', 'grass'

    -- Active sprite
    active_sprite_id INTEGER REFERENCES generated_assets(id),

    -- Generic config (JSON for flexibility)
    config TEXT,                         -- JSON with category-specific settings

    -- Publication status
    is_published BOOLEAN DEFAULT FALSE,
    published_at DATETIME,
    published_by TEXT,

    -- Timestamps
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,

    UNIQUE(category, asset_key)
);

CREATE INDEX idx_asset_config_category ON asset_configurations(category);
CREATE INDEX idx_asset_config_published ON asset_configurations(is_published);
```

### Building Manager Price Editing UI

Add inline editing for cost and profit:

```tsx
// In BuildingManager.tsx (to become AssetManager.tsx)

// Add editing state
const [editingBuilding, setEditingBuilding] = useState<string | null>(null);
const [editValues, setEditValues] = useState<{
    cost_override: number | null;
    base_profit_override: number | null;
}>({ cost_override: null, base_profit_override: null });

// Edit form component
function BuildingEditForm({ building, onSave, onCancel }: {
    building: BuildingConfig;
    onSave: (values: { cost_override: number | null; base_profit_override: number | null }) => void;
    onCancel: () => void;
}) {
    const [cost, setCost] = useState<string>(
        building.cost_override?.toString() || building.default_cost?.toString() || ''
    );
    const [profit, setProfit] = useState<string>(
        building.base_profit_override?.toString() || building.default_profit?.toString() || ''
    );
    const [useDefaultCost, setUseDefaultCost] = useState(!building.cost_override);
    const [useDefaultProfit, setUseDefaultProfit] = useState(!building.base_profit_override);

    const handleSave = () => {
        onSave({
            cost_override: useDefaultCost ? null : parseInt(cost) || null,
            base_profit_override: useDefaultProfit ? null : parseInt(profit) || null,
        });
    };

    return (
        <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
            <h4 className="font-medium mb-3">Edit Building Configuration</h4>

            <div className="grid grid-cols-2 gap-4">
                {/* Cost */}
                <div>
                    <label className="block text-sm font-medium mb-1">Cost</label>
                    <div className="flex items-center gap-2">
                        <input
                            type="checkbox"
                            checked={useDefaultCost}
                            onChange={(e) => setUseDefaultCost(e.target.checked)}
                        />
                        <span className="text-sm">Use default (${building.default_cost?.toLocaleString()})</span>
                    </div>
                    {!useDefaultCost && (
                        <input
                            type="number"
                            value={cost}
                            onChange={(e) => setCost(e.target.value)}
                            className="mt-2 w-full border rounded px-3 py-2"
                            placeholder="Override cost"
                        />
                    )}
                </div>

                {/* Profit */}
                <div>
                    <label className="block text-sm font-medium mb-1">Base Profit</label>
                    <div className="flex items-center gap-2">
                        <input
                            type="checkbox"
                            checked={useDefaultProfit}
                            onChange={(e) => setUseDefaultProfit(e.target.checked)}
                        />
                        <span className="text-sm">Use default (${building.default_profit?.toLocaleString()})</span>
                    </div>
                    {!useDefaultProfit && (
                        <input
                            type="number"
                            value={profit}
                            onChange={(e) => setProfit(e.target.value)}
                            className="mt-2 w-full border rounded px-3 py-2"
                            placeholder="Override profit"
                        />
                    )}
                </div>
            </div>

            <div className="flex gap-2 mt-4">
                <button
                    onClick={handleSave}
                    className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                >
                    Save
                </button>
                <button
                    onClick={onCancel}
                    className="px-4 py-2 text-gray-600 hover:text-gray-800"
                >
                    Cancel
                </button>
            </div>
        </div>
    );
}
```

### Asset Manager with Tabs for All Types

```tsx
// Rename BuildingManager.tsx to AssetManager.tsx

export function AssetManager() {
    const [activeTab, setActiveTab] = useState<'buildings' | 'npcs' | 'effects' | 'terrain' | 'base_ground'>('buildings');

    return (
        <div className="bg-white dark:bg-gray-800 shadow-sm rounded-lg">
            {/* Header */}
            <div className="border-b px-6 py-4">
                <h2 className="text-xl font-bold">Asset Manager</h2>
                <p className="text-sm text-gray-600">
                    Configure which assets are live in the game
                </p>
            </div>

            {/* Tabs */}
            <div className="flex border-b px-6">
                <button
                    onClick={() => setActiveTab('buildings')}
                    className={`py-3 px-4 ${activeTab === 'buildings' ? 'border-b-2 border-blue-500' : ''}`}
                >
                    Buildings
                </button>
                <button
                    onClick={() => setActiveTab('npcs')}
                    className={`py-3 px-4 ${activeTab === 'npcs' ? 'border-b-2 border-blue-500' : ''}`}
                >
                    NPCs
                </button>
                <button
                    onClick={() => setActiveTab('effects')}
                    className={`py-3 px-4 ${activeTab === 'effects' ? 'border-b-2 border-blue-500' : ''}`}
                >
                    Effects
                </button>
                <button
                    onClick={() => setActiveTab('terrain')}
                    className={`py-3 px-4 ${activeTab === 'terrain' ? 'border-b-2 border-blue-500' : ''}`}
                >
                    Terrain
                </button>
                <button
                    onClick={() => setActiveTab('base_ground')}
                    className={`py-3 px-4 ${activeTab === 'base_ground' ? 'border-b-2 border-blue-500' : ''}`}
                >
                    Base Ground
                </button>
            </div>

            {/* Content */}
            <div className="p-6">
                {activeTab === 'buildings' && <BuildingsList />}
                {activeTab === 'npcs' && <NPCsList />}
                {activeTab === 'effects' && <EffectsList />}
                {activeTab === 'terrain' && <TerrainList />}
                {activeTab === 'base_ground' && <BaseGroundList />}
            </div>
        </div>
    );
}
```

### Base Ground List Component

The base ground is a special terrain type that appears BEHIND all other terrain tiles. It creates the "world floor" that roads, dirt tracks, and properties sit on top of.

```tsx
// BaseGroundList.tsx
function BaseGroundList() {
    const { showToast } = useToast();
    const [grounds, setGrounds] = useState<AssetConfig[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeGround, setActiveGround] = useState<string | null>(null);

    useEffect(() => {
        loadGrounds();
    }, []);

    const loadGrounds = async () => {
        setLoading(true);
        try {
            const data = await assetApi.getAssetConfigurations('base_ground');
            setGrounds(data);
            // Find the active one
            const active = data.find(g => g.is_active);
            setActiveGround(active?.asset_key || null);
        } catch (err) {
            showToast(err instanceof Error ? err.message : 'Failed to load base grounds', 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleSetActive = async (assetKey: string) => {
        try {
            await assetApi.setActiveBaseGround(assetKey);
            showToast('Base ground updated', 'success');
            setActiveGround(assetKey);
            await loadGrounds();
        } catch (err) {
            showToast(err instanceof Error ? err.message : 'Failed to update', 'error');
        }
    };

    if (loading) {
        return <Loader2 className="w-6 h-6 animate-spin" />;
    }

    return (
        <div className="space-y-4">
            <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg mb-4">
                <h4 className="font-medium text-blue-800 dark:text-blue-200">About Base Ground</h4>
                <p className="text-sm text-blue-600 dark:text-blue-300 mt-1">
                    The base ground is a seamless tiling texture that appears BEHIND all terrain tiles.
                    Roads, dirt tracks, and properties are rendered ON TOP of this layer.
                    Only ONE base ground can be active at a time.
                </p>
            </div>

            <div className="grid grid-cols-3 gap-4">
                {grounds.map((ground) => (
                    <div
                        key={ground.asset_key}
                        className={clsx(
                            'border rounded-lg p-4 cursor-pointer transition-colors',
                            activeGround === ground.asset_key
                                ? 'border-green-500 bg-green-50 dark:bg-green-900/20'
                                : 'border-gray-200 dark:border-gray-700 hover:border-gray-400'
                        )}
                        onClick={() => handleSetActive(ground.asset_key)}
                    >
                        <div className="w-full aspect-[2/1] bg-gray-100 dark:bg-gray-800 rounded mb-2">
                            {ground.sprite_url ? (
                                <img
                                    src={ground.sprite_url}
                                    alt={ground.asset_key}
                                    className="w-full h-full object-contain"
                                />
                            ) : (
                                <span className="text-gray-400 text-2xl flex items-center justify-center h-full">?</span>
                            )}
                        </div>
                        <div className="text-center">
                            <span className="font-medium capitalize">
                                {ground.asset_key.replace(/_/g, ' ')}
                            </span>
                            {activeGround === ground.asset_key && (
                                <span className="ml-2 px-2 py-0.5 bg-green-500 text-white text-xs rounded">
                                    ACTIVE
                                </span>
                            )}
                        </div>
                    </div>
                ))}
            </div>

            {grounds.length === 0 && (
                <div className="text-center py-12 text-gray-500">
                    No base ground textures available.
                    <br />
                    Generate one in the asset generation panel.
                </div>
            )}
        </div>
    );
}
```

### Backend: Base Ground Specific Endpoint

```javascript
// Add to assets.js

// PUT /api/admin/assets/base-ground/active
// Set the active base ground for the game
router.put('/base-ground/active', async (c) => {
    const env = c.env;
    const user = c.get('user');
    const { asset_key } = await c.req.json();

    // Clear all active flags for base_ground
    await env.DB.prepare(`
        UPDATE asset_configurations
        SET is_active = FALSE
        WHERE category = 'base_ground'
    `).run();

    // Set the new active one
    await env.DB.prepare(`
        UPDATE asset_configurations
        SET is_active = TRUE, updated_at = CURRENT_TIMESTAMP
        WHERE category = 'base_ground' AND asset_key = ?
    `).bind(asset_key).run();

    await logAudit(env, 'set_active_base_ground', null, user?.username, { asset_key });

    return c.json({ success: true });
});

// GET /api/admin/assets/base-ground/active
// Get the current active base ground URL
router.get('/base-ground/active', async (c) => {
    const env = c.env;

    const result = await env.DB.prepare(`
        SELECT
            ac.asset_key,
            ga.r2_url as sprite_url
        FROM asset_configurations ac
        LEFT JOIN generated_assets ga ON ac.active_sprite_id = ga.id
        WHERE ac.category = 'base_ground' AND ac.is_active = TRUE
        LIMIT 1
    `).first();

    if (!result) {
        return c.json({ success: true, base_ground: null });
    }

    return c.json({
        success: true,
        base_ground: {
            asset_key: result.asset_key,
            sprite_url: result.sprite_url
        }
    });
});
```

### Backend: Asset Configuration Endpoints

```javascript
// Add to assets.js

// GET /api/admin/assets/configurations/:category
// List all configurations for a category
router.get('/configurations/:category', async (c) => {
    const { category } = c.req.param();
    const env = c.env;

    // For buildings, use existing building_configurations
    if (category === 'buildings') {
        const configs = await env.DB.prepare(`
            SELECT
                bt.id as asset_key,
                bt.name,
                bc.active_sprite_id,
                bc.cost_override,
                bc.base_profit_override,
                bc.is_published,
                ga.r2_url as sprite_url
            FROM building_types bt
            LEFT JOIN building_configurations bc ON bt.id = bc.building_type_id
            LEFT JOIN generated_assets ga ON bc.active_sprite_id = ga.id
            ORDER BY bt.name
        `).all();

        return c.json({ success: true, configurations: configs.results });
    }

    // For other categories, use asset_configurations
    const configs = await env.DB.prepare(`
        SELECT
            ac.*,
            ga.r2_url as sprite_url,
            ga.asset_key as sprite_key
        FROM asset_configurations ac
        LEFT JOIN generated_assets ga ON ac.active_sprite_id = ga.id
        WHERE ac.category = ?
        ORDER BY ac.asset_key
    `).bind(category).all();

    return c.json({ success: true, configurations: configs.results });
});

// PUT /api/admin/assets/configurations/:category/:assetKey
// Update configuration for an asset
router.put('/configurations/:category/:assetKey', async (c) => {
    const { category, assetKey } = c.req.param();
    const env = c.env;
    const user = c.get('user');
    const body = await c.req.json();

    // For buildings, use existing endpoint
    if (category === 'buildings') {
        const { active_sprite_id, cost_override, base_profit_override } = body;

        await env.DB.prepare(`
            INSERT INTO building_configurations (building_type_id, active_sprite_id, cost_override, base_profit_override)
            VALUES (?, ?, ?, ?)
            ON CONFLICT (building_type_id) DO UPDATE SET
                active_sprite_id = COALESCE(excluded.active_sprite_id, building_configurations.active_sprite_id),
                cost_override = excluded.cost_override,
                base_profit_override = excluded.base_profit_override,
                updated_at = CURRENT_TIMESTAMP
        `).bind(assetKey, active_sprite_id || null, cost_override ?? null, base_profit_override ?? null).run();

        return c.json({ success: true });
    }

    // For other categories
    const { active_sprite_id, config } = body;

    await env.DB.prepare(`
        INSERT INTO asset_configurations (category, asset_key, active_sprite_id, config)
        VALUES (?, ?, ?, ?)
        ON CONFLICT (category, asset_key) DO UPDATE SET
            active_sprite_id = COALESCE(excluded.active_sprite_id, asset_configurations.active_sprite_id),
            config = COALESCE(excluded.config, asset_configurations.config),
            updated_at = CURRENT_TIMESTAMP
    `).bind(category, assetKey, active_sprite_id || null, config ? JSON.stringify(config) : null).run();

    await logAudit(env, 'update_asset_config', null, user?.username, {
        category, assetKey, ...body
    });

    return c.json({ success: true });
});

// POST /api/admin/assets/configurations/:category/:assetKey/publish
router.post('/configurations/:category/:assetKey/publish', async (c) => {
    const { category, assetKey } = c.req.param();
    const env = c.env;
    const user = c.get('user');

    const table = category === 'buildings' ? 'building_configurations' : 'asset_configurations';
    const keyColumn = category === 'buildings' ? 'building_type_id' : 'asset_key';

    await env.DB.prepare(`
        UPDATE ${table}
        SET is_published = TRUE, published_at = CURRENT_TIMESTAMP, published_by = ?
        WHERE ${keyColumn} = ?
    `).bind(user?.username, assetKey).run();

    return c.json({ success: true });
});
```

---

## Test Cases

### Test 1: Edit Building Prices
1. Open Asset Manager → Buildings tab
2. Click "Edit" on a building
3. Uncheck "Use default" for Cost
4. Enter new cost value
5. Click Save

**Expected:** Price updated in database, UI shows "(override)"

### Test 2: NPC Configuration
1. Open Asset Manager → NPCs tab
2. Select an approved NPC sprite
3. Publish

**Expected:** NPC configuration saved and published

### Test 3: Revert to Default Price
1. Edit a building with overridden price
2. Check "Use default" checkbox
3. Save

**Expected:** `cost_override` set to NULL, shows default price

### Test 4: Base Ground Selection
1. Open Asset Manager → Base Ground tab
2. Verify current active ground is highlighted
3. Click a different ground texture
4. Verify active indicator moves to new selection

**Expected:** Only one base ground active, API returns new active ground URL

### Test 5: Base Ground API
1. Call `GET /api/admin/assets/base-ground/active`
2. Verify response includes `sprite_url`

**Expected:** Returns currently active base ground URL for game consumption

---

## Acceptance Checklist

- [ ] Building Manager renamed to Asset Manager
- [ ] Price editing UI for buildings (cost_override, base_profit_override)
- [ ] "Use default" toggle for prices
- [ ] Tabs for Buildings, NPCs, Effects, Terrain, Base Ground
- [ ] Generic asset_configurations table for non-building types
- [ ] Backend endpoints for all asset types
- [ ] Publish/unpublish for all asset types
- [ ] Sprite selection for all asset types
- [ ] Base Ground tab shows all available base ground textures
- [ ] Only ONE base ground can be active at a time
- [ ] Active base ground highlighted in UI
- [ ] Game can fetch active base ground via API

---

## Deployment

### Commands

```bash
# Run migration
npx wrangler d1 execute notropolis-db --remote --file=migrations/0028_create_asset_configurations.sql

# Deploy
cd authentication-dashboard-system
npm run build && npm run deploy
```

### Verification

1. Open admin/assets
2. Navigate to Asset Manager tab
3. Verify all tabs work
4. Edit a building price
5. Publish an NPC configuration

---

## Integration with Generation Flow

This stage connects the generation pipeline to the game:

```
FULL ASSET LIFECYCLE
====================

1. GENERATE REFERENCE (full control)
   └── building_ref, terrain_ref, character_ref, etc.
   └── Edit prompt, select references, configure Gemini settings
   └── Generate → Review → Approve

2. GENERATE SPRITES (manual, 1-by-1, full control)
   └── Select parent reference
   └── System shows which sprites are needed (e.g., 5 for terrain, 1 for building)
   └── Generate each sprite variant with:
       ├── Custom/edited prompt
       ├── Parent ref + additional references
       └── Gemini settings (temperature, topK, topP)
   └── Generate → Review → Approve

3. POST-APPROVAL PIPELINE (automatic for sprites)
   └── On sprite approval:
       ├── Background removal (Slazzer)
       ├── Trim transparent pixels
       ├── Save PNG to private bucket
       ├── Resize + WebP conversion (Cloudflare)
       └── Save to public bucket

4. ASSET MANAGER (this stage)
   └── View all approved sprites per asset type
   └── Select active sprite for each asset
   └── Configure prices (buildings)
   └── Publish to game

5. GAME CONSUMPTION
   └── Game fetches published assets via API
   └── Uses public bucket URLs for sprites
```

**Key points:**
- NO auto-sprite creation - all sprites manually generated with full control
- Sprites require an approved parent reference
- LLM settings saved with each generation for reproducibility
- Asset Manager is the final step before assets appear in the game
