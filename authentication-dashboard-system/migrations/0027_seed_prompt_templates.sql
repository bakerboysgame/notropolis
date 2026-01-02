-- Migration: 0027_seed_prompt_templates.sql
-- Purpose: Seed existing hardcoded prompts into prompt_templates table
-- Author: Asset Admin Overhaul - Stage 03
-- Date: 2026-01-02

-- ============================================
-- GLOBAL STYLE GUIDE
-- ============================================

INSERT INTO prompt_templates (category, asset_key, template_name, base_prompt, style_guide, is_active, created_by)
VALUES (
    '_global',
    '_style_guide',
    'Master Style Guide',
    'STYLE GUIDE - Apply to all generations:

VISUAL STYLE:
- 90s CGI aesthetic with modern rendering
- Chunky, geometric shapes (like early Pixar/SimCity)
- Photorealistic textures and PBR materials
- Soft ambient occlusion, professional lighting
- NOT cartoon, NOT flat, NOT cel-shaded

LIGHTING:
- Top-left light source at 45 degrees
- Soft shadows, ambient occlusion
- Consistent across all assets

COLOR PALETTE:
- Muted but vibrant colors
- Realistic material colors
- Avoid oversaturation

PROPORTIONS:
- Slightly exaggerated for readability
- Chunky, stocky characters
- Buildings scaled for game visibility',
    NULL,
    TRUE,
    'system'
);

-- ============================================
-- BUILDING REFERENCE SHEETS - Default Template
-- ============================================

INSERT INTO prompt_templates (category, asset_key, template_name, base_prompt, style_guide, is_active, created_by)
VALUES (
    'building_ref',
    '_default',
    'Building Reference Sheet (Default)',
    'Create a REFERENCE SHEET for a {BUILDING_TYPE}.

LAYOUT: 6 views in a 3x2 grid on gray background
- Top row: FRONT, LEFT SIDE, BACK
- Bottom row: RIGHT SIDE, ISOMETRIC (45-degree), DETAIL CLOSEUPS

Each view in its own labeled box. Show the COMPLETE building in each view.

THE {BUILDING_TYPE}:
{BUILDING_FEATURES}

ISOMETRIC VIEW ORIENTATION:
- Door/entrance faces TOWARD the viewer (bottom-left of the image)
- Back of building at top-right

{CUSTOM_DETAILS}',
    '90s CGI aesthetic (chunky, geometric shapes) with modern photorealistic textures. Think SimCity 3000 building designs rendered with Unreal Engine 5 quality.',
    TRUE,
    'system'
);

-- ============================================
-- BUILDING REFERENCE SHEETS - Building-specific Templates
-- ============================================

INSERT INTO prompt_templates (category, asset_key, template_name, base_prompt, style_guide, is_active, created_by)
VALUES (
    'building_ref',
    'restaurant',
    'Restaurant Reference Sheet',
    'Create a REFERENCE SHEET for a RESTAURANT.

LAYOUT: 6 views in a 3x2 grid on gray background
- Top row: FRONT, LEFT SIDE, BACK
- Bottom row: RIGHT SIDE, ISOMETRIC (45-degree), DETAIL CLOSEUPS

Each view in its own labeled box. Show the COMPLETE building in each view.

THE RESTAURANT:
MUST BE UNMISTAKABLY A RESTAURANT with these distinctive features:
- COMPACT SQUARE FOOTPRINT building (fits isometric diamond tile, not rectangular)
- HUGE illuminated "RESTAURANT" sign on the roof or facade (the word RESTAURANT must be visible)
- Giant fork and knife crossed logo mounted on the building facade
- Red and white striped awning over entrance
- Large windows showing tables with white tablecloths and wine glasses inside
- Steam rising from chimney (suggesting cooking)
- Elegant double doors with brass handles
- Chef''s hat or plate-and-cutlery motif on signage
- TWO STORIES tall to fill the vertical space
NO outdoor furniture, tables, or items outside the building footprint.
The building should SCREAM "this is a restaurant" at first glance.

ISOMETRIC VIEW ORIENTATION:
- Door/entrance faces TOWARD the viewer (bottom-left of the image)
- Back of building at top-right

{CUSTOM_DETAILS}',
    '90s CGI aesthetic (chunky, geometric shapes) with modern photorealistic textures. Think SimCity 3000 building designs rendered with Unreal Engine 5 quality.',
    TRUE,
    'system'
);

INSERT INTO prompt_templates (category, asset_key, template_name, base_prompt, style_guide, is_active, created_by)
VALUES (
    'building_ref',
    'bank',
    'Bank Reference Sheet',
    'Create a REFERENCE SHEET for a BANK.

LAYOUT: 6 views in a 3x2 grid on gray background
- Top row: FRONT, LEFT SIDE, BACK
- Bottom row: RIGHT SIDE, ISOMETRIC (45-degree), DETAIL CLOSEUPS

Each view in its own labeled box. Show the COMPLETE building in each view.

THE BANK:
MUST BE UNMISTAKABLY A BANK with these distinctive features:
- Massive stone columns at entrance (Greek temple style)
- HUGE "BANK" text carved into stone or on brass plaque
- Giant vault door visible through windows or as decorative element
- Gold/brass everywhere - door handles, window frames, trim
- Clock mounted prominently above entrance
- Security bars on all windows
- Heavy bronze double doors with serious locks
- Stone steps leading up to imposing entrance
- Money bag or coin imagery in architecture
The building should SCREAM "this is a bank" at first glance.

ISOMETRIC VIEW ORIENTATION:
- Door/entrance faces TOWARD the viewer (bottom-left of the image)
- Back of building at top-right

{CUSTOM_DETAILS}',
    '90s CGI aesthetic (chunky, geometric shapes) with modern photorealistic textures. Think SimCity 3000 building designs rendered with Unreal Engine 5 quality.',
    TRUE,
    'system'
);

INSERT INTO prompt_templates (category, asset_key, template_name, base_prompt, style_guide, is_active, created_by)
VALUES (
    'building_ref',
    'temple',
    'Temple Reference Sheet',
    'Create a REFERENCE SHEET for a TEMPLE.

LAYOUT: 6 views in a 3x2 grid on gray background
- Top row: FRONT, LEFT SIDE, BACK
- Bottom row: RIGHT SIDE, ISOMETRIC (45-degree), DETAIL CLOSEUPS

Each view in its own labeled box. Show the COMPLETE building in each view.

THE TEMPLE:
MUST BE UNMISTAKABLY A TEMPLE with these distinctive features:
- Multi-tiered pagoda-style roof with curved eaves
- Ornate roof decorations (dragons, phoenixes, or abstract spiritual symbols)
- Grand stone staircase leading to main entrance
- Large ceremonial doors with intricate carvings
- Incense burner or offering table visible at entrance
- Bell tower or prayer bell
- Decorative columns with spiritual motifs
- Peaceful garden elements (stone lanterns, small trees)
- Roof tiles in traditional terracotta or gold
Religion-neutral but clearly spiritual/sacred architecture.

ISOMETRIC VIEW ORIENTATION:
- Door/entrance faces TOWARD the viewer (bottom-left of the image)
- Back of building at top-right

{CUSTOM_DETAILS}',
    '90s CGI aesthetic (chunky, geometric shapes) with modern photorealistic textures. Think SimCity 3000 building designs rendered with Unreal Engine 5 quality.',
    TRUE,
    'system'
);

