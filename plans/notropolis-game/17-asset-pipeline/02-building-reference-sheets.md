# Stage 02: Building Reference Sheets

## Objective

Generate multi-view reference sheets for all 13 building types using Gemini API, with 2 variants each for selection.

## Dependencies

`[Requires: Stage 01 complete]` - Infrastructure must be in place.

## Complexity

**Medium** - Batch API calls, quality review process.

---

## Files to Modify

| File | Changes |
|------|---------|
| None | Uses existing infrastructure |

## Files to Create

| File | Purpose |
|------|---------|
| `scripts/generate-building-refs.js` | Node.js script for batch generation |

---

## Building List

| # | Building | Category | Asset Key | Distinctive Features |
|---|----------|----------|-----------|---------------------|
| 1 | Market Stall | building_ref | market_stall | Wooden booth, canvas awning, produce crates |
| 2 | Hot Dog Stand | building_ref | hot_dog_stand | Metal cart, umbrella, condiment bottles, steamer |
| 3 | Campsite | building_ref | campsite | A-frame tent, campfire ring, crates, lantern |
| 4 | Shop | building_ref | shop | Brick facade, display window, awning, "OPEN" sign |
| 5 | Burger Bar | building_ref | burger_bar | Chrome diner, red/white, neon "BURGERS", checkered floor visible |
| 6 | Motel | building_ref | motel | Row of rooms, "MOTEL" sign, "VACANCY", doors with numbers |
| 7 | High Street Store | building_ref | high_street_store | Two-story, shop windows, ornamental upper floor |
| 8 | Restaurant | building_ref | restaurant | "RESTAURANT" sign, visible diners through window, menu board outside, canopy |
| 9 | Manor | building_ref | manor | Grand mansion, columns, many windows, steep roofs, chimneys |
| 10 | Casino | building_ref | casino | Lights everywhere, "CASINO" sign, gold/red, glass doors |
| 11 | Temple | building_ref | temple | Multi-tiered roof, curved eaves, entrance stairs, columns |
| 12 | Bank | building_ref | bank | Stone columns, "BANK" carved, bronze doors, barred windows, clock |
| 13 | Police Station | building_ref | police_station | Brick, "POLICE" sign, blue lamp, reinforced doors, barred windows |

---

## Enhanced Prompts

The prompts from [Ref: 16a-asset-requirements.md] need enhancement for distinctiveness. Key improvements:

### Restaurant (Example Enhancement)

**Before:** "Upscale dining establishment. Elegant facade..."

**After:**
```
Create a building reference sheet for a RESTAURANT.

Match the EXACT template layout from the existing building references:
- Same gray background, white border boxes, label positions, font style
- Views: FRONT VIEW (top left), SIDE PROFILE VIEW (top right), BACK VIEW (middle left), 45 DEGREE ISOMETRIC VIEW (middle right), CLOSE UP DETAILS (bottom)
- Title: "BUILDING REFERENCE SHEET: 90s CGI RESTAURANT"
- 45 degree view: Restaurant entrance on BOTTOM LEFT

The restaurant: CLEARLY IDENTIFIABLE as a restaurant with these distinctive features:
- Large "RESTAURANT" text signage above entrance (illuminated)
- Visible diners at tables through large front windows (silhouettes)
- Outdoor menu board with "TODAY'S SPECIAL" text
- Red and white checkered tablecloths visible inside
- Chef's hat logo on the door or signage
- Small bistro-style awning over entrance
- Warm interior lighting with chandeliers visible
- Wine bottles displayed in window

Materials to highlight in close-up: Menu board detail, tablecloth pattern, wine bottle display, chef hat logo, brass door handle.

90s CGI chunky style with modern render quality - warm golden interior glow suggesting dinner service, inviting upscale but clearly FOOD atmosphere.
```

---

## Implementation Details

### Generation Script: `scripts/generate-building-refs.js`

