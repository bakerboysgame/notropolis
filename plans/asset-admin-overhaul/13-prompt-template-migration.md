# Stage 13: Prompt Template Migration

## Objective

Update all prompt templates in the database with:
1. **Square tile format** (64x64) instead of diamond isometric (64x32 or 128x64)
2. **System instructions** from the Gemini Gem configuration
3. **Comprehensive prompts** from the documented asset specifications
4. Preserve avatar templates unchanged

## Current State

The `prompt_templates` table has:
- `base_prompt` - The generation prompt (shown in modal)
- `system_instructions` - Currently NULL for all templates
- `style_guide` - Optional style notes

Existing categories with templates:
- `_global` (style guide)
- `avatar` (SKIP - keeping as-is)
- `building_ref`, `building_sprite`
- `terrain`, `terrain_ref`
- `effect`, `effect_ref`
- `npc`, `character_ref`
- `vehicle_ref`
- `scene`, `overlay`, `ui`

## Key Changes

### 1. Diamond to Square

| Before | After |
|--------|-------|
| Diamond 64x32 | Square 64x64 |
| Diamond 128x64 | Square 64x64 |
| "rhombus" shape | Square canvas |
| 2:1 isometric | Elevated 45° view |

### 2. System Instructions

Add the Gemini Gem system prompt to all templates as `system_instructions`.

### 3. Prompt Updates

Replace placeholder prompts with comprehensive prompts from [16a-asset-requirements.md](../notropolis-game/16a-asset-requirements.md).

---

## Migration SQL

### File: `migrations/0031_update_prompt_templates.sql`

