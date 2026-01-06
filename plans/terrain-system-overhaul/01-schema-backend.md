# Stage 1: Schema + Backend

## Objective
Add terrain_variant column, new terrain types, and terrain reference system prompts.

## Dependencies
None

## Complexity
Medium

## Files to Modify

| File | Changes |
|------|---------|
| `authentication-dashboard-system/src/types/game.ts` | Add snow/sand/mountain to TerrainType, add terrain_variant to Tile |
| `authentication-dashboard-system/worker/index.js` | Add new terrain types to validation (~line 6547) |
| `authentication-dashboard-system/worker/src/routes/admin/assets.js` | Add TERRAIN_VARIANTS, system prompts (~line 1158) |

## Files to Create

| File | Purpose |
|------|---------|
| `authentication-dashboard-system/migrations/0069_terrain_variant.sql` | Add terrain_variant column to tiles |

## Implementation Details

### 1. Migration (0069_terrain_variant.sql)
```sql
ALTER TABLE tiles ADD COLUMN terrain_variant TEXT DEFAULT NULL;
-- Values: straight_ns, straight_ew, corner_ne, corner_nw, corner_se, corner_sw,
--         tjunction_n, tjunction_e, tjunction_s, tjunction_w, crossroad,
--         deadend_n, deadend_e, deadend_s, deadend_w
```

### 2. Types (game.ts)
```typescript
export type TerrainType = 'free_land' | 'road' | 'water' | 'dirt_track' | 'trees' | 'snow' | 'sand' | 'mountain';

export interface Tile {
  // ... existing
  terrain_variant?: string | null;
}
```

### 3. Backend Validation (worker/index.js ~line 6547)
Add 'snow', 'sand', 'mountain' to terrain type validation array.

### 4. Terrain System Prompts (worker/src/routes/admin/assets.js)

Add after TERRAIN_FEATURES (~line 1173):
```javascript
const TERRAIN_VARIANTS = {
  road: ['straight_ns', 'straight_ew', 'corner_ne', 'corner_nw', 'corner_se', 'corner_sw',
         'tjunction_n', 'tjunction_e', 'tjunction_s', 'tjunction_w', 'crossroad',
         'deadend_n', 'deadend_e', 'deadend_s', 'deadend_w']
};

const TERRAIN_REFERENCE_SYSTEM_PROMPT = `
You are creating isometric terrain tiles for a 2D city-builder game.

CRITICAL SPECIFICATIONS:
- Shape: Isometric diamond (rhombus)
- Dimensions: 63x32 pixels (2:1 aspect ratio isometric projection)
- Angle: ~27° isometric projection (standard for 2:1 tiles)
- Background: Transparent (PNG with alpha channel)
- Style: Match the uploaded reference image exactly

For road/path tiles:
- Path exits at exactly CENTER of each tile edge (50% point)
- Path covers approximately 40-50% of tile width
- Connect seamlessly with adjacent road tiles
`;
```

### 5. Add snow to TERRAIN_FEATURES (line ~1162, after sand)
Note: `sand` and `mountain` already exist in TERRAIN_FEATURES. Only add:
```javascript
snow: `Snow/ice terrain tile. Seamless white texture with subtle blue shadows.`,
```

## Database Changes

Migration adds nullable `terrain_variant` column to `tiles` table.

## Test Cases

1. **Migration runs without error**
   - Run: `wrangler d1 migrations apply notropolis-database --local`
   - Expected: Success, column added

2. **New terrain types accepted**
   - POST tile update with terrain_type='snow'
   - Expected: 200 OK

3. **terrain_variant stored correctly**
   - POST tile update with terrain_variant='straight_ns'
   - GET tile, verify terrain_variant='straight_ns'

## Acceptance Checklist

- [ ] Migration file created and runs successfully
- [ ] TerrainType includes snow, sand, mountain
- [ ] Tile interface includes terrain_variant
- [ ] Backend validates new terrain types
- [ ] TERRAIN_VARIANTS constant defined
- [ ] TERRAIN_REFERENCE_SYSTEM_PROMPT defined
- [ ] Build passes with no type errors

## Deployment

```bash
cd authentication-dashboard-system
# Run migration
wrangler d1 migrations apply notropolis-database --remote
# Deploy worker
npx wrangler deploy
```

## Handoff Notes

- terrain_variant is nullable - existing tiles unaffected
- System prompts ready for use in Stage 2 asset generation
- TERRAIN_VARIANTS used by Stage 2 for variant sprite generation
