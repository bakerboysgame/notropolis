-- Migration: 0031_update_prompt_templates.sql
-- Purpose: Update prompt templates with square format and system instructions
-- Date: 2026-01-02
-- Stage: 13 - Prompt Template Migration

-- ============================================
-- GLOBAL SYSTEM INSTRUCTIONS
-- This gets applied to all non-avatar templates
-- ============================================

-- First, store the system instructions in the _global template
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
For ALL building sprites, the building is viewed from a 45-degree elevated angle with the entry point/door on the BOTTOM FACE (facing the viewer).

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
INSERT OR REPLACE INTO prompt_templates (category, asset_key, template_name, base_prompt, system_instructions, version, is_active, created_by)
VALUES ('terrain', 'grass', 'Grass Tile',
'Create a terrain tile sprite for GRASS.

Format: 45-degree elevated view
Canvas: 64 x 64 pixels SQUARE
Background: TRANSPARENT (PNG-ready)

The grass tile: Lush green grass with subtle variation in shade. Small tufts and texture visible but not overwhelming. Natural, well-maintained lawn appearance.

The tile must seamlessly connect when placed adjacent to identical tiles.

Style: 90s CGI aesthetic with modern render quality. Clean, slightly stylized grass texture. Soft shadows suggesting gentle undulation.',
(SELECT system_instructions FROM prompt_templates WHERE category = '_global' AND asset_key = '_style_guide'), 1, TRUE, 'system');

-- Road straight (NS direction)
INSERT OR REPLACE INTO prompt_templates (category, asset_key, template_name, base_prompt, system_instructions, version, is_active, created_by)
VALUES ('terrain', 'road_ns', 'Road Straight NS',
'Create a STRAIGHT ROAD terrain tile sprite (North-South direction).

Format: 45-degree elevated view
Canvas: 64 x 64 pixels SQUARE
Background: TRANSPARENT (PNG-ready)

The road runs from top edge to bottom edge (North-South).
- Gray asphalt in center with subtle texture
- Narrow sidewalks on both sides (East and West edges)
- Road surface has fine grain texture
- Edges connect cleanly to adjacent road tiles

Style: 90s CGI aesthetic with modern render quality. Clean asphalt with visible but subtle texture.',
(SELECT system_instructions FROM prompt_templates WHERE category = '_global' AND asset_key = '_style_guide'), 1, TRUE, 'system');

-- Road straight (EW direction)
INSERT OR REPLACE INTO prompt_templates (category, asset_key, template_name, base_prompt, system_instructions, version, is_active, created_by)
VALUES ('terrain', 'road_ew', 'Road Straight EW',
'Create a STRAIGHT ROAD terrain tile sprite (East-West direction).

Format: 45-degree elevated view
Canvas: 64 x 64 pixels SQUARE
Background: TRANSPARENT (PNG-ready)

The road runs from left edge to right edge (East-West).
- Gray asphalt in center with subtle texture
- Narrow sidewalks on both sides (North and South edges)
- Road surface has fine grain texture
- Edges connect cleanly to adjacent road tiles

Style: 90s CGI aesthetic with modern render quality. Clean asphalt with visible but subtle texture.',
(SELECT system_instructions FROM prompt_templates WHERE category = '_global' AND asset_key = '_style_guide'), 1, TRUE, 'system');

-- Road corners
INSERT OR REPLACE INTO prompt_templates (category, asset_key, template_name, base_prompt, system_instructions, version, is_active, created_by)
VALUES ('terrain', 'road_ne', 'Road Corner NE',
'Create a CORNER ROAD terrain tile sprite (90-degree turn, North to East).

Format: 45-degree elevated view
Canvas: 64 x 64 pixels SQUARE
Background: TRANSPARENT (PNG-ready)

The road curves from North edge to East edge.
- Gray asphalt with natural curve
- Sidewalks follow the corner
- Clean connection points at edges

Style: 90s CGI aesthetic with modern render quality.',
(SELECT system_instructions FROM prompt_templates WHERE category = '_global' AND asset_key = '_style_guide'), 1, TRUE, 'system');

INSERT OR REPLACE INTO prompt_templates (category, asset_key, template_name, base_prompt, system_instructions, version, is_active, created_by)
VALUES ('terrain', 'road_nw', 'Road Corner NW',
'Create a CORNER ROAD terrain tile sprite (90-degree turn, North to West).

Format: 45-degree elevated view
Canvas: 64 x 64 pixels SQUARE
Background: TRANSPARENT (PNG-ready)

The road curves from North edge to West edge.
- Gray asphalt with natural curve
- Sidewalks follow the corner
- Clean connection points at edges

Style: 90s CGI aesthetic with modern render quality.',
(SELECT system_instructions FROM prompt_templates WHERE category = '_global' AND asset_key = '_style_guide'), 1, TRUE, 'system');

INSERT OR REPLACE INTO prompt_templates (category, asset_key, template_name, base_prompt, system_instructions, version, is_active, created_by)
VALUES ('terrain', 'road_se', 'Road Corner SE',
'Create a CORNER ROAD terrain tile sprite (90-degree turn, South to East).

Format: 45-degree elevated view
Canvas: 64 x 64 pixels SQUARE
Background: TRANSPARENT (PNG-ready)

The road curves from South edge to East edge.
- Gray asphalt with natural curve
- Sidewalks follow the corner
- Clean connection points at edges

Style: 90s CGI aesthetic with modern render quality.',
(SELECT system_instructions FROM prompt_templates WHERE category = '_global' AND asset_key = '_style_guide'), 1, TRUE, 'system');

INSERT OR REPLACE INTO prompt_templates (category, asset_key, template_name, base_prompt, system_instructions, version, is_active, created_by)
VALUES ('terrain', 'road_sw', 'Road Corner SW',
'Create a CORNER ROAD terrain tile sprite (90-degree turn, South to West).

Format: 45-degree elevated view
Canvas: 64 x 64 pixels SQUARE
Background: TRANSPARENT (PNG-ready)

The road curves from South edge to West edge.
- Gray asphalt with natural curve
- Sidewalks follow the corner
- Clean connection points at edges

Style: 90s CGI aesthetic with modern render quality.',
(SELECT system_instructions FROM prompt_templates WHERE category = '_global' AND asset_key = '_style_guide'), 1, TRUE, 'system');

-- Road T-junctions
INSERT OR REPLACE INTO prompt_templates (category, asset_key, template_name, base_prompt, system_instructions, version, is_active, created_by)
VALUES ('terrain', 'road_nes', 'Road T-Junction NES',
'Create a T-JUNCTION ROAD terrain tile sprite (North, East, South connections).

Format: 45-degree elevated view
Canvas: 64 x 64 pixels SQUARE
Background: TRANSPARENT (PNG-ready)

T-junction with roads connecting to North, East, and South edges. West edge has sidewalk only.

Style: 90s CGI aesthetic with modern render quality.',
(SELECT system_instructions FROM prompt_templates WHERE category = '_global' AND asset_key = '_style_guide'), 1, TRUE, 'system');