```sql
-- Migration: 0031_update_prompt_templates.sql
-- Purpose: Update prompt templates with square format and system instructions
-- Date: 2026-01-02

-- ============================================
-- GLOBAL SYSTEM INSTRUCTIONS
-- This gets copied to all non-avatar templates
-- ============================================

-- First, store the system instructions in a _global template
UPDATE prompt_templates
SET system_instructions = 'You are an asset generator for "Notropolis", a business simulation game with a distinctive 90s CGI aesthetic. Your role is to create consistent, high-quality visual assets that match the established style.

## VISUAL STYLE

The art direction is RETRO 90s CGI, but rendered with MODERN quality.

Style (what to replicate):
- Chunky, geometric 3D forms with visible polygonal edges
- Slightly exaggerated proportions (stocky characters, blocky buildings)
- Muted, slightly desaturated color palette
- Subtle texture detail (brick patterns, fabric weaves)
- Clean, professional feel (think RenderWare, early Pixar, SimCity 3000)

Render Quality (modern polish):
- Soft ambient occlusion in corners and under overhangs
- Subtle global illumination / bounced light
- Gentle rim lighting to separate edges from background
- Soft shadows (not harsh or pixelated)
- Clean, smooth surface rendering (no noise or grain)
- Subtle specular highlights on appropriate materials
- Defined material separation
- High resolution, crisp edges with clean anti-aliasing
- Professional studio lighting setup
- "Box art" or "promotional render" quality

Lighting direction: Consistent top-left lighting across all assets.

## CRITICAL RULES

### SQUARE CANVAS
All game sprites use a SQUARE canvas (64x64, 128x128, 192x192, 256x256, or 320x320 depending on asset type).

### BUILDING ORIENTATION
For ALL building sprites and reference sheets, the 45 DEGREE ISOMETRIC VIEW must have the entry point/door positioned on the BOTTOM LEFT side.

### COUNTRY-NEUTRAL
All assets must be COUNTRY-NEUTRAL. No national flags, country-specific signage, currency symbols, or region-specific elements.

### CLEAN ASSETS
All assets must show ONLY the subject itself. No vehicles, people, animals, or surrounding objects unless specifically requested.

### TRANSPARENT BACKGROUNDS
All sprites require transparent PNG backgrounds unless specifically stated otherwise.'
WHERE category = '_global' AND asset_key = '_style_guide';

-- ============================================
-- TERRAIN TILES - Updated to SQUARE 64x64
-- ============================================

-- Default terrain template
UPDATE prompt_templates
SET base_prompt = 'Create a terrain tile sprite for {TERRAIN_TYPE}.

Format: 45-degree elevated view
Canvas: 64 x 64 pixels SQUARE
Background: TRANSPARENT (PNG-ready)

The terrain should be viewed from an elevated angle, showing depth and texture.
The tile should connect seamlessly with adjacent identical tiles.

{CUSTOM_DETAILS}

Style: 90s CGI aesthetic with modern render quality. Clean edges, soft shadows.',
    system_instructions = (SELECT system_instructions FROM prompt_templates WHERE category = '_global' AND asset_key = '_style_guide')
WHERE category = 'terrain' AND asset_key = '_default';

-- Grass terrain
INSERT OR REPLACE INTO prompt_templates (category, asset_key, template_name, base_prompt, system_instructions, version)
VALUES ('terrain', 'grass', 'Grass Tile',
'Create a terrain tile sprite for GRASS.

Format: 45-degree elevated view
Canvas: 64 x 64 pixels SQUARE
Background: TRANSPARENT (PNG-ready)

The grass tile: Lush green grass with subtle variation in shade. Small tufts and texture visible but not overwhelming. Natural, well-maintained lawn appearance.

The tile must seamlessly connect when placed adjacent to identical tiles.

Style: 90s CGI aesthetic with modern render quality. Clean, slightly stylized grass texture. Soft shadows suggesting gentle undulation.',
(SELECT system_instructions FROM prompt_templates WHERE category = '_global' AND asset_key = '_style_guide'), 1);

-- Road terrain (straight)
INSERT OR REPLACE INTO prompt_templates (category, asset_key, template_name, base_prompt, system_instructions, version)
VALUES ('terrain', 'road_straight', 'Road Straight Tile',
'Create a STRAIGHT ROAD terrain tile sprite.

Format: 45-degree elevated view
Canvas: 64 x 64 pixels SQUARE (will display at 64x64)
Background: TRANSPARENT (PNG-ready)

The road runs from one edge to the opposite edge.
- Gray asphalt in center with subtle texture
- Narrow sidewalks on both sides
- Road surface has fine grain texture
- Edges connect cleanly to adjacent road tiles

Style: 90s CGI aesthetic with modern render quality. Clean asphalt with visible but subtle texture.',
(SELECT system_instructions FROM prompt_templates WHERE category = '_global' AND asset_key = '_style_guide'), 1);

-- Road corner
INSERT OR REPLACE INTO prompt_templates (category, asset_key, template_name, base_prompt, system_instructions, version)
VALUES ('terrain', 'road_corner', 'Road Corner Tile',
'Create a CORNER ROAD terrain tile sprite (90-degree turn).

Format: 45-degree elevated view
Canvas: 64 x 64 pixels SQUARE
Background: TRANSPARENT (PNG-ready)

The road curves from one edge to an adjacent edge.
- Gray asphalt with natural curve
- Sidewalks follow the corner
- Clean connection points at edges

Style: 90s CGI aesthetic with modern render quality.',
(SELECT system_instructions FROM prompt_templates WHERE category = '_global' AND asset_key = '_style_guide'), 1);

-- Water terrain
INSERT OR REPLACE INTO prompt_templates (category, asset_key, template_name, base_prompt, system_instructions, version)
VALUES ('terrain', 'water', 'Water Tile',
'Create a WATER terrain tile sprite.

Format: 45-degree elevated view
Canvas: 64 x 64 pixels SQUARE
Background: TRANSPARENT (PNG-ready)

The water tile: Blue water with subtle ripple texture. Gentle reflective quality suggesting calm water surface. Light caustic patterns optional.

The tile must seamlessly connect when placed adjacent to identical tiles.

Style: 90s CGI aesthetic with modern render quality. Clean, stylized water surface. Subtle specular highlights.',
(SELECT system_instructions FROM prompt_templates WHERE category = '_global' AND asset_key = '_style_guide'), 1);

-- Dirt track
INSERT OR REPLACE INTO prompt_templates (category, asset_key, template_name, base_prompt, system_instructions, version)
VALUES ('terrain', 'dirt_straight', 'Dirt Track Straight',
'Create a DIRT TRACK terrain tile sprite.

Format: 45-degree elevated view
Canvas: 64 x 64 pixels SQUARE
Background: TRANSPARENT (PNG-ready)

The dirt track: Brown/tan compacted dirt path. Visible texture suggesting worn earth - small pebbles, subtle tire/foot track impressions. Earthy, natural appearance.

The tile must seamlessly connect when placed adjacent to identical tiles.

Style: 90s CGI aesthetic with modern render quality. Warm brown tones with variation.',
(SELECT system_instructions FROM prompt_templates WHERE category = '_global' AND asset_key = '_style_guide'), 1);

-- Trees
INSERT OR REPLACE INTO prompt_templates (category, asset_key, template_name, base_prompt, system_instructions, version)
VALUES ('terrain', 'trees', 'Trees Tile',
'Create a TREE CLUSTER terrain tile sprite.

Format: 45-degree elevated view - LIKE A BUILDING (3D, not flat top-down)
Canvas: 64 x 64 pixels SQUARE
Background: TRANSPARENT (PNG-ready)

This is a 3D tree cluster viewed from the same angle as buildings. NOT a flat top-down canopy view.

The trees:
- 2-3 trees clustered together
- Visible tree trunks at base
- Full leafy canopy
- 3D form with visible height/depth
- Fits on one tile like a small building

Style: 90s CGI aesthetic with modern render quality. Chunky, stylized trees with visible 3D form. Think park trees in SimCity 3000.',
(SELECT system_instructions FROM prompt_templates WHERE category = '_global' AND asset_key = '_style_guide'), 1);

-- ============================================
-- BUILDING SPRITES - Updated to SQUARE canvas
-- ============================================

-- Default building sprite template
UPDATE prompt_templates
SET base_prompt = 'Create an isometric game sprite for {BUILDING_TYPE}.

Format: 45-degree isometric view, single image
Canvas: SQUARE (size depends on building class - 128/192/256/320 px)
Background: TRANSPARENT (PNG-ready)
Orientation: Entry/front door on BOTTOM LEFT, building extends toward top-right

Building size classes:
- SHORT (128x128): Small structures (stalls, tents, carts)
- MEDIUM (192x192): Single-story buildings
- TALL (256x256): Two-story buildings
- VERY TALL (320x320): Large/impressive buildings

{CUSTOM_DETAILS}

Style: 90s CGI chunky polygonal aesthetic with modern render quality. Top-left lighting. Country-neutral. Building only - no vehicles, people, or surrounding objects.',
    system_instructions = (SELECT system_instructions FROM prompt_templates WHERE category = '_global' AND asset_key = '_style_guide')
WHERE category = 'building_sprite' AND asset_key = '_default';

-- Market Stall sprite
INSERT OR REPLACE INTO prompt_templates (category, asset_key, template_name, base_prompt, system_instructions, version)
VALUES ('building_sprite', 'market_stall', 'Market Stall Sprite',
'Create an isometric game sprite for a MARKET STALL.

Format: 45-degree isometric view, single image
Canvas: 128 x 128 px SQUARE
Background: TRANSPARENT (PNG-ready)
Size class: SHORT (small structure)
Orientation: Entry/customer-facing side on BOTTOM LEFT

The market stall: Small outdoor wooden vendor booth with canvas awning. Weathered timber frame with visible wood grain. Fabric awning with subtle cloth folds. Display counter with crates of colorful goods. Hand-painted signage. Rustic and humble.

Style: 90s CGI chunky polygonal aesthetic with modern render quality. Soft ambient occlusion under awning. Clean anti-aliased edges. Top-left lighting. Country-neutral. Building only - no vehicles, people, or surrounding objects.',
(SELECT system_instructions FROM prompt_templates WHERE category = '_global' AND asset_key = '_style_guide'), 1);

-- Burger Bar sprite
INSERT OR REPLACE INTO prompt_templates (category, asset_key, template_name, base_prompt, system_instructions, version)
VALUES ('building_sprite', 'burger_bar', 'Burger Bar Sprite',
'Create an isometric game sprite for a BURGER BAR.

Format: 45-degree isometric view, single image
Canvas: 192 x 192 px SQUARE
Background: TRANSPARENT (PNG-ready)
Size class: MEDIUM (single-story building)
Orientation: Diner entrance on BOTTOM LEFT

The burger bar: 1950s diner style building. Chrome trim with specular reflections. Red and white color scheme. Neon "BURGERS" sign. Large plate glass windows showing checkered floor inside. Retro roadside restaurant vibe.

Style: 90s CGI chunky polygonal aesthetic with modern render quality. Bright chrome reflections. Neon glow effect. Warm interior lighting visible. Top-left lighting. Country-neutral. Building only.',
(SELECT system_instructions FROM prompt_templates WHERE category = '_global' AND asset_key = '_style_guide'), 1);

-- Restaurant sprite
INSERT OR REPLACE INTO prompt_templates (category, asset_key, template_name, base_prompt, system_instructions, version)
VALUES ('building_sprite', 'restaurant', 'Restaurant Sprite',
'Create an isometric game sprite for a RESTAURANT.

Format: 45-degree isometric view, single image
Canvas: 256 x 256 px SQUARE
Background: TRANSPARENT (PNG-ready)
Size class: TALL (two-story building)
Orientation: Restaurant entrance on BOTTOM LEFT

The restaurant: Upscale dining establishment. Elegant facade with rendered or stone-effect walls. Large windows with sheer curtains diffusing warm interior light. Decorative entrance with small canopy. Brass door furniture. Outdoor menu display case. Classy atmosphere.

Style: 90s CGI chunky polygonal aesthetic with modern render quality. Warm golden interior glow. Polished brass reflections. Soft fabric translucency on curtains. Top-left lighting. Country-neutral. Building only.',
(SELECT system_instructions FROM prompt_templates WHERE category = '_global' AND asset_key = '_style_guide'), 1);

-- Casino sprite
INSERT OR REPLACE INTO prompt_templates (category, asset_key, template_name, base_prompt, system_instructions, version)
VALUES ('building_sprite', 'casino', 'Casino Sprite',
'Create an isometric game sprite for a CASINO.

Format: 45-degree isometric view, single image
Canvas: 320 x 320 px SQUARE
Background: TRANSPARENT (PNG-ready)
Size class: VERY TALL (impressive large building)
Orientation: Casino entrance on BOTTOM LEFT

The casino: Flashy entertainment building. Facade covered in decorative lights. Grand double-door entrance with brass and glass. Large "CASINO" signage with illuminated lettering. Gold and red color accents. Plush carpet visible through glass doors. Glamorous gambling hall style.

Style: 90s CGI chunky polygonal aesthetic with modern render quality. Bright lighting effects. Gold metallic reflections. Warm inviting glow from entrance. Top-left lighting. Country-neutral. Building only.',
(SELECT system_instructions FROM prompt_templates WHERE category = '_global' AND asset_key = '_style_guide'), 1);

-- ============================================
-- BUILDING REFERENCE SHEETS
-- ============================================

-- Update default building_ref template
UPDATE prompt_templates
SET base_prompt = 'Create a building reference sheet for {BUILDING_TYPE}.

Match the EXACT template layout:
- Gray background (#808080), white border boxes, bold labels
- Views: FRONT VIEW (top left), SIDE PROFILE VIEW (top right), BACK VIEW (middle left), 45 DEGREE ISOMETRIC VIEW (middle right), CLOSE UP DETAILS (bottom)
- Title: "BUILDING REFERENCE SHEET: 90s CGI {BUILDING_TYPE}"
- 45 degree view: Entry/door on BOTTOM LEFT

{CUSTOM_DETAILS}

CRITICAL RULES:
- Entry point/door on BOTTOM LEFT in isometric view
- Country-neutral (no flags, currency symbols, country-specific elements)
- Building ONLY - no vehicles, people, animals, or surrounding objects

STYLE: 90s CGI chunky polygonal aesthetic with modern render quality.',
    system_instructions = (SELECT system_instructions FROM prompt_templates WHERE category = '_global' AND asset_key = '_style_guide')
WHERE category = 'building_ref' AND asset_key = '_default';

-- Restaurant reference sheet
UPDATE prompt_templates
SET base_prompt = 'Create a building reference sheet for a RESTAURANT.

Match the EXACT template layout:
- Gray background (#808080), white border boxes, bold labels
- Views: FRONT VIEW (top left), SIDE PROFILE VIEW (top right), BACK VIEW (middle left), 45 DEGREE ISOMETRIC VIEW (middle right), CLOSE UP DETAILS (bottom)
- Title: "BUILDING REFERENCE SHEET: 90s CGI RESTAURANT"
- 45 degree view: Restaurant entrance on BOTTOM LEFT

The restaurant: CLEARLY IDENTIFIABLE as a restaurant with these distinctive features:
- Large "RESTAURANT" text signage above entrance (illuminated)
- Visible diners at tables through large front windows (silhouettes)
- Outdoor menu board with "TODAY''S SPECIAL" text
- Red and white checkered tablecloths visible inside
- Chef''s hat logo on the door or signage
- Small bistro-style awning over entrance
- Warm interior lighting with chandeliers visible
- Wine bottles displayed in window

Materials to highlight in close-up: Menu board detail, tablecloth pattern, wine bottle display, chef hat logo, brass door handle.

90s CGI chunky style with modern render quality - warm golden interior glow suggesting dinner service, inviting upscale but clearly FOOD atmosphere.',
    system_instructions = (SELECT system_instructions FROM prompt_templates WHERE category = '_global' AND asset_key = '_style_guide')
WHERE category = 'building_ref' AND asset_key = 'restaurant';

-- ============================================
-- BASE GROUND (Background Image)
-- ============================================

INSERT OR REPLACE INTO prompt_templates (category, asset_key, template_name, base_prompt, system_instructions, version)
VALUES ('terrain', 'base_ground_grass', 'Base Ground Grass',
'Create a seamless tiling grass texture for use as a game map background.

Dimensions: 512x512 pixels (will be repeated via CSS)
Format: Square image, NO transparency needed (solid grass)

CRITICAL REQUIREMENT - SEAMLESS TILING:
This texture will be repeated infinitely as the game world floor.
The grass pattern MUST tile seamlessly in all directions.
- All four edges must blend perfectly when repeated
- No distinct features that would create obvious repetition
- Avoid any gradients or directional lighting

The grass texture:
- Lush, healthy green grass viewed from above
- Subtle variation in green tones
- Natural lawn appearance
- Soft texture suggesting grass blades

Style: 90s CGI aesthetic with modern render quality.

Do NOT include:
- Flowers, rocks, or debris
- Shadows or lighting direction
- Any features that break seamless tiling',
(SELECT system_instructions FROM prompt_templates WHERE category = '_global' AND asset_key = '_style_guide'), 1);

-- ============================================
-- EFFECTS
-- ============================================

-- Fire effect
INSERT OR REPLACE INTO prompt_templates (category, asset_key, template_name, base_prompt, system_instructions, version)
VALUES ('effect', 'fire', 'Fire Effect',
'Create a dirty trick effect overlay for FIRE/ARSON.

Format: 45-degree isometric view
Canvas: 128 x 128 px SQUARE
Background: TRANSPARENT (PNG-ready)
Purpose: This will be overlaid on ANY building to show it''s on fire

Show ONLY the fire effect elements - NO BUILDING VISIBLE:
- Bright orange and yellow flames rising upward
- Dark smoke plumes billowing
- Glowing embers floating
- Heat distortion suggestion
- Flickering fire tongues at different heights

The effect should be sized to overlay a standard building footprint at 45-degree isometric angle.

CRITICAL: Use only universal elements. No specific building materials visible. The effect must work whether overlaid on a canvas tent, wooden shack, or stone temple.

Style: 90s CGI aesthetic with modern render quality. Stylized but dramatic flames. Volumetric smoke.',
(SELECT system_instructions FROM prompt_templates WHERE category = '_global' AND asset_key = '_style_guide'), 1);

-- Damage 25%
INSERT OR REPLACE INTO prompt_templates (category, asset_key, template_name, base_prompt, system_instructions, version)
VALUES ('effect', 'damage_25', 'Light Damage Effect',
'Create a damage effect overlay for LIGHT DAMAGE (25% health).

Format: 45-degree isometric view
Canvas: 128 x 128 px SQUARE
Background: TRANSPARENT (PNG-ready)
Purpose: This will be overlaid on ANY building to show minor damage

Show ONLY the damage effect elements - NO BUILDING VISIBLE:
- Scattered dust and small debris particles
- Thin wisps of smoke from a few points
- Generic scuff marks and scratches
- Minor discoloration patches
- A few floating broken glass shards

CRITICAL: Use only universal elements. No bricks, wood planks, concrete chunks, or any specific building materials.

Style: 90s CGI aesthetic with modern render quality. Subtle damage suggestion.',
(SELECT system_instructions FROM prompt_templates WHERE category = '_global' AND asset_key = '_style_guide'), 1);

-- ============================================
-- APPLY SYSTEM INSTRUCTIONS TO ALL NON-AVATAR TEMPLATES
-- ============================================

UPDATE prompt_templates
SET system_instructions = (SELECT system_instructions FROM prompt_templates WHERE category = '_global' AND asset_key = '_style_guide')
WHERE category NOT IN ('avatar', '_global')
  AND system_instructions IS NULL;

-- ============================================
-- LOG THE MIGRATION
-- ============================================

INSERT INTO audit_log (action, details, created_at)
VALUES ('prompt_template_migration', '{"version": "0031", "changes": "diamond_to_square, added_system_instructions"}', CURRENT_TIMESTAMP);
```

