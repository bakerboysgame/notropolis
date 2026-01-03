-- Add prompt templates for NPC (pedestrian) sprites

-- Default NPC sprite template
INSERT INTO prompt_templates (category, asset_key, template_name, base_prompt, style_guide, system_instructions, is_active, created_by)
VALUES (
    'npc',
    '_default',
    'NPC Sprite (Default)',
    'Create a TOP-DOWN pedestrian sprite for use in a city-builder game.

FORMAT REQUIREMENTS:
- TOP-DOWN OVERHEAD VIEW (bird''s eye, looking straight down from above)
- Single sprite: 32x32 pixels
- Background: TRANSPARENT (PNG-ready)
- This single sprite will be rotated in-game for movement in any direction

THE PEDESTRIAN:
{NPC_FEATURES}

VISUAL STYLE:
- 90s CGI chunky polygonal aesthetic (think early Pixar/DreamWorks)
- Realistic human proportions (7-8 heads tall), NOT blocky/Roblox style
- Simple but well-defined geometry
- Visible head, shoulders from above
- Neutral, generic appearance that blends into city background

CRITICAL:
- Pure top-down overhead view - NOT isometric, NOT angled
- Match the chunky 90s CGI aesthetic from building sprites
- Country-neutral (no specific national markings)
- NO external shadows on transparent background
- Sprite must be CENTERED on the canvas

{CUSTOM_DETAILS}',
    'Chunky 90s CGI aesthetic with realistic human proportions. NOT blocky or Roblox-style.',
    'You are generating game sprites for a city-builder game with a 90s CGI aesthetic.

CRITICAL REQUIREMENTS:
1. TOP-DOWN OVERHEAD VIEW - looking straight down from above like a bird''s eye view
2. NOT isometric - pure overhead perspective
3. Transparent PNG background
4. Match the chunky, polygonal 90s CGI style of the game
5. Realistic human proportions (7-8 heads tall)
6. Single sprite that will be rotated by the game engine for different directions',
    TRUE,
    'system'
);

-- Pedestrian walk frame 1 template
INSERT INTO prompt_templates (category, asset_key, template_name, base_prompt, style_guide, system_instructions, is_active, created_by)
VALUES (
    'npc',
    'pedestrian_walk_1',
    'Pedestrian Walk Frame 1',
    'Create a TOP-DOWN pedestrian walking sprite (Frame 1) for use in a city-builder game.

FORMAT REQUIREMENTS:
- TOP-DOWN OVERHEAD VIEW (bird''s eye, looking straight down from above)
- Single sprite: 32x32 pixels
- Background: TRANSPARENT (PNG-ready)
- FRAME 1 of walk cycle: Right leg forward, left leg back - mid-stride pose

THE PEDESTRIAN:
Generic city pedestrian seen from directly above:
- Top of head and shoulders visible
- Right leg extended forward, left leg back
- Right arm back, left arm forward (opposite to legs)
- Business casual clothing visible from above
- Realistic human proportions (7-8 heads tall scale)

VISUAL STYLE:
- 90s CGI chunky polygonal aesthetic
- Simple but recognizable walking pose
- Match the approved pedestrian reference sheet style

CRITICAL:
- Pure top-down overhead view - NOT isometric
- Match the reference image style exactly
- This sprite will be rotated in-game for all directions
- NO external shadows
- CENTERED on canvas

{CUSTOM_DETAILS}',
    'Chunky 90s CGI aesthetic. Walking pose from above.',
    'You are generating a pedestrian walk cycle sprite for a city-builder game.

CRITICAL REQUIREMENTS:
1. TOP-DOWN OVERHEAD VIEW - looking straight down from above
2. FRAME 1: Right leg forward, left leg back
3. Transparent PNG background
4. Match the approved reference sheet for this pedestrian',
    TRUE,
    'system'
);

-- Pedestrian walk frame 2 template
INSERT INTO prompt_templates (category, asset_key, template_name, base_prompt, style_guide, system_instructions, is_active, created_by)
VALUES (
    'npc',
    'pedestrian_walk_2',
    'Pedestrian Walk Frame 2',
    'Create a TOP-DOWN pedestrian walking sprite (Frame 2) for use in a city-builder game.

FORMAT REQUIREMENTS:
- TOP-DOWN OVERHEAD VIEW (bird''s eye, looking straight down from above)
- Single sprite: 32x32 pixels
- Background: TRANSPARENT (PNG-ready)
- FRAME 2 of walk cycle: Left leg forward, right leg back - opposite mid-stride pose

THE PEDESTRIAN:
Generic city pedestrian seen from directly above:
- Top of head and shoulders visible
- Left leg extended forward, right leg back
- Left arm back, right arm forward (opposite to legs)
- Business casual clothing visible from above
- Realistic human proportions (7-8 heads tall scale)

VISUAL STYLE:
- 90s CGI chunky polygonal aesthetic
- Simple but recognizable walking pose
- Match the approved pedestrian reference sheet style

CRITICAL:
- Pure top-down overhead view - NOT isometric
- Match the reference image style exactly
- This sprite will be rotated in-game for all directions
- NO external shadows
- CENTERED on canvas

{CUSTOM_DETAILS}',
    'Chunky 90s CGI aesthetic. Walking pose from above.',
    'You are generating a pedestrian walk cycle sprite for a city-builder game.

CRITICAL REQUIREMENTS:
1. TOP-DOWN OVERHEAD VIEW - looking straight down from above
2. FRAME 2: Left leg forward, right leg back
3. Transparent PNG background
4. Match the approved reference sheet for this pedestrian',
    TRUE,
    'system'
);
