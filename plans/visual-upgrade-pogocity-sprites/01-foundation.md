# Stage 1: Foundation - Building Metadata & Infrastructure

## Objective

Create building footprint metadata configuration and update asset loader to support the Asset Manager API for sprite URLs.

## Dependencies

**Requires**: None (Stage 4 character/vehicle systems already complete)

## Complexity

**Low** — Pure configuration and helper functions, no rendering changes

---

## Key Architecture Decision: Asset Manager Integration

**IMPORTANT**: Building sprite URLs come from the **Asset Manager** at https://boss.notropolis.net/admin/assets.

- Sprites are uploaded/generated, approved, and published via the Asset Manager UI
- Published sprites have URLs stored in R2 (requires authentication)
- The API endpoint `GET /api/assets/buildings/published` returns sprite URLs (requires JWT auth)
- This stage creates **footprint metadata only** - sprite URLs are fetched from the API

**Authentication Flow**:
- R2 storage is **NOT public** - requires authentication via middleware
- Existing pattern in `useIsometricAssets.ts`: fetch sprite URLs from authenticated API endpoint
- For Phaser (Stage 2+): sprite loading must go through authenticated fetch → blob URL conversion
- The `populateBuildingSpriteCache()` function receives URLs from the authenticated API

**What this stage does NOT do**:
- Hardcode sprite paths (those come from Asset Manager)
- Modify the Asset Manager system or authentication
- Change how sprites are selected/published

---

## Files to Modify

### 1. `src/components/game/phaser/gameConfig.ts`
**Changes**: Add DEPTH_LAYERS constant
```typescript
export const DEPTH_LAYERS = {
  GROUND: 0.00,
  LAMP_GLOW: 0.04,
  BUILDINGS: 0.05,
  DECORATIONS: 0.06,
  VEHICLES: 0.10,
  CHARACTERS: 0.20,
} as const;
```

### 2. `src/components/game/phaser/utils/assetLoader.ts`
**Changes**:
- Import buildingMetadata for footprint data
- Add sprite URL cache that can be populated from Asset Manager API
- Add helper functions: `getBuildingMetadata()`, `getBuildingFootprint()`, `getBuildingRenderSize()`
- Add `setBuildingSpriteUrl()` and `getBuildingSpriteUrl()` for runtime sprite URL management

---

## Files to Create

### 1. `src/config/buildingMetadata.ts` (NEW)

**Purpose**: Central configuration for building visual properties (footprint/render size only - NOT sprite URLs)

**Interface**:
```typescript
export interface BuildingMetadata {
  buildingTypeId: string;
  footprint: { width: number; height: number };
  renderSize?: { width: number; height: number };  // If different from footprint
  offset?: { x: number; y: number };               // Position adjustment
  scale?: number;                                   // Sprite scale factor
}

export const BUILDING_METADATA: Record<string, BuildingMetadata>
```

**Content**: Map all 15 Notropolis building types (from `assetApi.ts` ASSET_KEYS.building_ref):

| Building | Footprint | Notes |
|----------|-----------|-------|
| market_stall | 1×1 | Level 1 commercial |
| hot_dog_stand | 1×1 | Level 1 commercial |
| campsite | 1×1 | Level 1 |
| shop | 1×1 | Level 1 retail |
| burger_bar | 1×1 | Level 2 fast food |
| motel | 2×1 | Level 2 lodging (wider) |
| high_street_store | 2×2 | Level 3 premium retail |
| restaurant | 2×2 | Level 3 dining |
| manor | 2×3 | Level 4 luxury estate |
| casino | 3×3 | Level 5 gaming |
| bank | 3×3 | Special building |
| temple | 3×3 | Special building |
| police_station | 3×2 | Special building (wider) |
| demolished | 1×1 | Collapsed building state |
| claim_stake | 1×1 | Unclaimed property marker |

---

## Implementation Details

### buildingMetadata.ts Full Implementation

