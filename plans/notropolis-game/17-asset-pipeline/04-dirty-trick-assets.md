# Stage 04: Effect Assets (Dirty Tricks + Status Effects)

## Objective

Generate overlay sprites for all 12 effect types: 6 dirty trick attack effects and 6 status effect overlays, with transparent backgrounds for layering on buildings.

## Dependencies

`[Requires: Stage 03 complete]` - Building sprites should be available for overlay testing.

## Complexity

**Medium** - Effect overlays must work on any building type.

---

## Files to Create

| File | Purpose |
|------|---------|
| `scripts/generate-dirty-trick-refs.js` | Dirty trick reference sheet generation |
| `scripts/generate-dirty-trick-sprites.js` | Dirty trick overlay sprite generation |
| `scripts/generate-status-effects.js` | Status effect overlay generation |

---

## Part A: Dirty Trick Attack Effects (6 types)

These are attack effects shown during dirty trick actions on rival buildings.

| # | Effect | Description | Visual Elements |
|---|--------|-------------|-----------------|
| 1 | Cluster Bomb | Explosive attack | Smoke plumes, fire bursts, grey dust clouds, sparks, scorch marks |
| 2 | Arson | Fire attack | Flames, heavy smoke, embers, orange glow, charring |
| 3 | Vandalism | Property damage | Spray paint marks, broken glass, graffiti, trash |
| 4 | Robbery | Theft attack | Broken windows, open door, scattered papers/money, chaos |
| 5 | Poisoning | Chemical attack | Green toxic clouds, bubbling puddles, wilted plants, gas masks |
| 6 | Blackout | Power disruption | Darkness overlay, electrical sparks, broken lights, blue arcs |

---

## Part B: Status Effect Overlays (6 types)

These show current building status/health on the map.

| # | Effect | Size | Description |
|---|--------|------|-------------|
| 1 | fire | 64×64 | Flames on building (fire damage indicator) |
| 2 | damage_25 | 64×64 | Light damage cracks/wear at 25% health |
| 3 | damage_50 | 64×64 | Medium damage at 50% health |
| 4 | damage_75 | 64×64 | Heavy damage/near destruction at 75% health |
| 5 | for_sale | 24×24 | Small "For Sale" sign indicator |
| 6 | security | 24×24 | Shield/camera security icon |

---

## Critical Rules for Effects

From [Ref: 16a-asset-requirements.md]:

> **UNIVERSAL EFFECTS**: Dirty trick effects must work on ANY building type (from canvas tent to stone temple). Avoid specific building materials in effects. Use only universal elements: smoke, fire, sparks, generic debris, dust clouds.

**DO NOT include:**
- Brick debris (specific to brick buildings)
- Wood splinters (specific to wooden buildings)
- Specific building parts
- Any building structure visible

**DO include:**
- Smoke, fire, sparks (universal)
- Generic grey/black debris particles
- Dust clouds
- Light effects (glow, sparks)
- Abstract damage patterns

---

## Implementation Details

### Reference Sheet Prompts

```javascript
const effects = [
    {
        key: 'cluster_bomb',
        name: 'Cluster Bomb',
        description: `An explosive attack effect overlay.

Visual elements (NO BUILDING - effects ONLY):
- Multiple smoke plumes rising at different heights
- Orange and yellow fire bursts at impact points
- Grey dust clouds spreading outward
- Bright sparks and embers flying
- Scorch marks on an invisible ground plane
- Debris particles (generic grey/black chunks, NOT specific materials)

The effect should look like multiple small explosions happening simultaneously.
Dramatic, destructive, chaotic but clearly "attack in progress".`
    },
    {
        key: 'arson',
        name: 'Arson',
        description: `A fire attack effect overlay.

Visual elements (NO BUILDING - effects ONLY):
- Tall flames rising from multiple points
- Heavy black and grey smoke billowing upward
- Orange and red fire glow
- Floating embers and sparks
- Heat distortion effect (wavy air)
- Char marks on invisible surfaces

The fire should look like it's consuming something, spreading and intense.
Classic "building on fire" flames without showing the building.`
    },
    {
        key: 'vandalism',
        name: 'Vandalism',
        description: `A property damage effect overlay.

Visual elements (NO BUILDING - effects ONLY):
- Spray paint marks and drips in bright colors (red, blue, green)
- Broken glass shards scattered
- Generic graffiti tags/scribbles (no readable text)
- Overturned trash/debris
- Egg splatter marks
- Toilet paper streamers

