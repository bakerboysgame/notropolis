# Stage 02: Worker Pipeline Update

## Objective

Update the sprite resize pipeline to use tiered output sizes based on category.

## Dependencies

`[Requires: Stage 01 complete]` - map_scale column must exist before deploying.

## Complexity

**Medium** - Modifying core pipeline logic and size constants.

---

## Files to Modify

| File | Changes |
|------|---------|
| `worker/src/routes/admin/assets.js` | Update BUILDING_SIZE_CLASSES, add SPRITE_OUTPUT_SIZES, modify getTargetDimensions() |

---

## Implementation Details

### 1. Add Tiered Output Size Constants

**Location:** Near line 1454 (after existing constants)

```javascript
// ============================================
// SPRITE OUTPUT SIZES (Tiered by category)
// ============================================

const SPRITE_OUTPUT_SIZES = {
    building_sprite: 320,
    effect: 320,
    terrain: 320,
    vehicle: 128,
    npc: 64,
    overlay: 128,
    ui: 64
};
```

### 2. Update BUILDING_SIZE_CLASSES

**Location:** Lines 1454-1470

Replace width/height with default_map_scale:

```javascript
const BUILDING_SIZE_CLASSES = {
    claim_stake: { class: 'TINY', default_map_scale: 0.2 },
    demolished: { class: 'SHORT', default_map_scale: 0.4 },
    market_stall: { class: 'SHORT', default_map_scale: 0.4 },
    hot_dog_stand: { class: 'SHORT', default_map_scale: 0.4 },
    campsite: { class: 'SHORT', default_map_scale: 0.4 },
    shop: { class: 'MEDIUM', default_map_scale: 0.6 },
    burger_bar: { class: 'MEDIUM', default_map_scale: 0.6 },
    motel: { class: 'MEDIUM', default_map_scale: 0.6 },
    high_street_store: { class: 'TALL', default_map_scale: 0.8 },
    restaurant: { class: 'TALL', default_map_scale: 0.8 },
    manor: { class: 'TALL', default_map_scale: 0.8 },
    police_station: { class: 'TALL', default_map_scale: 0.8 },
    casino: { class: 'VERY_TALL', default_map_scale: 1.0 },
    temple: { class: 'VERY_TALL', default_map_scale: 1.0 },
    bank: { class: 'VERY_TALL', default_map_scale: 1.0 }
};
```

### 3. Add Default Map Scale Constants

```javascript
const DEFAULT_MAP_SCALES = {
    building_sprite: 1.0,  // Per-building overrides above
    effect: 1.0,
    terrain: 1.0,
    vehicle: 0.4,
    npc: 0.1,
    overlay: 0.4,
    ui: 0.2
};
```

### 4. Simplify getTargetDimensions()

**Location:** Lines 387-425

Replace the complex per-asset logic with tiered lookup:

```javascript
function getTargetDimensions(category, assetKey) {
    const size = SPRITE_OUTPUT_SIZES[category];
    if (size) {
        return { width: size, height: size };
    }
    return null; // No resize for unlisted categories (refs, scenes, avatars)
}
```

### 5. Add Helper for Default Map Scale

```javascript
function getDefaultMapScale(category, assetKey) {
    if (category === 'building_sprite') {
        return BUILDING_SIZE_CLASSES[assetKey]?.default_map_scale ?? 1.0;
    }
    return DEFAULT_MAP_SCALES[category] ?? 1.0;
}
```

---

## Code Changes Summary

### Before (getTargetDimensions)
```javascript
function getTargetDimensions(category, assetKey) {
    if (category === 'building_sprite') {
        const sizeClass = BUILDING_SIZE_CLASSES[assetKey];
        if (sizeClass) {
            return { width: sizeClass.width, height: sizeClass.height };
        }
    }
    // ... 30+ lines of per-category logic
}
```

### After (getTargetDimensions)
```javascript
function getTargetDimensions(category, assetKey) {
    const size = SPRITE_OUTPUT_SIZES[category];
    if (size) {
        return { width: size, height: size };
    }
    return null;
}
```

---

## Test Cases

### 1. Building sprite resize
Approve a building sprite and verify pipeline outputs 320x320:
```bash
curl -s "https://assets.notropolis.net/sprites/building_sprite/bank_v8.webp?t=$(date +%s)" -o /tmp/test.webp
sips -g pixelWidth -g pixelHeight /tmp/test.webp
```
**Expected:** pixelWidth: 320, pixelHeight: ≤320

### 2. NPC sprite resize
After reprocessing an NPC sprite:
```bash
curl -s "https://assets.notropolis.net/sprites/npc/ped_walk_n_v1.webp?t=$(date +%s)" -o /tmp/test.webp
sips -g pixelWidth -g pixelHeight /tmp/test.webp
```
**Expected:** pixelWidth: 64, pixelHeight: ≤64

### 3. Vehicle sprite resize
```bash
curl -s "https://assets.notropolis.net/sprites/vehicle/car_sedan_v1.webp?t=$(date +%s)" -o /tmp/test.webp
sips -g pixelWidth -g pixelHeight /tmp/test.webp
```
**Expected:** pixelWidth: 128, pixelHeight: ≤128

### 4. Wrangler tail shows correct dimensions
```bash
npx wrangler tail --env production | grep "Resize"
```
**Expected:** Log messages showing correct target dimensions per category

---

## Acceptance Checklist

- [x] SPRITE_OUTPUT_SIZES constant added with tiered values
- [x] BUILDING_SIZE_CLASSES updated to use default_map_scale instead of width/height
- [x] DEFAULT_MAP_SCALES constant added
- [x] getTargetDimensions() simplified to use SPRITE_OUTPUT_SIZES
- [x] getDefaultMapScale() helper added
- [x] Worker deploys without errors
- [ ] Tail logs show correct resize dimensions (verified on next approval)

---

## Deployment

```bash
cd /Users/riki/notropolis/authentication-dashboard-system/worker
npx wrangler deploy --env production
```

**Verification:**
1. Check deployment succeeded (no errors)
2. Run `npx wrangler tail --env production` and approve a test asset
3. Verify resize logs show correct tiered dimensions

---

## Handoff Notes

- Pipeline now outputs tiered sizes, but existing sprites are still old sizes
- `[See: Stage 04]` for reprocessing all existing sprites
- The getDefaultMapScale() helper is ready for Stage 03 API updates
- If a category is not in SPRITE_OUTPUT_SIZES, it won't be resized (intentional for refs, scenes)