```javascript
#!/usr/bin/env node

// CONFIGURATION
// Get admin token from: docs/REFERENCE-test-tokens/CLAUDE.md
const WORKER_URL = 'https://api.notropolis.net';
const AUTH_TOKEN = 'YOUR_ADMIN_TOKEN_FROM_CLAUDE_MD';  // Copy from docs/REFERENCE-test-tokens/CLAUDE.md

const buildings = [
    {
        key: 'market_stall',
        name: 'Market Stall',
        distinctive: 'Wooden booth, canvas awning, "MARKET" or "FRESH PRODUCE" signage, crates of colorful fruits/vegetables, hand-lettered price signs, rustic charm'
    },
    {
        key: 'hot_dog_stand',
        name: 'Hot Dog Stand',
        distinctive: 'Metal wheeled cart, large "HOT DOGS" umbrella, visible hot dogs on rotisserie, mustard/ketchup bottles, steaming water tray, menu board with prices'
    },
    {
        key: 'campsite',
        name: 'Campsite',
        distinctive: 'Canvas A-frame tent, stone campfire ring with logs, "CAMP" flag or sign, wooden supply crates, oil lantern, outdoor cooking pot'
    },
    {
        key: 'shop',
        name: 'Shop',
        distinctive: 'Brick facade, large "SHOP" sign, display window with goods, striped awning, "OPEN" sign, doorbell, modest corner store feel'
    },
    {
        key: 'burger_bar',
        name: 'Burger Bar',
        distinctive: '1950s chrome diner, neon "BURGERS" sign, large hamburger logo/mascot, red and white colors, checkered floor visible, jukebox silhouette inside'
    },
    {
        key: 'motel',
        name: 'Motel',
        distinctive: 'Row of numbered doors, tall "MOTEL" sign with arrow, "VACANCY" in neon, room keys hanging in office window, ice machine, parking spaces marked'
    },
    {
        key: 'high_street_store',
        name: 'High Street Store',
        distinctive: 'Two-story Victorian retail, "DEPARTMENT STORE" signage, multiple shop windows with mannequins, ornate cornices, revolving door entrance'
    },
    {
        key: 'restaurant',
        name: 'Restaurant',
        distinctive: 'Large "RESTAURANT" sign, diners visible at tables through windows, outdoor menu board, checkered tablecloths, chef hat logo, wine bottles in window'
    },
    {
        key: 'manor',
        name: 'Manor',
        distinctive: 'Grand mansion, columned entrance portico, "PRIVATE ESTATE" sign, many windows with shutters, ornate iron gates visible, multiple chimneys'
    },
    {
        key: 'casino',
        name: 'Casino',
        distinctive: 'Hundreds of decorative lights, massive "CASINO" sign, playing card/dice motifs, gold and red everywhere, red carpet entrance, glamorous facade'
    },
    {
        key: 'temple',
        name: 'Temple',
        distinctive: 'Multi-tiered pagoda-style roof, curved eaves, grand stone stairs, "TEMPLE" or symbol, incense burner outside, prayer bells, serene atmosphere'
    },
    {
        key: 'bank',
        name: 'Bank',
        distinctive: 'Massive stone columns, "BANK" carved in stone, bronze vault-style doors, barred windows, clock above entrance, marble steps, imposing and secure'
    },
    {
        key: 'police_station',
        name: 'Police Station',
        distinctive: 'Brick government building, large "POLICE" sign, traditional blue lamp glowing, reinforced doors, barred windows, official and authoritative'
    }
];

function buildPrompt(building) {
    return `Create a building reference sheet for a ${building.name.toUpperCase()}.

OUTPUT REQUIREMENTS:
- Resolution: 3840×2160 pixels (4K landscape)
- Format: PNG with solid background (not transparent)
- Orientation: Landscape (wider than tall)