The effect should look like hoodlums attacked the property.
Messy, disrespectful, vandalized appearance.`
    },
    {
        key: 'robbery',
        name: 'Robbery',
        description: `A theft attack effect overlay.

Visual elements (NO BUILDING - effects ONLY):
- Broken glass shards (from windows)
- Scattered papers and documents
- Open/broken safe or lockbox
- Money bills floating in air
- Crowbar or tools left behind
- Alarm bell ringing (motion lines)
- "Smash and grab" chaos

The effect should look like a heist just happened.
Frantic, chaotic, evidence of break-in.`
    },
    {
        key: 'poisoning',
        name: 'Poisoning',
        description: `A chemical attack effect overlay.

Visual elements (NO BUILDING - effects ONLY):
- Green toxic clouds/gas spreading
- Bubbling puddles of noxious liquid
- Wilted/dead plants or flowers
- Warning symbols floating
- Flies or insects swarming
- Dripping toxic residue
- Sickly yellow-green color palette

The effect should look hazardous and contaminated.
Biohazard feel, toxic waste, dangerous atmosphere.`
    },
    {
        key: 'blackout',
        name: 'Blackout',
        description: `A power disruption effect overlay.

Visual elements (NO BUILDING - effects ONLY):
- Semi-transparent darkness/shadow overlay
- Blue electrical sparks and arcs
- Broken light bulb shards
- Dangling/cut wires with sparks
- Lightning bolt shapes
- Flickering effect elements
- Power-out darkness with sparks of light

The effect should look like the power was cut violently.
Dark, electrical chaos, disrupted infrastructure.`
    }
];
```

### Reference Sheet Generation Script

```javascript
#!/usr/bin/env node

const WORKER_URL = 'https://your-worker.dev';
const AUTH_TOKEN = 'your-admin-token';

// Effects defined above...

function buildRefPrompt(effect) {
    return `Create an effect reference sheet for ${effect.name.toUpperCase()} dirty trick attack.

