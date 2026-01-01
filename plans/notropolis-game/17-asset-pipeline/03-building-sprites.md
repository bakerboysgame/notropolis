# Stage 03: Building Sprites

## Objective

Generate isometric game sprites from approved reference sheets, then remove backgrounds for transparent PNGs ready for the game map.

## Dependencies

`[Requires: Stage 02 complete]` - Approved reference sheets must exist.

## Complexity

**Medium** - Two-step process (generate + remove background), quality validation.

---

## Files to Modify

| File | Changes |
|------|---------|
| None | Uses existing infrastructure |

## Files to Create

| File | Purpose |
|------|---------|
| `scripts/generate-building-sprites.js` | Sprite generation script |
| `scripts/batch-remove-backgrounds.js` | Background removal batch script |

---

## Building Sprite Specifications

| Building | Canvas Size | Size Class |
|----------|-------------|------------|
| Market Stall | 128 × 128 | SHORT |
| Hot Dog Stand | 128 × 128 | SHORT |
| Campsite | 128 × 128 | SHORT |
| Shop | 192 × 192 | MEDIUM |
| Burger Bar | 192 × 192 | MEDIUM |
| Motel | 192 × 192 | MEDIUM |
| High Street Store | 256 × 256 | TALL |
| Restaurant | 256 × 256 | TALL |
| Manor | 256 × 256 | TALL |
| Police Station | 256 × 256 | TALL |
| Casino | 320 × 320 | VERY TALL |
| Temple | 320 × 320 | VERY TALL |
| Bank | 320 × 320 | VERY TALL |

---

## Implementation Details

### Sprite Prompt Template

Each sprite prompt references the approved reference sheet:

```
Create a single isometric game sprite for a {BUILDING_NAME}.

REFERENCE: Look at the {BUILDING_NAME} reference sheet in Knowledge. Match the EXACT building design, colors, and details from that reference.

Format: 45-degree isometric view, single image
Canvas: {SIZE} x {SIZE} px SQUARE
Background: Solid color (will be removed) - use bright green (#00FF00) or magenta (#FF00FF)
Size class: {SIZE_CLASS}
Orientation: Entry/door on BOTTOM LEFT, building extends toward top-right

The building sits on a DIAMOND-shaped footprint at the BOTTOM of the square canvas. The structure extends UPWARD from the diamond base to fill the canvas vertically.

Extract ONLY the 45-degree isometric view from the reference sheet and render it as a clean game sprite.

CRITICAL:
- Match the reference sheet EXACTLY
- Entry/door on BOTTOM LEFT
- Diamond footprint at canvas bottom
- Building fills the square canvas vertically
- Solid background color (for easy removal)
- No ground plane, shadows on ground, or environmental elements

Style: 90s CGI chunky aesthetic with modern render quality. Clean edges suitable for game sprite use.
```

### Generation Script: `scripts/generate-building-sprites.js`

```javascript
#!/usr/bin/env node

const GEMINI_API_KEY = 'AIzaSyBWnr61XbV5G_SDBltdnDaBxoOIaWMbXow';
const WORKER_URL = 'https://your-worker.dev';
const AUTH_TOKEN = 'your-admin-token';

const buildings = [
    { key: 'market_stall', name: 'Market Stall', size: 128, class: 'SHORT' },
    { key: 'hot_dog_stand', name: 'Hot Dog Stand', size: 128, class: 'SHORT' },
    { key: 'campsite', name: 'Campsite', size: 128, class: 'SHORT' },
    { key: 'shop', name: 'Shop', size: 192, class: 'MEDIUM' },
    { key: 'burger_bar', name: 'Burger Bar', size: 192, class: 'MEDIUM' },
    { key: 'motel', name: 'Motel', size: 192, class: 'MEDIUM' },
    { key: 'high_street_store', name: 'High Street Store', size: 256, class: 'TALL' },
    { key: 'restaurant', name: 'Restaurant', size: 256, class: 'TALL' },
    { key: 'manor', name: 'Manor', size: 256, class: 'TALL' },
    { key: 'police_station', name: 'Police Station', size: 256, class: 'TALL' },
    { key: 'casino', name: 'Casino', size: 320, class: 'VERY TALL' },
    { key: 'temple', name: 'Temple', size: 320, class: 'VERY TALL' },
    { key: 'bank', name: 'Bank', size: 320, class: 'VERY TALL' }
];

function buildPrompt(building) {
    return `Create a single isometric game sprite for a ${building.name.toUpperCase()}.

REFERENCE: Look at the ${building.name} reference sheet in Knowledge. Match the EXACT building design, colors, materials, and distinctive features from that reference.

