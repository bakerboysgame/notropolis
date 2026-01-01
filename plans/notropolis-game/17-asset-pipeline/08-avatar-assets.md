# Stage 08: Avatar Assets

## Objective

Generate layered avatar components (base body, skin tones, outfits, hair, accessories) that compose together for the avatar customization system. All items must be consistent with the 90s CGI character style established in the character template.

## Dependencies

`[Requires: Stage 01 complete]` - Needs asset pipeline infrastructure.
`[Requires: Character Template]` - Uses `character sheet template.jpg` as style reference.

## Blocks

`[Blocks: Stage 05 Scene Illustrations]` - **IMPORTANT:** Scene generation is blocked until avatar base assets are approved. This ensures scenes can be tested with actual avatar compositing. The API will return an error if scene generation is attempted before avatar/base_* assets are approved.

## Complexity

**High** - Multiple interrelated assets that must align perfectly for compositing.

---

## Character Reference

The base character style is defined by the character sheet template:

| Property | Value |
|----------|-------|
| File | `17-asset-pipeline/character sheet template.jpg` |
| Style | 90s CGI, chunky/stocky proportions, Pixar-like |
| Character | Middle-aged businessman |
| Views | Front, Side Profile, Back |

**Key Style Notes:**
- Chunky, exaggerated proportions (large head, stocky body)
- Smooth, slightly plastic-looking skin
- Simple, clean shapes
- Warm, saturated colors
- Expressive facial features

---

## Layer Architecture

All avatar layers must align to a fixed canvas size and position:

| Property | Value |
|----------|-------|
| Canvas Size | 512x512 pixels |
| Format | PNG with transparency |
| Alignment | Character centered, feet at bottom |

### Layer Order (bottom to top)

1. **Background** - Full canvas backdrop (no transparency)
2. **Base** - Body in neutral underwear/base clothing
3. **Skin** - Skin tone overlay (multiply blend)
4. **Outfit** - Clothing layer
5. **Hair** - Hair on top of head
6. **Headwear** - Hats, crowns on top of hair
7. **Accessory** - Glasses, watches, jewelry

---

## Asset Categories

### 1. Base Bodies (2 variants)

| ID | Name | Description |
|----|------|-------------|
| `base_1` | Standard | Average build, neutral pose |
| `base_2` | Athletic | Slightly broader shoulders |

**Generation Prompt Template:**
```
Create a 90s CGI character base body for avatar customization.

Reference style: [attach character sheet template.jpg]

Requirements:
- Full body, front-facing view
- NEUTRAL BASE ONLY: Plain white t-shirt and grey shorts
- NO glasses, NO accessories, NO hat
- Transparent background (PNG)
- 512x512 canvas, character centered
- Same chunky 90s CGI style as reference
- Skin should be a neutral mid-tone grey (will be colorized via overlay)
- Arms slightly away from body for outfit layering

Style: Pixar-like chunky 90s CGI, stocky proportions, smooth surfaces.
```

---

### 2. Skin Tones (Overlay method)

Instead of generating separate skin images, skin tones are applied as color tint/multiply overlays on the base. This is handled client-side.

**Skin Tone Palette:**

| ID | Name | Hex Color |
|----|------|-----------|
| `skin_1` | Light | `#F5D0B9` |
| `skin_2` | Medium | `#D4A574` |
| `skin_3` | Tan | `#B58863` |
| `skin_4` | Dark | `#8B5A2B` |
| `skin_5` | Deep | `#5C3A21` |

**Implementation:** These are not images - they're color values applied via CSS filter or canvas tinting to the base layer.

---

### 3. Hair Styles (6 variants)

| ID | Name | Description |
|----|------|-------------|
| `hair_1` | Short Brown | Short, neat businessman cut (like reference) |
| `hair_2` | Slicked Back | Slicked back, darker |
| `hair_3` | Bald | No hair (for combining with hats) |
| `hair_4` | Grey Executive | Distinguished grey/silver |
| `hair_5` | Mohawk | Punk style for unlockables |
| `hair_6` | Long | Longer hair, casual style |