INSERT OR REPLACE INTO prompt_templates (category, asset_key, template_name, base_prompt, system_instructions, version, is_active, created_by)
VALUES ('terrain', 'road_new', 'Road T-Junction NEW',
'Create a T-JUNCTION ROAD terrain tile sprite (North, East, West connections).

Format: 45-degree elevated view
Canvas: 64 x 64 pixels SQUARE
Background: TRANSPARENT (PNG-ready)

T-junction with roads connecting to North, East, and West edges. South edge has sidewalk only.

Style: 90s CGI aesthetic with modern render quality.',
(SELECT system_instructions FROM prompt_templates WHERE category = '_global' AND asset_key = '_style_guide'), 1, TRUE, 'system');

INSERT OR REPLACE INTO prompt_templates (category, asset_key, template_name, base_prompt, system_instructions, version, is_active, created_by)
VALUES ('terrain', 'road_nsw', 'Road T-Junction NSW',
'Create a T-JUNCTION ROAD terrain tile sprite (North, South, West connections).

Format: 45-degree elevated view
Canvas: 64 x 64 pixels SQUARE
Background: TRANSPARENT (PNG-ready)

T-junction with roads connecting to North, South, and West edges. East edge has sidewalk only.

Style: 90s CGI aesthetic with modern render quality.',
(SELECT system_instructions FROM prompt_templates WHERE category = '_global' AND asset_key = '_style_guide'), 1, TRUE, 'system');

INSERT OR REPLACE INTO prompt_templates (category, asset_key, template_name, base_prompt, system_instructions, version, is_active, created_by)
VALUES ('terrain', 'road_esw', 'Road T-Junction ESW',
'Create a T-JUNCTION ROAD terrain tile sprite (East, South, West connections).

Format: 45-degree elevated view
Canvas: 64 x 64 pixels SQUARE
Background: TRANSPARENT (PNG-ready)

T-junction with roads connecting to East, South, and West edges. North edge has sidewalk only.

Style: 90s CGI aesthetic with modern render quality.',
(SELECT system_instructions FROM prompt_templates WHERE category = '_global' AND asset_key = '_style_guide'), 1, TRUE, 'system');

-- Road crossroads
INSERT OR REPLACE INTO prompt_templates (category, asset_key, template_name, base_prompt, system_instructions, version, is_active, created_by)
VALUES ('terrain', 'road_nesw', 'Road Crossroads',
'Create a CROSSROADS terrain tile sprite (4-way intersection).

Format: 45-degree elevated view
Canvas: 64 x 64 pixels SQUARE
Background: TRANSPARENT (PNG-ready)

4-way intersection with roads connecting to all four edges (North, East, South, West).
Sidewalks at corners only.

Style: 90s CGI aesthetic with modern render quality.',
(SELECT system_instructions FROM prompt_templates WHERE category = '_global' AND asset_key = '_style_guide'), 1, TRUE, 'system');

-- Road dead ends
INSERT OR REPLACE INTO prompt_templates (category, asset_key, template_name, base_prompt, system_instructions, version, is_active, created_by)
VALUES ('terrain', 'road_n', 'Road Dead End N',
'Create a DEAD END ROAD terrain tile sprite (North connection only).

Format: 45-degree elevated view
Canvas: 64 x 64 pixels SQUARE
Background: TRANSPARENT (PNG-ready)

Road enters from North edge and ends with a U-turn/cul-de-sac.

Style: 90s CGI aesthetic with modern render quality.',
(SELECT system_instructions FROM prompt_templates WHERE category = '_global' AND asset_key = '_style_guide'), 1, TRUE, 'system');

INSERT OR REPLACE INTO prompt_templates (category, asset_key, template_name, base_prompt, system_instructions, version, is_active, created_by)
VALUES ('terrain', 'road_e', 'Road Dead End E',
'Create a DEAD END ROAD terrain tile sprite (East connection only).

Format: 45-degree elevated view
Canvas: 64 x 64 pixels SQUARE
Background: TRANSPARENT (PNG-ready)

Road enters from East edge and ends with a U-turn/cul-de-sac.

Style: 90s CGI aesthetic with modern render quality.',
(SELECT system_instructions FROM prompt_templates WHERE category = '_global' AND asset_key = '_style_guide'), 1, TRUE, 'system');

INSERT OR REPLACE INTO prompt_templates (category, asset_key, template_name, base_prompt, system_instructions, version, is_active, created_by)
VALUES ('terrain', 'road_s', 'Road Dead End S',
'Create a DEAD END ROAD terrain tile sprite (South connection only).

Format: 45-degree elevated view
Canvas: 64 x 64 pixels SQUARE
Background: TRANSPARENT (PNG-ready)

Road enters from South edge and ends with a U-turn/cul-de-sac.

Style: 90s CGI aesthetic with modern render quality.',
(SELECT system_instructions FROM prompt_templates WHERE category = '_global' AND asset_key = '_style_guide'), 1, TRUE, 'system');

INSERT OR REPLACE INTO prompt_templates (category, asset_key, template_name, base_prompt, system_instructions, version, is_active, created_by)
VALUES ('terrain', 'road_w', 'Road Dead End W',
'Create a DEAD END ROAD terrain tile sprite (West connection only).

Format: 45-degree elevated view
Canvas: 64 x 64 pixels SQUARE
Background: TRANSPARENT (PNG-ready)

Road enters from West edge and ends with a U-turn/cul-de-sac.

Style: 90s CGI aesthetic with modern render quality.',
(SELECT system_instructions FROM prompt_templates WHERE category = '_global' AND asset_key = '_style_guide'), 1, TRUE, 'system');

-- Water terrain
INSERT OR REPLACE INTO prompt_templates (category, asset_key, template_name, base_prompt, system_instructions, version, is_active, created_by)
VALUES ('terrain', 'water', 'Water Tile',
'Create a WATER terrain tile sprite.

Format: 45-degree elevated view
Canvas: 64 x 64 pixels SQUARE
Background: TRANSPARENT (PNG-ready)

The water tile: Blue water with subtle ripple texture. Gentle reflective quality suggesting calm water surface. Light caustic patterns optional.

The tile must seamlessly connect when placed adjacent to identical tiles.

Style: 90s CGI aesthetic with modern render quality. Clean, stylized water surface. Subtle specular highlights.',
(SELECT system_instructions FROM prompt_templates WHERE category = '_global' AND asset_key = '_style_guide'), 1, TRUE, 'system');

-- Water edge tiles
INSERT OR REPLACE INTO prompt_templates (category, asset_key, template_name, base_prompt, system_instructions, version, is_active, created_by)
VALUES ('terrain', 'water_edge_n', 'Water Edge North',
'Create a WATER EDGE terrain tile sprite (land to North).

Format: 45-degree elevated view
Canvas: 64 x 64 pixels SQUARE
Background: TRANSPARENT (PNG-ready)

Water tile with sandy shore along the North edge. Water in the South portion, shore/beach in the North portion.

Style: 90s CGI aesthetic with modern render quality.',
(SELECT system_instructions FROM prompt_templates WHERE category = '_global' AND asset_key = '_style_guide'), 1, TRUE, 'system');

