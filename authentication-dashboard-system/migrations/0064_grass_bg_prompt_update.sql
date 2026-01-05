-- Migration: 0064_grass_bg_prompt_update.sql
-- Purpose: Update grass_bg prompt to generate natural grass texture with varied tones
-- Date: 2026-01-05

-- ============================================
-- UPDATE GRASS_BG PROMPT
-- ============================================

UPDATE prompt_templates
SET base_prompt = 'Create a SEAMLESS GRASS BACKGROUND TEXTURE for a city-builder game.

CANVAS: 512 x 512 pixels
OUTPUT: PNG with NO transparency - this IS the base background

GRASS TEXTURE STYLE:
- Natural lawn grass viewed from above (aerial/satellite perspective)
- Organic, varied appearance - NOT uniform or artificial
- Mix of healthy green and slightly yellowed/dry patches
- Small bare spots and natural imperfections scattered throughout
- Subtle shadows creating depth and dimension

COLOR PALETTE:
- Base grass: Forest green (#3B5F3B to #4A6B4A)
- Healthy patches: Medium green (#4D7A4D)
- Dry/sunlit areas: Yellow-green (#6B7B4A, #7A8A5A)
- Shadow areas: Dark green (#2D4A2D, #3A533A)
- Bare spots: Tiny tan/brown specks (#5A5040)

TEXTURE DETAILS:
- Soft, slightly blurred grass - no individual blades visible
- Gentle variation in tone across the surface
- Random lighter patches where sun hits or grass is slightly dry
- Occasional darker spots where grass is thicker/shadowed
- Natural, organic distribution - avoid geometric patterns

SEAMLESS TILING - CRITICAL:
- All four edges must connect perfectly when tiled
- No obvious seams or repeating patterns visible
- Even distribution of color variation across the tile
- Test by imagining 4 copies placed in a 2x2 grid

STYLE: Photorealistic grass texture, slightly stylized for a game. Think Google Earth satellite view of a natural park lawn with varied grass health.

{CUSTOM_DETAILS}',
    system_instructions = 'You are generating a seamless grass background texture for "Notropolis", a business simulation game.

## OUTPUT REQUIREMENTS

- Canvas: 512 x 512 pixels SQUARE
- Format: PNG with SOLID FILL (no transparency)
- Purpose: Base layer behind all game elements

## TEXTURE STYLE

Create a natural grass texture as seen from above:
- Aerial/satellite view perspective
- Organic variation in color and tone
- Mix of healthy green areas and slightly yellowed patches
- Small imperfections and bare spots for realism
- Soft focus - no individual grass blades visible

## SEAMLESS TILING

This texture MUST tile seamlessly:
- All edges connect perfectly
- No visible seams when repeated
- Even distribution of variation
- No obvious focal points or patterns

## COLOR GUIDANCE

Use natural, varied greens:
- Forest greens as base (#3B5F3B to #4A6B4A)
- Yellow-green for sunlit/dry areas (#6B7B4A)
- Darker greens for shadows (#2D4A2D)
- Tiny tan specks for bare spots

The result should look like a well-used park lawn seen from a drone - natural variation, some wear, but overall healthy grass.',
    version = version + 1,
    updated_at = CURRENT_TIMESTAMP
WHERE asset_key = 'grass_bg' AND category = 'terrain';

-- ============================================
-- LOG THE MIGRATION
-- ============================================

INSERT INTO asset_audit_log (action, details, created_at)
VALUES ('prompt_template_migration', '{"version": "0064", "changes": "grass_bg_natural_texture_prompt"}', CURRENT_TIMESTAMP);