**Generation Prompt Template:**
```
Create a hair asset for 90s CGI character avatar customization.

Hair style: [STYLE NAME]

Requirements:
- Hair ONLY, no head/face/body
- Transparent background (PNG)
- 512x512 canvas
- Hair positioned where it would sit on character's head
- Style consistent with 90s CGI chunky aesthetic
- [STYLE-SPECIFIC DETAILS]

The hair will be composited onto a base character, so ensure:
- Bottom edge has clean transparency where it meets the head
- Natural hair shape matching chunky character style
```

---

### 4. Outfits (8 variants)

| ID | Name | Description | Rarity |
|----|------|-------------|--------|
| `outfit_1` | Business Suit | Grey suit with tie (like reference) | Common |
| `outfit_2` | Casual | Polo shirt and khakis | Common |
| `outfit_3` | Hawaiian | Loud Hawaiian shirt | Uncommon |
| `outfit_4` | Prison Jumpsuit | Orange prison uniform | Common |
| `outfit_5` | Tuxedo | Formal black tux | Rare |
| `outfit_6` | Golf | Argyle sweater vest | Uncommon |
| `outfit_7` | Tracksuit | 90s style tracksuit | Uncommon |
| `outfit_8` | Gold Suit | Shiny gold suit | Legendary |

**Generation Prompt Template:**
```
Create an outfit asset for 90s CGI character avatar customization.

Outfit: [OUTFIT NAME]

Requirements:
- Clothing ONLY, must show through where body would be underneath
- Transparent background (PNG)
- 512x512 canvas
- Must align with base character pose (arms slightly away from body)
- 90s CGI chunky aesthetic, clean shapes
- [OUTFIT-SPECIFIC DETAILS]

IMPORTANT:
- NO head, NO face, NO hands (just clothing)
- Neck opening should show transparency (for skin layer)
- Sleeves should have hand openings with transparency
- Clean edges for compositing
```

---

### 5. Headwear (6 variants)

| ID | Name | Description | Rarity |
|----|------|-------------|--------|
| `head_1` | Top Hat | Classic formal top hat | Uncommon |
| `head_2` | Baseball Cap | Casual cap | Common |
| `head_3` | Fedora | Detective/noir style | Uncommon |
| `head_4` | Crown | Royal gold crown | Legendary |
| `head_5` | Hard Hat | Construction helmet | Common |
| `head_6` | Cowboy Hat | Western style | Rare |

**Generation Prompt Template:**
```
Create a headwear asset for 90s CGI character avatar customization.

Headwear: [HEADWEAR NAME]

Requirements:
- Hat/headwear ONLY
- Transparent background (PNG)
- 512x512 canvas
- Positioned where it sits on character's head
- 90s CGI chunky aesthetic
- [HEADWEAR-SPECIFIC DETAILS]

The headwear will be composited on top of hair layer.
```

---

### 6. Accessories (6 variants)

| ID | Name | Description | Rarity |
|----|------|-------------|--------|
| `acc_1` | Glasses | Silver-rimmed glasses (like reference) | Common |
| `acc_2` | Sunglasses | Dark aviator sunglasses | Common |
| `acc_3` | Watch | Gold wristwatch | Uncommon |
| `acc_4` | Cigar | Lit cigar in mouth | Rare |
| `acc_5` | Monocle | Fancy single eyepiece | Rare |
| `acc_6` | Gold Chain | Chunky gold necklace | Legendary |

**Generation Prompt Template:**
```
Create an accessory asset for 90s CGI character avatar customization.

Accessory: [ACCESSORY NAME]

Requirements:
- Accessory ONLY
- Transparent background (PNG)
- 512x512 canvas
- Positioned correctly for compositing on character
- 90s CGI chunky aesthetic
- [ACCESSORY-SPECIFIC DETAILS]

[For glasses/face items]: Position at eye level, centered
[For watches]: Position at wrist area on left arm
[For necklaces]: Position at neck/chest area
```

---

### 7. Backgrounds (4 variants)

| ID | Name | Description | Rarity |
|----|------|-------------|--------|
| `bg_1` | City Skyline | Urban backdrop with buildings | Common |
| `bg_2` | Office | Corporate office setting | Common |
| `bg_3` | Mansion | Luxury mansion background | Rare |
| `bg_4` | Money Vault | Stacks of cash backdrop | Legendary |