INSERT OR REPLACE INTO prompt_templates (category, asset_key, template_name, base_prompt, system_instructions, version, is_active, created_by)
VALUES ('terrain', 'water_edge_e', 'Water Edge East',
'Create a WATER EDGE terrain tile sprite (land to East).

Format: 45-degree elevated view
Canvas: 64 x 64 pixels SQUARE
Background: TRANSPARENT (PNG-ready)

Water tile with sandy shore along the East edge. Water in the West portion, shore/beach in the East portion.

Style: 90s CGI aesthetic with modern render quality.',
(SELECT system_instructions FROM prompt_templates WHERE category = '_global' AND asset_key = '_style_guide'), 1, TRUE, 'system');

INSERT OR REPLACE INTO prompt_templates (category, asset_key, template_name, base_prompt, system_instructions, version, is_active, created_by)
VALUES ('terrain', 'water_edge_s', 'Water Edge South',
'Create a WATER EDGE terrain tile sprite (land to South).

Format: 45-degree elevated view
Canvas: 64 x 64 pixels SQUARE
Background: TRANSPARENT (PNG-ready)

Water tile with sandy shore along the South edge. Water in the North portion, shore/beach in the South portion.

Style: 90s CGI aesthetic with modern render quality.',
(SELECT system_instructions FROM prompt_templates WHERE category = '_global' AND asset_key = '_style_guide'), 1, TRUE, 'system');

INSERT OR REPLACE INTO prompt_templates (category, asset_key, template_name, base_prompt, system_instructions, version, is_active, created_by)
VALUES ('terrain', 'water_edge_w', 'Water Edge West',
'Create a WATER EDGE terrain tile sprite (land to West).

Format: 45-degree elevated view
Canvas: 64 x 64 pixels SQUARE
Background: TRANSPARENT (PNG-ready)

Water tile with sandy shore along the West edge. Water in the East portion, shore/beach in the West portion.

Style: 90s CGI aesthetic with modern render quality.',
(SELECT system_instructions FROM prompt_templates WHERE category = '_global' AND asset_key = '_style_guide'), 1, TRUE, 'system');

-- Water corner tiles (outer)
INSERT OR REPLACE INTO prompt_templates (category, asset_key, template_name, base_prompt, system_instructions, version, is_active, created_by)
VALUES ('terrain', 'water_corner_ne', 'Water Corner NE',
'Create a WATER CORNER terrain tile sprite (outer corner, land to North and East).

Format: 45-degree elevated view
Canvas: 64 x 64 pixels SQUARE
Background: TRANSPARENT (PNG-ready)

Outer corner water tile. Shore along North and East edges forming a corner. Water fills the Southwest portion.

Style: 90s CGI aesthetic with modern render quality.',
(SELECT system_instructions FROM prompt_templates WHERE category = '_global' AND asset_key = '_style_guide'), 1, TRUE, 'system');

INSERT OR REPLACE INTO prompt_templates (category, asset_key, template_name, base_prompt, system_instructions, version, is_active, created_by)
VALUES ('terrain', 'water_corner_nw', 'Water Corner NW',
'Create a WATER CORNER terrain tile sprite (outer corner, land to North and West).

Format: 45-degree elevated view
Canvas: 64 x 64 pixels SQUARE
Background: TRANSPARENT (PNG-ready)

Outer corner water tile. Shore along North and West edges forming a corner. Water fills the Southeast portion.

Style: 90s CGI aesthetic with modern render quality.',
(SELECT system_instructions FROM prompt_templates WHERE category = '_global' AND asset_key = '_style_guide'), 1, TRUE, 'system');

INSERT OR REPLACE INTO prompt_templates (category, asset_key, template_name, base_prompt, system_instructions, version, is_active, created_by)
VALUES ('terrain', 'water_corner_se', 'Water Corner SE',
'Create a WATER CORNER terrain tile sprite (outer corner, land to South and East).

Format: 45-degree elevated view
Canvas: 64 x 64 pixels SQUARE
Background: TRANSPARENT (PNG-ready)

Outer corner water tile. Shore along South and East edges forming a corner. Water fills the Northwest portion.

Style: 90s CGI aesthetic with modern render quality.',
(SELECT system_instructions FROM prompt_templates WHERE category = '_global' AND asset_key = '_style_guide'), 1, TRUE, 'system');

INSERT OR REPLACE INTO prompt_templates (category, asset_key, template_name, base_prompt, system_instructions, version, is_active, created_by)
VALUES ('terrain', 'water_corner_sw', 'Water Corner SW',
'Create a WATER CORNER terrain tile sprite (outer corner, land to South and West).

Format: 45-degree elevated view
Canvas: 64 x 64 pixels SQUARE
Background: TRANSPARENT (PNG-ready)

Outer corner water tile. Shore along South and West edges forming a corner. Water fills the Northeast portion.

Style: 90s CGI aesthetic with modern render quality.',
(SELECT system_instructions FROM prompt_templates WHERE category = '_global' AND asset_key = '_style_guide'), 1, TRUE, 'system');

-- Water inner corner tiles
INSERT OR REPLACE INTO prompt_templates (category, asset_key, template_name, base_prompt, system_instructions, version, is_active, created_by)
VALUES ('terrain', 'water_inner_ne', 'Water Inner Corner NE',
'Create a WATER INNER CORNER terrain tile sprite (concave corner at Northeast).

Format: 45-degree elevated view
Canvas: 64 x 64 pixels SQUARE
Background: TRANSPARENT (PNG-ready)

Inner/concave corner water tile. Small beach/shore in the NE corner only, rest is water. Used where water wraps around a land point.

Style: 90s CGI aesthetic with modern render quality.',
(SELECT system_instructions FROM prompt_templates WHERE category = '_global' AND asset_key = '_style_guide'), 1, TRUE, 'system');

INSERT OR REPLACE INTO prompt_templates (category, asset_key, template_name, base_prompt, system_instructions, version, is_active, created_by)
VALUES ('terrain', 'water_inner_nw', 'Water Inner Corner NW',
'Create a WATER INNER CORNER terrain tile sprite (concave corner at Northwest).

Format: 45-degree elevated view
Canvas: 64 x 64 pixels SQUARE
Background: TRANSPARENT (PNG-ready)

Inner/concave corner water tile. Small beach/shore in the NW corner only, rest is water. Used where water wraps around a land point.

Style: 90s CGI aesthetic with modern render quality.',
(SELECT system_instructions FROM prompt_templates WHERE category = '_global' AND asset_key = '_style_guide'), 1, TRUE, 'system');