---

## Implementation Steps

### Step 1: Create Full Migration File

The SQL above is a subset. Create the full migration with ALL building types:
- market_stall, hot_dog_stand, campsite, shop, burger_bar, motel
- high_street_store, restaurant, manor, casino
- temple, bank, police_station

And ALL terrain types:
- grass, road_straight, road_corner, road_t_junction, road_crossroads, road_end
- water, water_pond, water_outlet, water_channel, water_inlet
- dirt_straight, dirt_corner
- trees

### Step 2: Run Migration

```bash
cd /Users/riki/notropolis/authentication-dashboard-system

CLOUDFLARE_API_TOKEN="RQeVAceZ3VT-McbFF9DnYem0ZDc8YXbnHPH8wbg_" \
CLOUDFLARE_ACCOUNT_ID="329dc0e016dd5cd512d6566d64d8aa0c" \
npx wrangler d1 execute notropolis-database --remote --file=migrations/0031_update_prompt_templates.sql
```

### Step 3: Verify Templates Updated

```bash
# Check system_instructions populated
CLOUDFLARE_API_TOKEN="RQeVAceZ3VT-McbFF9DnYem0ZDc8YXbnHPH8wbg_" \
CLOUDFLARE_ACCOUNT_ID="329dc0e016dd5cd512d6566d64d8aa0c" \
npx wrangler d1 execute notropolis-database --remote --command \
"SELECT category, asset_key, LENGTH(system_instructions) as sys_len FROM prompt_templates WHERE category NOT IN ('avatar') LIMIT 20;"
```

