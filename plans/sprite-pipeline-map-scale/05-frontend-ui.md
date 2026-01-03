# Stage 05: Frontend UI

## Objective

Add map_scale slider to the admin Asset Manager for buildings and other asset categories.

## Dependencies

`[Requires: Stage 03 complete]` - API must return map_scale in configuration responses.

## Complexity

**Medium** - Modifying TypeScript interfaces and React components.

---

## Files to Modify

| File | Changes |
|------|---------|
| `src/services/assetApi.ts` | Add map_scale to interfaces |
| `src/components/assets/AssetManager.tsx` | Add map_scale slider to edit forms |

---

## Implementation Details

### 1. Update TypeScript Interfaces

**File:** `src/services/assetApi.ts`

#### Update BuildingConfiguration (around line 871)

```typescript
export interface BuildingConfiguration {
  asset_key: string;
  name: string;
  active_sprite_id?: number | null;
  cost_override?: number | null;
  base_profit_override?: number | null;
  map_scale?: number | null;              // ADD
  default_map_scale?: number;             // ADD
  effective_map_scale?: number;           // ADD
  default_cost?: number;
  default_profit?: number;
  effective_cost?: number;
  effective_profit?: number;
  is_published?: boolean;
  published_at?: string;
  published_by?: string;
  sprite_url?: string;
  available_sprites?: number;
}
```

#### Update AssetConfiguration (around line 854)

```typescript
export interface AssetConfiguration {
  id?: number;
  category: string;
  asset_key: string;
  active_sprite_id?: number | null;
  config?: Record<string, unknown>;
  map_scale?: number | null;              // ADD
  default_map_scale?: number;             // ADD
  effective_map_scale?: number;           // ADD
  is_active?: boolean;
  is_published?: boolean;
  published_at?: string;
  published_by?: string;
  sprite_url?: string;
  available_sprites?: number;
  created_at?: string;
  updated_at?: string;
}
```

### 2. Update BuildingEditForm Component

**File:** `src/components/assets/AssetManager.tsx`

Find the `BuildingEditForm` component (around line 77) and add map_scale state and UI:

#### Add state for map_scale

```typescript
function BuildingEditForm({ building, onSave, onCancel }: BuildingEditFormProps) {
  const [costOverride, setCostOverride] = useState<number | null>(building.cost_override ?? null);
  const [profitOverride, setProfitOverride] = useState<number | null>(building.base_profit_override ?? null);
  const [mapScale, setMapScale] = useState<number>(building.map_scale ?? building.default_map_scale ?? 1.0);  // ADD
  const [saving, setSaving] = useState(false);
  // ...
```

#### Add map_scale slider UI (after profit fields)

```tsx
{/* Map Scale */}
<div className="flex items-center gap-3 py-3 border-t border-gray-100 dark:border-gray-700">
  <Maximize2 className="w-4 h-4 text-gray-400 flex-shrink-0" />
  <div className="flex-1">
    <div className="flex items-center justify-between mb-1">
      <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
        Map Scale
      </label>
      <span className="text-sm font-mono text-gray-500">
        {mapScale.toFixed(1)}x
        {building.default_map_scale && mapScale !== building.default_map_scale && (
          <span className="text-xs text-gray-400 ml-1">
            (default: {building.default_map_scale.toFixed(1)}x)
          </span>
        )}
      </span>
    </div>
    <input
      type="range"
      min="0.1"
      max="2.0"
      step="0.1"
      value={mapScale}
      onChange={(e) => setMapScale(parseFloat(e.target.value))}
      className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700"
    />
    <div className="flex justify-between text-xs text-gray-400 mt-1">
      <span>0.1x</span>
      <span>1.0x</span>
      <span>2.0x</span>
    </div>
  </div>
</div>
```

#### Update handleSave to include map_scale

```typescript
const handleSave = async () => {
  setSaving(true);
  try {
    await assetConfigApi.updateConfiguration('buildings', building.asset_key, {
      cost_override: costOverride,
      base_profit_override: profitOverride,
      map_scale: mapScale,  // ADD
    });
    showToast('Building configuration saved', 'success');
    onSave();
  } catch (err) {
    showToast('Failed to save configuration', 'error');
  } finally {
    setSaving(false);
  }
};
```

### 3. Add Maximize2 Import

At the top of AssetManager.tsx, add to lucide-react imports:

```typescript
import {
  // ... existing imports
  Maximize2,  // ADD
} from 'lucide-react';
```

### 4. Optional: Add Reset to Default Button

```tsx
<button
  type="button"
  onClick={() => setMapScale(building.default_map_scale ?? 1.0)}
  className="text-xs text-blue-600 hover:text-blue-700"
>
  Reset to default
</button>
```

---

## Visual Preview

The map_scale slider should look like:

```
┌─────────────────────────────────────────┐
│ ↔️  Map Scale                    0.8x   │
│ ────────────●──────────────────────     │
│ 0.1x        1.0x                 2.0x   │
│                    (default: 0.8x)      │
└─────────────────────────────────────────┘
```

---

## Test Cases

### 1. Map scale slider appears for buildings
Navigate to Admin > Assets > Buildings, click Settings on a building.
**Expected:** Map Scale slider visible with current value

### 2. Changing map_scale saves correctly
1. Adjust slider to 0.5
2. Click Save
3. Refresh page
4. Open same building
**Expected:** Slider shows 0.5

### 3. Default value shown when no override
For a building that hasn't been customized:
**Expected:** Slider at default_map_scale value, "(default: X.Xx)" shown

### 4. API receives map_scale in update
Check Network tab when saving:
**Expected:** Request body includes `"map_scale": 0.5`

---

## Acceptance Checklist

- [x] BuildingConfiguration interface has map_scale, default_map_scale, effective_map_scale ✅
- [x] AssetConfiguration interface has map_scale, default_map_scale, effective_map_scale ✅
- [x] BuildingEditForm has mapScale state initialized from building data ✅
- [x] Map scale slider renders with 0.1-2.0 range ✅
- [x] Current value displays next to slider ✅
- [x] Default value shown when different from current ✅
- [x] handleSave includes map_scale in update payload ✅
- [x] Maximize2 icon imported from lucide-react ✅
- [x] Build succeeds without TypeScript errors ✅
- [x] Saving map_scale works end-to-end ✅

**Completed:** 2026-01-03

---

## Deployment

```bash
cd /Users/riki/notropolis/authentication-dashboard-system

# Build
npm run build

# Deploy to Pages (adjust project name as needed)
npx wrangler pages deploy dist --project-name notropolis-dashboard
```

**Verification:**
1. Navigate to https://boss.notropolis.net/admin/assets
2. Click Settings on a building
3. Verify map_scale slider appears and functions

---

## Handoff Notes

- Frontend now displays and saves map_scale
- The game client should read `effective_map_scale` from the API to render sprites
- Future enhancement: Add map_scale to non-building asset categories (NPCs, vehicles, etc.) using similar pattern
- The slider range 0.1-2.0 allows scaling from 10% to 200% - adjust if needed

## Implementation Notes

**Fix applied during review:** Added `map_scale?: number | null` to the `updateConfiguration()` method type in `assetApi.ts` (line 943) - the original spec's implementation details didn't include updating this type signature, which would have caused TypeScript errors.
