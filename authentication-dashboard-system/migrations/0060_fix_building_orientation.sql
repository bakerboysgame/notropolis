-- Migration: 0060_fix_building_orientation.sql
-- Purpose: Fix building orientation so front face (with entrance) is on bottom-left side
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

Square transparent PNG with the building+tile centered.
Building and tile float on transparency - the tile is the only ground element.

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
- NO grass (the game map provides grass background)
- NO people or vehicles
- Country-neutral
- Colors should be BRIGHT and SATURATED'
WHERE category = 'building_sprite';

-- ============================================
-- UPDATE BUILDING_REF SYSTEM INSTRUCTIONS
-- ============================================

UPDATE prompt_templates
SET system_instructions = 'You are generating BUILDING REFERENCE SHEETS for "Notropolis", a business simulation game.

## REQUIRED 6-PANEL LAYOUT

Create exactly 6 panels in a 3x2 grid on gray background (#808080):

TOP ROW:
1. FRONT ELEVATION - flat front view, door centered
2. LEFT SIDE - flat side view
3. BACK - flat back view

BOTTOM ROW:
4. RIGHT SIDE - flat side view
5. GAME SPRITE VIEW - ISOMETRIC view with tile base (see below)
6. DETAIL CLOSEUPS - material/texture samples

Each panel has white border and bold label. Building floats on gray - NO ground (except panel 5).

## GAME SPRITE VIEW - ISOMETRIC WITH TILE BASE (panel 5)

True ISOMETRIC projection:
- Camera angle: 30 degrees from horizontal, viewing corner of building
- Two faces visible: FRONT face on the LEFT, SIDE face on the RIGHT
- The FRONT of the building (with entrance/door) faces BOTTOM-LEFT
- Classic SimCity, RollerCoaster Tycoon, Theme Hospital style

MANDATORY DIAMOND TILE BASE:
- Building sits on a DIAMOND-SHAPED tile base
- The diamond is the classic isometric 2:1 ratio (width = 2x height)
- Building is CENTERED on tile with EQUAL margins on all sides
- The tile wraps evenly around the building - same distance front, back, left, right
- Diamond edges should be clearly visible

Base material should be APPROPRIATE for the building:
- Urban buildings: concrete or pavement (gray tones)
- Rural/outdoor buildings (campsite, farm): dirt, gravel, or packed earth
- Industrial: concrete or asphalt
- The base should make sense for what the building is

IMPORTANT: The base should be THIN - just a small margin around the building. The BUILDING is the main focus, not the base. Think of it as a thin foundation edge, not a large plaza.

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

- ALL 6 PANELS REQUIRED
- NO ground/pavement in panels 1-4 and 6
- Panel 5 MUST have diamond tile base (material appropriate to building)
- Base should be THIN - building is the focus
- FRONT of building (entrance/door) faces BOTTOM-LEFT in panel 5
- NO people/vehicles
- Country-neutral
- Colors should be BRIGHT and SATURATED'
WHERE category = 'building_ref';

-- ============================================
-- LOG THE MIGRATION
-- ============================================

INSERT INTO asset_audit_log (action, details, created_at)
VALUES ('prompt_template_migration', '{"version": "0060", "changes": "fixed_building_orientation_front_faces_bottom_left"}', CURRENT_TIMESTAMP);