```typescript
/**
 * Building Metadata - Footprint and visual configuration
 *
 * NOTE: Sprite URLs are NOT stored here - they come from the Asset Manager API.
 * This file only contains footprint/render size data for vertical slice rendering.
 */

export interface BuildingMetadata {
  buildingTypeId: string;
  footprint: { width: number; height: number };
  renderSize?: { width: number; height: number };
  offset?: { x: number; y: number };
  scale?: number;
}

export const BUILDING_METADATA: Record<string, BuildingMetadata> = {
  // Level 1 buildings (1×1)
  market_stall: {
    buildingTypeId: 'market_stall',
    footprint: { width: 1, height: 1 },
  },
  hot_dog_stand: {
    buildingTypeId: 'hot_dog_stand',
    footprint: { width: 1, height: 1 },
  },
  campsite: {
    buildingTypeId: 'campsite',
    footprint: { width: 1, height: 1 },
  },
  shop: {
    buildingTypeId: 'shop',
    footprint: { width: 1, height: 1 },
  },

  // Level 2 buildings
  burger_bar: {
    buildingTypeId: 'burger_bar',
    footprint: { width: 1, height: 1 },
  },
  motel: {
    buildingTypeId: 'motel',
    footprint: { width: 2, height: 1 },
  },

  // Level 3 buildings (2×2)
  high_street_store: {
    buildingTypeId: 'high_street_store',
    footprint: { width: 2, height: 2 },
  },
  restaurant: {
    buildingTypeId: 'restaurant',
    footprint: { width: 2, height: 2 },
  },

  // Level 4 buildings
  manor: {
    buildingTypeId: 'manor',
    footprint: { width: 2, height: 3 },
  },

  // Level 5 buildings (3×3)
  casino: {
    buildingTypeId: 'casino',
    footprint: { width: 3, height: 3 },
  },

  // Special buildings (3×3 or 3×2)
  bank: {
    buildingTypeId: 'bank',
    footprint: { width: 3, height: 3 },
  },
  temple: {
    buildingTypeId: 'temple',
    footprint: { width: 3, height: 3 },
  },
  police_station: {
    buildingTypeId: 'police_station',
    footprint: { width: 3, height: 2 },
  },

  // State buildings (1×1)
  demolished: {
    buildingTypeId: 'demolished',
    footprint: { width: 1, height: 1 },
  },
  claim_stake: {
    buildingTypeId: 'claim_stake',
    footprint: { width: 1, height: 1 },
  },
};

export function getBuildingMetadata(buildingTypeId: string): BuildingMetadata | undefined {
  return BUILDING_METADATA[buildingTypeId];
}

export function getBuildingFootprint(buildingTypeId: string): { width: number; height: number } {
  const metadata = BUILDING_METADATA[buildingTypeId];
  return metadata?.footprint || { width: 1, height: 1 };
}

export function getBuildingRenderSize(buildingTypeId: string): { width: number; height: number } {
  const metadata = BUILDING_METADATA[buildingTypeId];
  return metadata?.renderSize || metadata?.footprint || { width: 1, height: 1 };
}
```

### assetLoader.ts Updates

```typescript
import {
  BUILDING_METADATA,
  getBuildingMetadata,
  getBuildingFootprint,
  getBuildingRenderSize
} from '../../../../config/buildingMetadata';

// ============================================
// SPRITE URL CACHE (populated from Asset Manager API)
// ============================================

// Cache of building sprite URLs from Asset Manager
// Key: building_type_id, Value: sprite URL (may require auth to load)
const buildingSpriteCache: Map<string, string> = new Map();

// Cache of blob URLs for Phaser (created from authenticated fetch)
// Key: building_type_id, Value: blob URL that can be used directly
const buildingBlobCache: Map<string, string> = new Map();

/**
 * Set sprite URL for a building type (called when loading from Asset Manager API)
 */
export function setBuildingSpriteUrl(buildingTypeId: string, url: string): void {
  buildingSpriteCache.set(buildingTypeId, url);
}

/**
 * Set blob URL for a building type (for Phaser loading after authenticated fetch)
 */
export function setBuildingBlobUrl(buildingTypeId: string, blobUrl: string): void {
  buildingBlobCache.set(buildingTypeId, blobUrl);
}

/**
 * Populate sprite cache from Asset Manager API response
 * Call this when game loads with data from authenticated API call
 * Format matches /api/assets/buildings/published response
 */
export function populateBuildingSpriteCache(
  sprites: Record<string, { url: string; outline_url?: string }>
): void {
  for (const [buildingTypeId, sprite] of Object.entries(sprites)) {
    if (sprite.url) {
      buildingSpriteCache.set(buildingTypeId, sprite.url);
    }
  }
}

/**
 * Get building sprite URL
 * Priority: 1) Blob cache (ready for Phaser), 2) Asset Manager URL, 3) Local fallback, 4) Default
 *
 * NOTE: R2 URLs require authentication. For Phaser, use getBuildingBlobUrl() after
 * fetching with auth and converting to blob.
 */
export function getBuildingUrl(buildingTypeId: string): string {
  // First check blob cache (already authenticated and ready for Phaser)
  const blobUrl = buildingBlobCache.get(buildingTypeId);
  if (blobUrl) return blobUrl;

  // Check Asset Manager cache (may need auth to load)
  const cachedUrl = buildingSpriteCache.get(buildingTypeId);
  if (cachedUrl) return cachedUrl;

  // Fall back to local mapping (for development/testing - no auth needed)
  const localUrl = LOCAL_BUILDING_MAPPING[buildingTypeId];
  if (localUrl) return localUrl;

  // Default fallback
  return DEFAULT_BUILDING;
}

/**
 * Clear blob cache (call on logout or when sprites are republished)
 */
export function clearBuildingBlobCache(): void {
  // Revoke all blob URLs to free memory
  for (const blobUrl of buildingBlobCache.values()) {
    URL.revokeObjectURL(blobUrl);
  }
  buildingBlobCache.clear();
}

// Export metadata helpers
export { getBuildingMetadata, getBuildingFootprint, getBuildingRenderSize };
```

