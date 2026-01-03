-- Add prompt templates for vehicle sprites

-- Default vehicle sprite template
INSERT INTO prompt_templates (category, asset_key, template_name, base_prompt, style_guide, system_instructions, is_active, created_by)
VALUES (
    'vehicle',
    '_default',
    'Vehicle Sprite (Default)',
    'Create a TOP-DOWN vehicle sprite for use in a city-builder game.

FORMAT REQUIREMENTS:
- TOP-DOWN OVERHEAD VIEW (bird''s eye, looking straight down from above)
- Single sprite: 64x32 pixels (wider than tall for vehicle shape)
- Background: TRANSPARENT (PNG-ready)
- Vehicle pointing UP (toward top of image) - game will rotate for other directions

THE VEHICLE:
{VEHICLE_FEATURES}

VISUAL STYLE:
- 90s CGI chunky polygonal aesthetic (think early Pixar/DreamWorks)
- Toy-like proportions - slightly exaggerated, not realistic
- Clean, bold shapes with simple geometry
- Soft ambient lighting, no harsh shadows
- Visible roof, hood, and basic car outline from above
- No brand logos or specific manufacturer details

CRITICAL:
- Pure top-down overhead view - NOT isometric, NOT angled
- The car must be clearly recognizable from directly above
- Country-neutral (no specific national markings)
- NO external shadows on transparent background
- Sprite must be CENTERED on the canvas
- This single sprite will be rotated in-game for N/S/E/W movement

{CUSTOM_DETAILS}',
    'Chunky, toy-like 90s CGI aesthetic. Cars should look friendly and game-like, not realistic.',
    'You are generating game sprites for a city-builder game with a 90s CGI aesthetic.

CRITICAL REQUIREMENTS:
1. TOP-DOWN OVERHEAD VIEW - looking straight down from above like a bird''s eye view
2. NOT isometric - pure overhead perspective
3. Transparent PNG background
4. Match the chunky, polygonal 90s CGI style of the game
5. Vehicle should be clearly recognizable from above
6. Single sprite that will be rotated by the game engine for different directions',
    TRUE,
    'system'
);

-- Car sedan sprite template
INSERT INTO prompt_templates (category, asset_key, template_name, base_prompt, style_guide, system_instructions, is_active, created_by)
VALUES (
    'vehicle',
    'car_sedan_sprite',
    'Car Sedan Sprite',
    'Create a TOP-DOWN car sedan sprite for use in a city-builder game.

FORMAT REQUIREMENTS:
- TOP-DOWN OVERHEAD VIEW (bird''s eye, looking straight down from above)
- Single sprite: 64x32 pixels (wider than tall for car shape)
- Background: TRANSPARENT (PNG-ready)
- Car pointing UP (toward top of image) - game will rotate for other directions

THE VEHICLE:
Generic city sedan car seen from directly above:
- Visible roof with subtle windshield/rear window indication
- Hood visible at the front (top of sprite)
- Trunk visible at back (bottom of sprite)
- Chunky, toy-like proportions
- Simple solid color (generic city car colors)
- No brand logos or specific details

VISUAL STYLE:
- 90s CGI chunky polygonal aesthetic (think early Pixar cars)
- Toy-like proportions - rounded but geometric
- Clean, bold shapes with simple geometry
- Soft ambient lighting, slight highlight on roof center
- Match the approved car reference sheet style

CRITICAL:
- Pure top-down overhead view - NOT isometric
- Match the reference image style exactly
- This sprite will be rotated in-game for all directions
- NO external shadows
- CENTERED on canvas

{CUSTOM_DETAILS}',
    'Chunky, toy-like 90s CGI sedan. Friendly game aesthetic.',
    'You are generating a car sprite for a city-builder game with a 90s CGI aesthetic.

CRITICAL REQUIREMENTS:
1. TOP-DOWN OVERHEAD VIEW - looking straight down from above
2. NOT isometric - pure overhead perspective
3. Transparent PNG background
4. Match the chunky, polygonal 90s CGI style
5. Match the approved reference sheet for this car
6. Single sprite that will be rotated by the game engine',
    TRUE,
    'system'
);
