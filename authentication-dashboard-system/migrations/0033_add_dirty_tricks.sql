-- Migration 0033: Add Dirty Tricks support
-- Adds prompt templates for trick overlays (graffiti, smoke_bomb, etc.)
-- Adds asset_configurations for dirty tricks

-- ============================================
-- DIRTY TRICKS OVERLAY PROMPT TEMPLATES
-- ============================================

-- System instructions for trick overlays
INSERT OR REPLACE INTO prompt_templates (category, asset_key, template_name, base_prompt, system_instructions, version, is_active, created_by)
VALUES ('overlay', '_trick_system', 'Trick Overlay System Instructions',
'',
'You are generating TRICK OVERLAYS for "Notropolis", a business simulation game.

## PURPOSE
These overlays are layered ON TOP of building sprites to show the building has been sabotaged/attacked.
They must be semi-transparent PNG images that partially obscure but don''t completely hide the building.

## CANVAS
Format: SQUARE (matches building sprite sizes: 128x128, 192x192, 256x256, or 320x320)
Background: TRANSPARENT PNG
The overlay should cover roughly 40-70% of the canvas area

## VISUAL STYLE
Art Direction: 90s CGI aesthetic with modern render quality
- Match the chunky, colorful style of the game buildings
- Effects should look impactful but cartoonish (not realistic damage)
- Semi-transparent so the building is still recognizable underneath
- Bright, saturated colors that stand out

## RULES
- Must be PNG with transparency
- Effect should be visible but not completely obscure the building
- Use alpha/transparency so building shows through
- Effects float on transparency - no solid backgrounds
- Match the art style of existing game assets',
1, TRUE, 'system');

-- Graffiti overlay template
INSERT OR REPLACE INTO prompt_templates (category, asset_key, template_name, base_prompt, system_instructions, version, is_active, created_by)
VALUES ('overlay', 'graffiti', 'Graffiti Trick Overlay',
'Create a GRAFFITI OVERLAY for a sabotaged building.

Format: Square PNG with transparency
Size: 256 x 256 px (will be scaled to match building)
Background: TRANSPARENT

The graffiti: Colorful spray paint tags, drips, and scribbles. Bright neon colors (pink, green, orange, blue). Cartoonish vandalism style - think skate park graffiti, not gang tags. Include:
- Large splashy tag letters
- Paint drips running down
- Some spray paint overspray
- Maybe a silly face or symbol

Coverage: 40-60% of canvas - enough to be obvious but building still visible underneath.
Alpha: Use varying transparency (30-80%) so building shows through.

Style: Fun and cartoonish, not menacing. Vibrant colors. 90s game aesthetic.',
(SELECT system_instructions FROM prompt_templates WHERE category = 'overlay' AND asset_key = '_trick_system'),
1, TRUE, 'system');

-- Smoke bomb overlay template
INSERT OR REPLACE INTO prompt_templates (category, asset_key, template_name, base_prompt, system_instructions, version, is_active, created_by)
VALUES ('overlay', 'smoke_bomb', 'Smoke Bomb Trick Overlay',
'Create a SMOKE BOMB OVERLAY for a sabotaged building.

Format: Square PNG with transparency
Size: 256 x 256 px (will be scaled to match building)
Background: TRANSPARENT

The smoke: Thick billowing smoke clouds in cartoon style. Greenish-yellow or purple tinted (stink bomb style). Include:
- Large puffy smoke clouds
- Wisps and tendrils drifting outward
- Some darker areas for depth
- Subtle swirl patterns

Coverage: 50-70% of canvas - building obscured by smoke.
Alpha: Use varying transparency (20-60%) with denser areas in center.

Style: Cartoonish puffy clouds, not realistic smoke. Think comic book "POOF!" clouds. Slight color tint to indicate it''s a stink/smoke bomb. 90s game aesthetic.',
(SELECT system_instructions FROM prompt_templates WHERE category = 'overlay' AND asset_key = '_trick_system'),
1, TRUE, 'system');