**Generation Prompt Template:**
```
Create a background for 90s CGI character avatar.

Background: [BACKGROUND NAME]

Requirements:
- Full 512x512 image (NO transparency)
- 90s CGI aesthetic, matching character style
- [BACKGROUND-SPECIFIC DETAILS]
- Soft focus/slight blur to not distract from character
- Centered composition with space for character overlay
```

---

## Generation Script

```javascript
#!/usr/bin/env node

const WORKER_URL = 'https://your-worker.dev';
const AUTH_TOKEN = 'your-admin-token';

// Attach the character template as reference
const CHARACTER_TEMPLATE_PATH = './character sheet template.jpg';

const avatarAssets = {
    base: [
        {
            id: 'base_1',
            name: 'Standard',
            prompt: `Create a 90s CGI character base body for avatar customization.

Reference the attached character sheet for exact style.

Requirements:
- Full body, front-facing view
- NEUTRAL BASE ONLY: Plain white t-shirt and grey shorts
- NO glasses, NO accessories, NO hat
- Transparent background (PNG)
- 512x512 canvas, character centered
- Same chunky 90s CGI style as reference
- Skin should be a neutral mid-tone (for skin overlay)
- Arms slightly away from body for outfit layering

Style: Pixar-like chunky 90s CGI, stocky proportions.`
        },
        {
            id: 'base_2',
            name: 'Athletic',
            prompt: `Create a 90s CGI character base body - ATHLETIC variant.

Reference the attached character sheet for exact style.

Requirements:
- Full body, front-facing view
- Slightly broader shoulders than standard
- NEUTRAL BASE ONLY: Plain white t-shirt and grey shorts
- NO glasses, NO accessories, NO hat
- Transparent background (PNG)
- 512x512 canvas, character centered
- Same chunky 90s CGI style but more athletic build

Style: Pixar-like chunky 90s CGI, athletic proportions.`
        }
    ],

    hair: [
        {
            id: 'hair_1',
            name: 'Short Brown',
            prompt: `Create a hair asset for 90s CGI character avatar.

Hair style: SHORT BROWN - neat businessman cut

Requirements:
- Hair ONLY, no head/face/body visible
- Dark brown color, neatly combed to side
- Transparent background (PNG)
- 512x512 canvas
- Positioned where it sits on character's head (top portion of canvas)
- 90s CGI chunky aesthetic with smooth surfaces

The hair will be composited onto a base character.`
        },
        {
            id: 'hair_2',
            name: 'Slicked Back',
            prompt: `Create a hair asset for 90s CGI character avatar.

Hair style: SLICKED BACK - dark, gelled back look

Requirements:
- Hair ONLY
- Black/very dark brown, slicked back with gel
- Transparent background (PNG)
- 512x512 canvas
- 90s CGI aesthetic

Composited onto base character.`
        },
        {
            id: 'hair_3',
            name: 'Bald',
            prompt: `Create a "bald head" asset for 90s CGI character avatar.

This is the bald/shaved head option.

Requirements:
- Just the top of head shape with no hair
- Transparent background (PNG)
- 512x512 canvas
- Shows smooth scalp matching 90s CGI style
- Slight shine on top of head

For players who prefer bald or want to show off headwear.`
        },
        {
            id: 'hair_4',
            name: 'Grey Executive',
            prompt: `Create a hair asset for 90s CGI character avatar.

Hair style: GREY EXECUTIVE - distinguished silver/grey

Requirements:
- Hair ONLY
- Silver/grey color, neatly styled
- Distinguished executive look
- Transparent background (PNG)
- 512x512 canvas
- 90s CGI aesthetic`
        },
        {
            id: 'hair_5',
            name: 'Mohawk',
            prompt: `Create a hair asset for 90s CGI character avatar.

Hair style: MOHAWK - punk style

Requirements:
- Hair ONLY
- Tall mohawk, spiky
- Bright color (leave as dark for now, color via overlay)
- Transparent background (PNG)
- 512x512 canvas
- 90s CGI aesthetic but edgy`
        },
        {
            id: 'hair_6',
            name: 'Long',
            prompt: `Create a hair asset for 90s CGI character avatar.

Hair style: LONG - shoulder-length casual