INSERT INTO prompt_templates (category, asset_key, template_name, base_prompt, style_guide, is_active, created_by)
VALUES (
    'building_ref',
    'casino',
    'Casino Reference Sheet',
    'Create a REFERENCE SHEET for a CASINO.

LAYOUT: 6 views in a 3x2 grid on gray background
- Top row: FRONT, LEFT SIDE, BACK
- Bottom row: RIGHT SIDE, ISOMETRIC (45-degree), DETAIL CLOSEUPS

Each view in its own labeled box. Show the COMPLETE building in each view.

THE CASINO:
MUST BE UNMISTAKABLY A CASINO with these distinctive features:
- MASSIVE illuminated "CASINO" sign with hundreds of light bulbs
- Giant playing card suits (spades, hearts, diamonds, clubs) on facade
- Huge dice or roulette wheel decorations
- Red carpet and velvet rope entrance
- Gold and red color scheme everywhere
- Flashing lights covering the entire facade
- Showgirl or lucky 7 imagery
- Grand double doors with golden handles
- Slot machine silhouettes visible through windows
The building should SCREAM "Las Vegas casino" at first glance.

ISOMETRIC VIEW ORIENTATION:
- Door/entrance faces TOWARD the viewer (bottom-left of the image)
- Back of building at top-right

{CUSTOM_DETAILS}',
    '90s CGI aesthetic (chunky, geometric shapes) with modern photorealistic textures. Think SimCity 3000 building designs rendered with Unreal Engine 5 quality.',
    TRUE,
    'system'
);

INSERT INTO prompt_templates (category, asset_key, template_name, base_prompt, style_guide, is_active, created_by)
VALUES (
    'building_ref',
    'police_station',
    'Police Station Reference Sheet',
    'Create a REFERENCE SHEET for a POLICE STATION.

LAYOUT: 6 views in a 3x2 grid on gray background
- Top row: FRONT, LEFT SIDE, BACK
- Bottom row: RIGHT SIDE, ISOMETRIC (45-degree), DETAIL CLOSEUPS

Each view in its own labeled box. Show the COMPLETE building in each view.

THE POLICE STATION:
MUST BE UNMISTAKABLY A POLICE STATION with these distinctive features:
- LARGE "POLICE" text prominently displayed on building
- Classic blue police lamp outside entrance (illuminated)
- Blue and white color scheme
- Badge or shield emblem on facade
- Heavy reinforced double doors
- Barred windows on lower level
- Security cameras visible
- Handcuff or badge motifs in architecture
- Utilitarian brick and concrete construction
The building should SCREAM "police station" at first glance.

ISOMETRIC VIEW ORIENTATION:
- Door/entrance faces TOWARD the viewer (bottom-left of the image)
- Back of building at top-right

{CUSTOM_DETAILS}',
    '90s CGI aesthetic (chunky, geometric shapes) with modern photorealistic textures. Think SimCity 3000 building designs rendered with Unreal Engine 5 quality.',
    TRUE,
    'system'
);

INSERT INTO prompt_templates (category, asset_key, template_name, base_prompt, style_guide, is_active, created_by)
VALUES (
    'building_ref',
    'manor',
    'Manor Reference Sheet',
    'Create a REFERENCE SHEET for a MANOR.

LAYOUT: 6 views in a 3x2 grid on gray background
- Top row: FRONT, LEFT SIDE, BACK
- Bottom row: RIGHT SIDE, ISOMETRIC (45-degree), DETAIL CLOSEUPS

Each view in its own labeled box. Show the COMPLETE building in each view.

THE MANOR:
MUST BE UNMISTAKABLY A WEALTHY MANOR with these distinctive features:
- Grand columned entrance portico with stone steps
- Multiple stories with many tall windows
- Ornate cornices and decorative stonework
- Multiple chimneys on steep rooflines
- Wrought iron gates or fence elements
- Coat of arms or family crest on facade
- Manicured topiary at entrance
- Luxury car silhouette in driveway (optional)
- Stained glass or arched windows
The building should SCREAM "wealthy mansion" at first glance.

ISOMETRIC VIEW ORIENTATION:
- Door/entrance faces TOWARD the viewer (bottom-left of the image)
- Back of building at top-right

{CUSTOM_DETAILS}',
    '90s CGI aesthetic (chunky, geometric shapes) with modern photorealistic textures. Think SimCity 3000 building designs rendered with Unreal Engine 5 quality.',
    TRUE,
    'system'
);

INSERT INTO prompt_templates (category, asset_key, template_name, base_prompt, style_guide, is_active, created_by)
VALUES (
    'building_ref',
    'high_street_store',
    'High Street Store Reference Sheet',
    'Create a REFERENCE SHEET for a HIGH STREET STORE.

LAYOUT: 6 views in a 3x2 grid on gray background
- Top row: FRONT, LEFT SIDE, BACK
- Bottom row: RIGHT SIDE, ISOMETRIC (45-degree), DETAIL CLOSEUPS

Each view in its own labeled box. Show the COMPLETE building in each view.

THE HIGH STREET STORE:
MUST BE UNMISTAKABLY A DEPARTMENT STORE with these distinctive features:
- Two-story Victorian retail building
- LARGE "DEPARTMENT STORE" or "STORE" signage
- Multiple display windows with mannequins visible
- Revolving door entrance
- Ornate upper floor with decorative moldings
- Shopping bag motif or logo
- Awning over each display window
- "SALE" or "OPEN" signs in windows
The building should SCREAM "shopping destination" at first glance.

ISOMETRIC VIEW ORIENTATION:
- Door/entrance faces TOWARD the viewer (bottom-left of the image)
- Back of building at top-right

{CUSTOM_DETAILS}',
    '90s CGI aesthetic (chunky, geometric shapes) with modern photorealistic textures. Think SimCity 3000 building designs rendered with Unreal Engine 5 quality.',
    TRUE,
    'system'
);

INSERT INTO prompt_templates (category, asset_key, template_name, base_prompt, style_guide, is_active, created_by)
VALUES (
    'building_ref',
    'motel',
    'Motel Reference Sheet',
    'Create a REFERENCE SHEET for a MOTEL.

LAYOUT: 6 views in a 3x2 grid on gray background
- Top row: FRONT, LEFT SIDE, BACK
- Bottom row: RIGHT SIDE, ISOMETRIC (45-degree), DETAIL CLOSEUPS

Each view in its own labeled box. Show the COMPLETE building in each view.

THE MOTEL:
MUST BE UNMISTAKABLY A MOTEL with these distinctive features:
- TALL neon "MOTEL" sign (classic roadside style)
- "VACANCY" sign underneath (illuminated)
- Single-story row of rooms with numbered doors
- Ice machine and vending machine alcove
- Parking spaces in front of each door
- Pool area visible (optional)
- Office with "RECEPTION" sign
- Classic Americana roadside aesthetic
The building should SCREAM "roadside motel" at first glance.

ISOMETRIC VIEW ORIENTATION:
- Door/entrance faces TOWARD the viewer (bottom-left of the image)
- Back of building at top-right

{CUSTOM_DETAILS}',
    '90s CGI aesthetic (chunky, geometric shapes) with modern photorealistic textures. Think SimCity 3000 building designs rendered with Unreal Engine 5 quality.',
    TRUE,
    'system'
);