Format: 45-degree isometric view, single isolated building
Canvas: ${building.size} x ${building.size} px SQUARE
Background: Use solid bright green (#00FF00) for easy background removal
Size class: ${building.class}
Orientation: Entry/door on BOTTOM LEFT, building extends toward top-right

Layout:
- DIAMOND-shaped footprint at the BOTTOM of the square canvas
- Building extends UPWARD from the diamond base
- Building should fill the canvas height appropriately for a ${building.class} structure

Extract ONLY the 45-degree isometric view from the reference sheet and render it as a clean game sprite.

CRITICAL REQUIREMENTS:
- Match the reference sheet design EXACTLY (same colors, windows, signs, details)
- Entry point/door on BOTTOM LEFT
- Diamond footprint aligned to canvas bottom
- SOLID GREEN BACKGROUND (#00FF00) - no gradients, no transparency yet
- NO ground plane, NO shadows on ground, NO environmental elements
- Just the building isolated on green

Style: 90s CGI chunky polygonal aesthetic with modern render quality. Clean anti-aliased edges. Top-left lighting. Ready for background removal.`;
}

async function generateAsset(category, assetKey, prompt, variant) {
    const response = await fetch(`${WORKER_URL}/api/admin/assets/generate`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${AUTH_TOKEN}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ category, asset_key: assetKey, prompt, variant })
    });
    return response.json();
}

async function main() {
    console.log('Starting building sprite generation...\n');
    console.log('NOTE: Sprites will have green background. Run background removal next.\n');

    for (const building of buildings) {
        const prompt = buildPrompt(building);

        console.log(`Generating: ${building.name} (${building.size}×${building.size})`);

        // Generate variant 1
        console.log(`  Variant 1...`);
        const result1 = await generateAsset('building_sprite', building.key, prompt, 1);
        console.log(`    ${result1.success ? '✓ ' + result1.url : '✗ ' + result1.error}`);

        await new Promise(r => setTimeout(r, 2000));

        // Generate variant 2
        console.log(`  Variant 2...`);
        const result2 = await generateAsset('building_sprite', building.key, prompt, 2);
        console.log(`    ${result2.success ? '✓ ' + result2.url : '✗ ' + result2.error}`);

        await new Promise(r => setTimeout(r, 3000));
    }

    console.log('\n✓ Sprite generation complete!');
    console.log('Next: Run batch-remove-backgrounds.js to make transparent');
}

main().catch(console.error);
```

### Background Removal Script: `scripts/batch-remove-backgrounds.js`

```javascript
#!/usr/bin/env node

const WORKER_URL = 'https://your-worker.dev';
const AUTH_TOKEN = 'your-admin-token';

async function listAssets(category) {
    const response = await fetch(`${WORKER_URL}/api/admin/assets/list/${category}`, {
        headers: { 'Authorization': `Bearer ${AUTH_TOKEN}` }
    });
    const data = await response.json();
    return data.assets;
}

async function removeBackground(assetId) {
    const response = await fetch(`${WORKER_URL}/api/admin/assets/remove-background/${assetId}`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${AUTH_TOKEN}` }
    });
    return response.json();
}

async function main() {
    console.log('Removing backgrounds from building sprites...\n');

    const assets = await listAssets('building_sprite');
    const pending = assets.filter(a => !a.background_removed && a.status === 'completed');

    console.log(`Found ${pending.length} sprites needing background removal\n`);

    for (const asset of pending) {
        console.log(`Processing: ${asset.asset_key} v${asset.variant}...`);

        const result = await removeBackground(asset.id);

        if (result.success) {
            console.log(`  ✓ ${result.url}`);
        } else {
            console.log(`  ✗ ${result.error}`);
        }

        // Rate limit for Removal.ai (40/month on free tier)
        await new Promise(r => setTimeout(r, 1500));
    }

    console.log('\n✓ Background removal complete!');
}

main().catch(console.error);
```

---

## Workflow

### Step 1: Generate Sprites (with green background)

```bash
node scripts/generate-building-sprites.js
```

This creates sprites at `assets/building_sprite/{key}_v{1|2}.png` with green backgrounds.

### Step 2: Remove Backgrounds

```bash
node scripts/batch-remove-backgrounds.js
```

This processes each sprite through Removal.ai and saves at `assets/building_sprite/{key}_v{1|2}_transparent.png`.

### Step 3: Review & Approve

For each building:
- Check sprite matches reference sheet
- Verify transparent background is clean (no green fringing)
- Confirm door on bottom-left
- Check building fills canvas appropriately

### Step 4: Finalize

Approved sprites become the game assets:
- Copy to `sprites/buildings/` in R2
- Update `building_types` table with new sprite URLs

---

## Test Cases

### 1. Single Sprite Generation
```bash
curl -X POST "${WORKER_URL}/api/admin/assets/generate" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "category": "building_sprite",
    "asset_key": "restaurant",
    "prompt": "...",
    "variant": 1
  }'
```

**Expected:** Sprite with green background uploaded.

### 2. Background Removal
```bash
curl -X POST "${WORKER_URL}/api/admin/assets/remove-background/15" \
  -H "Authorization: Bearer ${TOKEN}"
```

**Expected:** New transparent PNG at `*_transparent.png`.

### 3. Verify Transparency
Download the transparent PNG and verify:
- Alpha channel is correct
- No green fringing on edges
- Building edges are clean

---

## Acceptance Checklist

- [ ] All 13 buildings have sprite variants generated
- [ ] Sprites use green background (#00FF00)
- [ ] Background removal run on all sprites
- [ ] Transparent PNGs have clean edges
- [ ] Each sprite matches its reference sheet design
- [ ] Door/entry on bottom-left in all sprites
- [ ] Canvas sizes correct (128/192/256/320 as specified)
- [ ] At least 1 approved variant per building
- [ ] Final sprites uploaded to `sprites/buildings/` in R2

---

## Deployment

```bash
# 1. Ensure reference sheets are approved (Stage 02)

# 2. Generate sprites with green backgrounds
node scripts/generate-building-sprites.js

# 3. Review generated sprites
# Check assets in R2 or admin panel

# 4. Remove backgrounds
node scripts/batch-remove-backgrounds.js

# 5. Final review of transparent sprites
# Approve good ones, regenerate bad ones

# 6. Copy approved to game sprites location
# (Or update database to point to new URLs)
```

---

## Handoff Notes

**For Stage 04:**
- Building sprites are complete with transparency
- Same workflow applies to dirty trick effects
- Dirty tricks are OVERLAY sprites (will be placed ON TOP of buildings)
- Effects should be sized to match building footprint dimensions

**Quality Issues Found:**
*Document any consistent issues here*

| Building | Issue | Resolution |
|----------|-------|------------|
| (fill during review) | | |