TEMPLATE LAYOUT (match exactly):
- Gray background (#808080), white border boxes, bold label text
- Views: FRONT VIEW (top left), SIDE PROFILE VIEW (top right), BACK VIEW (middle left), 45 DEGREE ISOMETRIC VIEW (middle right), CLOSE UP DETAILS (bottom strip)
- Title at top: "BUILDING REFERENCE SHEET: 90s CGI ${building.name.toUpperCase()}"
- 45 degree isometric view: Entry/door on BOTTOM LEFT side, building extends toward top-right

The ${building.name.toLowerCase()}: MUST BE CLEARLY IDENTIFIABLE with these distinctive features:
${building.distinctive}

CRITICAL RULES:
- Entry point/door on BOTTOM LEFT in isometric view
- Country-neutral (no flags, no currency symbols, no country-specific elements)
- Building ONLY - no vehicles, people, animals, or surrounding objects
- Clean isolated building on its footprint

STYLE: 90s CGI chunky polygonal aesthetic (RenderWare, SimCity 3000, early Pixar) with MODERN render quality:
- Soft ambient occlusion in corners
- Subtle global illumination
- Clean anti-aliased edges
- Professional studio lighting from top-left
- "Box art" promotional render quality`;
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
    console.log('Starting building reference sheet generation...\n');

    for (const building of buildings) {
        const prompt = buildPrompt(building);

        console.log(`Generating: ${building.name}`);

        // Generate variant 1
        console.log(`  Variant 1...`);
        const result1 = await generateAsset('building_ref', building.key, prompt, 1);
        console.log(`    ${result1.success ? '✓ ' + result1.url : '✗ ' + result1.error}`);

        // Small delay to avoid rate limits
        await new Promise(r => setTimeout(r, 2000));

        // Generate variant 2
        console.log(`  Variant 2...`);
        const result2 = await generateAsset('building_ref', building.key, prompt, 2);
        console.log(`    ${result2.success ? '✓ ' + result2.url : '✗ ' + result2.error}`);

        // Delay between buildings
        await new Promise(r => setTimeout(r, 3000));
    }

    console.log('\n✓ Generation complete! Review assets in admin panel.');
}

main().catch(console.error);
```

---

## Review Workflow

### 1. Generate All Reference Sheets
```bash
node scripts/generate-building-refs.js
```

### 2. Review in Admin (or R2 Dashboard)

For each building:
- Compare variant 1 vs variant 2
- Check distinctive features are visible
- Verify door is on bottom-left in isometric view
- Ensure no country-specific elements
- Check template consistency

### 3. Approve or Regenerate

```bash
# Get token from docs/REFERENCE-test-tokens/CLAUDE.md (paste directly, don't use variables)

# Approve good variant (replace 1 with actual asset ID)
curl -X PUT "https://api.notropolis.net/api/admin/assets/approve/1" \
  -H "Authorization: Bearer TOKEN"

# Reject bad variant with reason (replace 2 with actual asset ID)
curl -X PUT "https://api.notropolis.net/api/admin/assets/reject/2" \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"reason": "Door on wrong side, regenerate"}'
```

---

## Test Cases

**⚠️ IMPORTANT:** Get the admin JWT token from `docs/REFERENCE-test-tokens/CLAUDE.md`. Paste token directly in curl commands (don't use shell variables with long JWTs).

### 1. Single Building Generation
```bash
# Replace TOKEN with actual token from CLAUDE.md
curl -X POST "https://api.notropolis.net/api/admin/assets/generate" \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "category": "building_ref",
    "asset_key": "restaurant",
    "prompt": "Create a building reference sheet for a RESTAURANT...",
    "variant": 1
  }'
```

**Expected:** `{ "success": true, "asset_id": N, "r2_key": "refs/restaurant_ref_v1.png", "bucket": "private" }`

### 2. Batch Generation
```bash
# Update AUTH_TOKEN in script first (from docs/REFERENCE-test-tokens/CLAUDE.md)
node scripts/generate-building-refs.js
```

**Expected:** 26 assets created (13 buildings × 2 variants).

### 3. List Generated Assets
```bash
# Replace TOKEN with actual token from CLAUDE.md
curl -X GET "https://api.notropolis.net/api/admin/assets/list/building_ref" \
  -H "Authorization: Bearer TOKEN"
```

**Expected:** `{ "assets": [...] }` - Array of 26 asset records with r2_key values.

---

## Acceptance Checklist

- [ ] Generation script created and tested
- [ ] All 13 buildings have 2 variants generated
- [ ] Each reference sheet has all 5 views (front, side, back, isometric, details)
- [ ] Isometric views have door on bottom-left
- [ ] No country-specific elements visible
- [ ] Distinctive features make each building recognizable
- [ ] Assets uploaded to R2 private bucket at `/refs/` (e.g., `refs/restaurant_ref_v1.png`)
- [ ] At least 1 approved variant per building
- [ ] Failed generations identified and documented

---

## Deployment

```bash
# 1. Navigate to project root
cd /Users/riki/notropolis/authentication-dashboard-system

# 2. Create scripts directory if needed
mkdir -p scripts

# 3. Copy script (already created in scripts/)
# The script is at: scripts/generate-building-refs.js

# 4. Get admin token from docs/REFERENCE-test-tokens/CLAUDE.md
# Edit the AUTH_TOKEN constant in the script with the current valid token

# 5. Run generation
node scripts/generate-building-refs.js

# 6. Review generated assets
# Assets are stored in private R2 bucket: refs/{asset_key}_ref_v{variant}.png
# List via API: curl -H "Authorization: Bearer TOKEN" "https://api.notropolis.net/api/admin/assets/list/building_ref"
```

---

## Handoff Notes

**For Stage 03:**
- Reference sheets are now in R2 **private bucket** at `refs/{asset_key}_ref_v{variant}.png`
  - Example: `refs/restaurant_ref_v1.png`
- Access via worker endpoint: `GET /api/admin/assets/preview/:id` (not direct R2 URL)
- Use approved reference sheet in sprite generation prompts
- Sprite prompts should say "Reference the {building} asset sheet in Knowledge"
- Sprites need background removal after generation

**Quality Issues Found:**
*Document any consistent issues here for prompt refinement*

| Building | Issue | Fix Applied |
|----------|-------|-------------|
| (fill in during review) | | |