INSERT OR REPLACE INTO prompt_templates (category, asset_key, template_name, base_prompt, system_instructions, version, is_active, created_by)
VALUES ('terrain', 'water_inner_se', 'Water Inner Corner SE',
'Create a WATER INNER CORNER terrain tile sprite (concave corner at Southeast).

Format: 45-degree elevated view
Canvas: 64 x 64 pixels SQUARE
Background: TRANSPARENT (PNG-ready)

Inner/concave corner water tile. Small beach/shore in the SE corner only, rest is water. Used where water wraps around a land point.

Style: 90s CGI aesthetic with modern render quality.',
(SELECT system_instructions FROM prompt_templates WHERE category = '_global' AND asset_key = '_style_guide'), 1, TRUE, 'system');

INSERT OR REPLACE INTO prompt_templates (category, asset_key, template_name, base_prompt, system_instructions, version, is_active, created_by)
VALUES ('terrain', 'water_inner_sw', 'Water Inner Corner SW',
'Create a WATER INNER CORNER terrain tile sprite (concave corner at Southwest).

Format: 45-degree elevated view
Canvas: 64 x 64 pixels SQUARE
Background: TRANSPARENT (PNG-ready)

Inner/concave corner water tile. Small beach/shore in the SW corner only, rest is water. Used where water wraps around a land point.

Style: 90s CGI aesthetic with modern render quality.',
(SELECT system_instructions FROM prompt_templates WHERE category = '_global' AND asset_key = '_style_guide'), 1, TRUE, 'system');

-- Dirt tracks
INSERT OR REPLACE INTO prompt_templates (category, asset_key, template_name, base_prompt, system_instructions, version, is_active, created_by)
VALUES ('terrain', 'dirt_ns', 'Dirt Track NS',
'Create a DIRT TRACK terrain tile sprite (North-South direction).

Format: 45-degree elevated view
Canvas: 64 x 64 pixels SQUARE
Background: TRANSPARENT (PNG-ready)

Brown/tan compacted dirt path running from top edge to bottom edge. Visible texture suggesting worn earth - small pebbles, subtle tire/foot track impressions. Earthy, natural appearance.

The tile must seamlessly connect when placed adjacent to identical tiles.

Style: 90s CGI aesthetic with modern render quality. Warm brown tones with variation.',
(SELECT system_instructions FROM prompt_templates WHERE category = '_global' AND asset_key = '_style_guide'), 1, TRUE, 'system');

INSERT OR REPLACE INTO prompt_templates (category, asset_key, template_name, base_prompt, system_instructions, version, is_active, created_by)
VALUES ('terrain', 'dirt_ew', 'Dirt Track EW',
'Create a DIRT TRACK terrain tile sprite (East-West direction).

Format: 45-degree elevated view
Canvas: 64 x 64 pixels SQUARE
Background: TRANSPARENT (PNG-ready)

Brown/tan compacted dirt path running from left edge to right edge. Visible texture suggesting worn earth.

Style: 90s CGI aesthetic with modern render quality. Warm brown tones with variation.',
(SELECT system_instructions FROM prompt_templates WHERE category = '_global' AND asset_key = '_style_guide'), 1, TRUE, 'system');

INSERT OR REPLACE INTO prompt_templates (category, asset_key, template_name, base_prompt, system_instructions, version, is_active, created_by)
VALUES ('terrain', 'dirt_ne', 'Dirt Track Corner NE',
'Create a DIRT TRACK CORNER terrain tile sprite (North to East).

Format: 45-degree elevated view
Canvas: 64 x 64 pixels SQUARE
Background: TRANSPARENT (PNG-ready)

Brown/tan dirt path curving from North edge to East edge.

Style: 90s CGI aesthetic with modern render quality.',
(SELECT system_instructions FROM prompt_templates WHERE category = '_global' AND asset_key = '_style_guide'), 1, TRUE, 'system');

INSERT OR REPLACE INTO prompt_templates (category, asset_key, template_name, base_prompt, system_instructions, version, is_active, created_by)
VALUES ('terrain', 'dirt_nw', 'Dirt Track Corner NW',
'Create a DIRT TRACK CORNER terrain tile sprite (North to West).

Format: 45-degree elevated view
Canvas: 64 x 64 pixels SQUARE
Background: TRANSPARENT (PNG-ready)

Brown/tan dirt path curving from North edge to West edge.

Style: 90s CGI aesthetic with modern render quality.',
(SELECT system_instructions FROM prompt_templates WHERE category = '_global' AND asset_key = '_style_guide'), 1, TRUE, 'system');

INSERT OR REPLACE INTO prompt_templates (category, asset_key, template_name, base_prompt, system_instructions, version, is_active, created_by)
VALUES ('terrain', 'dirt_se', 'Dirt Track Corner SE',
'Create a DIRT TRACK CORNER terrain tile sprite (South to East).

Format: 45-degree elevated view
Canvas: 64 x 64 pixels SQUARE
Background: TRANSPARENT (PNG-ready)

Brown/tan dirt path curving from South edge to East edge.

Style: 90s CGI aesthetic with modern render quality.',
(SELECT system_instructions FROM prompt_templates WHERE category = '_global' AND asset_key = '_style_guide'), 1, TRUE, 'system');

INSERT OR REPLACE INTO prompt_templates (category, asset_key, template_name, base_prompt, system_instructions, version, is_active, created_by)
VALUES ('terrain', 'dirt_sw', 'Dirt Track Corner SW',
'Create a DIRT TRACK CORNER terrain tile sprite (South to West).

Format: 45-degree elevated view
Canvas: 64 x 64 pixels SQUARE
Background: TRANSPARENT (PNG-ready)

Brown/tan dirt path curving from South edge to West edge.

Style: 90s CGI aesthetic with modern render quality.',
(SELECT system_instructions FROM prompt_templates WHERE category = '_global' AND asset_key = '_style_guide'), 1, TRUE, 'system');

-- Trees
INSERT OR REPLACE INTO prompt_templates (category, asset_key, template_name, base_prompt, system_instructions, version, is_active, created_by)
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
(SELECT system_instructions FROM prompt_templates WHERE category = '_global' AND asset_key = '_style_guide'), 1, TRUE, 'system');

-- Base ground (seamless background)
INSERT OR REPLACE INTO prompt_templates (category, asset_key, template_name, base_prompt, system_instructions, version, is_active, created_by)
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
(SELECT system_instructions FROM prompt_templates WHERE category = '_global' AND asset_key = '_style_guide'), 1, TRUE, 'system');

-- ============================================
-- BUILDING SPRITES - Updated to SQUARE canvas
-- ============================================

-- ============================================
-- BUILDING SPRITE SYSTEM INSTRUCTIONS (unique to this category)
-- ============================================

UPDATE prompt_templates
SET system_instructions = 'You are generating BUILDING SPRITES for "Notropolis", a business simulation game.

## CAMERA ANGLE