Requirements:
- Hair ONLY
- Shoulder-length, slightly wavy
- Transparent background (PNG)
- 512x512 canvas
- 90s CGI aesthetic`
        }
    ],

    outfit: [
        {
            id: 'outfit_1',
            name: 'Business Suit',
            prompt: `Create an outfit asset for 90s CGI character avatar.

Outfit: BUSINESS SUIT - grey suit with red/orange tie

Reference the attached character sheet for exact style.

Requirements:
- Grey business suit jacket and pants
- White dress shirt visible at collar
- Red/orange patterned tie
- NO head, NO face, NO hands visible
- Transparent background (PNG)
- 512x512 canvas
- Must align with base character pose
- Neck opening shows transparency
- Sleeve openings show transparency`
        },
        {
            id: 'outfit_2',
            name: 'Casual',
            prompt: `Create an outfit asset for 90s CGI character avatar.

Outfit: CASUAL - polo shirt and khakis

Requirements:
- Light blue polo shirt
- Khaki/tan pants
- NO head, NO face, NO hands
- Transparent background (PNG)
- 512x512 canvas
- Clean edges for compositing`
        },
        {
            id: 'outfit_3',
            name: 'Hawaiian',
            prompt: `Create an outfit asset for 90s CGI character avatar.

Outfit: HAWAIIAN SHIRT - loud tropical pattern

Requirements:
- Bright Hawaiian shirt with flowers/palms
- Casual shorts or pants
- NO head, NO face, NO hands
- Transparent background (PNG)
- 512x512 canvas`
        },
        {
            id: 'outfit_4',
            name: 'Prison Jumpsuit',
            prompt: `Create an outfit asset for 90s CGI character avatar.

Outfit: PRISON JUMPSUIT - orange prison uniform

Requirements:
- Bright orange prison jumpsuit
- Single piece uniform look
- NO head, NO face, NO hands
- Transparent background (PNG)
- 512x512 canvas`
        },
        {
            id: 'outfit_5',
            name: 'Tuxedo',
            prompt: `Create an outfit asset for 90s CGI character avatar.

Outfit: TUXEDO - formal black tuxedo

Requirements:
- Black tuxedo jacket with satin lapels
- White dress shirt, black bow tie
- Black pants
- NO head, NO face, NO hands
- Transparent background (PNG)
- 512x512 canvas`
        },
        {
            id: 'outfit_6',
            name: 'Golf Attire',
            prompt: `Create an outfit asset for 90s CGI character avatar.

Outfit: GOLF ATTIRE - argyle sweater vest

Requirements:
- Argyle pattern sweater vest
- Collared shirt underneath
- Golf-appropriate pants
- NO head, NO face, NO hands
- Transparent background (PNG)
- 512x512 canvas`
        },
        {
            id: 'outfit_7',
            name: 'Tracksuit',
            prompt: `Create an outfit asset for 90s CGI character avatar.

Outfit: 90s TRACKSUIT - vintage athletic wear

Requirements:
- Colorful 90s style tracksuit (think windbreaker material)
- Zippered jacket with stripe details
- Matching pants
- NO head, NO face, NO hands
- Transparent background (PNG)
- 512x512 canvas`
        },
        {
            id: 'outfit_8',
            name: 'Gold Suit',
            prompt: `Create an outfit asset for 90s CGI character avatar.

Outfit: GOLD SUIT - flashy golden suit

Requirements:
- Shiny gold/metallic suit jacket
- Matching gold pants
- Luxurious, ostentatious look
- NO head, NO face, NO hands
- Transparent background (PNG)
- 512x512 canvas`
        }
    ],

    headwear: [
        {
            id: 'head_1',
            name: 'Top Hat',
            prompt: `Create a headwear asset for 90s CGI character avatar.

Headwear: TOP HAT - classic formal

Requirements:
- Black top hat only
- Transparent background (PNG)
- 512x512 canvas
- Positioned at top of canvas where head would be
- 90s CGI chunky aesthetic`
        },
        {
            id: 'head_2',
            name: 'Baseball Cap',
            prompt: `Create a headwear asset for 90s CGI character avatar.

Headwear: BASEBALL CAP - casual cap

Requirements:
- Baseball cap, neutral color
- Transparent background (PNG)
- 512x512 canvas
- Positioned correctly for head`
        },
        {
            id: 'head_3',
            name: 'Fedora',
            prompt: `Create a headwear asset for 90s CGI character avatar.