INSERT INTO prompt_templates (category, asset_key, template_name, base_prompt, style_guide, is_active, created_by)
VALUES (
    'building_ref',
    'burger_bar',
    'Burger Bar Reference Sheet',
    'Create a REFERENCE SHEET for a BURGER BAR.

LAYOUT: 6 views in a 3x2 grid on gray background
- Top row: FRONT, LEFT SIDE, BACK
- Bottom row: RIGHT SIDE, ISOMETRIC (45-degree), DETAIL CLOSEUPS

Each view in its own labeled box. Show the COMPLETE building in each view.

THE BURGER BAR:
MUST BE UNMISTAKABLY A BURGER RESTAURANT with these distinctive features:
- GIANT hamburger model/sign on the roof
- Neon "BURGERS" sign with glowing tubes
- 1950s chrome diner aesthetic
- Red and white color scheme
- Large windows showing checkered floor inside
- Counter stools visible through windows
- Menu board with burger pictures
- Milkshake or fries imagery
- Classic American diner style
The building should SCREAM "burger joint" at first glance.

ISOMETRIC VIEW ORIENTATION:
- Door/entrance faces TOWARD the viewer (bottom-left of the image)
- Back of building at top-right

{CUSTOM_DETAILS}',
    '90s CGI aesthetic (chunky, geometric shapes) with modern photorealistic textures. Think SimCity 3000 building designs rendered with Unreal Engine 5 quality.',
    TRUE,
    'system'
);

INSERT INTO prompt_templates (category, asset_key, template_name, base_prompt, style_guide, is_active, created_by)
VALUES (
    'building_ref',
    'shop',
    'Shop Reference Sheet',
    'Create a REFERENCE SHEET for a SHOP.

LAYOUT: 6 views in a 3x2 grid on gray background
- Top row: FRONT, LEFT SIDE, BACK
- Bottom row: RIGHT SIDE, ISOMETRIC (45-degree), DETAIL CLOSEUPS

Each view in its own labeled box. Show the COMPLETE building in each view.

THE SHOP:
MUST BE UNMISTAKABLY A SMALL SHOP with these distinctive features:
- "SHOP" or "OPEN" sign prominently displayed
- Striped fabric awning over entrance
- Display window with goods visible
- Small A-frame sign outside
- Brass door handle and bell
- Friendly welcoming appearance
- Newspaper stand or product display outside
- Classic corner shop aesthetic
The building should SCREAM "neighborhood shop" at first glance.

ISOMETRIC VIEW ORIENTATION:
- Door/entrance faces TOWARD the viewer (bottom-left of the image)
- Back of building at top-right

{CUSTOM_DETAILS}',
    '90s CGI aesthetic (chunky, geometric shapes) with modern photorealistic textures. Think SimCity 3000 building designs rendered with Unreal Engine 5 quality.',
    TRUE,
    'system'
);

INSERT INTO prompt_templates (category, asset_key, template_name, base_prompt, style_guide, is_active, created_by)
VALUES (
    'building_ref',
    'campsite',
    'Campsite Reference Sheet',
    'Create a REFERENCE SHEET for a CAMPSITE.

LAYOUT: 6 views in a 3x2 grid on gray background
- Top row: FRONT, LEFT SIDE, BACK
- Bottom row: RIGHT SIDE, ISOMETRIC (45-degree), DETAIL CLOSEUPS

Each view in its own labeled box. Show the COMPLETE structure in each view.

THE CAMPSITE:
MUST BE UNMISTAKABLY A CAMPSITE with these distinctive features:
- Large canvas A-frame tent as centerpiece
- Stone campfire ring with logs and flames/smoke
- "CAMP" flag or wooden sign
- Cooking pot over fire
- Wooden supply crates and barrels
- Oil lantern on post (glowing)
- Outdoor adventurer aesthetic
- Sleeping bag visible at tent entrance
The building should SCREAM "camping site" at first glance.

ISOMETRIC VIEW ORIENTATION:
- Door/entrance faces TOWARD the viewer (bottom-left of the image)
- Back of building at top-right

{CUSTOM_DETAILS}',
    '90s CGI aesthetic (chunky, geometric shapes) with modern photorealistic textures. Think SimCity 3000 building designs rendered with Unreal Engine 5 quality.',
    TRUE,
    'system'
);

INSERT INTO prompt_templates (category, asset_key, template_name, base_prompt, style_guide, is_active, created_by)
VALUES (
    'building_ref',
    'hot_dog_stand',
    'Hot Dog Stand Reference Sheet',
    'Create a REFERENCE SHEET for a HOT DOG STAND.

LAYOUT: 6 views in a 3x2 grid on gray background
- Top row: FRONT, LEFT SIDE, BACK
- Bottom row: RIGHT SIDE, ISOMETRIC (45-degree), DETAIL CLOSEUPS

Each view in its own labeled box. Show the COMPLETE structure in each view.

THE HOT DOG STAND:
MUST BE UNMISTAKABLY A HOT DOG STAND with these distinctive features:
- GIANT hot dog model on top of cart
- "HOT DOGS" sign prominently displayed
- Large striped umbrella
- Mustard and ketchup bottles visible
- Steamer box with steam rising
- Menu board with prices
- Napkin dispenser
- Classic street food cart aesthetic
The building should SCREAM "hot dog vendor" at first glance.

ISOMETRIC VIEW ORIENTATION:
- Door/entrance faces TOWARD the viewer (bottom-left of the image)
- Back of building at top-right

{CUSTOM_DETAILS}',
    '90s CGI aesthetic (chunky, geometric shapes) with modern photorealistic textures. Think SimCity 3000 building designs rendered with Unreal Engine 5 quality.',
    TRUE,
    'system'
);

INSERT INTO prompt_templates (category, asset_key, template_name, base_prompt, style_guide, is_active, created_by)
VALUES (
    'building_ref',
    'market_stall',
    'Market Stall Reference Sheet',
    'Create a REFERENCE SHEET for a MARKET STALL.

LAYOUT: 6 views in a 3x2 grid on gray background
- Top row: FRONT, LEFT SIDE, BACK
- Bottom row: RIGHT SIDE, ISOMETRIC (45-degree), DETAIL CLOSEUPS

Each view in its own labeled box. Show the COMPLETE structure in each view.

THE MARKET STALL:
MUST BE UNMISTAKABLY A MARKET STALL with these distinctive features:
- Wooden vendor booth with canvas awning
- Crates overflowing with colorful produce/goods
- Hand-painted price signs
- Weighing scale on counter
- Hanging baskets of goods
- "FRESH" or "MARKET" signage
- Rustic farmer''s market aesthetic
- Apron hanging on hook
The building should SCREAM "market vendor" at first glance.

ISOMETRIC VIEW ORIENTATION:
- Door/entrance faces TOWARD the viewer (bottom-left of the image)
- Back of building at top-right

{CUSTOM_DETAILS}',
    '90s CGI aesthetic (chunky, geometric shapes) with modern photorealistic textures. Think SimCity 3000 building designs rendered with Unreal Engine 5 quality.',
    TRUE,
    'system'
);