View: Slightly elevated front view (NOT isometric)
- Camera is positioned mostly in FRONT of the building, slightly above and slightly to the right
- You see: MOSTLY the FRONT FACE, a little of the ROOF, a little of the RIGHT SIDE
- The front edge of the building runs HORIZONTALLY (parallel to the bottom edge of the canvas)

Think: Standing in front of a building, looking slightly up and slightly to the left.
NOT a birds eye view. NOT isometric. Almost front-on with subtle 3D depth.

## CANVAS

Format: SQUARE (128x128, 192x192, 256x256, or 320x320 depending on building size)
Background: TRANSPARENT PNG
The building floats on transparency - NO floor, ground, or base underneath.

## VISUAL STYLE

Art Direction: 90s CGI geometry with 2025 Pixar-quality rendering

Geometry (90s feel):
- Chunky, blocky polygonal shapes
- Clean geometric forms (think SimCity 3000, Theme Park, early Pixar)
- Slightly exaggerated proportions

Rendering (modern quality):
- Soft ambient occlusion in corners and under overhangs
- Subtle global illumination / bounced light
- Clean smooth surfaces with defined material separation
- Professional studio lighting from TOP-LEFT
- High quality materials, subtle specular highlights
- Crisp edges with clean anti-aliasing

## RULES

- NO floor/ground/base - building floats on transparency
- NO people, vehicles, or surrounding objects
- COUNTRY-NEUTRAL: No flags, currency symbols, or region-specific elements
- Front door/entrance faces the viewer (bottom of image)
- Building should fill the canvas appropriately for its size class'
WHERE category = 'building_sprite';

-- Default building sprite template
UPDATE prompt_templates
SET base_prompt = 'Create a building sprite for {BUILDING_TYPE}.

Format: Elevated front view with 3D depth, single image
Canvas: SQUARE (size depends on building class - 128/192/256/320 px)
Background: TRANSPARENT (PNG-ready)
Orientation: Entry/front door on BOTTOM FACE (facing the viewer)

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
INSERT OR REPLACE INTO prompt_templates (category, asset_key, template_name, base_prompt, system_instructions, version, is_active, created_by)
VALUES ('building_sprite', 'market_stall', 'Market Stall Sprite',
'Create a building sprite for a MARKET STALL.

Format: Elevated front view with 3D depth, single image
Canvas: 128 x 128 px SQUARE
Background: TRANSPARENT (PNG-ready)
Size class: SHORT (small structure)
Orientation: Entry/customer-facing side on BOTTOM FACE (facing the viewer)

The market stall: Small outdoor wooden vendor booth with canvas awning. Weathered timber frame with visible wood grain. Fabric awning with subtle cloth folds. Display counter with crates of colorful goods. Hand-painted signage. Rustic and humble.

Style: 90s CGI chunky polygonal aesthetic with modern render quality. Soft ambient occlusion under awning. Clean anti-aliased edges. Top-left lighting. Country-neutral. Building only - no vehicles, people, or surrounding objects.',
(SELECT system_instructions FROM prompt_templates WHERE category = '_global' AND asset_key = '_style_guide'), 1, TRUE, 'system');

-- Hot Dog Stand sprite
INSERT OR REPLACE INTO prompt_templates (category, asset_key, template_name, base_prompt, system_instructions, version, is_active, created_by)
VALUES ('building_sprite', 'hot_dog_stand', 'Hot Dog Stand Sprite',
'Create a building sprite for a HOT DOG STAND.

Format: Elevated front view with 3D depth, single image
Canvas: 128 x 128 px SQUARE
Background: TRANSPARENT (PNG-ready)
Size class: SHORT (small structure)
Orientation: Serving counter/customer-facing side on BOTTOM FACE (facing the viewer)

The hot dog stand: Wheeled street vendor cart with large fabric umbrella. Polished metal serving counter with subtle reflections. Condiment bottles visible. Steamer box. Menu board. Classic street food vendor style.

Style: 90s CGI chunky polygonal aesthetic with modern render quality. Specular highlights on metal. Soft shadows under umbrella. Top-left lighting. Country-neutral. Building only.',
(SELECT system_instructions FROM prompt_templates WHERE category = '_global' AND asset_key = '_style_guide'), 1, TRUE, 'system');

-- Campsite sprite
INSERT OR REPLACE INTO prompt_templates (category, asset_key, template_name, base_prompt, system_instructions, version, is_active, created_by)
VALUES ('building_sprite', 'campsite', 'Campsite Sprite',
'Create a building sprite for a CAMPSITE.

Format: Elevated front view with 3D depth, single image
Canvas: 128 x 128 px SQUARE
Background: TRANSPARENT (PNG-ready)
Size class: SHORT (small structure)
Orientation: Tent entrance on BOTTOM FACE (facing the viewer)

The campsite: Canvas A-frame tent with visible fabric tension. Stone campfire ring with charred logs. Wooden supply crates. Oil lantern on a post. Outdoorsy and rugged.

Style: 90s CGI chunky polygonal aesthetic with modern render quality. Soft light through canvas. Ambient occlusion in fabric folds. Top-left lighting. Country-neutral. Site only.',
(SELECT system_instructions FROM prompt_templates WHERE category = '_global' AND asset_key = '_style_guide'), 1, TRUE, 'system');

-- Shop sprite
INSERT OR REPLACE INTO prompt_templates (category, asset_key, template_name, base_prompt, system_instructions, version, is_active, created_by)
VALUES ('building_sprite', 'shop', 'Shop Sprite',
'Create a building sprite for a SHOP.

Format: Elevated front view with 3D depth, single image
Canvas: 192 x 192 px SQUARE
Background: TRANSPARENT (PNG-ready)
Size class: MEDIUM (single-story building)
Orientation: Shop entrance on BOTTOM FACE (facing the viewer)

The shop: Small single-story retail store. Brick or stucco facade with visible texture. Large display window with subtle glass reflections. Fabric awning over entrance. Wooden door with handle. "OPEN" sign in window. Modest neighborhood corner shop feel.

Style: 90s CGI chunky polygonal aesthetic with modern render quality. Glass reflections on window. Soft shadows under awning. Top-left lighting. Country-neutral. Building only.',
(SELECT system_instructions FROM prompt_templates WHERE category = '_global' AND asset_key = '_style_guide'), 1, TRUE, 'system');

-- Burger Bar sprite
INSERT OR REPLACE INTO prompt_templates (category, asset_key, template_name, base_prompt, system_instructions, version, is_active, created_by)
VALUES ('building_sprite', 'burger_bar', 'Burger Bar Sprite',
'Create a building sprite for a BURGER BAR.

Format: Elevated front view with 3D depth, single image
Canvas: 192 x 192 px SQUARE
Background: TRANSPARENT (PNG-ready)
Size class: MEDIUM (single-story building)
Orientation: Diner entrance on BOTTOM FACE (facing the viewer)

The burger bar: 1950s diner style building. Chrome trim with specular reflections. Red and white color scheme. Neon "BURGERS" sign. Large plate glass windows showing checkered floor inside. Retro roadside restaurant vibe.

Style: 90s CGI chunky polygonal aesthetic with modern render quality. Bright chrome reflections. Neon glow effect. Warm interior lighting visible. Top-left lighting. Country-neutral. Building only.',
(SELECT system_instructions FROM prompt_templates WHERE category = '_global' AND asset_key = '_style_guide'), 1, TRUE, 'system');