### Step 4: Test in UI

1. Open Generate Modal
2. Select a building type
3. Verify:
   - Generation Prompt shows new square-format prompt
   - System Instructions shows the Gemini Gem instructions
   - Expand "Advanced Settings" to verify system instructions

---

## Categories to Update

| Category | Asset Keys | Notes |
|----------|-----------|-------|
| `terrain` | grass, road_*, water_*, dirt_*, trees | Change to 64x64 square |
| `terrain_ref` | Same as terrain | Reference sheet format |
| `building_sprite` | market_stall, hot_dog_stand, campsite, shop, burger_bar, motel, high_street_store, restaurant, manor, casino, temple, bank, police_station | Square canvas sizes |
| `building_ref` | Same as building_sprite | Reference sheet format |
| `effect` | fire, damage_25, damage_50, damage_75, for_sale, security | Square overlays |
| `effect_ref` | Same as effect | Reference sheets |
| `npc` | pedestrian_male, pedestrian_female | 2-frame walk cycle |
| `vehicle_ref` | car, truck, etc. | Single sprite, game rotates |
| `scene` | arrested, court, prison, celebration, bank_interior, temple_interior, offshore, dirty_trick | Keep as-is (full scenes) |
| `ui` | minimap_player, minimap_enemy, cursor_select | Small icons |
| **avatar** | ALL | **SKIP - Do not modify** |

