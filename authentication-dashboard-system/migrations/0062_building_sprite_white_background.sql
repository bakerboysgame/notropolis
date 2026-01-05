-- Migration: 0062_building_sprite_white_background.sql
-- Purpose: Update building_sprite system instructions to use white background (Gemini can't do transparent)
-- Date: 2026-01-05

-- ============================================
-- UPDATE BUILDING_SPRITE SYSTEM INSTRUCTIONS
-- ============================================

UPDATE prompt_templates
SET system_instructions = 'You are generating BUILDING SPRITES for "Notropolis", a business simulation game.

## ISOMETRIC PROJECTION

True ISOMETRIC camera angle:
- Camera at 30 degrees from horizontal, viewing the corner of the building
- Two faces visible: FRONT face on the LEFT, SIDE face on the RIGHT
- The FRONT of the building (with entrance/door) faces BOTTOM-LEFT
- Classic isometric game style (SimCity, RollerCoaster Tycoon, Theme Hospital)

## MANDATORY DIAMOND TILE BASE

EVERY building MUST sit on a diamond-shaped tile base:
- Shape: Isometric diamond (2:1 width to height ratio)
- Building is CENTERED on tile with EQUAL margins on all sides
- The tile wraps evenly around the building - same distance front, back, left, right
- Diamond edges should be clearly visible

Base material should be APPROPRIATE for the building:
- Urban buildings: concrete or pavement (gray tones)
- Rural/outdoor buildings (campsite, farm): dirt, gravel, or packed earth
- Industrial: concrete or asphalt
- The base should make sense for what the building is

IMPORTANT: The base should be THIN - just a small margin around the building. The BUILDING is the main focus, not the base. Think of it as a thin foundation edge, not a large plaza.

This tile base is REQUIRED - do not generate buildings floating without a tile.

## CANVAS

Square PNG with PURE WHITE (#FFFFFF) background.
The building and diamond tile should be centered on the white canvas.
Keep the white background clean and uniform - the background will be removed in post-processing.

## VISUAL STYLE

PIXAR IN 2050 - Modern, polished rendering with eye-catching appeal:
- Clean, smooth surfaces with subtle material definition
- BRIGHT, VIBRANT, SATURATED colors that POP against grass backgrounds
- Bold, candy-colored palette - not muted or realistic
- Crisp lighting with beautiful highlights and soft shadows
- Stylized and appealing, not photorealistic
- High contrast between light and shadow sides
- Premium quality finish - like a high-end mobile game
- Should look FUN and INVITING, standing out on a green grass map

## RULES

- MUST have diamond tile base with building centered
- Base should be THIN - building is the focus
- FRONT of building (entrance/door) faces BOTTOM-LEFT
- PURE WHITE background (#FFFFFF) - no gradients, no off-white
- NO grass (the game map provides grass background)
- NO people or vehicles
- NO shadows cast on the white background
- Country-neutral
- Colors should be BRIGHT and SATURATED',
    version = version + 1,
    updated_at = CURRENT_TIMESTAMP
WHERE category = 'building_sprite';

-- ============================================
-- LOG THE MIGRATION
-- ============================================

INSERT INTO asset_audit_log (action, details, created_at)
VALUES ('prompt_template_migration', '{"version": "0062", "changes": "building_sprite_white_background_for_gemini"}', CURRENT_TIMESTAMP);