-- Motel sprite
INSERT OR REPLACE INTO prompt_templates (category, asset_key, template_name, base_prompt, system_instructions, version, is_active, created_by)
VALUES ('building_sprite', 'motel', 'Motel Sprite',
'Create a building sprite for a MOTEL.

Format: Elevated front view with 3D depth, single image
Canvas: 192 x 192 px SQUARE
Background: TRANSPARENT (PNG-ready)
Size class: MEDIUM (single-story, but wide)
Orientation: Room doors/front facade on BOTTOM FACE (facing the viewer)

The motel: Single-story row of connected rooms. Stucco or painted concrete exterior. Individual doors with room numbers and small windows. Flat roof with overhang. Tall "MOTEL" sign with "VACANCY" underneath. Ice machine alcove. Classic roadside motel.

Style: 90s CGI chunky polygonal aesthetic with modern render quality. Warm glow from windows. Sign lighting effect. Soft shadows under roof overhang. Top-left lighting. Country-neutral. Building only.',
(SELECT system_instructions FROM prompt_templates WHERE category = '_global' AND asset_key = '_style_guide'), 1, TRUE, 'system');

-- High Street Store sprite
INSERT OR REPLACE INTO prompt_templates (category, asset_key, template_name, base_prompt, system_instructions, version, is_active, created_by)
VALUES ('building_sprite', 'high_street_store', 'High Street Store Sprite',
'Create a building sprite for a HIGH STREET STORE.

Format: Elevated front view with 3D depth, single image
Canvas: 256 x 256 px SQUARE
Background: TRANSPARENT (PNG-ready)
Size class: TALL (two-story building)
Orientation: Shop entrance on BOTTOM FACE (facing the viewer)

The high street store: Two-story traditional retail building. Ground floor with large shop windows in frames. Decorative upper floor with smaller windows and ornamental details. Prominent signage area above entrance. Recessed doorway. Classic urban shopping district architecture.

Style: 90s CGI chunky polygonal aesthetic with modern render quality. Glass reflections on shop windows. Ambient occlusion in recessed doorway. Top-left lighting. Country-neutral. Building only.',
(SELECT system_instructions FROM prompt_templates WHERE category = '_global' AND asset_key = '_style_guide'), 1, TRUE, 'system');

-- Restaurant sprite
INSERT OR REPLACE INTO prompt_templates (category, asset_key, template_name, base_prompt, system_instructions, version, is_active, created_by)
VALUES ('building_sprite', 'restaurant', 'Restaurant Sprite',
'Create a building sprite for a RESTAURANT.

Format: Elevated front view with 3D depth, single image
Canvas: 256 x 256 px SQUARE
Background: TRANSPARENT (PNG-ready)
Size class: TALL (two-story building)
Orientation: Restaurant entrance on BOTTOM FACE (facing the viewer)

The restaurant: Upscale dining establishment. Elegant facade with rendered or stone-effect walls. Large windows with sheer curtains diffusing warm interior light. Decorative entrance with small canopy. Brass door furniture. Outdoor menu display case. Classy atmosphere.

Style: 90s CGI chunky polygonal aesthetic with modern render quality. Warm golden interior glow. Polished brass reflections. Soft fabric translucency on curtains. Top-left lighting. Country-neutral. Building only.',
(SELECT system_instructions FROM prompt_templates WHERE category = '_global' AND asset_key = '_style_guide'), 1, TRUE, 'system');

-- Manor sprite
INSERT OR REPLACE INTO prompt_templates (category, asset_key, template_name, base_prompt, system_instructions, version, is_active, created_by)
VALUES ('building_sprite', 'manor', 'Manor Sprite',
'Create a building sprite for a MANOR.

Format: Elevated front view with 3D depth, single image
Canvas: 256 x 256 px SQUARE
Background: TRANSPARENT (PNG-ready)
Size class: TALL (large multi-story mansion)
Orientation: Manor entrance on BOTTOM FACE (facing the viewer)

The manor: Grand mansion with multiple stories. Ornate architectural details - cornices, window surrounds, decorative stonework. Large columned entrance portico with steps. Many tall windows with shutters. Steep rooflines with chimneys. Wealthy estate feel - imposing and prestigious.

Style: 90s CGI chunky polygonal aesthetic with modern render quality. Dramatic lighting emphasizing grandeur. Soft shadows in decorative recesses. Top-left lighting. Country-neutral. Building only.',
(SELECT system_instructions FROM prompt_templates WHERE category = '_global' AND asset_key = '_style_guide'), 1, TRUE, 'system');

-- Casino sprite
INSERT OR REPLACE INTO prompt_templates (category, asset_key, template_name, base_prompt, system_instructions, version, is_active, created_by)
VALUES ('building_sprite', 'casino', 'Casino Sprite',
'Create a building sprite for a CASINO.

Format: Elevated front view with 3D depth, single image
Canvas: 320 x 320 px SQUARE
Background: TRANSPARENT (PNG-ready)
Size class: VERY TALL (impressive large building)
Orientation: Casino entrance on BOTTOM FACE (facing the viewer)

The casino: Flashy entertainment building. Facade covered in decorative lights. Grand double-door entrance with brass and glass. Large "CASINO" signage with illuminated lettering. Gold and red color accents. Plush carpet visible through glass doors. Glamorous gambling hall style.

Style: 90s CGI chunky polygonal aesthetic with modern render quality. Bright lighting effects. Gold metallic reflections. Warm inviting glow from entrance. Top-left lighting. Country-neutral. Building only.',
(SELECT system_instructions FROM prompt_templates WHERE category = '_global' AND asset_key = '_style_guide'), 1, TRUE, 'system');

-- Temple sprite
INSERT OR REPLACE INTO prompt_templates (category, asset_key, template_name, base_prompt, system_instructions, version, is_active, created_by)
VALUES ('building_sprite', 'temple', 'Temple Sprite',
'Create a building sprite for a TEMPLE.

Format: Elevated front view with 3D depth, single image
Canvas: 320 x 320 px SQUARE
Background: TRANSPARENT (PNG-ready)
Size class: VERY TALL (impressive sacred building)
Orientation: Temple entrance/front steps on BOTTOM FACE (facing the viewer)

The temple: Sacred spiritual building. Ornate multi-tiered roofing with curved eaves and decorative ridge tiles. Grand entrance stairs leading to main doors. Decorative columns or pillars with carved details. Intricate architectural ornamentation. Stone foundation with polished wooden upper structure. Peaceful, reverent, ancient atmosphere.

Style: 90s CGI chunky polygonal aesthetic with modern render quality. Warm wood tones with subtle grain. Cool stone contrasts. Soft lighting suggesting serenity. Ambient occlusion in architectural details. Top-left lighting. Country-neutral (generic spiritual architecture). Building only.',
(SELECT system_instructions FROM prompt_templates WHERE category = '_global' AND asset_key = '_style_guide'), 1, TRUE, 'system');

