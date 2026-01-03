-- Migration: 0038_add_grass_bg_prompt.sql
-- Purpose: Add prompt template for grass_bg (512x512 seamless background tile)
-- Date: 2026-01-03

-- ============================================
-- GRASS BACKGROUND TILE (512x512 seamless)
-- This is different from the isometric grass tile -
-- it's a large square tile that sits BEHIND everything
-- ============================================

INSERT INTO prompt_templates (category, asset_key, template_name, base_prompt, style_guide, system_instructions, is_active, created_by)
VALUES (
    'terrain',
    'grass_bg',
    'Grass Background Tile (512x512)',
    'Create a SEAMLESS GRASS BACKGROUND TILE for an isometric city-builder game.

FORMAT REQUIREMENTS:
- Size: 512x512 pixels SQUARE (NOT isometric diamond)
- Background: SOLID FILL - no transparency, this IS the background
- Purpose: Base layer that sits BEHIND all buildings and terrain tiles

THE GRASS:
- Lush green lawn texture
- Subtle variation in grass blade direction and shade
- Small details: clover patches, slight shadow variations, tiny wildflowers
- Natural outdoor park/lawn appearance
- NOT photorealistic photo - stylized 90s CGI grass texture

SEAMLESS TILING CRITICAL:
- All four edges (top, bottom, left, right) must tile perfectly
- No visible seams when repeated in a grid
- Avoid obvious repeating patterns or focal points
- Even distribution of grass details across the tile

COLOR PALETTE:
- Main grass: #4a7c23 to #5a8c33 (varied greens)
- Highlights: #6b9d44 (sunlit blades)
- Shadows: #3a6c13 (shaded areas)

{CUSTOM_DETAILS}',
    '90s CGI aesthetic with modern photorealistic textures. Natural, organic terrain texture that tiles seamlessly in all directions. Consistent top-left lighting at 45 degrees.',
    'You are creating a seamless tiling grass texture. This is a SQUARE tile (not isometric diamond). The tile must tile perfectly in all directions with no visible seams. Do NOT add any transparency - this tile IS the background layer that everything else sits on top of. Focus on natural grass variation without obvious patterns.',
    TRUE,
    'system'
);