-- Stink lines overlay (alternative to smoke bomb)
INSERT OR REPLACE INTO prompt_templates (category, asset_key, template_name, base_prompt, system_instructions, version, is_active, created_by)
VALUES ('overlay', 'stink_lines', 'Stink Lines Trick Overlay',
'Create a STINK LINES OVERLAY for a sabotaged building.

Format: Square PNG with transparency
Size: 256 x 256 px (will be scaled to match building)
Background: TRANSPARENT

The stink effect: Wavy stink lines rising from below, cartoon style. Green/yellow tinted lines. Include:
- Multiple wavy lines rising upward
- Some small flies or odor symbols
- Varying line thickness
- Lines emanating from bottom/sides

Coverage: 30-50% of canvas - visible but not overwhelming.
Alpha: Use transparency (40-70%) so building shows through.

Style: Classic cartoon stink lines (like a garbage can in comics). Green/yellow color. Could add tiny cartoon flies. 90s game aesthetic.',
(SELECT system_instructions FROM prompt_templates WHERE category = 'overlay' AND asset_key = '_trick_system'),
1, TRUE, 'system');

-- Egg splatter overlay
INSERT OR REPLACE INTO prompt_templates (category, asset_key, template_name, base_prompt, system_instructions, version, is_active, created_by)
VALUES ('overlay', 'egg_splatter', 'Egg Splatter Trick Overlay',
'Create an EGG SPLATTER OVERLAY for a vandalized building.

Format: Square PNG with transparency
Size: 256 x 256 px (will be scaled to match building)
Background: TRANSPARENT

The egg splatter: Multiple egg impacts with yolk drips. Yellow and white splatter marks. Include:
- 3-5 egg impact points
- Runny yolk dripping down
- Some egg shell fragments
- Splatter patterns from impact

Coverage: 30-50% of canvas - multiple egg hits visible.
Alpha: Egg is mostly opaque (70-90%) with runny edges more transparent.

Style: Cartoonish egg splats, bright yellow yolk. Think Halloween prank. 90s game aesthetic.',
(SELECT system_instructions FROM prompt_templates WHERE category = 'overlay' AND asset_key = '_trick_system'),
1, TRUE, 'system');

-- Toilet paper overlay
INSERT OR REPLACE INTO prompt_templates (category, asset_key, template_name, base_prompt, system_instructions, version, is_active, created_by)
VALUES ('overlay', 'toilet_paper', 'Toilet Paper Trick Overlay',
'Create a TOILET PAPER (TP) OVERLAY for a vandalized building.

Format: Square PNG with transparency
Size: 256 x 256 px (will be scaled to match building)
Background: TRANSPARENT

The TP effect: Toilet paper streamers draped across the building. White paper strips hanging and tangled. Include:
- Long streamers hanging down
- Tangled clumps
- Some trailing in the "wind"
- Varying strip widths

Coverage: 40-60% of canvas - draped across building.
Alpha: Paper is semi-transparent (50-80%) so building shows through gaps.

Style: Classic Halloween prank TP''d building. White paper streamers. Playful and cartoonish. 90s game aesthetic.',
(SELECT system_instructions FROM prompt_templates WHERE category = 'overlay' AND asset_key = '_trick_system'),
1, TRUE, 'system');

-- ============================================
-- ADD ASSET CONFIGURATIONS FOR DIRTY TRICKS
-- ============================================

INSERT OR REPLACE INTO asset_configurations (category, asset_key, is_active, created_at)
VALUES
    ('tricks', 'graffiti', TRUE, CURRENT_TIMESTAMP),
    ('tricks', 'smoke_bomb', TRUE, CURRENT_TIMESTAMP),
    ('tricks', 'stink_lines', TRUE, CURRENT_TIMESTAMP),
    ('tricks', 'egg_splatter', TRUE, CURRENT_TIMESTAMP),
    ('tricks', 'toilet_paper', TRUE, CURRENT_TIMESTAMP);

-- ============================================
-- LOG THE MIGRATION
-- ============================================

INSERT INTO asset_audit_log (action, details, created_at)
VALUES ('prompt_template_migration', '{"version": "0033", "changes": "added_dirty_tricks_overlays"}', CURRENT_TIMESTAMP);