-- Bank sprite
INSERT OR REPLACE INTO prompt_templates (category, asset_key, template_name, base_prompt, system_instructions, version, is_active, created_by)
VALUES ('building_sprite', 'bank', 'Bank Sprite',
'Create a building sprite for a BANK.

Format: Elevated front view with 3D depth, single image
Canvas: 320 x 320 px SQUARE
Background: TRANSPARENT (PNG-ready)
Size class: VERY TALL (imposing institutional building)
Orientation: Bank entrance/front columns on BOTTOM FACE (facing the viewer)

The bank: Imposing neoclassical building. Large stone columns at entrance with detailed capitals. Heavy bronze or brass doors with secure appearance. "BANK" carved into stone facade or on polished brass plaque. Barred lower windows with decorative ironwork. Clock mounted above entrance. Solid stone or marble facade. Institutional grandeur - solid, trustworthy, monumental.

Style: 90s CGI chunky polygonal aesthetic with modern render quality. Weighty stone materiality. Polished bronze reflections. Strong shadows from columns. Top-left lighting. Country-neutral. Building only.',
(SELECT system_instructions FROM prompt_templates WHERE category = '_global' AND asset_key = '_style_guide'), 1, TRUE, 'system');

-- Police Station sprite
INSERT OR REPLACE INTO prompt_templates (category, asset_key, template_name, base_prompt, system_instructions, version, is_active, created_by)
VALUES ('building_sprite', 'police_station', 'Police Station Sprite',
'Create a building sprite for a POLICE STATION.

Format: Elevated front view with 3D depth, single image
Canvas: 256 x 256 px SQUARE
Background: TRANSPARENT (PNG-ready)
Size class: TALL (official government building)
Orientation: Station entrance/front doors on BOTTOM FACE (facing the viewer)

The police station: Official government building. Brick and concrete construction with functional design. "POLICE" signage prominently displayed. Blue lamp mounted outside entrance (traditional police lamp). Heavy-duty double doors with reinforced frames. Barred windows on lower level for security. Utilitarian but authoritative architecture.

Style: 90s CGI chunky polygonal aesthetic with modern render quality. Blue lamp glow effect. Strong institutional lighting. Ambient occlusion on brick texture. Top-left lighting. Country-neutral (generic police building). Building only.',
(SELECT system_instructions FROM prompt_templates WHERE category = '_global' AND asset_key = '_style_guide'), 1, TRUE, 'system');

-- ============================================
-- BUILDING REFERENCE SHEETS - Updated format
-- ============================================

-- Update default building_ref template
UPDATE prompt_templates
SET base_prompt = 'Create a building reference sheet for {BUILDING_TYPE}.

Match the EXACT template layout:
- Gray background (#808080), white border boxes, bold labels
- Views: FRONT VIEW (top left), SIDE PROFILE VIEW (top right), BACK VIEW (middle left), 45 DEGREE ISOMETRIC VIEW (middle right), CLOSE UP DETAILS (bottom)
- Title: "BUILDING REFERENCE SHEET: 90s CGI {BUILDING_TYPE}"
- 45 degree view: Entry/door on BOTTOM FACE (facing the viewer)

{CUSTOM_DETAILS}

CRITICAL RULES:
- Entry point/door on BOTTOM FACE (facing the viewer) in isometric view
- Country-neutral (no flags, currency symbols, country-specific elements)
- Building ONLY - no vehicles, people, animals, or surrounding objects

STYLE: 90s CGI chunky polygonal aesthetic with modern render quality.',
    system_instructions = (SELECT system_instructions FROM prompt_templates WHERE category = '_global' AND asset_key = '_style_guide')
WHERE category = 'building_ref' AND asset_key = '_default';

-- Update restaurant reference
UPDATE prompt_templates
SET base_prompt = 'Create a building reference sheet for a RESTAURANT.

Match the EXACT template layout:
- Gray background (#808080), white border boxes, bold labels
- Views: FRONT VIEW (top left), SIDE PROFILE VIEW (top right), BACK VIEW (middle left), 45 DEGREE ISOMETRIC VIEW (middle right), CLOSE UP DETAILS (bottom)
- Title: "BUILDING REFERENCE SHEET: 90s CGI RESTAURANT"
- 45 degree view: Restaurant entrance on BOTTOM FACE (facing the viewer)

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
-- EFFECTS - Updated to SQUARE canvas
-- ============================================

-- Fire effect
INSERT OR REPLACE INTO prompt_templates (category, asset_key, template_name, base_prompt, system_instructions, version, is_active, created_by)
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
(SELECT system_instructions FROM prompt_templates WHERE category = '_global' AND asset_key = '_style_guide'), 1, TRUE, 'system');

-- Damage 25%
INSERT OR REPLACE INTO prompt_templates (category, asset_key, template_name, base_prompt, system_instructions, version, is_active, created_by)
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
(SELECT system_instructions FROM prompt_templates WHERE category = '_global' AND asset_key = '_style_guide'), 1, TRUE, 'system');

-- Damage 50%
INSERT OR REPLACE INTO prompt_templates (category, asset_key, template_name, base_prompt, system_instructions, version, is_active, created_by)
VALUES ('effect', 'damage_50', 'Medium Damage Effect',
'Create a damage effect overlay for MEDIUM DAMAGE (50% health).

Format: 45-degree isometric view
Canvas: 128 x 128 px SQUARE
Background: TRANSPARENT (PNG-ready)
Purpose: This will be overlaid on ANY building to show moderate damage

Show ONLY the damage effect elements - NO BUILDING VISIBLE:
- More prominent dust clouds and debris particles
- Multiple smoke wisps rising from various points
- Larger floating debris (generic gray rubble)
- Scorch marks and soot patches
- Broken glass scattered
- Some structural warping suggestion

CRITICAL: Use only universal elements. No bricks, wood planks, concrete chunks, or any specific building materials.

Style: 90s CGI aesthetic with modern render quality. Noticeable damage state.',
(SELECT system_instructions FROM prompt_templates WHERE category = '_global' AND asset_key = '_style_guide'), 1, TRUE, 'system');