Headwear: FEDORA - detective/noir style

Requirements:
- Classic fedora hat
- Dark grey/brown color
- Transparent background (PNG)
- 512x512 canvas`
        },
        {
            id: 'head_4',
            name: 'Crown',
            prompt: `Create a headwear asset for 90s CGI character avatar.

Headwear: ROYAL CROWN - golden king's crown

Requirements:
- Ornate golden crown with jewels
- Regal, impressive look
- Transparent background (PNG)
- 512x512 canvas`
        },
        {
            id: 'head_5',
            name: 'Hard Hat',
            prompt: `Create a headwear asset for 90s CGI character avatar.

Headwear: HARD HAT - construction helmet

Requirements:
- Yellow construction hard hat
- Transparent background (PNG)
- 512x512 canvas`
        },
        {
            id: 'head_6',
            name: 'Cowboy Hat',
            prompt: `Create a headwear asset for 90s CGI character avatar.

Headwear: COWBOY HAT - western style

Requirements:
- Brown leather cowboy hat
- Wide brim
- Transparent background (PNG)
- 512x512 canvas`
        }
    ],

    accessory: [
        {
            id: 'acc_1',
            name: 'Glasses',
            prompt: `Create an accessory asset for 90s CGI character avatar.

Accessory: GLASSES - silver-rimmed reading glasses

Reference the attached character sheet for style.

Requirements:
- Silver/metal rimmed glasses only
- Positioned at eye level
- Transparent background (PNG)
- 512x512 canvas
- Match the style from the character reference`
        },
        {
            id: 'acc_2',
            name: 'Sunglasses',
            prompt: `Create an accessory asset for 90s CGI character avatar.

Accessory: SUNGLASSES - dark aviator style

Requirements:
- Dark aviator sunglasses
- Positioned at eye level
- Transparent background (PNG)
- 512x512 canvas`
        },
        {
            id: 'acc_3',
            name: 'Watch',
            prompt: `Create an accessory asset for 90s CGI character avatar.

Accessory: WATCH - gold wristwatch

Requirements:
- Fancy gold wristwatch
- Positioned at left wrist area
- Transparent background (PNG)
- 512x512 canvas`
        },
        {
            id: 'acc_4',
            name: 'Cigar',
            prompt: `Create an accessory asset for 90s CGI character avatar.

Accessory: CIGAR - lit cigar

Requirements:
- Lit cigar positioned at mouth area
- Small smoke wisps
- Transparent background (PNG)
- 512x512 canvas`
        },
        {
            id: 'acc_5',
            name: 'Monocle',
            prompt: `Create an accessory asset for 90s CGI character avatar.

Accessory: MONOCLE - fancy single eyepiece

Requirements:
- Gold monocle with chain
- Positioned over one eye
- Transparent background (PNG)
- 512x512 canvas`
        },
        {
            id: 'acc_6',
            name: 'Gold Chain',
            prompt: `Create an accessory asset for 90s CGI character avatar.

Accessory: GOLD CHAIN - chunky necklace

Requirements:
- Thick gold chain necklace
- Positioned at neck/chest area
- Transparent background (PNG)
- 512x512 canvas`
        }
    ],

    background: [
        {
            id: 'bg_1',
            name: 'City Skyline',
            prompt: `Create a background for 90s CGI character avatar.

Background: CITY SKYLINE

Requirements:
- Full 512x512 image, no transparency
- 90s CGI aesthetic matching character style
- Urban skyline with office buildings
- Soft focus, not too detailed
- Daylight lighting`
        },
        {
            id: 'bg_2',
            name: 'Office',
            prompt: `Create a background for 90s CGI character avatar.

Background: CORPORATE OFFICE

Requirements:
- Full 512x512 image, no transparency
- 90s CGI aesthetic
- Office interior with desk, window, plants
- Professional corporate feel
- Soft lighting`
        },
        {
            id: 'bg_3',
            name: 'Mansion',
            prompt: `Create a background for 90s CGI character avatar.

Background: LUXURY MANSION

