-- Migration: 0070_add_building_batch_prompts.sql
-- Purpose: Add prompt templates for building_batch category (multi-building spritesheet generation)
-- Author: Building Batch Generator Feature
-- Date: 2026-01-16

-- ============================================
-- BUILDING BATCH - Default Template
-- System prompt defines the grid/style, user prompt describes each building
-- ============================================

INSERT INTO prompt_templates (category, asset_key, template_name, base_prompt, style_guide, system_instructions, is_active, created_by)
VALUES (
    'building_batch',
    '_default',
    'Building Batch (Default)',
    'Generate the following buildings, each as a separate sprite on the canvas:

1. RESTAURANT - Red/white awning, fork & knife logo, outdoor seating, neon "OPEN" sign
2. BANK - Grand marble columns, vault door visible, clock tower, gold accents
3. MOTEL - Two-story with room doors, neon "VACANCY" sign, parking area
4. GAS STATION - Pumps, canopy, convenience store attached, fuel price sign
5. SHOP - Large display windows, awning, "SALE" signs, shopping bags logo
6. BURGER BAR - Drive-through window, giant burger sign, 50s retro diner style

Each building should be clearly separated with space between them for easy extraction.',
    '90s CGI aesthetic (chunky, geometric shapes like SimCity 3000) rendered with modern photorealistic textures. Buildings should look like they belong in the same game world.',
    'You are generating a SPRITESHEET of multiple building sprites for a top-down isometric city building game.

CRITICAL REQUIREMENTS:
1. Generate ALL buildings on a SINGLE 4K (4096x4096) canvas
2. Each building should be rendered as a SEPARATE SPRITE with clear spacing between them
3. Use a SOLID WHITE or LIGHT GRAY background (for easy background removal)
4. Buildings should be arranged in a GRID pattern with even spacing
5. Each building must be SELF-CONTAINED (no overlapping, no bleeding edges)

VISUAL STYLE:
- 90s CGI aesthetic with modern rendering quality
- Chunky, geometric shapes (like early Pixar/SimCity)
- Photorealistic PBR textures
- Top-left lighting at 45 degrees
- Soft shadows and ambient occlusion

ORIENTATION:
- Isometric 45-degree view for ALL buildings
- Entrance/door faces BOTTOM-LEFT (toward viewer)
- Consistent scale across all buildings
- Buildings should be roughly 400-600 pixels each

BUILDING REQUIREMENTS:
- Each building must be INSTANTLY RECOGNIZABLE for its type
- Use clear visual signifiers (signs, logos, distinctive features)
- Compact square footprint (fits isometric diamond tile)
- 2-3 stories tall for visual impact
- Include rooftop details (AC units, signs, antennas)

DO NOT:
- Overlap buildings
- Use transparent backgrounds
- Include ground/terrain
- Add people or vehicles
- Use text that is hard to read',
    TRUE,
    'system'
);

-- ============================================
-- BUILDING BATCH - Residential Pack
-- ============================================

INSERT INTO prompt_templates (category, asset_key, template_name, base_prompt, style_guide, system_instructions, is_active, created_by)
VALUES (
    'building_batch',
    'batch',
    'Building Batch Generator',
    'Generate the following buildings, each as a separate sprite on the canvas:

1. RESTAURANT - Red/white awning, fork & knife logo, outdoor seating, neon "OPEN" sign
2. BANK - Grand marble columns, vault door visible, clock tower, gold accents
3. MOTEL - Two-story with room doors, neon "VACANCY" sign, parking area
4. GAS STATION - Pumps, canopy, convenience store attached, fuel price sign
5. SHOP - Large display windows, awning, "SALE" signs, shopping bags logo
6. BURGER BAR - Drive-through window, giant burger sign, 50s retro diner style
7. TEMPLE - Asian pagoda style, red columns, ornate roof with gold trim
8. CASINO - Neon lights, playing card motifs, grand entrance with red carpet

Arrange in a 4x2 grid. Each building should be clearly separated with white space between them.',
    '90s CGI aesthetic (chunky, geometric shapes like SimCity 3000) rendered with modern photorealistic textures. Buildings should look like they belong in the same game world.',
    'You are generating a SPRITESHEET of multiple building sprites for a top-down isometric city building game.

CRITICAL REQUIREMENTS:
1. Generate ALL buildings on a SINGLE 4K (4096x4096) canvas
2. Each building should be rendered as a SEPARATE SPRITE with clear spacing between them
3. Use a SOLID WHITE or LIGHT GRAY background (for easy background removal)
4. Buildings should be arranged in a GRID pattern with even spacing
5. Each building must be SELF-CONTAINED (no overlapping, no bleeding edges)

VISUAL STYLE:
- 90s CGI aesthetic with modern rendering quality
- Chunky, geometric shapes (like early Pixar/SimCity)
- Photorealistic PBR textures
- Top-left lighting at 45 degrees
- Soft shadows and ambient occlusion

ORIENTATION:
- Isometric 45-degree view for ALL buildings
- Entrance/door faces BOTTOM-LEFT (toward viewer)
- Consistent scale across all buildings
- Buildings should be roughly 400-600 pixels each

BUILDING REQUIREMENTS:
- Each building must be INSTANTLY RECOGNIZABLE for its type
- Use clear visual signifiers (signs, logos, distinctive features)
- Compact square footprint (fits isometric diamond tile)
- 2-3 stories tall for visual impact
- Include rooftop details (AC units, signs, antennas)

DO NOT:
- Overlap buildings
- Use transparent backgrounds
- Include ground/terrain
- Add people or vehicles
- Use text that is hard to read',
    TRUE,
    'system'
);