---

## Key Format Changes

### Before (Diamond Isometric)
```
Format: Diamond/rhombus shaped tile
Dimensions: 64x32 pixels (2:1 ratio)
```

### After (Square Elevated)
```
Format: 45-degree elevated view
Canvas: 64 x 64 pixels SQUARE
```

### Building Sizes (All Square)
| Class | Before | After |
|-------|--------|-------|
| SHORT | 128x64 | 128x128 |
| MEDIUM | 192x96 | 192x192 |
| TALL | 256x128 | 256x256 |
| VERY TALL | 320x160 | 320x320 |

---

## Acceptance Checklist

- [ ] Migration file created with all templates
- [ ] System instructions added to all non-avatar templates
- [ ] Terrain templates updated to 64x64 square
- [ ] Building sprite templates updated to square canvas
- [ ] Building ref templates updated
- [ ] Effect templates updated
- [ ] Migration run successfully
- [ ] UI shows updated prompts
- [ ] Avatar templates unchanged
- [ ] Old diamond references removed from prompts

---

## Rollback

If needed, restore from backup or revert prompts:

```sql
-- Revert to diamond format (emergency rollback)
UPDATE prompt_templates
SET base_prompt = REPLACE(base_prompt, '64 x 64 pixels SQUARE', '64x32 pixels diamond')
WHERE category NOT IN ('avatar');
```

---

## Sign-off

- **Executed By:**
- **Date:**
- **Templates Updated:** _____ rows
- **System Instructions Added:** ☐ Yes
- **UI Verified:** ☐ Yes