INSERT INTO prompt_templates (category, asset_key, template_name, base_prompt, style_guide, is_active, created_by)
VALUES (
    'building_ref',
    'claim_stake',
    'Claim Stake Reference Sheet',
    'Create a REFERENCE SHEET for a CLAIM STAKE.

LAYOUT: 6 views in a 3x2 grid on gray background
- Top row: FRONT, LEFT SIDE, BACK
- Bottom row: RIGHT SIDE, ISOMETRIC (45-degree), DETAIL CLOSEUPS

Each view in its own labeled box. Show the COMPLETE structure in each view.

THE CLAIM STAKE:
MUST BE UNMISTAKABLY A LAND CLAIM STAKE with these distinctive features:
- Wooden stake/post driven into the ground (main element)
- Small wooden "SOLD" or "CLAIMED" sign hanging from the post
- Simple rope or ribbon tied near the top
- The stake is the ONLY structure - no buildings, just the marker
- Stakes should look weathered but sturdy
- Clear indication that this plot of land has been purchased
- Small footprint - just the stake and immediate surroundings
- Maybe a small surveyor''s flag or ribbon
This is a placeholder for purchased but unbuilt land.

ISOMETRIC VIEW ORIENTATION:
- Door/entrance faces TOWARD the viewer (bottom-left of the image)
- Back of building at top-right

{CUSTOM_DETAILS}',
    '90s CGI aesthetic (chunky, geometric shapes) with modern photorealistic textures. Think SimCity 3000 building designs rendered with Unreal Engine 5 quality.',
    TRUE,
    'system'
);

INSERT INTO prompt_templates (category, asset_key, template_name, base_prompt, style_guide, is_active, created_by)
VALUES (
    'building_ref',
    'demolished',
    'Demolished Building Reference Sheet',
    'Create a REFERENCE SHEET for a DEMOLISHED BUILDING.

LAYOUT: 6 views in a 3x2 grid on gray background
- Top row: FRONT, LEFT SIDE, BACK
- Bottom row: RIGHT SIDE, ISOMETRIC (45-degree), DETAIL CLOSEUPS

Each view in its own labeled box. Show the COMPLETE scene in each view.

THE DEMOLISHED BUILDING:
MUST BE UNMISTAKABLY A DEMOLISHED/RUINED BUILDING with these distinctive features:
- Pile of rubble and debris (bricks, wood, concrete chunks)
- Broken walls - partial wall sections still standing at different heights
- Exposed rebar and twisted metal
- Dust clouds or settling debris
- "CONDEMNED" or "DEMOLITION" sign or yellow caution tape
- Construction/safety barriers around the perimeter
- Maybe a wrecking ball or demolition crane element
- Dark scorch marks suggesting damage
- Broken glass and scattered materials
- NOT a construction site - this is destruction/ruin
This shows a building at 0% health waiting to be cleared.

ISOMETRIC VIEW ORIENTATION:
- Door/entrance faces TOWARD the viewer (bottom-left of the image)
- Back of building at top-right

{CUSTOM_DETAILS}',
    '90s CGI aesthetic (chunky, geometric shapes) with modern photorealistic textures. Think SimCity 3000 building designs rendered with Unreal Engine 5 quality.',
    TRUE,
    'system'
);

-- ============================================
-- BUILDING SPRITE - Default Template
-- ============================================

INSERT INTO prompt_templates (category, asset_key, template_name, base_prompt, style_guide, is_active, created_by)
VALUES (
    'building_sprite',
    '_default',
    'Building Sprite (Default)',
    'Create a {BUILDING_TYPE} isometric game sprite.

=== ABSOLUTE REQUIREMENTS ===

NO FLOOR/BASE/GROUND:
- The building FLOATS on transparent background
- NO floor tile, NO concrete pad, NO platform underneath
- Building walls go straight down to nothing - just transparency below
- The building fills the canvas edge-to-edge with NO ground visible

DOOR/ENTRY ORIENTATION:
- Isometric 45-degree view looking DOWN at the building
- The door/entrance MUST be on the LEFT-FACING wall of the building
- When looking at the final image: door is on the LEFT side, back wall on the RIGHT
- Think: you''re standing SOUTH-EAST of the building, looking at its WEST and NORTH walls

SIZE: {SIZE_CLASS}

THE {BUILDING_TYPE}:
{BUILDING_FEATURES}

{CUSTOM_DETAILS}',
    '90s CGI (chunky geometric shapes) with photorealistic textures.',
    TRUE,
    'system'
);

-- ============================================
-- CHARACTER REFERENCE SHEETS
-- ============================================