-- Damage 75%
INSERT OR REPLACE INTO prompt_templates (category, asset_key, template_name, base_prompt, system_instructions, version, is_active, created_by)
VALUES ('effect', 'damage_75', 'Heavy Damage Effect',
'Create a damage effect overlay for HEAVY DAMAGE (75% health).

Format: 45-degree isometric view
Canvas: 128 x 128 px SQUARE
Background: TRANSPARENT (PNG-ready)
Purpose: This will be overlaid on ANY building to show severe damage

Show ONLY the damage effect elements - NO BUILDING VISIBLE:
- Heavy dust and smoke clouds
- Thick smoke columns rising
- Significant floating debris field (generic gray/black rubble)
- Large scorch marks and burn patches
- Sparks and embers
- Structural collapse suggestion (bent/warped shapes)
- Exposed framework silhouettes

CRITICAL: Use only universal elements. No bricks, wood planks, concrete chunks, or any specific building materials.

Style: 90s CGI aesthetic with modern render quality. Dramatic near-destruction state.',
(SELECT system_instructions FROM prompt_templates WHERE category = '_global' AND asset_key = '_style_guide'), 1, TRUE, 'system');

-- For Sale sign
INSERT OR REPLACE INTO prompt_templates (category, asset_key, template_name, base_prompt, system_instructions, version, is_active, created_by)
VALUES ('effect', 'for_sale', 'For Sale Sign',
'Create a small UI indicator for a FOR SALE status.

Format: Small icon/sign, slight 3D perspective
Canvas: 64 x 64 px SQUARE
Background: TRANSPARENT (PNG-ready)
Size: Small - approximately 24x24 pixels worth of detail centered
Purpose: Positioned at top-right of a building to show it''s for sale

The sign: A small wooden or metal sign post with a hanging "FOR SALE" placard. Classic real estate sign style. Red and white coloring. Simple and recognizable.

Style: 90s CGI aesthetic with modern render quality. Chunky, readable at small size. Clean anti-aliased edges. Country-neutral (no currency symbols, just "FOR SALE" text).',
(SELECT system_instructions FROM prompt_templates WHERE category = '_global' AND asset_key = '_style_guide'), 1, TRUE, 'system');

-- Security icon
INSERT OR REPLACE INTO prompt_templates (category, asset_key, template_name, base_prompt, system_instructions, version, is_active, created_by)
VALUES ('effect', 'security', 'Security Icon',
'Create a small UI indicator for SECURITY status.

Format: Small icon, slight 3D perspective
Canvas: 64 x 64 px SQUARE
Background: TRANSPARENT (PNG-ready)
Size: Small - approximately 24x24 pixels worth of detail centered
Purpose: Positioned at top-right of a building to show it has security

The icon: A shield shape with a checkmark or lock symbol. Alternatively, a small security camera. Blue and silver coloring. Protective, secure feeling.

Style: 90s CGI aesthetic with modern render quality. Chunky, readable at small size. Clean anti-aliased edges. Instantly recognizable as "protected/secure".',
(SELECT system_instructions FROM prompt_templates WHERE category = '_global' AND asset_key = '_style_guide'), 1, TRUE, 'system');

-- ============================================
-- APPLY SYSTEM INSTRUCTIONS TO ALL NON-AVATAR TEMPLATES
-- ============================================

UPDATE prompt_templates
SET system_instructions = (SELECT system_instructions FROM prompt_templates WHERE category = '_global' AND asset_key = '_style_guide')
WHERE category NOT IN ('avatar', '_global')
  AND system_instructions IS NULL;

-- ============================================
-- UPDATE TERRAIN_REF TEMPLATES - Square format
-- ============================================

UPDATE prompt_templates
SET base_prompt = '5 road tiles in a row. Smooth modern style. NOT pixel art.

ROAD: Dark gray asphalt, yellow/orange dashed centerline, thin gray curb ONLY around road edges.
BACKGROUND: Transparent or white - NOT pavement. Sidewalk does NOT fill empty areas.

CRITICAL: All tiles use 64x64 SQUARE canvas (not diamond).

5 TILES left to right:
1. STRAIGHT - vertical road through center
2. CORNER - L-SHAPE 90 turn (NOT S-curve). Road enters LEFT edge center, turns RIGHT ANGLE, exits BOTTOM edge center. Top-right is empty.
3. T-JUNCTION - road at center of LEFT, RIGHT, BOTTOM edges. Empty at top.
4. CROSSROAD - road at center of all 4 edges
5. DEAD-END - road from center of BOTTOM edge, U-turn at top

Sidewalk wraps road only. Empty space is transparent, not paved.

{CUSTOM_DETAILS}',
    system_instructions = (SELECT system_instructions FROM prompt_templates WHERE category = '_global' AND asset_key = '_style_guide')
WHERE category = 'terrain_ref' AND asset_key = 'road';

UPDATE prompt_templates
SET base_prompt = 'Create a WATER TILES reference sheet for an isometric game.

TILE SHAPE: 64x64 SQUARE canvas

WATER STYLE:
- Blue water with subtle ripples
- Sandy shore where water meets land (shore is INSIDE the water tile)

SHOW 13 TILES in a 5x3 grid:
Row 1: Full-water, N-edge, E-edge, S-edge, W-edge
Row 2: NE-outer, NW-outer, SE-outer, SW-outer, empty
Row 3: NE-inner, NW-inner, SE-inner, SW-inner, empty

Edge tiles: Shore runs along that full edge.
Outer corners: Shore on two adjacent edges.
Inner corners: Small shore in one corner only, rest is water.

Background: white or light gray.

{CUSTOM_DETAILS}',
    system_instructions = (SELECT system_instructions FROM prompt_templates WHERE category = '_global' AND asset_key = '_style_guide')
WHERE category = 'terrain_ref' AND asset_key = 'water';

UPDATE prompt_templates
SET base_prompt = 'Create a DIRT PATH TILES reference sheet for an isometric game.

TILE SHAPE: 64x64 SQUARE canvas

DIRT STYLE:
- Brown/tan dirt path (40% of tile width)
- Green grass fills areas without path

SHOW 6 TILES in a 3x2 grid:
Row 1: NS-straight, EW-straight, NE-corner
Row 2: NW-corner, SE-corner, SW-corner

Path enters/exits at center of each edge for seamless connection.

Background: white or light gray.

{CUSTOM_DETAILS}',
    system_instructions = (SELECT system_instructions FROM prompt_templates WHERE category = '_global' AND asset_key = '_style_guide')
WHERE category = 'terrain_ref' AND asset_key = 'dirt';

UPDATE prompt_templates
SET base_prompt = 'Create a GRASS TILE for an isometric game.

TILE SHAPE: 64x64 SQUARE canvas

Simple green grass with subtle texture. Seamless tiling.

Background: white or light gray.

{CUSTOM_DETAILS}',
    system_instructions = (SELECT system_instructions FROM prompt_templates WHERE category = '_global' AND asset_key = '_style_guide')
WHERE category = 'terrain_ref' AND asset_key = 'grass';

-- ============================================
-- LOG THE MIGRATION
-- ============================================

INSERT INTO asset_audit_log (action, details, created_at)
VALUES ('prompt_template_migration', '{"version": "0031", "changes": "diamond_to_square, added_system_instructions, updated_all_categories"}', CURRENT_TIMESTAMP);
