# Stage 08: Avatar Assets

## Objective

Generate layered avatar components (base body, skin tones, outfits, hair, accessories) that compose together for the avatar customization system. All items must be consistent with the 90s CGI character style established in the character template.

## Dependencies

`[Requires: Stage 01 complete]` - Needs asset pipeline infrastructure.
`[Requires: Character Template]` - Uses `character sheet template.jpg` as style reference.

## Blocks

`[Blocks: Stage 05 Scene Illustrations]` - **IMPORTANT:** Scene generation is blocked until avatar base assets are approved. This ensures scenes can be tested with actual avatar compositing. The API will return an error if scene generation is attempted before avatar/base_* assets are approved.

## Test Credentials

**REQUIRED:** Use tokens from `authentication-dashboard-system/docs/REFERENCE-test-tokens/CLAUDE.md` for all API testing.

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
| `base_standard` | Standard | Average build, neutral pose |
| `base_athletic` | Athletic | Slightly broader shoulders |

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
| `hair_short` | Short | Short, neat businessman cut (like reference) |
| `hair_slicked` | Slicked Back | Slicked back, shiny, product-styled |
| `hair_bald` | Bald | No hair (for combining with hats) |
| `hair_curly` | Curly | Chunky stylized curls, medium length |
| `hair_mohawk` | Mohawk | Punk style for unlockables |
| `hair_long` | Long | Longer hair, casual style |

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
| `outfit_suit` | Business Suit | Grey suit with tie (like reference) | Common |
| `outfit_casual` | Casual | Polo shirt and khakis | Common |
| `outfit_tropical` | Tropical | Hawaiian shirt, vacation attire | Uncommon |
| `outfit_prison` | Prison Jumpsuit | Orange prison uniform | Common |
| `outfit_formal` | Formal | Black tie formal wear, tuxedo | Rare |
| `outfit_street` | Street | Hoodie, sneakers, urban fashion | Uncommon |
| `outfit_flashy` | Flashy | Bright colors, gold accessories | Uncommon |
| `outfit_gold_legendary` | Gold Suit | Shiny metallic gold suit | Legendary |

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
| `headwear_tophat` | Top Hat | Classic formal top hat | Uncommon |
| `headwear_cap` | Baseball Cap | Casual cap | Common |
| `headwear_fedora` | Fedora | Detective/noir style | Uncommon |
| `headwear_crown_legendary` | Crown | Royal gold crown with jewels | Legendary |
| `headwear_hardhat` | Hard Hat | Construction helmet | Common |
| `headwear_beanie` | Beanie | Knit beanie, urban style | Common |

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
| `accessory_sunglasses` | Sunglasses | Dark aviator sunglasses | Common |
| `accessory_watch` | Watch | Luxury wristwatch | Uncommon |
| `accessory_cigar` | Cigar | Lit cigar in mouth | Rare |
| `accessory_briefcase` | Briefcase | Professional leather briefcase | Common |
| `accessory_chain` | Gold Chain | Chunky gold necklace | Uncommon |
| `accessory_earring` | Earring | Stud or small hoop | Common |

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
| `background_city` | City Skyline | Urban backdrop with skyscrapers | Common |
| `background_office` | Office | Executive office with city view | Common |
| `background_mansion` | Mansion | Luxury mansion interior/exterior | Rare |
| `background_prison` | Prison | Prison cell or yard backdrop | Common |

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

## API Usage

Avatar asset prompts are pre-built in `worker/src/routes/admin/assets.js`. Generate assets via the API:

### All Avatar Asset Keys (32 total)

```
BASE (2):       base_standard, base_athletic
HAIR (6):       hair_short, hair_slicked, hair_bald, hair_curly, hair_mohawk, hair_long
OUTFIT (8):     outfit_suit, outfit_casual, outfit_tropical, outfit_prison, outfit_formal,
                outfit_street, outfit_flashy, outfit_gold_legendary
HEADWEAR (6):   headwear_tophat, headwear_cap, headwear_fedora, headwear_crown_legendary,
                headwear_hardhat, headwear_beanie
ACCESSORY (6):  accessory_sunglasses, accessory_watch, accessory_cigar, accessory_briefcase,
                accessory_chain, accessory_earring
BACKGROUND (4): background_city, background_office, background_mansion, background_prison
```

### Generate Single Asset

```bash
# Using Python (recommended - see CLAUDE.md for token)
python3 -c "
import urllib.request
import json

with open('/tmp/token.txt', 'r') as f:
    token = f.read().strip()

data = json.dumps({
    'category': 'avatar',
    'asset_key': 'base_standard'
}).encode('utf-8')

req = urllib.request.Request(
    'https://api.notropolis.net/api/admin/assets/generate',
    data=data,
    headers={
        'Authorization': f'Bearer {token}',
        'Content-Type': 'application/json'
    },
    method='POST'
)

with urllib.request.urlopen(req) as resp:
    print(json.dumps(json.loads(resp.read()), indent=2))
"
```

### Generate All Avatar Assets (Batch)

```bash
# Generate all 32 avatar assets
for key in base_standard base_athletic \
           hair_short hair_slicked hair_bald hair_curly hair_mohawk hair_long \
           outfit_suit outfit_casual outfit_tropical outfit_prison outfit_formal outfit_street outfit_flashy outfit_gold_legendary \
           headwear_tophat headwear_cap headwear_fedora headwear_crown_legendary headwear_hardhat headwear_beanie \
           accessory_sunglasses accessory_watch accessory_cigar accessory_briefcase accessory_chain accessory_earring \
           background_city background_office background_mansion background_prison
do
    echo "Generating: $key"
    python3 -c "
import urllib.request, json
with open('/tmp/token.txt') as f: token = f.read().strip()
data = json.dumps({'category': 'avatar', 'asset_key': '$key'}).encode()
req = urllib.request.Request('https://api.notropolis.net/api/admin/assets/generate', data=data, headers={'Authorization': f'Bearer {token}', 'Content-Type': 'application/json'}, method='POST')
with urllib.request.urlopen(req) as r: print(json.loads(r.read()).get('message', 'OK'))
"
    sleep 3  # Rate limiting
done
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

After assets are generated and approved, update the avatar_items table:

```sql
-- Update seed data after generation
-- R2 keys are set automatically by the pipeline

-- Verify assets exist:
SELECT id, category, r2_key, r2_url
FROM avatar_items
WHERE r2_key IS NOT NULL;
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

- [x] 2 base bodies (`base_standard`, `base_athletic`) generated and approved
- [x] 6 hair styles generated with clean transparency
- [x] 8 outfits generated, aligned with base pose
- [x] 6 headwear items generated
- [x] 6 accessories generated
- [x] 4 backgrounds generated (no transparency)
- [x] All 32 assets are 512x512 PNG
- [x] All assets (except backgrounds) have transparent backgrounds
- [x] Layer alignment verified by compositing test
- [x] Assets in private bucket: `avatars/{asset_key}_v1.png`
- [x] Background removal applied (except background_* assets)
- [x] Published to public bucket as PNG (for compositing)
- [x] Database `generated_assets` table has all 32 avatar entries

**Completed:** 2026-01-02 by Claude Code

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