**Note on Authentication**: The R2 sprite URLs require JWT authentication. Stage 2 will need to:
1. Fetch each sprite URL with auth headers
2. Convert response to blob URL via `URL.createObjectURL(blob)`
3. Store in `buildingBlobCache` for Phaser to load directly

---

## Database Changes

**None** — This stage is configuration only

---

## Test Cases

### Test 1: Metadata Lookup
```typescript
// Input
getBuildingMetadata('bank')

// Expected Output
{
  buildingTypeId: 'bank',
  footprint: { width: 3, height: 3 }
}
```

### Test 2: Footprint Helper
```typescript
// Input
getBuildingFootprint('manor')

// Expected Output
{ width: 2, height: 3 }
```

### Test 3: Missing Building Fallback
```typescript
// Input
getBuildingFootprint('nonexistent')

// Expected Output
{ width: 1, height: 1 }  // Safe default
```

### Test 4: Sprite URL from Cache
```typescript
// Setup
populateBuildingSpriteCache({
  'casino': { url: 'https://assets.notropolis.net/sprites/casino.webp' }
});

// Input
getBuildingUrl('casino')

// Expected Output
'https://assets.notropolis.net/sprites/casino.webp'
```

### Test 5: Fallback to Local
```typescript
// When Asset Manager has no published sprite
getBuildingUrl('market_stall')

// Expected Output (falls back to LOCAL_BUILDING_MAPPING)
'/Building/commercial/2x2checkers_south.png'
```

---

## Acceptance Checklist

- [ ] `buildingMetadata.ts` created with all 15 building footprints
- [ ] `DEPTH_LAYERS` constant added to `gameConfig.ts`
- [ ] `assetLoader.ts` updated with sprite cache functions
- [ ] `getBuildingMetadata()` returns correct footprint for all 15 buildings
- [ ] `getBuildingFootprint()` returns { width: 1, height: 1 } for unknown buildings
- [ ] `populateBuildingSpriteCache()` correctly populates cache from API response format
- [ ] `getBuildingUrl()` prioritizes cached URL > local fallback > default
- [ ] No TypeScript errors
- [ ] Existing buildings still render (backward compatible with current LOCAL_BUILDING_MAPPING)
- [ ] Build succeeds with no warnings

---

## Deployment

```bash
# Build
cd /Users/riki/notropolis/authentication-dashboard-system
npm run build

# Deploy (Stage 1 has no visual changes but deploys to verify build)
CLOUDFLARE_API_TOKEN="RQeVAceZ3VT-McbFF9DnYem0ZDc8YXbnHPH8wbg_" \
CLOUDFLARE_ACCOUNT_ID="329dc0e016dd5cd512d6566d64d8aa0c" \
npx wrangler pages deploy dist --project-name=notropolis-dashboard
```

**Verification**:
- TypeScript compilation successful
- No runtime errors in console
- Visit https://boss.notropolis.net and confirm game still works
- Existing game functionality unchanged (same sprites as before)

---

## Handoff Notes

**For Stage 2**:
- `getBuildingMetadata(buildingTypeId)` returns footprint for slice calculation
- `getBuildingFootprint(buildingTypeId)` returns { width, height } with safe fallback
- `DEPTH_LAYERS.BUILDINGS` (0.05) should be used for building slice depth
- All 15 building types have footprint metadata
- Sprite URLs come from `getBuildingUrl()` which checks Asset Manager cache first
- To use Asset Manager sprites at runtime, call `populateBuildingSpriteCache()` with data from `/api/admin/assets/configurations/buildings`

**Asset Manager Integration Notes**:
- Building sprites are managed at https://boss.notropolis.net/admin/assets (Buildings tab → Asset Manager tab)
- Published sprites have `is_published: true` and `sprite_url` pointing to R2
- The game should fetch configurations on load and call `populateBuildingSpriteCache()`