Layout: Multi-view reference sheet with labeled views
- Gray background (#808080)
- White border boxes around each view
- Views: EFFECT ELEMENTS (top), 45 DEGREE OVERLAY (middle), ANIMATION FRAMES (bottom, optional)
- Title: "EFFECT REFERENCE SHEET: 90s CGI ${effect.name.toUpperCase()}"

${effect.description}

CRITICAL RULES:
- NO BUILDING VISIBLE - only the effect elements
- Effects must be UNIVERSAL - work on any building type
- NO specific building materials (no bricks, wood planks, etc.)
- Use only: smoke, fire, sparks, generic debris, dust, light effects
- 45-degree isometric angle matching building perspective
- Transparent-ready (will be overlaid on buildings)

Style: 90s CGI chunky aesthetic with modern render quality.
Dramatic, visible, clearly communicates "attack effect".`;
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
    console.log('Generating dirty trick reference sheets...\n');

    for (const effect of effects) {
        const prompt = buildRefPrompt(effect);
        console.log(`Generating: ${effect.name}`);

        for (let v = 1; v <= 2; v++) {
            console.log(`  Variant ${v}...`);
            const result = await generateAsset('dirty_trick_ref', effect.key, prompt, v);
            console.log(`    ${result.success ? '✓' : '✗'} ${result.url || result.error}`);
            await new Promise(r => setTimeout(r, 2000));
        }

        await new Promise(r => setTimeout(r, 3000));
    }

    console.log('\n✓ Reference sheets complete! Review and approve before sprites.');
}

main().catch(console.error);
```

### Overlay Sprite Generation Script

```javascript
#!/usr/bin/env node

const WORKER_URL = 'https://your-worker.dev';
const AUTH_TOKEN = 'your-admin-token';

// Same effects array...

function buildSpritePrompt(effect) {
    return `Create a dirty trick overlay sprite for ${effect.name.toUpperCase()}.

REFERENCE: Match the ${effect.name} reference sheet in Knowledge.

Format: 45-degree isometric overlay, single image
Canvas: 320 x 320 px (will be scaled to fit buildings)
Background: Solid bright green (#00FF00) for easy removal
Purpose: This will be OVERLAID on top of building sprites

${effect.description}

CRITICAL REQUIREMENTS:
- NO BUILDING VISIBLE - effect elements ONLY
- 45-degree isometric angle (matching building perspective)
- Effect sized to cover a typical building footprint
- SOLID GREEN BACKGROUND (#00FF00)
- Universal elements only (no building-specific debris)
- Clean edges for background removal

The effect should be centered and fill the canvas appropriately.
It will be composited on top of various building types.

Style: 90s CGI aesthetic with modern render quality.
Dramatic, impactful, clearly visible attack effect.`;
}

async function main() {
    console.log('Generating dirty trick overlay sprites...\n');

    for (const effect of effects) {
        const prompt = buildSpritePrompt(effect);
        console.log(`Generating: ${effect.name}`);

        for (let v = 1; v <= 2; v++) {
            console.log(`  Variant ${v}...`);
            const result = await generateAsset('dirty_trick_sprite', effect.key, prompt, v);
            console.log(`    ${result.success ? '✓' : '✗'} ${result.url || result.error}`);
            await new Promise(r => setTimeout(r, 2000));
        }

        await new Promise(r => setTimeout(r, 3000));
    }

    console.log('\n✓ Sprites generated! Run background removal next.');
}

main().catch(console.error);
```

---

## Workflow

### Phase A: Reference Sheets

1. Generate reference sheets (2 variants each)
2. **MANUAL REVIEW CHECKPOINT**
   - Check effects are universal (no building materials)
   - Verify visual clarity and impact
   - Approve best variants

### Phase B: Overlay Sprites

1. Generate overlay sprites from approved refs
2. Remove backgrounds (green → transparent)
3. **MANUAL REVIEW CHECKPOINT**
   - Test overlay on sample buildings
   - Check transparent edges are clean
   - Approve best variants

---

## Test Cases

### 1. Overlay Test

Composite a dirty trick sprite onto a building sprite:

```javascript
// Pseudocode for testing
const building = loadImage('building_restaurant.png');
const effect = loadImage('effect_arson_transparent.png');

// Effect should overlay building cleanly
const composite = overlayImages(building, effect);
saveImage(composite, 'test_overlay.png');
```

### 2. Scale Test

Test effect at different building sizes:
- 128×128 (SHORT buildings)
- 192×192 (MEDIUM buildings)
- 256×256 (TALL buildings)
- 320×320 (VERY TALL buildings)

Effect should scale appropriately and still look good.

---

## Acceptance Checklist

- [ ] All 6 effect reference sheets generated (2 variants each)
- [ ] Reference sheets show ONLY effects, no buildings
- [ ] No building-specific materials in effects
- [ ] 1 variant approved per effect
- [ ] All 6 overlay sprites generated (2 variants each)
- [ ] Backgrounds removed, transparent PNGs ready
- [ ] Effects tested overlaid on building sprites
- [ ] Effects scale appropriately to all building sizes
- [ ] Final sprites uploaded to `sprites/effects/` in R2

---

## Deployment

```bash
# 1. Generate effect reference sheets
node scripts/generate-dirty-trick-refs.js

# 2. Review and approve refs (manual)

# 3. Generate overlay sprites
node scripts/generate-dirty-trick-sprites.js

# 4. Remove backgrounds
# Use batch-remove-backgrounds.js with 'dirty_trick_sprite' category

# 5. Test overlays on buildings

# 6. Approve and finalize
```

---

## Handoff Notes

**For Stage 05:**
- Dirty trick overlays complete
- Same general approach for scene illustrations
- Scenes don't need transparency (full backgrounds)
- Scenes may include characters (90s CGI style characters)

**Effect Usage in Game:**
- Overlay sprites at `sprites/effects/{effect_key}_transparent.png`
- Scale to match building size when applying
- Z-index above building sprite
- May need animation (future enhancement)

---

## Part B: Status Effect Implementation

### Status Effect Prompts

```javascript
const statusEffects = [
    {
        key: 'fire',
        name: 'Fire Effect',
        size: '64x64',
        prompt: `Create a status effect overlay for FIRE.

Format: 45-degree isometric view
Canvas: 64 x 64 px
Background: TRANSPARENT (PNG-ready)
Purpose: Shows building is on fire/burning

Visual elements:
- Bright orange and yellow flames rising
- Dark smoke wisps
- Glowing embers
- Flickering fire tongues

The effect should overlay on any building to indicate fire damage.
Dramatic but not overwhelming - clearly visible indicator.

Style: 90s CGI aesthetic with modern render quality. Stylized flames.`
    },
    {
        key: 'damage_25',
        name: 'Light Damage (25%)',
        size: '64x64',
        prompt: `Create a status effect overlay for LIGHT DAMAGE (25% health).

Format: 45-degree isometric view
Canvas: 64 x 64 px
Background: TRANSPARENT (PNG-ready)
Purpose: Shows building has minor damage

Visual elements:
- Scattered dust particles
- Thin smoke wisps
- Generic scratches and scuffs
- Minor debris

Subtle damage indication - building is slightly worn/damaged.

Style: 90s CGI aesthetic. Minimal but visible damage state.`
    },
    {
        key: 'damage_50',
        name: 'Medium Damage (50%)',
        size: '64x64',
        prompt: `Create a status effect overlay for MEDIUM DAMAGE (50% health).

Format: 45-degree isometric view
Canvas: 64 x 64 px
Background: TRANSPARENT (PNG-ready)
Purpose: Shows building has moderate damage

Visual elements:
- More prominent dust and debris
- Multiple smoke wisps
- Larger rubble pieces (generic grey)
- Scorch marks

Noticeable damage - building is clearly damaged but still standing.

Style: 90s CGI aesthetic. Moderate damage visibility.`
    },
    {
        key: 'damage_75',
        name: 'Heavy Damage (75%)',
        size: '64x64',
        prompt: `Create a status effect overlay for HEAVY DAMAGE (75% health).

Format: 45-degree isometric view
Canvas: 64 x 64 px
Background: TRANSPARENT (PNG-ready)
Purpose: Shows building is severely damaged

Visual elements:
- Heavy dust and smoke
- Significant debris field
- Sparks and embers
- Structural collapse hints
- Near-destruction state

Dramatic damage - building is barely standing.

Style: 90s CGI aesthetic. Severe damage, dramatic effect.`
    },
    {
        key: 'for_sale',
        name: 'For Sale Sign',
        size: '24x24',
        prompt: `Create a small FOR SALE indicator icon.

Format: Small 3D sign with slight perspective
Canvas: 24 x 24 px
Background: TRANSPARENT (PNG-ready)
Purpose: Shows building is for sale on the map

Visual elements:
- Small wooden or metal sign post
- Hanging "FOR SALE" placard
- Red and white coloring
- Classic real estate sign style

Simple, recognizable at small size.

Style: 90s CGI aesthetic. Country-neutral (no currency symbols).`
    },
    {
        key: 'security',
        name: 'Security Icon',
        size: '24x24',
        prompt: `Create a small SECURITY indicator icon.

Format: Small icon with slight 3D perspective
Canvas: 24 x 24 px
Background: TRANSPARENT (PNG-ready)
Purpose: Shows building has security protection

Visual elements:
- Shield shape with checkmark OR
- Small security camera
- Blue and silver coloring
- Protective, secure feeling

Simple, recognizable at small size.

Style: 90s CGI aesthetic. Instantly reads as "protected/secure".`
    }
];
```

### Status Effect Generation Script: `scripts/generate-status-effects.js`

```javascript
#!/usr/bin/env node

const WORKER_URL = 'https://notropolis-api.rikisenia.workers.dev';
const AUTH_TOKEN = 'your-admin-token';

// statusEffects array defined above...

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
    console.log('Generating status effect overlays...\n');

    for (const effect of statusEffects) {
        console.log(`Generating: ${effect.name} (${effect.size})`);

        const result = await generateAsset('status_effect', effect.key, effect.prompt, 1);
        console.log(`  ${result.success ? '✓' : '✗'} ${result.url || result.error}`);

        await new Promise(r => setTimeout(r, 2000));
    }

    console.log('\n✓ Status effects complete!');
}

main().catch(console.error);
```

---

## Updated Acceptance Checklist

### Part A: Dirty Trick Effects
- [ ] All 6 dirty trick reference sheets generated (2 variants each)
- [ ] Reference sheets show ONLY effects, no buildings
- [ ] No building-specific materials in effects
- [ ] 1 variant approved per effect
- [ ] All 6 dirty trick overlay sprites generated
- [ ] Backgrounds removed, transparent PNGs ready
- [ ] Effects tested overlaid on building sprites

### Part B: Status Effects
- [ ] All 6 status effect overlays generated
- [ ] fire, damage_25, damage_50, damage_75 work on buildings
- [ ] for_sale, security icons are visible at small size
- [ ] All transparent PNGs ready
- [ ] Effects uploaded to `sprites/effects/` in R2

---

## R2 Storage Structure

```
sprites/
└── effects/
    ├── dirty_trick_cluster_bomb.png
    ├── dirty_trick_arson.png
    ├── dirty_trick_vandalism.png
    ├── dirty_trick_robbery.png
    ├── dirty_trick_poisoning.png
    ├── dirty_trick_blackout.png
    ├── status_fire.png
    ├── status_damage_25.png
    ├── status_damage_50.png
    ├── status_damage_75.png
    ├── status_for_sale.png
    └── status_security.png
```