Requirements:
- Full 512x512 image, no transparency
- 90s CGI aesthetic
- Mansion interior or exterior
- Wealth and luxury feel
- Rich colors`
        },
        {
            id: 'bg_4',
            name: 'Money Vault',
            prompt: `Create a background for 90s CGI character avatar.

Background: MONEY VAULT

Requirements:
- Full 512x512 image, no transparency
- 90s CGI aesthetic
- Vault filled with cash and gold
- Wealth and success theme
- Dramatic lighting`
        }
    ]
};

async function generateAsset(category, item, characterTemplate) {
    const formData = new FormData();
    formData.append('category', `avatar_${category}`);
    formData.append('asset_key', item.id);
    formData.append('prompt', item.prompt);
    formData.append('variant', 1);

    // Attach character template as reference image (for base/outfit generation)
    if (['base', 'outfit', 'accessory'].includes(category) && characterTemplate) {
        formData.append('reference_image', characterTemplate);
    }

    const response = await fetch(`${WORKER_URL}/api/admin/assets/generate`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${AUTH_TOKEN}`
        },
        body: formData
    });

    return response.json();
}

async function main() {
    const fs = require('fs');
    const characterTemplate = fs.readFileSync(CHARACTER_TEMPLATE_PATH);

    console.log('Generating avatar assets...\n');

    for (const [category, items] of Object.entries(avatarAssets)) {
        console.log(`\n=== ${category.toUpperCase()} ===`);

        for (const item of items) {
            console.log(`  Generating: ${item.name}...`);

            const result = await generateAsset(category, item, characterTemplate);
            console.log(`    ${result.success ? '✓' : '✗'} ${result.url || result.error}`);

            // Rate limiting pause
            await new Promise(r => setTimeout(r, 3000));
        }
    }

    console.log('\n✓ Avatar asset generation complete! Review and approve in admin panel.');
}

main().catch(console.error);
```

---

## Post-Processing

After generation, each asset needs:

1. **Background Removal** (except backgrounds category)
   - Use Removal.ai API or manual cleanup
   - Ensure clean transparency edges

2. **Alignment Verification**
   - Overlay all layers to check alignment
   - Adjust positioning if needed

3. **Size Consistency**
   - All assets must be exactly 512x512
   - Character centered consistently

---

## Seed Data Update

Update the avatar_items seed data in the migration to match generated assets:

```sql
-- Update seed data after generation
-- Replace r2_key values with actual generated asset paths

UPDATE avatar_items SET r2_key = 'avatars/base/standard.png' WHERE id = 'base_1';
UPDATE avatar_items SET r2_key = 'avatars/base/athletic.png' WHERE id = 'base_2';
-- ... etc for all items
```

---

## Test Cases

| Test | Input | Expected Output |
|------|-------|-----------------|
| Layer alignment | Stack all layers | Character looks correct |
| Transparency | View on checkered bg | Clean edges, no halos |
| Size consistency | Measure all assets | All 512x512 |
| Compositing | Load in avatar preview | Layers blend correctly |
| Skin tint | Apply skin color | Natural skin appearance |

---

## Acceptance Checklist

- [ ] 2 base body variants generated and approved
- [ ] 6 hair styles generated with clean transparency
- [ ] 8 outfits generated, aligned with base pose
- [ ] 6 headwear items generated
- [ ] 6 accessories generated
- [ ] 4 backgrounds generated
- [ ] All assets are 512x512 PNG
- [ ] All assets (except backgrounds) have transparent backgrounds
- [ ] Layer alignment verified by compositing test
- [ ] Assets uploaded to R2: `avatars/{category}/{id}.png`
- [ ] Database seed data updated with actual R2 keys

---

## Deployment

```bash
# 1. Generate assets
node scripts/generate-avatar-assets.js

# 2. Review and approve in admin panel

# 3. Process approved assets (background removal)
# Via admin panel or batch script

# 4. Upload to R2
# Assets automatically go to notropolis-avatars bucket

# 5. Verify in avatar customization page
```

---

## Handoff Notes

**For Avatar System:**
- All avatar items must be consistently positioned for compositing
- Skin tones are CSS filters, not separate images
- Test compositing in the Avatar page preview component

**For Scene Compositing:**
- Avatar composites (flattened layers) are cached when user saves
- Scene templates use these cached composites for faster rendering
- Cache invalidates when avatar changes