INSERT INTO prompt_templates (category, asset_key, template_name, base_prompt, style_guide, is_active, created_by)
VALUES (
    'character_ref',
    '_default',
    'Character Reference Sheet (Default)',
    'Create a character reference sheet for a {CHARACTER_TYPE}.

CHARACTER REFERENCE SHEET TEMPLATE LAYOUT (CRITICAL - FOLLOW EXACTLY):

Canvas: 16:9 landscape, neutral gray background (#808080)

LAYOUT - 6 SEPARATE BOXES arranged in a 3x2 grid:
ROW 1 (top):
  [FRONT VIEW] - Character viewed straight-on from front
  [SIDE PROFILE] - Character viewed from left side (90 degrees)
  [BACK VIEW] - Character viewed from behind

ROW 2 (bottom):
  [TOP-DOWN VIEW] - Character viewed from directly above (bird''s eye) - CRITICAL for sprite generation
  [3/4 FRONT VIEW] - 45-degree front angle (shows depth)
  [DETAIL CLOSEUPS] - Face closeup, hands, shoes, material textures

CRITICAL LAYOUT RULES:
- Each view in its OWN SEPARATE BOX with white border
- Views must NOT overlap or blend into each other
- Bold label at top of each box
- Title at very top: "CHARACTER REFERENCE SHEET: [CHARACTER NAME]"
- EVERY VIEW shows the COMPLETE character, same pose
- Same lighting across all views (top-left at 45 degrees)
- TOP-DOWN VIEW is ESSENTIAL - shows head/shoulders from above for directional walk sprites

Title: "CHARACTER REFERENCE SHEET: 90s CGI {CHARACTER_TYPE}"

{CHARACTER_FEATURES}

{CUSTOM_DETAILS}

Remember: All views must show the exact same character. This reference establishes the character proportions and style that all pedestrian NPCs and avatar assets must match.',
    'Chunky, geometric shapes like early Pixar/SimCity with photorealistic textures. Clean edges, soft shadows.',
    TRUE,
    'system'
);

INSERT INTO prompt_templates (category, asset_key, template_name, base_prompt, style_guide, is_active, created_by)
VALUES (
    'character_ref',
    'pedestrian',
    'Pedestrian Character Reference',
    'Create a character reference sheet for a PEDESTRIAN.

CHARACTER REFERENCE SHEET TEMPLATE LAYOUT (CRITICAL - FOLLOW EXACTLY):

Canvas: 16:9 landscape, neutral gray background (#808080)

LAYOUT - 6 SEPARATE BOXES arranged in a 3x2 grid:
ROW 1 (top):
  [FRONT VIEW] - Character viewed straight-on from front
  [SIDE PROFILE] - Character viewed from left side (90 degrees)
  [BACK VIEW] - Character viewed from behind

ROW 2 (bottom):
  [TOP-DOWN VIEW] - Character viewed from directly above (bird''s eye) - CRITICAL for sprite generation
  [3/4 FRONT VIEW] - 45-degree front angle (shows depth)
  [DETAIL CLOSEUPS] - Face closeup, hands, shoes, material textures

Title: "CHARACTER REFERENCE SHEET: 90s CGI PEDESTRIAN"

THE CHARACTER:
PEDESTRIAN CHARACTER - generic city walker for ambient animation:
- REALISTIC human proportions (7-8 heads tall like a real adult), NOT blocky/Roblox
- Think Toy Story or Incredibles humans - normal proportions, stylized 90s CGI rendering
- Simple but well-defined geometry - proper arms, legs, torso proportions
- Business casual attire (polo shirt, trousers, sensible shoes)
- Neutral expression, casual walking demeanor
- Generic adult that blends into city background
- NO specific ethnicity - neutral skin tone placeholder
When approved, this generates directional walk sprites (N/S/E/W) automatically.
This establishes the character style for ALL ambient pedestrian NPCs.

{CUSTOM_DETAILS}

Remember: All views must show the exact same character. This reference establishes the character proportions and style that all pedestrian NPCs and avatar assets must match.',
    'Chunky, geometric shapes like early Pixar/SimCity with photorealistic textures. Clean edges, soft shadows.',
    TRUE,
    'system'
);

-- ============================================
-- VEHICLE REFERENCE SHEETS
-- ============================================

INSERT INTO prompt_templates (category, asset_key, template_name, base_prompt, style_guide, is_active, created_by)
VALUES (
    'vehicle_ref',
    '_default',
    'Vehicle Reference Sheet (Default)',
    'Create a vehicle reference sheet for a {VEHICLE_TYPE}.

VEHICLE REFERENCE SHEET TEMPLATE LAYOUT (CRITICAL - FOLLOW EXACTLY):

Canvas: 16:9 landscape, neutral gray background (#808080)

LAYOUT - 6 SEPARATE BOXES arranged in a 3x2 grid:
ROW 1 (top):
  [FRONT VIEW] - Vehicle viewed straight-on from front
  [SIDE VIEW] - Vehicle viewed from driver''s side
  [BACK VIEW] - Vehicle viewed from behind

ROW 2 (bottom):
  [TOP-DOWN VIEW] - Vehicle viewed from directly above
  [ISOMETRIC VIEW] - 45-degree isometric angle (game view)
  [DETAIL CLOSEUPS] - Wheels, headlights, interior glimpse, material textures

Title: "VEHICLE REFERENCE SHEET: 90s CGI {VEHICLE_TYPE}"

THE VEHICLE:
{VEHICLE_FEATURES}

VEHICLE-SPECIFIC RULES:
- NO brand logos, badges, or manufacturer markings
- Country-neutral (no specific license plate style)
- Chunky, toy-like proportions matching the building style
- Same top-left lighting as buildings

{CUSTOM_DETAILS}

Remember: All views must show the exact same vehicle. This reference establishes the vehicle style that all car sprites must match.',
    'STYLE: 90s CGI aesthetic with modern rendering. Chunky, geometric shapes (like early Pixar/SimCity). Photorealistic textures and PBR materials.',
    TRUE,
    'system'
);

INSERT INTO prompt_templates (category, asset_key, template_name, base_prompt, style_guide, is_active, created_by)
VALUES (
    'vehicle_ref',
    'car_sedan',
    'Sedan Vehicle Reference',
    'Create a vehicle reference sheet for a CAR SEDAN.

VEHICLE REFERENCE SHEET TEMPLATE LAYOUT (CRITICAL - FOLLOW EXACTLY):

Canvas: 16:9 landscape, neutral gray background (#808080)

LAYOUT - 6 SEPARATE BOXES arranged in a 3x2 grid:
ROW 1 (top):
  [FRONT VIEW] - Vehicle viewed straight-on from front
  [SIDE VIEW] - Vehicle viewed from driver''s side
  [BACK VIEW] - Vehicle viewed from behind

ROW 2 (bottom):
  [TOP-DOWN VIEW] - Vehicle viewed from directly above
  [ISOMETRIC VIEW] - 45-degree isometric angle (game view)
  [DETAIL CLOSEUPS] - Wheels, headlights, interior glimpse, material textures

Title: "VEHICLE REFERENCE SHEET: 90s CGI CAR SEDAN"

THE VEHICLE:
SEDAN CAR - generic city vehicle (TOP-DOWN OVERHEAD VIEW):
- 90s CGI SHAPES with PHOTOREALISTIC MODERN RENDERING
- TOP-DOWN view showing roof, hood, trunk from directly above
- Stocky, geometric proportions (90s game aesthetic) but rendered with PBR materials
- 4-door sedan shape, compact and readable silhouette from above
- PHOTOREALISTIC paint finish with clear coat reflections and metallic flake
- Visible sunroof or roof details, windshield reflections
- Wheels visible at corners, realistic rubber texture
- Neutral color (gray/silver/dark blue) to show material quality
- NO brand logos, badges, or text
This establishes the car style for all vehicles - 90s SHAPES, TOP-DOWN VIEW.

{CUSTOM_DETAILS}

Remember: All views must show the exact same vehicle.',
    'STYLE: 90s CGI aesthetic with modern rendering. Chunky, geometric shapes (like early Pixar/SimCity). Photorealistic textures and PBR materials.',
    TRUE,
    'system'
);

-- ============================================
-- EFFECT REFERENCE SHEETS
-- ============================================

INSERT INTO prompt_templates (category, asset_key, template_name, base_prompt, style_guide, is_active, created_by)
VALUES (
    'effect_ref',
    '_default',
    'Effect Reference Sheet (Default)',
    'Create an effect reference sheet for {EFFECT_TYPE}.

EFFECT REFERENCE SHEET TEMPLATE LAYOUT (CRITICAL - FOLLOW EXACTLY):

Canvas: 16:9 landscape, neutral gray background (#808080)

LAYOUT - 6 SEPARATE BOXES arranged in a 3x2 grid:
ROW 1 (top):
  [EFFECT OVERVIEW] - Full effect from isometric game view angle
  [FRONT VIEW] - Effect viewed straight-on
  [SIDE VIEW] - Effect from side angle

ROW 2 (bottom):
  [TOP-DOWN VIEW] - Effect from above
  [ANIMATION FRAMES] - 3-4 key frames showing effect progression/variation
  [ELEMENT BREAKDOWN] - Individual particles, flames, smoke, debris isolated

Title: "EFFECT REFERENCE SHEET: {EFFECT_TYPE}"

THE EFFECT:
{EFFECT_FEATURES}

EFFECT-SPECIFIC RULES:
- NO building or structure visible - effect elements ONLY
- Must work as overlay on ANY building (tent, shack, temple, etc.)
- Use only universal elements (fire, smoke, sparks, generic debris)
- NO specific building materials in the debris
- Effect should be dramatic but readable at small game sizes

{CUSTOM_DETAILS}

Remember: This reference establishes how this effect looks from all angles. The game sprite will be extracted from the isometric view.',
    'Dynamic, eye-catching effects. Blend of realistic and stylized.',
    TRUE,
    'system'
);

INSERT INTO prompt_templates (category, asset_key, template_name, base_prompt, style_guide, is_active, created_by)
VALUES (
    'effect_ref',
    'fire',
    'Fire Effect Reference',
    'Create an effect reference sheet for FIRE.

EFFECT REFERENCE SHEET TEMPLATE LAYOUT (CRITICAL - FOLLOW EXACTLY):

Canvas: 16:9 landscape, neutral gray background (#808080)

LAYOUT - 6 SEPARATE BOXES arranged in a 3x2 grid:
ROW 1 (top):
  [EFFECT OVERVIEW] - Full effect from isometric game view angle
  [FRONT VIEW] - Effect viewed straight-on
  [SIDE VIEW] - Effect from side angle

ROW 2 (bottom):
  [TOP-DOWN VIEW] - Effect from above
  [ANIMATION FRAMES] - 3-4 key frames showing effect progression/variation
  [ELEMENT BREAKDOWN] - Individual particles, flames, smoke, debris isolated

Title: "EFFECT REFERENCE SHEET: FIRE"

THE EFFECT:
FIRE/ARSON EFFECT:
- Bright orange and yellow flames in multiple layers
- Dark smoke plumes rising above flames
- Glowing embers floating upward
- Base of fire (where it contacts surface - will be transparent)
- Heat shimmer/distortion suggestion
- Flames at different heights and intensities
- NO building visible - just the fire effect itself
Universal fire effect for any building type.

{CUSTOM_DETAILS}

Remember: This reference establishes how this effect looks from all angles.',
    'Dynamic, eye-catching effects. Blend of realistic and stylized.',
    TRUE,
    'system'
);

-- ============================================
-- TERRAIN REFERENCE SHEETS
-- ============================================

INSERT INTO prompt_templates (category, asset_key, template_name, base_prompt, style_guide, is_active, created_by)
VALUES (
    'terrain_ref',
    'road',
    'Road Terrain Reference',
    '5 road tiles in a row. Smooth modern style. NOT pixel art.

ROAD: Dark gray asphalt, yellow/orange dashed centerline, thin gray curb ONLY around road edges.
BACKGROUND: Transparent or white - NOT pavement. Sidewalk does NOT fill empty areas.

CRITICAL ALIGNMENT: Road exits at exactly 50% (middle) of each tile edge. Road width is 60% of tile.

5 TILES left to right:
1. STRAIGHT - vertical road through center
2. CORNER - L-SHAPE 90 turn (NOT S-curve). Road enters LEFT edge center, turns RIGHT ANGLE, exits BOTTOM edge center. Top-right is empty.
3. T-JUNCTION - road at center of LEFT, RIGHT, BOTTOM edges. Empty at top.
4. CROSSROAD - road at center of all 4 edges
5. DEAD-END - road from center of BOTTOM edge, U-turn at top

Sidewalk wraps road only. Empty space is transparent, not paved.

{CUSTOM_DETAILS}',
    'Natural, organic textures for terrain. Consistent lighting and style with buildings.',
    TRUE,
    'system'
);

INSERT INTO prompt_templates (category, asset_key, template_name, base_prompt, style_guide, is_active, created_by)
VALUES (
    'terrain_ref',
    'water',
    'Water Terrain Reference',
    'Create a WATER TILES reference sheet for an isometric game.

TILE SHAPE: Diamond (rhombus), 2:1 ratio. Points at: top, right, bottom, left.

WATER STYLE:
- Blue water with subtle ripples
- Sandy shore where water meets land (shore is INSIDE the water tile)

SHOW 13 TILES in a 5x3 grid:
Row 1: Full-water, N-edge, E-edge, S-edge, W-edge
Row 2: NE-outer, NW-outer, SE-outer, SW-outer, empty
Row 3: NE-inner, NW-inner, SE-inner, SW-inner, empty

Edge tiles: Shore runs along that full edge (diagonal line).
Outer corners: Shore on two adjacent edges.
Inner corners: Small shore in one corner only, rest is water.

Background: white or light gray.

{CUSTOM_DETAILS}',
    'Natural, organic textures for terrain. Consistent lighting and style with buildings.',
    TRUE,
    'system'
);

INSERT INTO prompt_templates (category, asset_key, template_name, base_prompt, style_guide, is_active, created_by)
VALUES (
    'terrain_ref',
    'dirt',
    'Dirt Path Terrain Reference',
    'Create a DIRT PATH TILES reference sheet for an isometric game.

TILE SHAPE: Diamond (rhombus), 2:1 ratio.

DIRT STYLE:
- Brown/tan dirt path (40% of tile width)
- Green grass fills areas without path

SHOW 6 TILES in a 3x2 grid:
Row 1: NS-straight, EW-straight, NE-corner
Row 2: NW-corner, SE-corner, SW-corner

Path enters/exits at center of each edge for seamless connection.

Background: white or light gray.

{CUSTOM_DETAILS}',
    'Natural, organic textures for terrain. Consistent lighting and style with buildings.',
    TRUE,
    'system'
);

INSERT INTO prompt_templates (category, asset_key, template_name, base_prompt, style_guide, is_active, created_by)
VALUES (
    'terrain_ref',
    'grass',
    'Grass Terrain Reference',
    'Create a GRASS TILE for an isometric game.

TILE SHAPE: Diamond (rhombus), 2:1 ratio.

Simple green grass with subtle texture. Seamless tiling.

Background: white or light gray.

{CUSTOM_DETAILS}',
    'Natural, organic textures for terrain. Consistent lighting and style with buildings.',
    TRUE,
    'system'
);

-- ============================================
-- TERRAIN SPRITES
-- ============================================

INSERT INTO prompt_templates (category, asset_key, template_name, base_prompt, style_guide, is_active, created_by)
VALUES (
    'terrain',
    '_default',
    'Terrain Sprite (Default)',
    'Create an isometric terrain tile for {TERRAIN_TYPE}.

SHAPE: Diamond (rhombus), 128x64 pixels, transparent background.

Match the approved terrain reference exactly.

{CUSTOM_DETAILS}',
    'Natural textures, consistent with game''s 90s CGI aesthetic.',
    TRUE,
    'system'
);

-- ============================================
-- EFFECT OVERLAYS (Dirty Tricks, Damage)
-- ============================================

INSERT INTO prompt_templates (category, asset_key, template_name, base_prompt, style_guide, is_active, created_by)
VALUES (
    'effect',
    '_default',
    'Effect Overlay (Default)',
    'Create a TRANSPARENT OVERLAY for a building: {EFFECT_TYPE} EFFECT.

=== THIS IS AN OVERLAY IMAGE WITH TRANSPARENT BACKGROUND ===
This image will be placed ON TOP OF any building sprite to show the effect is happening to that building.
Think: A layer in Photoshop that sits above the building layer.

FORMAT REQUIREMENTS:
- 45-degree isometric view matching the building sprite angle
- Background: COMPLETELY TRANSPARENT (PNG with alpha channel, NO solid color background)
- Canvas: Square canvas, same size as building sprites (e.g., 256x256 or 320x320)
- Output: PNG with transparency - only the effect elements visible, background is see-through

PURPOSE:
- This overlay is placed directly ON TOP of a building
- The building shows through the transparent areas
- The effect (fire, smoke, etc.) appears to be happening TO the building
- Same overlay works on restaurants, banks, temples, shacks - any building

THE EFFECT ELEMENTS (floating on transparent background, NO BUILDING):
{EFFECT_FEATURES}

CRITICAL RULES:
- ABSOLUTELY NO BUILDING in this image
- NO ground, NO base, NO platform, NO background color
- Background must be TRANSPARENT (alpha channel = 0), not any solid color
- ONLY show fire, smoke, sparks, debris, effects floating on transparency
- Effects should fill the canvas appropriately to cover a building when overlaid
- Effects must be universal - work on wooden shack OR stone temple
- NO building materials (no bricks, no wood, no concrete)

{CUSTOM_DETAILS}',
    'Dynamic, dramatic effects. Fire should look dangerous, vandalism should look chaotic, etc.',
    TRUE,
    'system'
);

INSERT INTO prompt_templates (category, asset_key, template_name, base_prompt, style_guide, is_active, created_by)
VALUES (
    'effect',
    'fire',
    'Fire Effect Overlay',
    'Create a TRANSPARENT OVERLAY for a building: FIRE EFFECT.

=== THIS IS AN OVERLAY IMAGE WITH TRANSPARENT BACKGROUND ===
This image will be placed ON TOP OF any building sprite to show the effect is happening to that building.

FORMAT REQUIREMENTS:
- 45-degree isometric view matching the building sprite angle
- Background: COMPLETELY TRANSPARENT (PNG with alpha channel)
- Canvas: Square canvas, same size as building sprites

THE EFFECT ELEMENTS:
Bright orange and yellow flames rising upward. Dark smoke plumes billowing. Glowing embers floating. Heat distortion suggestion. Flickering fire tongues at different heights. ARSON attack effect.

CRITICAL RULES:
- ABSOLUTELY NO BUILDING in this image
- NO ground, NO base, NO platform, NO background color
- ONLY show fire, smoke, sparks floating on transparency

{CUSTOM_DETAILS}',
    'Dynamic, dramatic effects. Fire should look dangerous.',
    TRUE,
    'system'
);

-- ============================================
-- SCENE ILLUSTRATIONS
-- ============================================

INSERT INTO prompt_templates (category, asset_key, template_name, base_prompt, style_guide, is_active, created_by)
VALUES (
    'scene',
    '_default',
    'Scene Background (Default)',
    'Create a scene BACKGROUND illustration: {SCENE_TYPE}.

FORMAT REQUIREMENTS:
- Aspect ratio: 16:9 widescreen (1920x1080, will be resized to 1280x720)
- Full scene with complete background
- Purpose: Background layer, character avatar composited on top

THE SCENE:
{SCENE_FEATURES}

CHARACTER INTEGRATION:
- Leave clear space in the composition where a character avatar will be placed ON TOP
- Characters in this game are chunky 90s CGI style - match that aesthetic

CRITICAL:
- Country-neutral (no flags, national symbols, specific currency)
- Match the 90s CGI aesthetic from building reference sheets
- Complete background scene

{CUSTOM_DETAILS}',
    'STYLE: 90s CGI aesthetic with modern rendering.',
    TRUE,
    'system'
);

INSERT INTO prompt_templates (category, asset_key, template_name, base_prompt, style_guide, is_active, created_by)
VALUES (
    'scene',
    'arrest_bg',
    'Arrest Scene Background',
    'Create a scene BACKGROUND illustration: ARREST.

FORMAT REQUIREMENTS:
- Aspect ratio: 16:9 widescreen (1920x1080, will be resized to 1280x720)
- Full scene with complete background
- Purpose: Background layer, character avatar composited on top

THE SCENE:
Exterior scene - street or building entrance at dusk/night. Police lights (blue/red) illuminating the area. Dramatic lighting. Space in center-foreground for character placement.

CHARACTER INTEGRATION:
- Leave clear space in the composition where a character avatar will be placed ON TOP

CRITICAL:
- Country-neutral (no flags, national symbols, specific currency)
- Match the 90s CGI aesthetic

{CUSTOM_DETAILS}',
    'STYLE: 90s CGI aesthetic with modern rendering.',
    TRUE,
    'system'
);

-- ============================================
-- NPC SPRITES (Pedestrians and Vehicles)
-- ============================================

INSERT INTO prompt_templates (category, asset_key, template_name, base_prompt, style_guide, is_active, created_by)
VALUES (
    'npc',
    '_default',
    'NPC Sprite (Default)',
    'Create an ambient NPC sprite: {NPC_TYPE}.

FORMAT REQUIREMENTS:
- TOP-DOWN OVERHEAD VIEW (bird''s eye, looking straight down from above)
- Background: TRANSPARENT (PNG-ready)

THE NPC:
{NPC_FEATURES}

CRITICAL:
- Match the chunky 90s CGI aesthetic from building reference sheets
- Country-neutral (no flags, specific national markings)
- NO external shadows
- Sprite must be CENTERED on the canvas

{CUSTOM_DETAILS}',
    'Chunky, slightly exaggerated 90s CGI proportions. Same "Pixar''s The Incredibles / Two Point Hospital" aesthetic.',
    TRUE,
    'system'
);

INSERT INTO prompt_templates (category, asset_key, template_name, base_prompt, style_guide, is_active, created_by)
VALUES (
    'npc',
    'ped_walk_n',
    'Pedestrian Walk North Sprite',
    'Create an ambient NPC sprite: PEDESTRIAN WALK NORTH.

FORMAT REQUIREMENTS:
- TOP-DOWN OVERHEAD VIEW (bird''s eye, looking straight down from above)
- Single sprite: 32x32 pixels (one animation frame)
- Background: TRANSPARENT (PNG-ready)

THE NPC:
SINGLE SPRITE: 32x32 pixels.
TOP-DOWN OVERHEAD VIEW (bird''s eye, looking straight down from above).
Pedestrian walking UP (NORTH - toward top of screen). Top of head and shoulders visible from above.
Business casual clothing visible from above.
90s CGI stylized rendering. NOT isometric, NOT angled - pure top-down overhead view.

DIRECTION: NORTH (toward top of screen)
- The character must be clearly facing/moving in the N direction

{CUSTOM_DETAILS}',
    'Chunky, slightly exaggerated 90s CGI proportions.',
    TRUE,
    'system'
);

INSERT INTO prompt_templates (category, asset_key, template_name, base_prompt, style_guide, is_active, created_by)
VALUES (
    'npc',
    'car_n',
    'Car North Sprite',
    'Create an ambient NPC sprite: CAR NORTH.

FORMAT REQUIREMENTS:
- TOP-DOWN OVERHEAD VIEW (bird''s eye, looking straight down from above)
- Single sprite: 32x32 pixels (one car facing specific direction)
- Background: TRANSPARENT (PNG-ready)

THE NPC:
SINGLE SPRITE: 32x32 pixels.
TOP-DOWN OVERHEAD VIEW (bird''s eye, looking straight down from above).
Car pointing UP (NORTH - toward top of screen). Roof and hood visible from above, front of car at top.
Chunky, toy-like 90s proportions. Generic sedan. No brand markings.
90s CGI stylized rendering. NOT isometric, NOT angled - pure top-down overhead view.

DIRECTION: NORTH (toward top of screen)
- The vehicle must be clearly facing in the N direction

{CUSTOM_DETAILS}',
    'Chunky, toy-like 90s proportions.',
    TRUE,
    'system'
);

-- ============================================
-- AVATAR ASSETS
-- ============================================

INSERT INTO prompt_templates (category, asset_key, template_name, base_prompt, style_guide, is_active, created_by)
VALUES (
    'avatar',
    '_default',
    'Avatar Layer (Default)',
    'Create an avatar layer: {AVATAR_TYPE}.

FORMAT REQUIREMENTS:
- Front-facing character view
- Canvas: 512x512 pixels SQUARE
- Background: TRANSPARENT (PNG-ready)

THE ASSET:
{AVATAR_FEATURES}

CRITICAL:
- Match the chunky, stocky 90s CGI character proportions from reference sheets
- All avatar layers must align perfectly for compositing
- Transparent background, only the specific element visible
- Country-neutral, gender-appropriate

{CUSTOM_DETAILS}',
    'Stylized but proportionally realistic. Clean lines for layer compositing.',
    TRUE,
    'system'
);

INSERT INTO prompt_templates (category, asset_key, template_name, base_prompt, style_guide, is_active, created_by)
VALUES (
    'avatar',
    'base_body',
    'Avatar Base Body',
    'Create an avatar BASE layer: BASE BODY.

FORMAT REQUIREMENTS:
- Front-facing character view
- Canvas: 512x512 pixels SQUARE
- Background: TRANSPARENT (PNG-ready)
- Purpose: BASE LAYER - underlying body shape. Show as neutral gray (skin applied separately). Must align with all other layers.

THE ASSET:
Standard adult human body silhouette. Neutral standing pose, arms slightly away from body. Average/normal build. Stocky, geometric 90s CGI proportions.

CRITICAL:
- Match the chunky, stocky 90s CGI character proportions
- All avatar layers must align perfectly for compositing
- Transparent background, only the specific element visible

{CUSTOM_DETAILS}',
    'Stylized but proportionally realistic. Clean lines for layer compositing.',
    TRUE,
    'system'
);

-- ============================================
-- UI ELEMENTS
-- ============================================

INSERT INTO prompt_templates (category, asset_key, template_name, base_prompt, style_guide, is_active, created_by)
VALUES (
    'ui',
    '_default',
    'UI Element (Default)',
    'Create a UI element: {UI_TYPE}.

FORMAT REQUIREMENTS:
- Background: TRANSPARENT (PNG-ready)

{UI_FEATURES}

STYLE:
- Clean, simple, easily distinguishable
- Bright enough to be visible over any terrain or building
- Smooth anti-aliased edges

{CUSTOM_DETAILS}',
    'Clean, bold iconography.',
    TRUE,
    'system'
);

INSERT INTO prompt_templates (category, asset_key, template_name, base_prompt, style_guide, is_active, created_by)
VALUES (
    'ui',
    'minimap_player',
    'Minimap Player Marker',
    'Create a UI element: MINIMAP PLAYER.

FORMAT REQUIREMENTS:
- Background: TRANSPARENT (PNG-ready)
- Small bright GREEN dot or diamond shape. Solid, highly visible. Simple geometric. Subtle glow optional. 8x8 pixels.

PURPOSE:
Shows player position on the minimap. Must be highly visible at tiny size.

STYLE:
- Clean, simple, easily distinguishable
- Bright enough to be visible over any terrain or building

{CUSTOM_DETAILS}',
    'Clean, bold iconography.',
    TRUE,
    'system'
);

INSERT INTO prompt_templates (category, asset_key, template_name, base_prompt, style_guide, is_active, created_by)
VALUES (
    'ui',
    'cursor_select',
    'Cursor Selection Indicator',
    'Create a UI element: CURSOR SELECT.

FORMAT REQUIREMENTS:
- Background: TRANSPARENT (PNG-ready)
- Glowing diamond outline that surrounds an isometric tile. Bright yellow, white, or cyan edge glow. Just the outline - no fill (or very subtle semi-transparent fill). 68x36 pixels.

PURPOSE:
Highlights currently selected/hovered tile on the game map.

STYLE:
- Clean, simple, easily distinguishable
- Bright enough to be visible over any terrain or building
- Smooth anti-aliased edges

{CUSTOM_DETAILS}',
    'Clean, bold iconography.',
    TRUE,
    'system'
);

-- ============================================
-- OWNERSHIP OVERLAYS
-- ============================================

INSERT INTO prompt_templates (category, asset_key, template_name, base_prompt, style_guide, is_active, created_by)
VALUES (
    'overlay',
    '_default',
    'Ownership Overlay (Default)',
    'Create an ownership overlay: {OVERLAY_TYPE}.

FORMAT REQUIREMENTS:
- Diamond/rhombus shape matching tile footprint
- Size: 64x32 pixels (same as terrain tile)
- Background: TRANSPARENT (PNG-ready)
- Opacity: 30-40% semi-transparent

THE OVERLAY:
- Semi-transparent color fill of the diamond shape
- Shows terrain/building underneath
- Simple ownership indicator

STYLE:
- Clean geometric diamond shape
- Consistent with isometric tile grid
- Simple color overlay, no gradients or effects needed

{CUSTOM_DETAILS}',
    'Simple, functional overlays.',
    TRUE,
    'system'
);

INSERT INTO prompt_templates (category, asset_key, template_name, base_prompt, style_guide, is_active, created_by)
VALUES (
    'overlay',
    'owned_self',
    'Player Owned Tile Overlay',
    'Create an ownership overlay: OWNED SELF.

FORMAT REQUIREMENTS:
- Diamond/rhombus shape matching tile footprint
- Size: 64x32 pixels (same as terrain tile)
- Background: TRANSPARENT (PNG-ready)
- Opacity: 30-40% semi-transparent

THE OVERLAY:
- Solid GREEN (#22c55e) color fill of the diamond shape
- Semi-transparent to show terrain/building underneath
- Indicates this tile is player-owned

STYLE:
- Clean geometric diamond shape
- Consistent with isometric tile grid

{CUSTOM_DETAILS}',
    'Simple, functional overlays.',
    TRUE,
    'system'
);

INSERT INTO prompt_templates (category, asset_key, template_name, base_prompt, style_guide, is_active, created_by)
VALUES (
    'overlay',
    'owned_other',
    'Enemy Owned Tile Overlay',
    'Create an ownership overlay: OWNED OTHER.

FORMAT REQUIREMENTS:
- Diamond/rhombus shape matching tile footprint
- Size: 64x32 pixels (same as terrain tile)
- Background: TRANSPARENT (PNG-ready)
- Opacity: 30-40% semi-transparent

THE OVERLAY:
- Solid RED (#ef4444) color fill of the diamond shape
- Semi-transparent to show terrain/building underneath
- Indicates this tile is enemy-owned

STYLE:
- Clean geometric diamond shape
- Consistent with isometric tile grid

{CUSTOM_DETAILS}',
    'Simple, functional overlays.',
    TRUE,
    'system'
);
