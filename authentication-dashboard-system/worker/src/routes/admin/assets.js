// Asset generation routes
// Environment bindings needed:
// - env.DB (D1)
// - env.R2_PRIVATE (private R2 bucket for refs/raw)
// - env.R2_PUBLIC (public R2 bucket for game-ready assets)
// - env.GEMINI_API_KEY
// - env.REMOVAL_AI_API_KEY

// R2 Public URL Configuration:
// Public bucket URL: https://pub-874867b18f8b4b4882277d8a2b7dfe80.r2.dev
// Custom domain (if configured): https://assets.notropolis.net
const R2_PUBLIC_URL = 'https://assets.notropolis.net';

// Audit logging helper
async function logAudit(env, action, assetId, actor, details = {}) {
    await env.DB.prepare(`
        INSERT INTO asset_audit_log (action, asset_id, actor, details)
        VALUES (?, ?, ?, ?)
    `).bind(action, assetId, actor || 'system', JSON.stringify(details)).run();
}

// Hash string helper for cache invalidation
async function hashString(str) {
    const encoder = new TextEncoder();
    const data = encoder.encode(str);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('').substring(0, 16);
}

// ============================================================================
// STYLE GUIDE AND PROMPT BUILDER
// Art direction: Retro 90s CGI aesthetic with modern render quality
// Think: Modern HD remaster of a 90s game - Pixar 1995 style with 2024 rendering
// ============================================================================

const STYLE_GUIDE = `
VISUAL STYLE - NOTROPOLIS GAME:

CRITICAL: This is NOT cartoon style. NOT cel-shaded. NOT flat.
The art direction is RETRO 90s CGI with HYPER-REALISTIC MODERN RENDERING.
Think: Pixar's Toy Story 1 SHAPES with Pixar's modern RENDERING QUALITY.
Think: SimCity 3000 / RollerCoaster Tycoon building DESIGN with Unreal Engine 5 surface quality.

DESIGN AESTHETIC (the 90s part - SHAPES AND PROPORTIONS ONLY):
- Chunky, geometric 3D forms with slightly simplified shapes
- Stocky, blocky proportions (not realistic human ratios)
- Clean, readable silhouettes designed for small display sizes
- No unnecessary complexity - functional design

RENDERING QUALITY (the modern part - THIS IS CRITICAL):
- PHOTOREALISTIC surface rendering with realistic material properties
- Rich, detailed textures (actual brick texture, wood grain, metal reflections)
- Soft ambient occlusion creating depth in every corner and crevice
- Subsurface scattering on appropriate materials (skin, wax, marble)
- Realistic specular highlights and fresnel effects on glass/metal
- PBR (Physically Based Rendering) material appearance
- Global illumination with natural light bounce
- Crisp, clean anti-aliasing (4K quality downscaled)
- Professional product photography lighting
- "Hero shot" or "box art" level polish - every surface finished perfectly
- NOT flat, NOT cartoon, NOT cel-shaded, NOT stylized lighting

COLOR PALETTE:
- Slightly muted, vintage color grading (like early 2000s 3D renders)
- Rich, saturated colors but not oversaturated
- Natural color variation and weathering on surfaces

LIGHTING DIRECTION: Consistent TOP-LEFT soft studio lighting. Shadows fall BOTTOM-RIGHT but are soft, not harsh.

SQUARE CANVAS WITH DIAMOND FOOTPRINT (CRITICAL):
ALL building sprites must be rendered on a SQUARE canvas. The building sits on a diamond-shaped footprint within this square. The diamond footprint touches the middle of each edge of the square.

Diagram:
┌─────────────┐
│      ▲      │
│     /·\\     │
│    / · \\    │
│   /  ·  \\   │
│  ◄───·───►  │  ← Diamond footprint inside square
│   \\  ·  /   │
│    \\ · /    │
│     \\·/     │
│      ▼      │
└─────────────┘

Buildings extend UPWARD from this diamond base. The square canvas must be tall enough to contain the full building height.

CENTERING (ABSOLUTELY CRITICAL):
- The diamond footprint must be PERFECTLY CENTERED horizontally within the canvas
- The building's center of mass must align with the canvas center horizontally
- When the tile is placed on the isometric map, the building must appear centered on the tile
- NO horizontal offset or lean - the building sits DEAD CENTER on the tile
- The vertical center of the diamond base should be at the BOTTOM THIRD of the canvas

BUILDING ORIENTATION (CRITICAL):
For ALL building sprites, the 45-degree isometric view must have the entry point/door positioned on the BOTTOM LEFT side of the building. The front facade should face bottom-left, with the building extending toward the top-right.

NO BASE/PLATFORM (ABSOLUTELY FORBIDDEN):
=== THIS IS THE MOST IMPORTANT RULE - VIOLATING THIS RUINS THE ASSET ===
- NEVER EVER include a concrete base, platform, foundation, or ground plane under the building
- NEVER show sidewalks, paths, or paving around the building
- NEVER show grass, soil, or any terrain under the building
- The building must appear to FLOAT in space like a product render
- The building's walls go straight down and END - there is NOTHING below
- Think: 3D model isolated on transparent background, like an online store product image
- If the bottom edge of the building shows ANY ground element, the asset is REJECTED
- Building should look like it was cut out with scissors - clean edges, no environment

NO EXTERNAL SHADOWS (CRITICAL):
- NO cast shadows outside the building footprint
- Shadows ONLY exist as ambient occlusion WITHIN the building (under overhangs, corners, window recesses)
- Building appears lit by soft diffused studio lighting with no ground shadow

COUNTRY-NEUTRAL:
All assets must be COUNTRY-NEUTRAL. Do not include:
- National flags of any country
- Country-specific signage, text, or symbols
- Currency symbols (no $, £, €, etc.)
- Nationality-specific architectural elements
- Keep text generic (e.g., "POLICE", "BANK", "RESTAURANT")

CLEAN BUILDINGS:
Building assets must show ONLY the building itself. Do not include:
- Vehicles, people, or animals
- Street furniture (benches, lamp posts, trash cans)
- Other buildings or structures
- Trees, bushes, or landscaping
- Ground shadows extending beyond the diamond footprint`;

const REFERENCE_SHEET_TEMPLATE = `
REFERENCE SHEET TEMPLATE LAYOUT (CRITICAL - FOLLOW EXACTLY):

Canvas: 16:9 landscape, neutral gray background (#808080)

LAYOUT - 6 SEPARATE BOXES arranged in a 3x2 grid:
ROW 1 (top):
  [FRONT VIEW] - Building viewed straight-on from the front entrance side
  [LEFT SIDE VIEW] - Building viewed from the left side (90 degrees from front)
  [BACK VIEW] - Building viewed from the back (opposite of front entrance)

ROW 2 (bottom):
  [RIGHT SIDE VIEW] - Building viewed from the right side (90 degrees from front)
  [ISOMETRIC VIEW] - 45-degree angle view with entrance on BOTTOM-LEFT
  [DETAIL CLOSEUPS] - 3-4 material/texture detail shots

CRITICAL LAYOUT RULES:
- Each view must be in its OWN SEPARATE BOX with white border
- Views must NOT overlap or blend into each other
- Each box has a bold label at the top (e.g., "FRONT VIEW", "BACK VIEW")
- Title at very top: "BUILDING REFERENCE SHEET: [BUILDING NAME]"
- All 6 boxes should be roughly equal size
- EVERY VIEW shows the COMPLETE building, not cropped

This is a professional orthographic reference sheet like game studios use for 3D modeling.`;

// Building-specific distinctive features
// IMPORTANT: Features should be OBVIOUSLY identifiable - almost comically obvious what the building is
const BUILDING_FEATURES = {
    restaurant: `MUST BE UNMISTAKABLY A RESTAURANT with these distinctive features:
- COMPACT SQUARE FOOTPRINT building (fits isometric diamond tile, not rectangular)
- HUGE illuminated "RESTAURANT" sign on the roof or facade (the word RESTAURANT must be visible)
- Giant fork and knife crossed logo mounted on the building facade
- Red and white striped awning over entrance
- Large windows showing tables with white tablecloths and wine glasses inside
- Steam rising from chimney (suggesting cooking)
- Elegant double doors with brass handles
- Chef's hat or plate-and-cutlery motif on signage
- TWO STORIES tall to fill the vertical space
NO outdoor furniture, tables, or items outside the building footprint.
The building should SCREAM "this is a restaurant" at first glance.`,

    bank: `MUST BE UNMISTAKABLY A BANK with these distinctive features:
- Massive stone columns at entrance (Greek temple style)
- HUGE "BANK" text carved into stone or on brass plaque
- Giant vault door visible through windows or as decorative element
- Gold/brass everywhere - door handles, window frames, trim
- Clock mounted prominently above entrance
- Security bars on all windows
- Heavy bronze double doors with serious locks
- Stone steps leading up to imposing entrance
- Money bag or coin imagery in architecture
The building should SCREAM "this is a bank" at first glance.`,

    temple: `MUST BE UNMISTAKABLY A TEMPLE with these distinctive features:
- Multi-tiered pagoda-style roof with curved eaves
- Ornate roof decorations (dragons, phoenixes, or abstract spiritual symbols)
- Grand stone staircase leading to main entrance
- Large ceremonial doors with intricate carvings
- Incense burner or offering table visible at entrance
- Bell tower or prayer bell
- Decorative columns with spiritual motifs
- Peaceful garden elements (stone lanterns, small trees)
- Roof tiles in traditional terracotta or gold
Religion-neutral but clearly spiritual/sacred architecture.`,

    casino: `MUST BE UNMISTAKABLY A CASINO with these distinctive features:
- MASSIVE illuminated "CASINO" sign with hundreds of light bulbs
- Giant playing card suits (spades, hearts, diamonds, clubs) on facade
- Huge dice or roulette wheel decorations
- Red carpet and velvet rope entrance
- Gold and red color scheme everywhere
- Flashing lights covering the entire facade
- Showgirl or lucky 7 imagery
- Grand double doors with golden handles
- Slot machine silhouettes visible through windows
The building should SCREAM "Las Vegas casino" at first glance.`,

    police_station: `MUST BE UNMISTAKABLY A POLICE STATION with these distinctive features:
- LARGE "POLICE" text prominently displayed on building
- Classic blue police lamp outside entrance (illuminated)
- Blue and white color scheme
- Badge or shield emblem on facade
- Heavy reinforced double doors
- Barred windows on lower level
- Security cameras visible
- Handcuff or badge motifs in architecture
- Utilitarian brick and concrete construction
The building should SCREAM "police station" at first glance.`,

    manor: `MUST BE UNMISTAKABLY A WEALTHY MANOR with these distinctive features:
- Grand columned entrance portico with stone steps
- Multiple stories with many tall windows
- Ornate cornices and decorative stonework
- Multiple chimneys on steep rooflines
- Wrought iron gates or fence elements
- Coat of arms or family crest on facade
- Manicured topiary at entrance
- Luxury car silhouette in driveway (optional)
- Stained glass or arched windows
The building should SCREAM "wealthy mansion" at first glance.`,

    high_street_store: `MUST BE UNMISTAKABLY A DEPARTMENT STORE with these distinctive features:
- Two-story Victorian retail building
- LARGE "DEPARTMENT STORE" or "STORE" signage
- Multiple display windows with mannequins visible
- Revolving door entrance
- Ornate upper floor with decorative moldings
- Shopping bag motif or logo
- Awning over each display window
- "SALE" or "OPEN" signs in windows
The building should SCREAM "shopping destination" at first glance.`,

    motel: `MUST BE UNMISTAKABLY A MOTEL with these distinctive features:
- TALL neon "MOTEL" sign (classic roadside style)
- "VACANCY" sign underneath (illuminated)
- Single-story row of rooms with numbered doors
- Ice machine and vending machine alcove
- Parking spaces in front of each door
- Pool area visible (optional)
- Office with "RECEPTION" sign
- Classic Americana roadside aesthetic
The building should SCREAM "roadside motel" at first glance.`,

    burger_bar: `MUST BE UNMISTAKABLY A BURGER RESTAURANT with these distinctive features:
- GIANT hamburger model/sign on the roof
- Neon "BURGERS" sign with glowing tubes
- 1950s chrome diner aesthetic
- Red and white color scheme
- Large windows showing checkered floor inside
- Counter stools visible through windows
- Menu board with burger pictures
- Milkshake or fries imagery
- Classic American diner style
The building should SCREAM "burger joint" at first glance.`,

    shop: `MUST BE UNMISTAKABLY A SMALL SHOP with these distinctive features:
- "SHOP" or "OPEN" sign prominently displayed
- Striped fabric awning over entrance
- Display window with goods visible
- Small A-frame sign outside
- Brass door handle and bell
- Friendly welcoming appearance
- Newspaper stand or product display outside
- Classic corner shop aesthetic
The building should SCREAM "neighborhood shop" at first glance.`,

    campsite: `MUST BE UNMISTAKABLY A CAMPSITE with these distinctive features:
- Large canvas A-frame tent as centerpiece
- Stone campfire ring with logs and flames/smoke
- "CAMP" flag or wooden sign
- Cooking pot over fire
- Wooden supply crates and barrels
- Oil lantern on post (glowing)
- Outdoor adventurer aesthetic
- Sleeping bag visible at tent entrance
The building should SCREAM "camping site" at first glance.`,

    hot_dog_stand: `MUST BE UNMISTAKABLY A HOT DOG STAND with these distinctive features:
- GIANT hot dog model on top of cart
- "HOT DOGS" sign prominently displayed
- Large striped umbrella
- Mustard and ketchup bottles visible
- Steamer box with steam rising
- Menu board with prices
- Napkin dispenser
- Classic street food cart aesthetic
The building should SCREAM "hot dog vendor" at first glance.`,

    market_stall: `MUST BE UNMISTAKABLY A MARKET STALL with these distinctive features:
- Wooden vendor booth with canvas awning
- Crates overflowing with colorful produce/goods
- Hand-painted price signs
- Weighing scale on counter
- Hanging baskets of goods
- "FRESH" or "MARKET" signage
- Rustic farmer's market aesthetic
- Apron hanging on hook
The building should SCREAM "market vendor" at first glance.`
};

/**
 * Build a complete prompt for building reference sheet generation
 * Combines style guide + template layout + building-specific features
 */
function buildBuildingRefPrompt(buildingType, customDetails = '') {
    const buildingName = buildingType.replace(/_/g, ' ').toUpperCase();
    const features = BUILDING_FEATURES[buildingType] || customDetails;

    if (!features) {
        throw new Error(`No features defined for building type: ${buildingType}. Provide customDetails.`);
    }

    return `Create a building reference sheet for a ${buildingName}.

${REFERENCE_SHEET_TEMPLATE}

Title: "BUILDING REFERENCE SHEET: 90s CGI ${buildingName}"

THE ${buildingName}:
${features}

${STYLE_GUIDE}

${customDetails ? `ADDITIONAL NOTES:\n${customDetails}` : ''}

Remember: All views must show the exact same building. This is a professional reference sheet for game asset development. The quality should be like promotional concept art - clean, polished, and production-ready.`;
}

// ============================================================================
// ASSET CATEGORY PROMPT BUILDERS
// All prompts reference approved reference sheets for style consistency
// ============================================================================

/**
 * Core style reference that all non-ref assets should include
 * References the approved building reference sheets as style anchors
 */
const STYLE_REFERENCE_ANCHOR = `
STYLE CONSISTENCY (CRITICAL):
Your output MUST match the established art style from the approved building reference sheets.
Reference these approved assets for visual consistency:
- Same chunky, slightly exaggerated 90s CGI proportions
- Same modern rendering quality (smooth surfaces, soft ambient occlusion)
- Same top-left lighting at 45 degrees
- Same muted but vibrant color palette
- Same clean, anti-aliased edges
- Same "Pixar's The Incredibles / Two Point Hospital" aesthetic

If in doubt, match the style of the restaurant or temple reference sheets exactly.`;

// ============================================================================
// REFERENCE SHEET BUILDERS (Non-Building)
// These establish the style for each asset category before sprites are made
// ============================================================================

const CHARACTER_REF_TEMPLATE = `
CHARACTER REFERENCE SHEET TEMPLATE LAYOUT (CRITICAL - FOLLOW EXACTLY):

Canvas: 16:9 landscape, neutral gray background (#808080)

LAYOUT - 6 SEPARATE BOXES arranged in a 3x2 grid:
ROW 1 (top):
  [FRONT VIEW] - Character viewed straight-on from front
  [SIDE PROFILE] - Character viewed from left side (90 degrees)
  [BACK VIEW] - Character viewed from behind

ROW 2 (bottom):
  [3/4 FRONT VIEW] - 45-degree front angle (shows depth)
  [3/4 BACK VIEW] - 45-degree back angle
  [FACE CLOSEUP + DETAILS] - Head closeup, hands, shoes, material textures

CRITICAL LAYOUT RULES:
- Each view in its OWN SEPARATE BOX with white border
- Views must NOT overlap or blend into each other
- Bold label at top of each box
- Title at very top: "CHARACTER REFERENCE SHEET: [CHARACTER NAME]"
- EVERY VIEW shows the COMPLETE character, same pose
- Same lighting across all views (top-left at 45 degrees)`;

const VEHICLE_REF_TEMPLATE = `
VEHICLE REFERENCE SHEET TEMPLATE LAYOUT (CRITICAL - FOLLOW EXACTLY):

Canvas: 16:9 landscape, neutral gray background (#808080)

LAYOUT - 6 SEPARATE BOXES arranged in a 3x2 grid:
ROW 1 (top):
  [FRONT VIEW] - Vehicle viewed straight-on from front
  [SIDE VIEW] - Vehicle viewed from driver's side
  [BACK VIEW] - Vehicle viewed from behind

ROW 2 (bottom):
  [TOP-DOWN VIEW] - Vehicle viewed from directly above
  [ISOMETRIC VIEW] - 45-degree isometric angle (game view)
  [DETAIL CLOSEUPS] - Wheels, headlights, interior glimpse, material textures

CRITICAL LAYOUT RULES:
- Each view in its OWN SEPARATE BOX with white border
- Views must NOT overlap
- Bold label at top of each box
- Title at very top: "VEHICLE REFERENCE SHEET: [VEHICLE NAME]"
- Same vehicle in every view
- Same lighting (top-left at 45 degrees)`;

const EFFECT_REF_TEMPLATE = `
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

CRITICAL LAYOUT RULES:
- Each view in its OWN SEPARATE BOX with white border
- Effect on TRANSPARENT background within each box (gray shows through)
- Bold label at top of each box
- Title at very top: "EFFECT REFERENCE SHEET: [EFFECT NAME]"
- This is the reference for creating overlays that work on ANY building`;

// Character reference features (for pedestrians and avatar base)
const CHARACTER_REF_FEATURES = {
    pedestrian_business: `BUSINESS PEDESTRIAN - adult in professional attire:
- Chunky, stocky 90s CGI proportions (slightly exaggerated)
- Head is large relative to body (stylized, not realistic)
- Simple geometric shapes - cylindrical limbs, blocky torso
- Business suit or smart casual (shirt, trousers, shoes)
- Neutral expression, professional demeanor
- Generic adult, gender-neutral or male
- NO specific ethnicity focus - neutral skin tone placeholder
This establishes the character style for all business NPCs.`,

    pedestrian_casual: `CASUAL PEDESTRIAN - everyday citizen:
- Same chunky 90s CGI proportions as business pedestrian
- Relaxed posture, casual clothing (t-shirt, jeans, sneakers)
- Slightly less formal stance
- Could carry shopping bag or nothing
- Generic everyday person walking around the city
This establishes the style for casual NPC citizens.`,

    avatar_base: `AVATAR BASE CHARACTER - player character foundation:
- Chunky, stocky 90s CGI proportions matching pedestrians
- Neutral standing pose, arms slightly away from body
- PLACEHOLDER appearance - gray silhouette body
- This is the BASE that outfits, hair, accessories layer onto
- Must be perfectly centered for layer compositing
- Shows body shape that all avatar items must fit
This is the master reference for all avatar assets.`
};

// Vehicle reference features
const VEHICLE_REF_FEATURES = {
    car_sedan: `SEDAN CAR - generic city vehicle:
- Chunky, toy-like proportions (not realistic)
- Rounded edges, simplified details
- 4-door sedan shape, compact
- Neutral color (gray/silver) - shows the form
- NO brand logos, badges, or text
- Visible wheels with simple hub design
- Glass windows with subtle tint
- Headlights and taillights as simple shapes
This establishes the car style for all vehicles.`,

    car_sports: `SPORTS CAR - flashy vehicle:
- Same chunky toy-like proportions as sedan
- Lower, sleeker profile but still stylized
- 2-door coupe shape
- Bold color (red or yellow suggested)
- Spoiler optional, simple design
- NO brand logos
This is the sporty variant of the car style.`,

    car_van: `VAN/DELIVERY VEHICLE:
- Chunky, boxy proportions
- Taller than sedan, utility shape
- Side panel (could have generic "DELIVERY" text)
- White or neutral color
- Sliding door suggestion
- NO specific company branding
Work/utility vehicle variant.`,

    car_taxi: `TAXI CAB:
- Same proportions as sedan
- Distinctive yellow color
- "TAXI" sign on roof (lit)
- Checkered stripe optional
- Generic taxi appearance
- NO specific city/company markings
City taxi variant.`
};

// Effect reference features
const EFFECT_REF_FEATURES = {
    fire: `FIRE/ARSON EFFECT:
- Bright orange and yellow flames in multiple layers
- Dark smoke plumes rising above flames
- Glowing embers floating upward
- Base of fire (where it contacts surface - will be transparent)
- Heat shimmer/distortion suggestion
- Flames at different heights and intensities
- NO building visible - just the fire effect itself
Universal fire effect for any building type.`,

    cluster_bomb: `CLUSTER BOMB/EXPLOSION EFFECT:
- Multiple impact points across the area
- Smoke plumes (gray/black) at various heights
- Fire bursts scattered
- Debris clouds (generic gray particles)
- Sparks and flash elements
- Scorch marks (as floating elements)
- Dust/dirt kicked up
Explosive damage covering building footprint.`,

    vandalism: `VANDALISM EFFECT:
- Spray paint marks (bright colors - pink, green, blue)
- Floating/splattered paint drips
- Generic trash debris
- Broken glass shards
- Graffiti shapes (abstract, no readable text)
- Scattered mess appearance
Surface vandalism overlay.`,

    robbery: `ROBBERY/BREAK-IN EFFECT:
- Shattered glass (door/window shaped void)
- Scattered papers and debris
- Flashlight beam suggestion
- Open safe/drawer elements
- Broken lock/handle
- Signs of forced entry
Post-robbery scene overlay.`,

    poisoning: `POISONING/TOXIC EFFECT:
- Green toxic clouds/gas
- Bubbling green puddles
- Wilted/dead plant elements
- Sickly yellow-green color palette
- Dripping toxic substance
- Fumes rising
Toxic contamination overlay.`,

    blackout: `BLACKOUT/ELECTRICAL EFFECT:
- Darkness/shadow overlay
- Blue electrical sparks/arcs
- Broken light fixture elements
- Flickering light suggestion
- Exposed wiring sparks
- Power-out atmosphere
Electrical failure overlay.`
};

/**
 * Build prompt for CHARACTER reference sheet
 */
function buildCharacterRefPrompt(characterType, customDetails = '') {
    const characterName = characterType.replace(/_/g, ' ').toUpperCase();
    const features = CHARACTER_REF_FEATURES[characterType] || customDetails;

    if (!features) {
        throw new Error(`No features defined for character type: ${characterType}. Provide customDetails.`);
    }

    return `Create a character reference sheet for a ${characterName}.

${CHARACTER_REF_TEMPLATE}

Title: "CHARACTER REFERENCE SHEET: 90s CGI ${characterName}"

THE CHARACTER:
${features}

${STYLE_GUIDE}

${customDetails ? `ADDITIONAL NOTES:\n${customDetails}` : ''}

Remember: All views must show the exact same character. This reference establishes the character proportions and style that all pedestrian NPCs and avatar assets must match.`;
}

/**
 * Build prompt for VEHICLE reference sheet
 */
function buildVehicleRefPrompt(vehicleType, customDetails = '') {
    const vehicleName = vehicleType.replace(/_/g, ' ').toUpperCase();
    const features = VEHICLE_REF_FEATURES[vehicleType] || customDetails;

    if (!features) {
        throw new Error(`No features defined for vehicle type: ${vehicleType}. Provide customDetails.`);
    }

    return `Create a vehicle reference sheet for a ${vehicleName}.

${VEHICLE_REF_TEMPLATE}

Title: "VEHICLE REFERENCE SHEET: 90s CGI ${vehicleName}"

THE VEHICLE:
${features}

${STYLE_GUIDE}

VEHICLE-SPECIFIC RULES:
- NO brand logos, badges, or manufacturer markings
- Country-neutral (no specific license plate style)
- Chunky, toy-like proportions matching the building style
- Same top-left lighting as buildings

${customDetails ? `ADDITIONAL NOTES:\n${customDetails}` : ''}

Remember: All views must show the exact same vehicle. This reference establishes the vehicle style that all car sprites must match.`;
}

/**
 * Build prompt for EFFECT reference sheet
 */
function buildEffectRefPrompt(effectType, customDetails = '') {
    const effectName = effectType.replace(/_/g, ' ').toUpperCase();
    const features = EFFECT_REF_FEATURES[effectType] || customDetails;

    if (!features) {
        throw new Error(`No features defined for effect type: ${effectType}. Provide customDetails.`);
    }

    return `Create an effect reference sheet for ${effectName}.

${EFFECT_REF_TEMPLATE}

Title: "EFFECT REFERENCE SHEET: ${effectName}"

THE EFFECT:
${features}

${STYLE_GUIDE}

EFFECT-SPECIFIC RULES:
- NO building or structure visible - effect elements ONLY
- Must work as overlay on ANY building (tent, shack, temple, etc.)
- Use only universal elements (fire, smoke, sparks, generic debris)
- NO specific building materials in the debris
- Effect should be dramatic but readable at small game sizes

${customDetails ? `ADDITIONAL NOTES:\n${customDetails}` : ''}

Remember: This reference establishes how this effect looks from all angles. The game sprite will be extracted from the isometric view.`;
}

// ============================================================================
// TERRAIN TILE FEATURES
// ============================================================================

const TERRAIN_FEATURES = {
    grass: `Lush green grass with subtle variation in shade. Small tufts and texture visible but not overwhelming. Natural, well-maintained lawn appearance.`,

    trees: `Dense cluster of trees viewed from above and the side. Chunky, stylized tree canopy with visible foliage masses. Mix of greens. Trees extend above the base diamond footprint like early 3D game trees.`,

    mountain: `Rocky, elevated terrain with chunky rock formations. Gray and brown stone with visible facets. Impassable, rugged appearance. Angular rock shapes with visible polygonal faces.`,

    sand: `Golden/beige sand with subtle ripple texture suggesting wind patterns. Small variation in tone. Beach/desert sand appearance.`,

    water: `Blue water with subtle ripple texture. Gentle reflective quality suggesting calm water surface. Light caustic patterns optional.`,

    // Road tiles - all share base description
    road_base: `Dark gray asphalt road running through the center. Light gray/beige sidewalks on edges. Clear visual distinction between road surface (vehicles) and sidewalk (pedestrians).`,

    // Dirt tiles
    dirt_base: `Brown/tan compacted dirt path. Visible texture suggesting worn earth - small pebbles, subtle tire/foot track impressions. Earthy, natural appearance.`,

    // Water edge tiles share this base
    water_edge_base: `Water tile with land transition. The water should blend naturally into grass/land on the specified edge(s). Gentle shore/beach effect at the transition.`
};

// ============================================================================
// TERRAIN VARIATION AUTO-GENERATION MAPPINGS
// When a base terrain type is approved, auto-generate all its variations
// ============================================================================

const TERRAIN_VARIATIONS = {
    // Road: base tile approved → generate all 15 connection variants
    road: [
        'road_ns', 'road_ew',                                           // Straights (2)
        'road_ne', 'road_nw', 'road_se', 'road_sw',                     // Corners (4)
        'road_nes', 'road_new', 'road_nsw', 'road_esw',                 // T-junctions (4)
        'road_nesw',                                                     // 4-way (1)
        'road_n', 'road_e', 'road_s', 'road_w'                          // Dead ends (4)
    ],

    // Dirt: base tile approved → generate all 6 connection variants
    dirt: [
        'dirt_ns', 'dirt_ew',                                           // Straights (2)
        'dirt_ne', 'dirt_nw', 'dirt_se', 'dirt_sw'                      // Corners (4)
    ],

    // Water: base tile approved → generate all 12 edge/corner variants
    water: [
        'water_edge_n', 'water_edge_e', 'water_edge_s', 'water_edge_w', // Edges (4)
        'water_corner_ne', 'water_corner_nw', 'water_corner_se', 'water_corner_sw', // Outer corners (4)
        'water_inner_ne', 'water_inner_nw', 'water_inner_se', 'water_inner_sw'      // Inner corners (4)
    ]
};

// NPC/Vehicle directional sprite mappings
// When base character/vehicle reference is approved, auto-generate all direction variants
const DIRECTIONAL_SPRITE_VARIANTS = {
    // Pedestrian: 4 directions × 2 animation frames = 8 sprites (as 4 sprite strips)
    pedestrian: ['ped_walk_n', 'ped_walk_s', 'ped_walk_e', 'ped_walk_w'],

    // Car: 4 directions × 1 sprite = 4 sprites
    car: ['car_n', 'car_s', 'car_e', 'car_w']
};

/**
 * Build prompt for terrain tile generation
 */
function buildTerrainPrompt(terrainType, customDetails = '') {
    const isRoad = terrainType.startsWith('road_');
    const isDirt = terrainType.startsWith('dirt_');
    const isWaterEdge = terrainType.startsWith('water_') && terrainType !== 'water';

    let baseFeatures;
    let specificDetails = '';

    if (isRoad) {
        baseFeatures = TERRAIN_FEATURES.road_base;
        const directions = terrainType.replace('road_', '');
        specificDetails = `Road connects to: ${directions.toUpperCase().split('').join(', ')} direction(s).`;
    } else if (isDirt) {
        baseFeatures = TERRAIN_FEATURES.dirt_base;
        const directions = terrainType.replace('dirt_', '');
        specificDetails = `Dirt path connects to: ${directions.toUpperCase().split('').join(', ')} direction(s).`;
    } else if (isWaterEdge) {
        baseFeatures = TERRAIN_FEATURES.water_edge_base;
        const edgeType = terrainType.replace('water_', '');
        specificDetails = `Edge type: ${edgeType}. Land appears on this side of the tile.`;
    } else {
        baseFeatures = TERRAIN_FEATURES[terrainType] || customDetails;
    }

    if (!baseFeatures) {
        throw new Error(`No features defined for terrain type: ${terrainType}. Provide customDetails.`);
    }

    return `Create a single isometric terrain tile for ${terrainType.toUpperCase().replace(/_/g, ' ')}.

FORMAT REQUIREMENTS:
- Diamond/rhombus shaped tile viewed from above at 45-degree isometric angle
- Dimensions: Flat diamond that fits a 64x32 pixel canvas (2:1 ratio)
- Background: TRANSPARENT (PNG-ready)
- This is a FLAT ground tile (except trees/mountain which extend upward)

THE TERRAIN:
${baseFeatures}
${specificDetails}

${STYLE_GUIDE}

${STYLE_REFERENCE_ANCHOR}

CRITICAL:
- The tile must seamlessly connect when placed adjacent to identical tiles
- NO external shadows outside the tile footprint
- Transparent background
- Match the chunky 90s CGI aesthetic from the building reference sheets

${customDetails ? `ADDITIONAL NOTES:\n${customDetails}` : ''}`;
}

// ============================================================================
// BUILDING SPRITE (GAME-READY) - Different from reference sheets
// ============================================================================

const BUILDING_SIZE_CLASSES = {
    market_stall: { canvas: '128x128', class: 'SHORT' },
    hot_dog_stand: { canvas: '128x128', class: 'SHORT' },
    campsite: { canvas: '128x128', class: 'SHORT' },
    shop: { canvas: '192x192', class: 'MEDIUM' },
    burger_bar: { canvas: '192x192', class: 'MEDIUM' },
    motel: { canvas: '192x192', class: 'MEDIUM' },
    high_street_store: { canvas: '256x256', class: 'TALL' },
    restaurant: { canvas: '256x256', class: 'TALL' },
    manor: { canvas: '256x256', class: 'TALL' },
    police_station: { canvas: '256x256', class: 'TALL' },
    casino: { canvas: '320x320', class: 'VERY_TALL' },
    temple: { canvas: '320x320', class: 'VERY_TALL' },
    bank: { canvas: '320x320', class: 'VERY_TALL' }
};

/**
 * Build prompt for building game sprite (references the approved ref sheet)
 */
function buildBuildingSpritePrompt(buildingType, customDetails = '') {
    const buildingName = buildingType.replace(/_/g, ' ').toUpperCase();
    const sizeInfo = BUILDING_SIZE_CLASSES[buildingType];
    const features = BUILDING_FEATURES[buildingType];

    if (!sizeInfo) {
        throw new Error(`No size class defined for building type: ${buildingType}`);
    }

    return `Create a single isometric game sprite for a ${buildingName}.

CRITICAL: Use the approved ${buildingName} REFERENCE SHEET as your style guide.
Extract the 45-degree isometric view from that reference and render it as a standalone sprite.

FORMAT REQUIREMENTS:
- 45-degree isometric view, single image
- Canvas: ${sizeInfo.canvas} px SQUARE
- Background: TRANSPARENT (PNG-ready)
- Size class: ${sizeInfo.class}
- Orientation: Entry/front on BOTTOM LEFT, building extends toward top-right

BUILDING FOOTPRINT:
- Building sits on a DIAMOND-shaped footprint at the BOTTOM of the square canvas
- The structure extends UPWARD from the diamond base to fill the canvas vertically
- Building must fill the isometric diamond tile, not be rectangular

THE ${buildingName}:
${features || customDetails || 'Match the approved reference sheet exactly.'}

${STYLE_GUIDE}

${STYLE_REFERENCE_ANCHOR}

CRITICAL:
- NO external cast shadows outside the building footprint
- NO base/platform/ground - building floats on transparent background
- Building ONLY - no vehicles, people, surrounding objects
- Match the approved reference sheet EXACTLY in style and detail

${customDetails ? `ADDITIONAL NOTES:\n${customDetails}` : ''}`;
}

// ============================================================================
// EFFECT OVERLAYS (Dirty Tricks, Damage, Status)
// ============================================================================

const EFFECT_FEATURES = {
    // Dirty trick effects
    fire: `Bright orange and yellow flames rising upward. Dark smoke plumes billowing. Glowing embers floating. Heat distortion suggestion. Flickering fire tongues at different heights. ARSON attack effect.`,

    cluster_bomb: `Multiple smoke plumes and fire bursts scattered across the footprint. Grey dust clouds. Sparks flying. Scorch marks. Multiple impact points suggesting explosive damage.`,

    vandalism: `Spray paint marks in bright colors (floating, not on surface). Generic trash and debris scattered. Broken glass shards floating. Graffiti suggestion without readable text.`,

    robbery: `Broken glass shards. Open/damaged door imagery. Scattered papers and debris. Flashlight beams. Signs of forced entry.`,

    poisoning: `Green toxic clouds floating. Wilted/dying plant elements. Bubbling green puddles. Toxic fumes rising. Sickly color palette.`,

    blackout: `Darkness overlay with electrical sparks. Broken light elements. Blue electrical arcs. Flickering/failing light suggestion.`,

    // Damage levels
    damage_25: `Light damage - scattered dust and small debris particles. Thin wisps of smoke. Minor scuff marks. A few floating broken glass shards. Subtle wear.`,

    damage_50: `Medium damage - more prominent dust clouds and debris. Multiple smoke wisps. Larger floating debris (generic gray rubble). Scorch marks and soot patches. Structural warping suggestion.`,

    damage_75: `Heavy damage - heavy dust and smoke clouds. Thick smoke columns. Significant floating debris field. Large scorch marks. Sparks and embers. Structural collapse suggestion. Near-destruction state.`,

    // Status indicators
    for_sale: `Small wooden or metal sign post with hanging "FOR SALE" placard. Red and white coloring. Classic real estate sign style. 24x24 pixel detail level.`,

    security: `Shield shape with checkmark or lock symbol, OR small security camera. Blue and silver coloring. Protective, secure feeling. 24x24 pixel detail level.`
};

/**
 * Build prompt for effect overlay generation
 */
function buildEffectPrompt(effectType, customDetails = '') {
    const effectName = effectType.replace(/_/g, ' ').toUpperCase();
    const features = EFFECT_FEATURES[effectType];

    const isSmallIcon = ['for_sale', 'security'].includes(effectType);

    if (!features) {
        throw new Error(`No features defined for effect type: ${effectType}. Provide customDetails.`);
    }

    const sizeSpec = isSmallIcon
        ? `Size: Small icon, approximately 24x24 pixels worth of detail.`
        : `Size: Effect sized to overlay a standard building footprint at 45-degree isometric angle (64x64 px canvas).`;

    return `Create a ${isSmallIcon ? 'status indicator icon' : 'dirty trick/damage effect overlay'} for ${effectName}.

FORMAT REQUIREMENTS:
- ${isSmallIcon ? 'Small icon with slight 3D perspective' : '45-degree isometric view matching building perspective'}
- Background: TRANSPARENT (PNG-ready)
- ${sizeSpec}
- Purpose: ${isSmallIcon ? 'Positioned at top-right of building' : 'Overlaid on ANY building to show this effect'}

THE EFFECT:
${features}

CRITICAL - UNIVERSAL COMPATIBILITY:
${isSmallIcon ? '' : `- Show ONLY the effect elements - NO BUILDING VISIBLE
- Use only universal elements (smoke, fire, sparks, generic debris, dust)
- NO specific building materials (no bricks, wood planks, concrete chunks)
- The effect MUST work whether overlaid on a canvas tent, wooden shack, or stone temple

CENTERING (ABSOLUTELY CRITICAL):
- The effect must be PERFECTLY CENTERED on the canvas both horizontally and vertically
- The effect's center of mass must align with the building's center point
- When overlaid on a building, the effect should appear centered on the building tile
- NO horizontal or vertical offset - the effect sits DEAD CENTER
- This ensures fire appears centered on the building, not off to one side`}

${STYLE_GUIDE}

${STYLE_REFERENCE_ANCHOR}

${customDetails ? `ADDITIONAL NOTES:\n${customDetails}` : ''}`;
}

// ============================================================================
// SCENE ILLUSTRATIONS
// ============================================================================

const SCENE_FEATURES = {
    // Background scenes (no character slot needed)
    arrest_bg: `Exterior scene - street or building entrance at dusk/night. Police lights (blue/red) illuminating the area. Dramatic lighting. Space in center-foreground for character placement.`,

    court_bg: `Courtroom interior. Judge's bench visible. Wooden courtroom furniture. High ceilings. Formal, imposing legal atmosphere. Scales of justice optional. Space in foreground for defendant.`,

    prison_bg: `Prison cell interior. Concrete/brick walls. Bars visible (cell door or window). Basic bunk bed. Harsh institutional lighting. Confined, punishing atmosphere. Space for prisoner.`,

    hero_bg: `Celebration scene - could be yacht deck, tropical beach, or mansion terrace. Bright, sunny, successful atmosphere. Confetti elements optional. Space for triumphant character.`,

    bank_interior_bg: `Grand bank interior. Marble floors and columns. Teller windows/counters. High ceilings. Vault door in background. Brass fixtures. Wealthy, institutional atmosphere.`,

    temple_interior_bg: `Peaceful temple interior. Soft light filtering through windows or from candles. Altar/shrine area. Wooden beams. Spiritual, contemplative atmosphere.`,

    offshore_bg: `Tropical paradise with hidden wealth. Palm trees, crystal blue water, white sand. Small elegant bank building among palms. Secretive luxury.`,

    dirty_trick_bg: `Nighttime urban scene. Shadowy alley or building exterior. Dramatic noir lighting - moonlight, shadows, streetlamp. Suspenseful atmosphere.`,

    // Foreground layers (for compositing over character)
    arrest_fg: `Police officer arms/hands reaching to grab/escort. Handcuffs visible. Dramatic angle. MUST have transparent center for character placement.`,

    prison_fg: `Prison bars in foreground. Institutional frame elements. MUST have transparent center for character placement behind bars.`,

    hero_fg: `Champagne bottle/glass being raised. Confetti falling. Celebratory hands. MUST have transparent center for character placement.`,

    dirty_trick_fg: `Shadowy hands holding spray can, lighter, or suspicious package. Noir lighting. MUST have transparent center for character placement.`
};

/**
 * Build prompt for scene illustration generation
 */
function buildScenePrompt(sceneType, customDetails = '') {
    const sceneName = sceneType.replace(/_/g, ' ').toUpperCase();
    const features = SCENE_FEATURES[sceneType];
    const isForeground = sceneType.endsWith('_fg');
    const isBackground = sceneType.endsWith('_bg');

    if (!features) {
        throw new Error(`No features defined for scene type: ${sceneType}. Provide customDetails.`);
    }

    return `Create a scene ${isForeground ? 'FOREGROUND layer' : 'BACKGROUND'} illustration: ${sceneName}.

FORMAT REQUIREMENTS:
- Aspect ratio: 16:9 widescreen (1920x1080, will be resized to 1280x720)
- ${isForeground ? 'Background: TRANSPARENT - this is a foreground layer for compositing' : 'Full scene with complete background'}
- Purpose: ${isForeground ? 'Composited OVER character avatar in scene' : 'Background layer, character avatar composited on top'}

THE SCENE:
${features}

CHARACTER INTEGRATION:
${isForeground
    ? '- Leave transparent center area where character will be placed BEHIND this layer'
    : '- Leave clear space in the composition where a character avatar will be placed ON TOP'}
- Characters in this game are chunky 90s CGI style - match that aesthetic

${STYLE_GUIDE}

${STYLE_REFERENCE_ANCHOR}

CRITICAL:
- Country-neutral (no flags, national symbols, specific currency)
- Match the 90s CGI aesthetic from building reference sheets
- ${isForeground ? 'Transparent background with elements only at edges/corners' : 'Complete background scene'}

${customDetails ? `ADDITIONAL NOTES:\n${customDetails}` : ''}`;
}

// ============================================================================
// NPC SPRITES (Pedestrians and Vehicles)
// ============================================================================

const NPC_FEATURES = {
    // === PEDESTRIAN DIRECTIONAL WALK CYCLES ===
    // Each direction gets a 2-frame sprite strip (64x32 = 2 frames of 32x32)
    ped_walk_n: `2-frame walk cycle sprite strip. Pedestrian walking AWAY from camera (NORTH direction in isometric). Back of character visible. Chunky 90s CGI style. Business casual clothing. Each frame shows alternating leg positions.`,

    ped_walk_s: `2-frame walk cycle sprite strip. Pedestrian walking TOWARD camera (SOUTH direction in isometric). Front of character visible. Chunky 90s CGI style. Business casual clothing. Each frame shows alternating leg positions.`,

    ped_walk_e: `2-frame walk cycle sprite strip. Pedestrian walking RIGHT (EAST direction in isometric). Side profile, facing right. Chunky 90s CGI style. Business casual clothing. Each frame shows alternating leg positions.`,

    ped_walk_w: `2-frame walk cycle sprite strip. Pedestrian walking LEFT (WEST direction in isometric). Side profile, facing left. Chunky 90s CGI style. Business casual clothing. Each frame shows alternating leg positions.`,

    // === CAR DIRECTIONAL SPRITES ===
    // Each direction is a single sprite showing the car facing that direction
    car_n: `Car viewed from isometric angle, pointing AWAY (NORTH). Rear of car visible, front pointing away from camera. Chunky, toy-like 90s proportions. Generic sedan. No brand markings.`,

    car_s: `Car viewed from isometric angle, pointing TOWARD camera (SOUTH). Front of car visible, facing the camera. Chunky, toy-like 90s proportions. Generic sedan. No brand markings.`,

    car_e: `Car viewed from isometric angle, pointing RIGHT (EAST). Side profile, car facing right. Chunky, toy-like 90s proportions. Generic sedan. No brand markings.`,

    car_w: `Car viewed from isometric angle, pointing LEFT (WEST). Side profile, car facing left. Chunky, toy-like 90s proportions. Generic sedan. No brand markings.`,

    // === LEGACY (for backwards compatibility) ===
    pedestrian_walk: `4-frame walk cycle sprite strip. Chunky 90s CGI character. Business casual clothing. Walking pose from side view. Each frame shows different leg position. Generic adult pedestrian.`,

    pedestrian_stand: `Standing idle pose. Chunky 90s CGI character. Business casual clothing. Neutral standing position. Could have subtle idle animation frames.`,

    pedestrian_suit: `4-frame walk cycle. Character in business suit. Professional appearance. Briefcase optional. Corporate worker type.`,

    pedestrian_casual: `4-frame walk cycle. Character in casual clothes. Relaxed appearance. Everyday citizen type.`,

    car_sedan: `Generic sedan car from isometric 45-degree view. Chunky, slightly toy-like proportions. Solid neutral color (gray, blue, or silver). No brand markings.`,

    car_sports: `Sports car from isometric 45-degree view. Sleek but chunky 90s CGI style. Bold color (red or yellow). No brand markings.`,

    car_van: `Delivery/utility van from isometric 45-degree view. Boxy, chunky proportions. White or neutral color. No brand text.`,

    car_taxi: `Taxi cab from isometric 45-degree view. Yellow with "TAXI" sign on roof. Chunky proportions. Generic taxi appearance.`
};

/**
 * Build prompt for NPC sprite generation
 */
function buildNPCPrompt(npcType, customDetails = '') {
    const npcName = npcType.replace(/_/g, ' ').toUpperCase();
    const features = NPC_FEATURES[npcType];

    // Detect sprite type for proper sizing
    const isPedWalk = npcType.startsWith('ped_walk_');
    const isCarDirection = ['car_n', 'car_s', 'car_e', 'car_w'].includes(npcType);
    const isPedestrian = npcType.startsWith('pedestrian_') || isPedWalk;

    if (!features) {
        throw new Error(`No features defined for NPC type: ${npcType}. Provide customDetails.`);
    }

    // Size specifications based on type
    let sizeSpec;
    if (isPedWalk) {
        sizeSpec = 'Sprite strip: 64x32 pixels (2 frames of 32x32 each for walk animation)';
    } else if (isCarDirection) {
        sizeSpec = 'Single sprite: 64x32 pixels (one car facing specific direction)';
    } else if (isPedestrian) {
        sizeSpec = 'Sprite strip: 128x32 pixels (4 frames of 32x32 each) OR single 32x32 for idle';
    } else {
        sizeSpec = 'Single sprite: 64x32 pixels (fits road tile)';
    }

    // Direction info for directional sprites
    let directionNote = '';
    if (isPedWalk || isCarDirection) {
        const direction = npcType.split('_').pop().toUpperCase();
        const directionMap = {
            'N': 'NORTH (away from camera, back visible)',
            'S': 'SOUTH (toward camera, front visible)',
            'E': 'EAST (facing right)',
            'W': 'WEST (facing left)'
        };
        directionNote = `\nDIRECTION: ${directionMap[direction] || direction}
- The ${isPedWalk ? 'character' : 'vehicle'} must be clearly facing/moving in the ${direction} direction
- When placed on the isometric map, this sprite shows movement toward ${direction}`;
    }

    return `Create an ambient NPC sprite: ${npcName}.

FORMAT REQUIREMENTS:
- 45-degree isometric view
- ${sizeSpec}
- Background: TRANSPARENT (PNG-ready)
- Purpose: ${isPedestrian ? 'Pedestrians walking on sidewalks' : 'Vehicles driving on roads'}
${directionNote}

THE NPC:
${features}

${STYLE_GUIDE}

${STYLE_REFERENCE_ANCHOR}

CRITICAL:
- Match the chunky 90s CGI aesthetic from building reference sheets
- ${isPedestrian ? 'Character proportions should match the stocky, geometric style' : 'Vehicle should look toy-like and chunky, not realistic'}
- Country-neutral (no flags, specific national markings)
- NO external shadows
- Sprite must be CENTERED on the canvas

${customDetails ? `ADDITIONAL NOTES:\n${customDetails}` : ''}`;
}

// ============================================================================
// AVATAR ASSETS
// ============================================================================

const AVATAR_FEATURES = {
    // Base bodies
    base_standard: `Standard adult human body silhouette. Neutral standing pose, arms slightly away from body. Average/normal build. Stocky, geometric 90s CGI proportions.`,

    base_athletic: `Athletic adult human body silhouette. Broader shoulders, more muscular proportions. Neutral standing pose. Stocky, geometric 90s CGI proportions.`,

    // Hair styles
    hair_short: `Short, professional haircut. Neat and tidy. Dark brown/black. Chunky hair masses with subtle strand detail. Business-appropriate.`,

    hair_long: `Longer hair past ears, could reach shoulders. Styled but not overly formal. Dark brown/black. Chunky stylized masses.`,

    hair_mohawk: `Bold mohawk hairstyle. Spiked up center, shaved sides. Could be bold color. Punk/rebellious. Exaggerated chunky spikes.`,

    hair_bald: `Bald/shaved head. Smooth scalp with subtle skin texture. Clean, professional appearance.`,

    hair_slicked: `Slicked back hair. Shiny, product-styled. Professional businessman look. Dark color with highlights.`,

    hair_curly: `Curly/wavy hair. Chunky stylized curls. Medium length. Natural, slightly wild appearance.`,

    // Outfits
    outfit_suit: `Professional business suit. Dark gray or navy jacket and trousers. White dress shirt, tie. Classic corporate attire.`,

    outfit_casual: `Casual everyday clothes. Polo shirt and chinos, or button-down with jeans. Relaxed but presentable. Earth tones.`,

    outfit_flashy: `Flashy, expensive-looking outfit. Bright colors or patterns. Gold accessories. Showing off wealth.`,

    outfit_street: `Street style clothing. Hoodie, sneakers, urban fashion. Relaxed, youthful appearance.`,

    outfit_gold_legendary: `LEGENDARY: Extraordinary golden suit. Shimmering metallic gold fabric. Luxurious, ostentatious. Sparkle effects. "I made it" appearance.`,

    outfit_prison: `Prison jumpsuit. Orange or striped. Simple, institutional. Disheveled appearance.`,

    outfit_tropical: `Hawaiian shirt, shorts, sandals. Vacation/retirement attire. Relaxed, wealthy retiree look.`,

    outfit_formal: `Black tie formal wear. Tuxedo or evening gown equivalent. Elegant, high-class event attire.`,

    // Headwear
    headwear_tophat: `Classic tall top hat. Black with band. Formal, old-money wealthy appearance.`,

    headwear_cap: `Casual baseball cap. Curved brim forward. Solid color. Relaxed, sporty.`,

    headwear_fedora: `Fedora hat. Classic gangster/noir style. Dark color with band.`,

    headwear_crown_legendary: `LEGENDARY: Magnificent royal crown. Gold with jewels (rubies, sapphires, emeralds). Ornate metalwork. Regal, ultimate status symbol.`,

    headwear_hardhat: `Construction hard hat. Yellow or white. Working class, builder appearance.`,

    headwear_beanie: `Knit beanie hat. Casual, urban style. Solid color.`,

    // Accessories
    accessory_sunglasses: `Cool sunglasses. Dark lenses with reflection. Aviator or wayfarer style. Confident appearance.`,

    accessory_watch: `Luxury wristwatch. Metal band (silver or gold). Expensive, successful businessman accessory.`,

    accessory_cigar: `Lit cigar. Smoke wisping upward. Power/wealth symbol. Boss imagery.`,

    accessory_briefcase: `Professional briefcase. Leather, classic style. Business equipment.`,

    accessory_chain: `Gold chain necklace. Chunky, visible. Wealth display.`,

    accessory_earring: `Earring (stud or small hoop). Subtle jewelry accent.`,

    // Backgrounds
    background_city: `City skyline at dusk/golden hour. Multiple skyscraper silhouettes. Warm sky gradient. Urban, successful, metropolitan.`,

    background_office: `Executive office interior. Large window with city view. Bookshelf, desk edge, wood paneling. Professional corporate.`,

    background_mansion: `Mansion exterior or interior. Grand architecture. Wealth and success backdrop.`,

    background_prison: `Prison cell or yard. Institutional, consequence backdrop. Gray, confined atmosphere.`
};

/**
 * Build prompt for avatar asset generation
 */
function buildAvatarPrompt(avatarType, customDetails = '') {
    const avatarName = avatarType.replace(/_/g, ' ').toUpperCase();
    const features = AVATAR_FEATURES[avatarType];

    const category = avatarType.split('_')[0]; // base, hair, outfit, headwear, accessory, background
    const isBackground = category === 'background';
    const isLegendary = avatarType.includes('_legendary');

    if (!features) {
        throw new Error(`No features defined for avatar type: ${avatarType}. Provide customDetails.`);
    }

    let layerInstructions;
    switch (category) {
        case 'base':
            layerInstructions = 'BASE LAYER - underlying body shape. Show as neutral gray (skin applied separately). Must align with all other layers.';
            break;
        case 'hair':
            layerInstructions = 'HAIR LAYER - overlays on head position. Must align with base body head position.';
            break;
        case 'outfit':
            layerInstructions = 'OUTFIT LAYER - covers torso, arms, legs. Leave face and hands exposed for skin layer.';
            break;
        case 'headwear':
            layerInstructions = 'HEADWEAR LAYER - sits on/replaces visible hair. Must align with head position.';
            break;
        case 'accessory':
            layerInstructions = 'ACCESSORY LAYER - small addition to face/body. Must align with appropriate body part.';
            break;
        case 'background':
            layerInstructions = 'BACKGROUND LAYER - full coverage, no transparency. Character layers composite on top.';
            break;
        default:
            layerInstructions = 'Layer must align with base body for proper compositing.';
    }

    return `Create an avatar ${category.toUpperCase()} layer: ${avatarName}.

FORMAT REQUIREMENTS:
- Front-facing character view
- Canvas: 512x512 pixels SQUARE
- Background: ${isBackground ? 'Full coverage (this IS the background)' : 'TRANSPARENT (PNG-ready)'}
- Purpose: ${layerInstructions}

THE ASSET:
${features}

${isLegendary ? `
LEGENDARY RARITY:
This is a LEGENDARY tier item - make it look SPECIAL, RARE, and DESIRABLE.
- Premium quality rendering
- Extra visual flair (sparkles, glow, metallic effects)
- Should stand out as obviously high-value
` : ''}

${STYLE_GUIDE}

${STYLE_REFERENCE_ANCHOR}

CRITICAL:
- Match the chunky, stocky 90s CGI character proportions from reference sheets
- All avatar layers must align perfectly for compositing
- ${isBackground ? 'Fill entire canvas as background scene' : 'Transparent background, only the specific element visible'}
- Country-neutral, gender-appropriate

${customDetails ? `ADDITIONAL NOTES:\n${customDetails}` : ''}`;
}

// ============================================================================
// UI ELEMENTS
// ============================================================================

const UI_FEATURES = {
    minimap_player: `Small bright GREEN dot or diamond shape. Solid, highly visible. Simple geometric. Subtle glow optional. 8x8 pixels.`,

    minimap_enemy: `Small bright RED dot or diamond shape. Solid, highly visible. Simple geometric. Clearly different from green player marker. 8x8 pixels.`,

    cursor_select: `Glowing diamond outline that surrounds an isometric tile. Bright yellow, white, or cyan edge glow. Just the outline - no fill (or very subtle semi-transparent fill). 68x36 pixels.`
};

/**
 * Build prompt for UI element generation
 */
function buildUIPrompt(uiType, customDetails = '') {
    const uiName = uiType.replace(/_/g, ' ').toUpperCase();
    const features = UI_FEATURES[uiType];

    if (!features) {
        throw new Error(`No features defined for UI type: ${uiType}. Provide customDetails.`);
    }

    return `Create a UI element: ${uiName}.

FORMAT REQUIREMENTS:
- Background: TRANSPARENT (PNG-ready)
- ${features}

PURPOSE:
${uiType.startsWith('minimap_') ? 'Shows player/enemy positions on the minimap. Must be highly visible at tiny size.' : 'Highlights currently selected/hovered tile on the game map.'}

STYLE:
- Clean, simple, easily distinguishable
- Bright enough to be visible over any terrain or building
- Smooth anti-aliased edges

${STYLE_REFERENCE_ANCHOR}

${customDetails ? `ADDITIONAL NOTES:\n${customDetails}` : ''}`;
}

// ============================================================================
// OWNERSHIP OVERLAYS
// ============================================================================

/**
 * Build prompt for ownership overlay generation
 */
function buildOverlayPrompt(overlayType, customDetails = '') {
    const isPlayerOwned = overlayType === 'owned_self';
    const color = isPlayerOwned ? 'GREEN (#22c55e)' : 'RED (#ef4444)';
    const meaning = isPlayerOwned ? 'player-owned' : 'enemy-owned';

    return `Create an ownership overlay: ${overlayType.toUpperCase().replace(/_/g, ' ')}.

FORMAT REQUIREMENTS:
- Diamond/rhombus shape matching tile footprint
- Size: 64x32 pixels (same as terrain tile)
- Background: TRANSPARENT (PNG-ready)
- Opacity: 30-40% semi-transparent

THE OVERLAY:
- Solid ${color} color fill of the diamond shape
- Semi-transparent to show terrain/building underneath
- Indicates this tile is ${meaning}

STYLE:
- Clean geometric diamond shape
- Consistent with isometric tile grid
- Simple color overlay, no gradients or effects needed

${customDetails ? `ADDITIONAL NOTES:\n${customDetails}` : ''}`;
}

// ============================================================================
// MASTER PROMPT BUILDER - Routes to correct category builder
// ============================================================================

/**
 * Build the appropriate prompt based on asset category
 * @param {string} category - Asset category (building_ref, terrain, effect, etc.)
 * @param {string} assetKey - Specific asset identifier
 * @param {string} customDetails - Additional prompt details
 * @returns {string} Complete prompt for Gemini
 */
function buildAssetPrompt(category, assetKey, customDetails = '') {
    switch (category) {
        // === REFERENCE SHEETS (generate first, approve, then make sprites) ===
        case 'building_ref':
            return buildBuildingRefPrompt(assetKey, customDetails);

        case 'character_ref':
            return buildCharacterRefPrompt(assetKey, customDetails);

        case 'vehicle_ref':
            return buildVehicleRefPrompt(assetKey, customDetails);

        case 'effect_ref':
            return buildEffectRefPrompt(assetKey, customDetails);

        // === SPRITES (generated from approved reference sheets) ===
        case 'building_sprite':
            return buildBuildingSpritePrompt(assetKey, customDetails);

        case 'terrain':
            return buildTerrainPrompt(assetKey, customDetails);

        case 'effect':
            return buildEffectPrompt(assetKey, customDetails);

        case 'scene':
            return buildScenePrompt(assetKey, customDetails);

        case 'npc':
            return buildNPCPrompt(assetKey, customDetails);

        case 'avatar':
            return buildAvatarPrompt(assetKey, customDetails);

        case 'ui':
            return buildUIPrompt(assetKey, customDetails);

        case 'overlay':
            return buildOverlayPrompt(assetKey, customDetails);

        default:
            // For unknown categories, require a custom prompt
            if (!customDetails) {
                throw new Error(`Unknown category "${category}". Provide a custom prompt.`);
            }
            // Wrap custom prompt with style guide
            return `${customDetails}

${STYLE_GUIDE}

${STYLE_REFERENCE_ANCHOR}`;
    }
}

// ============================================================================
// ASSET DEPENDENCY CHECKING
// Some assets require other assets to be approved first
// ============================================================================

/**
 * Check if scene generation dependencies are met.
 * Scenes require avatar base assets to be approved for proper compositing testing.
 * Returns { canGenerate: boolean, missing: string[], message: string }
 */
async function checkSceneDependencies(env) {
    // Check for approved avatar base assets
    const avatarBase = await env.DB.prepare(`
        SELECT COUNT(*) as count FROM generated_assets
        WHERE category = 'avatar' AND asset_key LIKE 'base_%' AND status = 'approved'
    `).first();

    const missing = [];

    if (!avatarBase || avatarBase.count === 0) {
        missing.push('Avatar base body (avatar/base_*)');
    }

    // Optionally check for other dependencies
    // We could also require buildings, effects, etc. to be done first
    // For now, just require avatar base for compositing testing

    if (missing.length > 0) {
        return {
            canGenerate: false,
            missing,
            message: `Scene generation blocked. Required assets not yet approved: ${missing.join(', ')}. Scenes need avatar assets for compositing.`
        };
    }

    return { canGenerate: true, missing: [], message: 'All dependencies met.' };
}

/**
 * Check if sprite generation has required reference sheet approved.
 * Building sprites need building_ref, NPC sprites need character_ref, etc.
 */
async function checkSpriteReferenceDependency(env, category, assetKey) {
    const refCategoryMap = {
        'building_sprite': 'building_ref',
        'npc': 'character_ref',
        'effect': 'effect_ref'
    };

    const refCategory = refCategoryMap[category];
    if (!refCategory) {
        return { canGenerate: true }; // No reference needed
    }

    // Check if there's an approved reference for this asset_key
    const ref = await env.DB.prepare(`
        SELECT id, status FROM generated_assets
        WHERE category = ? AND asset_key = ? AND status = 'approved'
        ORDER BY created_at DESC LIMIT 1
    `).bind(refCategory, assetKey).first();

    if (!ref) {
        return {
            canGenerate: false,
            message: `No approved ${refCategory.replace('_', ' ')} found for "${assetKey}". Generate and approve a reference sheet first.`
        };
    }

    return { canGenerate: true, referenceId: ref.id };
}

// Gemini API helper - Uses Nano Banana Pro (gemini-3-pro-image-preview)
// referenceImage: optional { buffer: Uint8Array, mimeType: string } for image-to-image generation
async function generateWithGemini(env, prompt, referenceImage = null) {
    try {
        // Build the parts array - text prompt first, then optional reference image
        const parts = [{ text: prompt }];

        // If a reference image is provided, include it for Gemini to use as context
        if (referenceImage) {
            // Convert buffer to base64 (chunked to avoid stack overflow on large images)
            let base64Data = '';
            const bytes = referenceImage.buffer;
            const chunkSize = 8192;
            for (let i = 0; i < bytes.length; i += chunkSize) {
                const chunk = bytes.slice(i, i + chunkSize);
                base64Data += String.fromCharCode.apply(null, chunk);
            }
            base64Data = btoa(base64Data);

            parts.push({
                inlineData: {
                    mimeType: referenceImage.mimeType || 'image/png',
                    data: base64Data
                }
            });
        }

        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-pro-image-preview:generateContent?key=${env.GEMINI_API_KEY}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{
                        parts: parts
                    }],
                    generationConfig: {
                        responseModalities: ['IMAGE', 'TEXT']
                    }
                })
            }
        );

        if (!response.ok) {
            const error = await response.text();
            return { success: false, error };
        }

        const data = await response.json();

        // Extract image from response
        const imagePart = data.candidates?.[0]?.content?.parts?.find(p => p.inlineData);
        if (!imagePart) {
            return { success: false, error: 'No image in response' };
        }

        const imageBuffer = Uint8Array.from(atob(imagePart.inlineData.data), c => c.charCodeAt(0));
        return { success: true, imageBuffer };

    } catch (error) {
        return { success: false, error: error.message };
    }
}

// Map sprite categories to their corresponding reference sheet categories
const SPRITE_TO_REF_CATEGORY = {
    'building_sprite': 'building_ref',
    'npc': 'character_ref',      // pedestrians use character_ref
    'effect': 'effect_ref',
    'avatar': 'character_ref'    // avatars use character_ref (avatar_base)
};

// Get the reference sheet asset_key for a sprite
// For most, it's the same key. For NPCs/avatars, we need to map to the correct ref
function getRefAssetKey(category, assetKey) {
    if (category === 'npc') {
        // Pedestrians map to their character ref
        if (assetKey.startsWith('pedestrian_')) {
            return assetKey.includes('business') || assetKey.includes('suit')
                ? 'pedestrian_business'
                : 'pedestrian_casual';
        }
        // Vehicles map to their vehicle ref
        if (assetKey.startsWith('car_')) {
            return assetKey; // car_sedan, car_sports, etc.
        }
    }
    if (category === 'avatar') {
        return 'avatar_base'; // All avatar items use the avatar_base character ref
    }
    // For building_sprite and effect, the asset_key is the same
    return assetKey;
}

// Route handler for asset management
export async function handleAssetRoutes(request, env, path, method, user) {
    const url = new URL(request.url);

    // Parse route
    // /api/admin/assets/list/:category
    // /api/admin/assets/queue
    // /api/admin/assets/generate
    // etc.

    const pathParts = path.replace('/api/admin/assets', '').split('/').filter(Boolean);
    const action = pathParts[0];
    const param1 = pathParts[1];
    const param2 = pathParts[2];
    const param3 = pathParts[3];

    try {
        // GET /api/admin/assets/list/:category - List all assets by category
        if (action === 'list' && method === 'GET' && param1) {
            const category = param1;
            const assets = await env.DB.prepare(`
                SELECT * FROM generated_assets
                WHERE category = ?
                ORDER BY asset_key, variant
            `).bind(category).all();

            return Response.json({ success: true, data: assets.results || [] });
        }

        // GET /api/admin/assets/queue - Get generation queue status
        if (action === 'queue' && method === 'GET') {
            const queue = await env.DB.prepare(`
                SELECT q.*, a.category, a.asset_key
                FROM asset_generation_queue q
                JOIN generated_assets a ON q.asset_id = a.id
                WHERE q.status IN ('queued', 'processing')
                ORDER BY q.priority, q.created_at
            `).all();

            const items = queue.results || [];
            const pending = items.filter(i => i.status === 'queued').length;
            const generating = items.filter(i => i.status === 'processing').length;

            return Response.json({
                success: true,
                data: {
                    pending,
                    generating,
                    items: items.map(i => ({
                        id: i.id,
                        category: i.category,
                        asset_key: i.asset_key,
                        status: i.status === 'queued' ? 'pending' : 'generating',
                        created_at: i.created_at
                    }))
                }
            });
        }

        // GET /api/admin/assets/preview/:assetId - Get signed preview URL for private asset
        if (action === 'preview' && method === 'GET' && param1) {
            const assetId = param1;
            const asset = await env.DB.prepare(`
                SELECT * FROM generated_assets WHERE id = ?
            `).bind(assetId).first();

            if (!asset) {
                return Response.json({ success: false, error: 'Asset not found' }, { status: 404 });
            }

            // Get the object from R2 private bucket and create a signed URL
            // Since Cloudflare R2 doesn't support presigned URLs directly in Workers,
            // we'll return the image data as a data URL or use a proxy approach
            const r2Key = asset.r2_key_private;
            const object = await env.R2_PRIVATE.get(r2Key);

            if (!object) {
                return Response.json({ success: false, error: 'Image not found in storage' }, { status: 404 });
            }

            // Convert to base64 data URL (chunked to avoid stack overflow on large images)
            const arrayBuffer = await object.arrayBuffer();
            const uint8Array = new Uint8Array(arrayBuffer);
            let binary = '';
            const chunkSize = 8192;
            for (let i = 0; i < uint8Array.length; i += chunkSize) {
                const chunk = uint8Array.subarray(i, i + chunkSize);
                binary += String.fromCharCode.apply(null, chunk);
            }
            const base64 = btoa(binary);
            const contentType = object.httpMetadata?.contentType || 'image/png';
            const dataUrl = `data:${contentType};base64,${base64}`;

            return Response.json({
                success: true,
                data: {
                    url: dataUrl,
                    expires_at: new Date(Date.now() + 3600000).toISOString() // 1 hour (not really used for data URLs)
                }
            });
        }

        // POST /api/admin/assets/generate - Generate a new asset
        if (action === 'generate' && method === 'POST') {
            const { category, asset_key, prompt, variant = 1, custom_details } = await request.json();

            // === DEPENDENCY CHECKS ===
            // Scene generation requires avatar assets to be approved first
            if (category === 'scene') {
                const sceneCheck = await checkSceneDependencies(env);
                if (!sceneCheck.canGenerate) {
                    return Response.json({
                        error: 'Scene generation blocked',
                        reason: sceneCheck.message,
                        missing_dependencies: sceneCheck.missing,
                        hint: 'Generate and approve avatar base assets first (avatar/base_male, avatar/base_female)'
                    }, { status: 400 });
                }
            }

            // Sprite generation requires approved reference sheet
            if (['building_sprite', 'npc', 'effect'].includes(category)) {
                const spriteCheck = await checkSpriteReferenceDependency(env, category, asset_key);
                if (!spriteCheck.canGenerate) {
                    return Response.json({
                        error: 'Sprite generation blocked',
                        reason: spriteCheck.message,
                        hint: 'Generate and approve a reference sheet for this asset first'
                    }, { status: 400 });
                }
            }

            // Build the full prompt based on category using the master prompt builder
            let fullPrompt = prompt;

            // If no custom prompt provided, auto-build from category templates
            if (!prompt) {
                try {
                    fullPrompt = buildAssetPrompt(category, asset_key, custom_details || '');
                } catch (err) {
                    return Response.json({
                        error: err.message,
                        hint: `Provide a known asset_key for category "${category}" or include a custom prompt`,
                        supported_categories: {
                            reference_sheets: ['building_ref', 'character_ref', 'vehicle_ref', 'effect_ref'],
                            sprites: ['building_sprite', 'terrain', 'effect', 'scene', 'npc', 'avatar', 'ui', 'overlay']
                        }
                    }, { status: 400 });
                }
            } else {
                // If custom prompt provided, wrap it with style guide for consistency
                try {
                    fullPrompt = buildAssetPrompt(category, asset_key, prompt);
                } catch {
                    // If category doesn't have a builder, use prompt with style guide wrapper
                    fullPrompt = `${prompt}\n\n${STYLE_GUIDE}\n\n${STYLE_REFERENCE_ANCHOR}`;
                }
            }

            if (!fullPrompt) {
                return Response.json({ error: 'Could not build prompt. Provide asset_key or custom prompt.' }, { status: 400 });
            }

            // For sprite categories, fetch the approved reference sheet image
            let referenceImage = null;
            let parentAssetId = null;
            const refCategory = SPRITE_TO_REF_CATEGORY[category];

            if (refCategory) {
                // This is a sprite category that needs a reference sheet
                const refAssetKey = getRefAssetKey(category, asset_key);

                // Look for an approved reference sheet
                const refAsset = await env.DB.prepare(`
                    SELECT id, r2_key_private FROM generated_assets
                    WHERE category = ? AND asset_key = ? AND status = 'approved'
                    ORDER BY variant DESC
                    LIMIT 1
                `).bind(refCategory, refAssetKey).first();

                if (refAsset && refAsset.r2_key_private) {
                    // Fetch the reference image from R2
                    const refObject = await env.R2_PRIVATE.get(refAsset.r2_key_private);
                    if (refObject) {
                        const buffer = await refObject.arrayBuffer();
                        referenceImage = {
                            buffer: new Uint8Array(buffer),
                            mimeType: 'image/png'
                        };
                        parentAssetId = refAsset.id;

                        // Prepend instruction to use the reference image
                        fullPrompt = `REFERENCE IMAGE ATTACHED: Use the attached reference sheet image as your style guide. The sprite you generate MUST match the exact design, colors, and details shown in this reference sheet. Extract and render only the 45-degree isometric view as a standalone sprite.\n\n${fullPrompt}`;
                    }
                }

                // Warn if no approved ref exists (but don't block - allow generation anyway)
                if (!referenceImage) {
                    console.log(`Warning: No approved reference sheet found for ${refCategory}/${refAssetKey}. Generating sprite from text prompt only.`);
                }
            }

            // Create asset record
            const result = await env.DB.prepare(`
                INSERT INTO generated_assets (category, asset_key, variant, base_prompt, current_prompt, status, generation_model, parent_asset_id)
                VALUES (?, ?, ?, ?, ?, 'pending', 'gemini-3-pro-image-preview', ?)
                ON CONFLICT(category, asset_key, variant)
                DO UPDATE SET base_prompt = excluded.base_prompt, current_prompt = excluded.current_prompt, status = 'pending', parent_asset_id = excluded.parent_asset_id, updated_at = CURRENT_TIMESTAMP
                RETURNING id
            `).bind(category, asset_key, variant, fullPrompt, fullPrompt, parentAssetId).first();

            // Add to queue
            await env.DB.prepare(`
                INSERT INTO asset_generation_queue (asset_id, priority)
                VALUES (?, 5)
            `).bind(result.id).run();

            // Trigger generation with optional reference image
            const generated = await generateWithGemini(env, fullPrompt, referenceImage);

            if (generated.success) {
                // Determine storage path based on category
                // All originals go to PRIVATE bucket (not publicly accessible)
                let r2Key;
                if (category.endsWith('_ref')) {
                    // Reference sheets go to refs/
                    r2Key = `refs/${asset_key}_ref_v${variant}.png`;
                } else if (category === 'scene') {
                    // Scene originals go to scenes/
                    r2Key = `scenes/${asset_key}_v${variant}.png`;
                } else {
                    // Sprites go to raw/ (will be processed later)
                    r2Key = `raw/${category}_${asset_key}_raw_v${variant}.png`;
                }

                // Store in PRIVATE bucket (originals not publicly accessible)
                await env.R2_PRIVATE.put(r2Key, generated.imageBuffer, {
                    httpMetadata: { contentType: 'image/png' }
                });

                // Update asset record (r2_url left null for private assets)
                await env.DB.prepare(`
                    UPDATE generated_assets
                    SET status = 'completed', r2_key_private = ?, updated_at = CURRENT_TIMESTAMP
                    WHERE id = ?
                `).bind(r2Key, result.id).run();

                // Update queue
                await env.DB.prepare(`
                    UPDATE asset_generation_queue
                    SET status = 'completed', completed_at = CURRENT_TIMESTAMP
                    WHERE asset_id = ?
                `).bind(result.id).run();

                await logAudit(env, 'generate', result.id, user?.username, { category, asset_key, variant, used_reference: !!referenceImage });

                return Response.json({
                    success: true,
                    asset_id: result.id,
                    r2_key: r2Key,
                    bucket: 'private',
                    parent_asset_id: parentAssetId,
                    used_reference_image: !!referenceImage,
                    note: referenceImage
                        ? 'Generated using approved reference sheet. Original stored in private bucket.'
                        : 'Original stored in private bucket. Use POST /process/:id to create game-ready WebP in public bucket.'
                });
            } else {
                await env.DB.prepare(`
                    UPDATE generated_assets
                    SET status = 'failed', error_message = ?, updated_at = CURRENT_TIMESTAMP
                    WHERE id = ?
                `).bind(generated.error, result.id).run();

                return Response.json({ success: false, error: generated.error }, { status: 500 });
            }
        }

        // POST /api/admin/assets/remove-background/:id - Remove background and trim transparent pixels
        if (action === 'remove-background' && method === 'POST' && param1) {
            const id = param1;

            const asset = await env.DB.prepare(`
                SELECT * FROM generated_assets WHERE id = ?
            `).bind(id).first();

            if (!asset || !asset.r2_key_private) {
                return Response.json({ error: 'Asset not found' }, { status: 404 });
            }

            // Fetch the image from private bucket
            const originalObj = await env.R2_PRIVATE.get(asset.r2_key_private);
            if (!originalObj) {
                return Response.json({ error: 'Original image not found in R2' }, { status: 404 });
            }

            // Call Slazzer API with image file - includes crop=true to trim transparent pixels
            const arrayBuffer = await originalObj.arrayBuffer();
            const formData = new FormData();
            formData.append('source_image_file', new Blob([arrayBuffer], { type: 'image/png' }), 'image.png');
            formData.append('crop', 'true'); // Trim transparent pixels from all edges

            const slazzerResponse = await fetch('https://api.slazzer.com/v2.0/remove_image_background', {
                method: 'POST',
                headers: {
                    'API-KEY': env.SLAZZER_API_KEY
                },
                body: formData
            });

            if (!slazzerResponse.ok) {
                const error = await slazzerResponse.text();
                return Response.json({ error: `Background removal failed: ${error}` }, { status: 500 });
            }

            // Slazzer returns the image directly as binary
            const transparentBuffer = await slazzerResponse.arrayBuffer();

            // Store transparent + trimmed version in private bucket
            const newR2Key = asset.r2_key_private.replace('.png', '_transparent.png');
            await env.R2_PRIVATE.put(newR2Key, transparentBuffer, {
                httpMetadata: { contentType: 'image/png' }
            });

            // Update record
            await env.DB.prepare(`
                UPDATE generated_assets
                SET background_removed = TRUE, r2_key_private = ?, updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
            `).bind(newR2Key, id).run();

            await logAudit(env, 'remove_bg', parseInt(id), user?.username);

            return Response.json({
                success: true,
                r2_key: newR2Key,
                bucket: 'private',
                note: 'Background removed and transparent pixels trimmed. Use POST /process/:id to publish.'
            });
        }

        // PUT /api/admin/assets/approve/:id - Approve an asset and set as active
        if (action === 'approve' && method === 'PUT' && param1) {
            const id = param1;

            // Get asset details to know category and asset_key
            const asset = await env.DB.prepare(`
                SELECT category, asset_key FROM generated_assets WHERE id = ?
            `).bind(id).first();

            if (!asset) {
                return Response.json({ error: 'Asset not found' }, { status: 404 });
            }

            // Deactivate other assets of the same category and asset_key
            await env.DB.prepare(`
                UPDATE generated_assets
                SET is_active = FALSE
                WHERE category = ? AND asset_key = ? AND id != ?
            `).bind(asset.category, asset.asset_key, id).run();

            // Approve and set as active
            await env.DB.prepare(`
                UPDATE generated_assets
                SET status = 'approved', approved_at = CURRENT_TIMESTAMP, approved_by = ?, is_active = TRUE
                WHERE id = ?
            `).bind(user?.username || 'admin', id).run();

            await logAudit(env, 'approve', parseInt(id), user?.username, { set_active: true });

            // Check if this is a base terrain type that should auto-generate variations
            let autoGeneratedVariations = [];
            if (asset.category === 'terrain' && TERRAIN_VARIATIONS[asset.asset_key]) {
                const variations = TERRAIN_VARIATIONS[asset.asset_key];
                for (const variant of variations) {
                    // Create placeholder asset record with 'pending' status
                    const insertResult = await env.DB.prepare(`
                        INSERT INTO generated_assets (category, asset_key, variant, status, parent_asset_id)
                        VALUES (?, ?, 1, 'pending', ?)
                        ON CONFLICT (category, asset_key, variant) DO NOTHING
                    `).bind('terrain', variant, id).run();

                    if (insertResult.meta?.changes > 0) {
                        const newId = insertResult.meta?.last_row_id;
                        // Queue for generation
                        await env.DB.prepare(`
                            INSERT INTO asset_generation_queue (asset_id, priority)
                            VALUES (?, 1)
                        `).bind(newId).run();
                        autoGeneratedVariations.push({ variant, id: newId });
                    }
                }
                await logAudit(env, 'auto_queue_variations', parseInt(id), user?.username, {
                    base_type: asset.asset_key,
                    queued_variations: autoGeneratedVariations.map(v => v.variant)
                });
            }

            // Check if this is an NPC/vehicle reference that should auto-generate directional sprites
            if (asset.category === 'character_ref' && asset.asset_key === 'pedestrian') {
                const directions = DIRECTIONAL_SPRITE_VARIANTS.pedestrian;
                for (const dir of directions) {
                    const insertResult = await env.DB.prepare(`
                        INSERT INTO generated_assets (category, asset_key, variant, status, parent_asset_id)
                        VALUES (?, ?, 1, 'pending', ?)
                        ON CONFLICT (category, asset_key, variant) DO NOTHING
                    `).bind('npc', dir, id).run();

                    if (insertResult.meta?.changes > 0) {
                        const newId = insertResult.meta?.last_row_id;
                        await env.DB.prepare(`
                            INSERT INTO asset_generation_queue (asset_id, priority)
                            VALUES (?, 1)
                        `).bind(newId).run();
                        autoGeneratedVariations.push({ dir, id: newId });
                    }
                }
                await logAudit(env, 'auto_queue_directions', parseInt(id), user?.username, {
                    base_type: asset.asset_key,
                    queued_directions: autoGeneratedVariations.map(v => v.dir)
                });
            }

            // Check if this is a vehicle reference that should auto-generate directional sprites
            if (asset.category === 'vehicle_ref' && asset.asset_key.startsWith('car')) {
                const directions = DIRECTIONAL_SPRITE_VARIANTS.car;
                for (const dir of directions) {
                    const insertResult = await env.DB.prepare(`
                        INSERT INTO generated_assets (category, asset_key, variant, status, parent_asset_id)
                        VALUES (?, ?, 1, 'pending', ?)
                        ON CONFLICT (category, asset_key, variant) DO NOTHING
                    `).bind('npc', dir, id).run();

                    if (insertResult.meta?.changes > 0) {
                        const newId = insertResult.meta?.last_row_id;
                        await env.DB.prepare(`
                            INSERT INTO asset_generation_queue (asset_id, priority)
                            VALUES (?, 1)
                        `).bind(newId).run();
                        autoGeneratedVariations.push({ dir, id: newId });
                    }
                }
                await logAudit(env, 'auto_queue_directions', parseInt(id), user?.username, {
                    base_type: asset.asset_key,
                    queued_directions: autoGeneratedVariations.map(v => v.dir)
                });
            }

            return Response.json({
                success: true,
                is_active: true,
                auto_queued: autoGeneratedVariations.length > 0 ? autoGeneratedVariations : undefined
            });
        }

        // PUT /api/admin/assets/set-active/:id - Set an existing approved asset as the active one
        if (action === 'set-active' && method === 'PUT' && param1) {
            const id = param1;

            // Get asset details
            const asset = await env.DB.prepare(`
                SELECT category, asset_key, status FROM generated_assets WHERE id = ?
            `).bind(id).first();

            if (!asset) {
                return Response.json({ error: 'Asset not found' }, { status: 404 });
            }

            if (asset.status !== 'approved') {
                return Response.json({ error: 'Only approved assets can be set as active' }, { status: 400 });
            }

            // Deactivate other assets of the same category and asset_key
            await env.DB.prepare(`
                UPDATE generated_assets
                SET is_active = FALSE
                WHERE category = ? AND asset_key = ?
            `).bind(asset.category, asset.asset_key).run();

            // Set this one as active
            await env.DB.prepare(`
                UPDATE generated_assets
                SET is_active = TRUE
                WHERE id = ?
            `).bind(id).run();

            await logAudit(env, 'set_active', parseInt(id), user?.username);

            return Response.json({ success: true });
        }

        // PUT /api/admin/assets/reject/:id - Reject an asset WITH feedback
        if (action === 'reject' && method === 'PUT' && param1) {
            const id = param1;
            const { reason, incorporate_feedback = true } = await request.json();

            if (!reason) {
                return Response.json({ error: 'Rejection reason is required' }, { status: 400 });
            }

            // Get current asset
            const asset = await env.DB.prepare(`
                SELECT * FROM generated_assets WHERE id = ?
            `).bind(id).first();

            if (!asset) {
                return Response.json({ error: 'Asset not found' }, { status: 404 });
            }

            // Store rejection in history
            await env.DB.prepare(`
                INSERT INTO asset_rejections (asset_id, rejected_by, rejection_reason, prompt_at_rejection, prompt_version, r2_key_rejected)
                VALUES (?, ?, ?, ?, ?, ?)
            `).bind(id, user?.username || 'admin', reason, asset.current_prompt, asset.prompt_version, asset.r2_key_private).run();

            // Update the prompt with feedback if requested
            let newPrompt = asset.current_prompt;
            if (incorporate_feedback) {
                // Append feedback to prompt for next generation
                newPrompt = `${asset.base_prompt}

IMPORTANT FEEDBACK FROM PREVIOUS ATTEMPT:
${reason}

Please address the above feedback in this generation.`;
            }

            // Update asset status and prompt
            await env.DB.prepare(`
                UPDATE generated_assets
                SET status = 'rejected',
                    current_prompt = ?,
                    prompt_version = prompt_version + 1,
                    rejection_count = rejection_count + 1,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
            `).bind(newPrompt, id).run();

            await logAudit(env, 'reject', parseInt(id), user?.username, { reason, incorporate_feedback });

            return Response.json({
                success: true,
                message: 'Asset rejected. Prompt updated with feedback.',
                new_prompt_version: asset.prompt_version + 1,
                feedback_incorporated: incorporate_feedback
            });
        }

        // POST /api/admin/assets/regenerate/:id - Regenerate a rejected asset
        if (action === 'regenerate' && method === 'POST' && param1) {
            const id = param1;

            const asset = await env.DB.prepare(`
                SELECT * FROM generated_assets WHERE id = ?
            `).bind(id).first();

            if (!asset) {
                return Response.json({ error: 'Asset not found' }, { status: 404 });
            }

            // Use the current_prompt which includes any incorporated feedback
            const generated = await generateWithGemini(env, asset.current_prompt);

            if (generated.success) {
                // Store new version (overwrite old in private bucket)
                const r2Key = asset.r2_key_private || `raw/${asset.category}_${asset.asset_key}_v${asset.variant}.png`;

                await env.R2_PRIVATE.put(r2Key, generated.imageBuffer, {
                    httpMetadata: { contentType: 'image/png' }
                });

                // Update to review status
                await env.DB.prepare(`
                    UPDATE generated_assets
                    SET status = 'review',
                        r2_key_private = ?,
                        background_removed = FALSE,
                        updated_at = CURRENT_TIMESTAMP
                    WHERE id = ?
                `).bind(r2Key, id).run();

                await logAudit(env, 'regenerate', parseInt(id), user?.username, { prompt_version: asset.prompt_version });

                return Response.json({
                    success: true,
                    asset_id: id,
                    prompt_version: asset.prompt_version,
                    message: 'Asset regenerated with updated prompt. Ready for review.'
                });
            } else {
                await env.DB.prepare(`
                    UPDATE generated_assets
                    SET error_message = ?, updated_at = CURRENT_TIMESTAMP
                    WHERE id = ?
                `).bind(generated.error, id).run();

                return Response.json({ success: false, error: generated.error }, { status: 500 });
            }
        }

        // GET /api/admin/assets/rejections/:id - Get rejection history
        if (action === 'rejections' && method === 'GET' && param1) {
            const id = param1;

            const rejections = await env.DB.prepare(`
                SELECT * FROM asset_rejections
                WHERE asset_id = ?
                ORDER BY created_at DESC
            `).bind(id).all();

            return Response.json({ rejections: rejections.results });
        }

        // POST /api/admin/assets/generate-from-ref/:refId - Generate sprite from approved ref
        if (action === 'generate-from-ref' && method === 'POST' && param1) {
            const refId = param1;
            const { sprite_prompt, variant = 1 } = await request.json();

            // Get the approved reference
            const ref = await env.DB.prepare(`
                SELECT ga.*, ac.id as cat_id
                FROM generated_assets ga
                JOIN asset_categories ac ON ga.category = ac.id
                WHERE ga.id = ? AND ga.status = 'approved'
            `).bind(refId).first();

            if (!ref) {
                return Response.json({
                    error: 'Reference not found or not approved. Approve the reference sheet first.'
                }, { status: 400 });
            }

            // Find the sprite category for this ref
            const spriteCategory = await env.DB.prepare(`
                SELECT * FROM asset_categories WHERE parent_category = ?
            `).bind(ref.category).first();

            if (!spriteCategory) {
                return Response.json({
                    error: `No sprite category found for reference category ${ref.category}`
                }, { status: 400 });
            }

            // Create sprite record linked to parent ref
            const result = await env.DB.prepare(`
                INSERT INTO generated_assets (
                    category, asset_key, variant, base_prompt, current_prompt,
                    parent_asset_id, status, generation_model
                )
                VALUES (?, ?, ?, ?, ?, ?, 'pending', 'gemini-3-pro-image-preview')
                ON CONFLICT(category, asset_key, variant)
                DO UPDATE SET
                    base_prompt = excluded.base_prompt,
                    current_prompt = excluded.current_prompt,
                    parent_asset_id = excluded.parent_asset_id,
                    status = 'pending',
                    prompt_version = prompt_version + 1,
                    updated_at = CURRENT_TIMESTAMP
                RETURNING id
            `).bind(
                spriteCategory.id,
                ref.asset_key,
                variant,
                sprite_prompt,
                sprite_prompt,
                refId
            ).first();

            // Generate the sprite
            const generated = await generateWithGemini(env, sprite_prompt);

            if (generated.success) {
                const r2Key = `raw/${spriteCategory.id}_${ref.asset_key}_v${variant}.png`;

                await env.R2_PRIVATE.put(r2Key, generated.imageBuffer, {
                    httpMetadata: { contentType: 'image/png' }
                });

                await env.DB.prepare(`
                    UPDATE generated_assets
                    SET status = 'review', r2_key_private = ?, updated_at = CURRENT_TIMESTAMP
                    WHERE id = ?
                `).bind(r2Key, result.id).run();

                await logAudit(env, 'generate_from_ref', result.id, user?.username, {
                    parent_ref_id: refId,
                    category: spriteCategory.id
                });

                return Response.json({
                    success: true,
                    sprite_id: result.id,
                    parent_ref_id: refId,
                    category: spriteCategory.id,
                    message: 'Sprite generated from approved reference. Ready for review.'
                });
            } else {
                await env.DB.prepare(`
                    UPDATE generated_assets
                    SET status = 'failed', error_message = ?, updated_at = CURRENT_TIMESTAMP
                    WHERE id = ?
                `).bind(generated.error, result.id).run();

                return Response.json({ success: false, error: generated.error }, { status: 500 });
            }
        }

        // GET /api/admin/assets/approved-refs - Get approved refs ready for sprite generation
        if (action === 'approved-refs' && method === 'GET') {
            const refs = await env.DB.prepare(`
                SELECT ga.*, ac.name as category_name,
                       (SELECT COUNT(*) FROM generated_assets child
                        WHERE child.parent_asset_id = ga.id AND child.status = 'approved') as approved_sprites
                FROM generated_assets ga
                JOIN asset_categories ac ON ga.category = ac.id
                WHERE ga.status = 'approved'
                  AND ga.category LIKE '%_ref'
                ORDER BY ga.asset_key
            `).all();

            return Response.json({ refs: refs.results });
        }

        // POST /api/admin/assets/reset-prompt/:id - Reset prompt to base
        if (action === 'reset-prompt' && method === 'POST' && param1) {
            const id = param1;

            await env.DB.prepare(`
                UPDATE generated_assets
                SET current_prompt = base_prompt,
                    prompt_version = prompt_version + 1,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
            `).bind(id).run();

            await logAudit(env, 'reset_prompt', parseInt(id), user?.username);

            return Response.json({ success: true, message: 'Prompt reset to base. Feedback removed.' });
        }

        // GET /api/admin/assets/audit/:assetId - Get audit log for specific asset
        if (action === 'audit' && method === 'GET' && param1) {
            const assetId = param1;

            const logs = await env.DB.prepare(`
                SELECT * FROM asset_audit_log
                WHERE asset_id = ?
                ORDER BY created_at DESC
            `).bind(assetId).all();

            return Response.json({ logs: logs.results });
        }

        // GET /api/admin/assets/audit - Get recent audit log (all assets)
        if (action === 'audit' && method === 'GET' && !param1) {
            const limit = url.searchParams.get('limit') || '50';
            const actionFilter = url.searchParams.get('action');

            let query = `SELECT * FROM v_recent_audit`;
            const params = [];

            if (actionFilter) {
                query = `SELECT * FROM asset_audit_log al
                         LEFT JOIN generated_assets ga ON al.asset_id = ga.id
                         WHERE al.action = ?
                         ORDER BY al.created_at DESC
                         LIMIT ?`;
                params.push(actionFilter, parseInt(limit));
            } else {
                query += ` LIMIT ?`;
                params.push(parseInt(limit));
            }

            const logs = await env.DB.prepare(query).bind(...params).all();
            return Response.json({ logs: logs.results });
        }

        // GET /api/admin/assets/buildings - List all building types with configurations
        if (action === 'buildings' && method === 'GET' && !param1) {
            const buildings = await env.DB.prepare(`
                SELECT * FROM v_building_manager
                ORDER BY building_name
            `).all();

            return Response.json({ buildings: buildings.results });
        }

        // GET /api/admin/assets/buildings/:buildingType/sprites - Get available sprites
        if (action === 'buildings' && method === 'GET' && param1 && param2 === 'sprites') {
            const buildingType = param1;

            const sprites = await env.DB.prepare(`
                SELECT ga.*,
                       (SELECT bc.active_sprite_id FROM building_configurations bc
                        WHERE bc.building_type_id = ?) = ga.id as is_active
                FROM generated_assets ga
                WHERE ga.category = 'building_sprite'
                  AND ga.asset_key = ?
                  AND ga.status = 'approved'
                ORDER BY ga.created_at DESC
            `).bind(buildingType, buildingType).all();

            return Response.json({ sprites: sprites.results });
        }

        // PUT /api/admin/assets/buildings/:buildingType - Update building configuration
        if (action === 'buildings' && method === 'PUT' && param1 && !param2) {
            const buildingType = param1;
            const { active_sprite_id, cost_override, base_profit_override } = await request.json();

            // Validate sprite belongs to this building type
            if (active_sprite_id) {
                const sprite = await env.DB.prepare(`
                    SELECT * FROM generated_assets
                    WHERE id = ? AND category = 'building_sprite' AND asset_key = ? AND status = 'approved'
                `).bind(active_sprite_id, buildingType).first();

                if (!sprite) {
                    return Response.json({
                        error: 'Invalid sprite. Must be an approved building sprite for this building type.'
                    }, { status: 400 });
                }
            }

            // Upsert configuration
            await env.DB.prepare(`
                INSERT INTO building_configurations (building_type_id, active_sprite_id, cost_override, base_profit_override)
                VALUES (?, ?, ?, ?)
                ON CONFLICT(building_type_id)
                DO UPDATE SET
                    active_sprite_id = COALESCE(excluded.active_sprite_id, active_sprite_id),
                    cost_override = excluded.cost_override,
                    base_profit_override = excluded.base_profit_override,
                    updated_at = CURRENT_TIMESTAMP
            `).bind(buildingType, active_sprite_id, cost_override, base_profit_override).run();

            await logAudit(env, 'update_building_config', active_sprite_id, user?.username, {
                building_type: buildingType,
                cost_override,
                base_profit_override
            });

            return Response.json({ success: true, message: 'Building configuration updated.' });
        }

        // POST /api/admin/assets/buildings/:buildingType/publish - Publish building config
        if (action === 'buildings' && method === 'POST' && param1 && param2 === 'publish') {
            const buildingType = param1;

            // Check configuration exists and has a sprite
            const config = await env.DB.prepare(`
                SELECT * FROM building_configurations WHERE building_type_id = ?
            `).bind(buildingType).first();

            if (!config || !config.active_sprite_id) {
                return Response.json({
                    error: 'Cannot publish: no sprite selected for this building type.'
                }, { status: 400 });
            }

            // Mark as published
            await env.DB.prepare(`
                UPDATE building_configurations
                SET is_published = TRUE,
                    published_at = CURRENT_TIMESTAMP,
                    published_by = ?,
                    updated_at = CURRENT_TIMESTAMP
                WHERE building_type_id = ?
            `).bind(user?.username || 'admin', buildingType).run();

            await logAudit(env, 'publish_building', config.active_sprite_id, user?.username, {
                building_type: buildingType
            });

            return Response.json({ success: true, message: 'Building configuration published.' });
        }

        // POST /api/admin/assets/buildings/:buildingType/unpublish - Unpublish building
        if (action === 'buildings' && method === 'POST' && param1 && param2 === 'unpublish') {
            const buildingType = param1;

            await env.DB.prepare(`
                UPDATE building_configurations
                SET is_published = FALSE,
                    updated_at = CURRENT_TIMESTAMP
                WHERE building_type_id = ?
            `).bind(buildingType).run();

            await logAudit(env, 'unpublish_building', null, user?.username, {
                building_type: buildingType
            });

            return Response.json({ success: true, message: 'Building unpublished.' });
        }

        // POST /api/admin/assets/avatar/composite/:companyId - Generate/update avatar composite
        if (action === 'avatar' && param1 === 'composite' && method === 'POST' && param2) {
            const companyId = param2;
            const body = await request.json();
            const context = body.context || 'main';
            const imageData = body.imageData;

            // Get current avatar selection
            const selection = await env.DB.prepare(`
                SELECT * FROM company_avatars WHERE company_id = ?
            `).bind(companyId).first();

            if (!selection) {
                return Response.json({ error: 'No avatar configured for this company' }, { status: 404 });
            }

            // Generate hash of selection for cache invalidation
            const selectionItems = [
                selection.background_id,
                selection.base_id,
                selection.skin_id,
                selection.outfit_id,
                selection.hair_id,
                selection.headwear_id,
                selection.accessory_id,
            ].filter(Boolean).sort().join('|');

            const avatarHash = await hashString(selectionItems);

            // Check if composite already exists with same hash
            const existing = await env.DB.prepare(`
                SELECT * FROM avatar_composites WHERE company_id = ? AND context = ?
            `).bind(companyId, context).first();

            if (existing && existing.avatar_hash === avatarHash && !imageData) {
                return Response.json({
                    success: true,
                    message: 'Composite already up to date',
                    r2_url: existing.r2_url,
                    cached: true
                });
            }

            if (!imageData) {
                // Return layer info for client-side compositing
                const itemIds = [
                    selection.background_id,
                    selection.base_id,
                    selection.skin_id,
                    selection.outfit_id,
                    selection.hair_id,
                    selection.headwear_id,
                    selection.accessory_id,
                ].filter(Boolean);

                if (itemIds.length === 0) {
                    return Response.json({ error: 'No avatar items selected' }, { status: 400 });
                }

                const placeholders = itemIds.map(() => '?').join(',');
                const items = await env.DB.prepare(`
                    SELECT id, r2_key, category FROM avatar_items WHERE id IN (${placeholders})
                `).bind(...itemIds).all();

                const categoryOrder = ['background', 'base', 'skin', 'outfit', 'hair', 'headwear', 'accessory'];
                const layers = categoryOrder
                    .map(cat => items.results.find(i => i.category === cat))
                    .filter(Boolean);

                return Response.json({
                    success: false,
                    error: 'Client must provide composited imageData',
                    layers: layers.map(l => ({
                        category: l.category,
                        r2_key: l.r2_key
                    })),
                    message: 'Composite client-side and include imageData in request'
                }, { status: 400 });
            }

            // Decode base64 image
            const imageBuffer = Uint8Array.from(atob(imageData.split(',')[1] || imageData), c => c.charCodeAt(0));

            // Store in public bucket
            const r2Key = `composites/avatar_${companyId}_${context}.png`;
            await env.R2_PUBLIC.put(r2Key, imageBuffer, {
                httpMetadata: { contentType: 'image/png' }
            });

            const r2Url = `${R2_PUBLIC_URL}/${r2Key}`;

            // Upsert composite record
            await env.DB.prepare(`
                INSERT INTO avatar_composites (company_id, context, r2_key, r2_url, avatar_hash)
                VALUES (?, ?, ?, ?, ?)
                ON CONFLICT(company_id, context)
                DO UPDATE SET
                    r2_key = excluded.r2_key,
                    r2_url = excluded.r2_url,
                    avatar_hash = excluded.avatar_hash,
                    updated_at = CURRENT_TIMESTAMP
            `).bind(companyId, context, r2Key, r2Url, avatarHash).run();

            // Invalidate any cached scenes using this avatar
            await env.DB.prepare(`
                DELETE FROM composed_scene_cache WHERE company_id = ?
            `).bind(companyId).run();

            await logAudit(env, 'avatar_composite_updated', null, user?.username, {
                company_id: companyId,
                context,
                avatar_hash: avatarHash
            });

            return Response.json({
                success: true,
                r2_url: r2Url,
                avatar_hash: avatarHash,
                cached: false
            });
        }

        // GET /api/admin/assets/avatar/composite/:companyId - Get avatar composite URL
        if (action === 'avatar' && param1 === 'composite' && method === 'GET' && param2) {
            const companyId = param2;
            const context = url.searchParams.get('context') || 'main';

            const composite = await env.DB.prepare(`
                SELECT * FROM avatar_composites WHERE company_id = ? AND context = ?
            `).bind(companyId, context).first();

            if (composite) {
                return Response.json({
                    success: true,
                    cached: true,
                    r2_url: composite.r2_url,
                    avatar_hash: composite.avatar_hash,
                    updated_at: composite.updated_at
                });
            }

            // Not cached - return layer info for client-side compositing
            const selection = await env.DB.prepare(`
                SELECT * FROM company_avatars WHERE company_id = ?
            `).bind(companyId).first();

            if (!selection) {
                return Response.json({ success: false, error: 'No avatar configured' }, { status: 404 });
            }

            // Get layer URLs
            const itemIds = [
                selection.background_id,
                selection.base_id,
                selection.skin_id,
                selection.outfit_id,
                selection.hair_id,
                selection.headwear_id,
                selection.accessory_id,
            ].filter(Boolean);

            if (itemIds.length === 0) {
                return Response.json({
                    success: true,
                    cached: false,
                    layers: [],
                    message: 'No avatar items selected'
                });
            }

            const placeholders = itemIds.map(() => '?').join(',');
            const items = await env.DB.prepare(`
                SELECT id, r2_key, category FROM avatar_items WHERE id IN (${placeholders})
            `).bind(...itemIds).all();

            const categoryOrder = ['background', 'base', 'skin', 'outfit', 'hair', 'headwear', 'accessory'];
            const layers = categoryOrder
                .map(cat => {
                    const item = items.results.find(i => i.category === cat);
                    if (item) {
                        return { category: cat, url: `${R2_PUBLIC_URL}/${item.r2_key}` };
                    }
                    return null;
                })
                .filter(Boolean);

            return Response.json({
                success: true,
                cached: false,
                layers,
                message: 'Composite not cached. Use layers for client-side compositing.'
            });
        }

        // GET /api/admin/assets/scenes/templates - List all active scene templates
        if (action === 'scenes' && param1 === 'templates' && method === 'GET' && !param2) {
            const templates = await env.DB.prepare(`
                SELECT * FROM v_scene_templates ORDER BY id
            `).all();

            const result = templates.results.map(t => ({
                ...t,
                background_url: `${R2_PUBLIC_URL}/${t.background_r2_key}`,
                foreground_url: t.foreground_r2_key ? `${R2_PUBLIC_URL}/${t.foreground_r2_key}` : null,
                avatar_slot: JSON.parse(t.avatar_slot)
            }));

            return Response.json({ success: true, templates: result });
        }

        // GET /api/admin/assets/scenes/templates/:sceneId - Get specific scene template
        if (action === 'scenes' && param1 === 'templates' && method === 'GET' && param2) {
            const sceneId = param2;

            const template = await env.DB.prepare(`
                SELECT * FROM scene_templates WHERE id = ?
            `).bind(sceneId).first();

            if (!template) {
                return Response.json({ error: 'Scene template not found' }, { status: 404 });
            }

            return Response.json({
                success: true,
                template: {
                    ...template,
                    background_url: `${R2_PUBLIC_URL}/${template.background_r2_key}`,
                    foreground_url: template.foreground_r2_key ? `${R2_PUBLIC_URL}/${template.foreground_r2_key}` : null,
                    avatar_slot: JSON.parse(template.avatar_slot)
                }
            });
        }

        // PUT /api/admin/assets/scenes/templates/:sceneId - Create/update scene template
        if (action === 'scenes' && param1 === 'templates' && method === 'PUT' && param2) {
            const sceneId = param2;
            const { name, description, background_r2_key, foreground_r2_key, avatar_slot, width, height } = await request.json();

            if (!name || !background_r2_key || !avatar_slot) {
                return Response.json({
                    error: 'name, background_r2_key, and avatar_slot are required'
                }, { status: 400 });
            }

            // Validate avatar_slot JSON structure
            const slot = typeof avatar_slot === 'string' ? JSON.parse(avatar_slot) : avatar_slot;
            if (typeof slot.x !== 'number' || typeof slot.y !== 'number' ||
                typeof slot.width !== 'number' || typeof slot.height !== 'number') {
                return Response.json({
                    error: 'avatar_slot must have x, y, width, height as numbers'
                }, { status: 400 });
            }

            const avatarSlotJson = JSON.stringify(slot);

            await env.DB.prepare(`
                INSERT INTO scene_templates (id, name, description, background_r2_key, foreground_r2_key, avatar_slot, width, height)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(id)
                DO UPDATE SET
                    name = excluded.name,
                    description = excluded.description,
                    background_r2_key = excluded.background_r2_key,
                    foreground_r2_key = excluded.foreground_r2_key,
                    avatar_slot = excluded.avatar_slot,
                    width = COALESCE(excluded.width, width),
                    height = COALESCE(excluded.height, height),
                    updated_at = CURRENT_TIMESTAMP
            `).bind(sceneId, name, description, background_r2_key, foreground_r2_key, avatarSlotJson, width || 1920, height || 1080).run();

            // Invalidate all cached scenes for this template
            await env.DB.prepare(`
                DELETE FROM composed_scene_cache WHERE scene_template_id = ?
            `).bind(sceneId).run();

            await logAudit(env, 'scene_template_updated', null, user?.username, {
                scene_id: sceneId,
                name
            });

            return Response.json({ success: true, message: 'Scene template saved.' });
        }

        // GET /api/admin/assets/scenes/compose/:sceneId/:companyId - Get composed scene
        if (action === 'scenes' && param1 === 'compose' && method === 'GET' && param2 && param3) {
            const sceneId = param2;
            const companyId = param3;

            // Get scene template
            const template = await env.DB.prepare(`
                SELECT * FROM scene_templates WHERE id = ? AND is_active = TRUE
            `).bind(sceneId).first();

            if (!template) {
                return Response.json({ error: 'Scene template not found or inactive' }, { status: 404 });
            }

            // Get avatar composite hash
            const avatarComposite = await env.DB.prepare(`
                SELECT * FROM avatar_composites WHERE company_id = ? AND context = 'main'
            `).bind(companyId).first();

            // Check cache
            if (avatarComposite) {
                const templateHash = await hashString(`${template.background_r2_key}|${template.foreground_r2_key || ''}`);

                const cached = await env.DB.prepare(`
                    SELECT * FROM composed_scene_cache
                    WHERE scene_template_id = ? AND company_id = ?
                `).bind(sceneId, companyId).first();

                if (cached &&
                    cached.avatar_hash === avatarComposite.avatar_hash &&
                    cached.template_hash === templateHash) {
                    // Update last accessed for LRU
                    await env.DB.prepare(`
                        UPDATE composed_scene_cache SET last_accessed_at = CURRENT_TIMESTAMP WHERE id = ?
                    `).bind(cached.id).run();

                    return Response.json({
                        success: true,
                        cached: true,
                        r2_url: cached.r2_url
                    });
                }
            }

            // Not cached - return compositing info for client
            // Get avatar layers if no composite exists
            let avatarInfo;
            if (avatarComposite) {
                avatarInfo = { cached: true, url: avatarComposite.r2_url };
            } else {
                // Get layer info for client-side compositing
                const selection = await env.DB.prepare(`
                    SELECT * FROM company_avatars WHERE company_id = ?
                `).bind(companyId).first();

                if (selection) {
                    const itemIds = [
                        selection.background_id,
                        selection.base_id,
                        selection.skin_id,
                        selection.outfit_id,
                        selection.hair_id,
                        selection.headwear_id,
                        selection.accessory_id,
                    ].filter(Boolean);

                    if (itemIds.length > 0) {
                        const placeholders = itemIds.map(() => '?').join(',');
                        const items = await env.DB.prepare(`
                            SELECT id, r2_key, category FROM avatar_items WHERE id IN (${placeholders})
                        `).bind(...itemIds).all();

                        const categoryOrder = ['background', 'base', 'skin', 'outfit', 'hair', 'headwear', 'accessory'];
                        const layers = categoryOrder
                            .map(cat => {
                                const item = items.results.find(i => i.category === cat);
                                if (item) {
                                    return { category: cat, url: `${R2_PUBLIC_URL}/${item.r2_key}` };
                                }
                                return null;
                            })
                            .filter(Boolean);

                        avatarInfo = { cached: false, layers };
                    } else {
                        avatarInfo = { cached: false, layers: [] };
                    }
                } else {
                    avatarInfo = { cached: false, layers: [] };
                }
            }

            return Response.json({
                success: true,
                cached: false,
                scene: {
                    id: sceneId,
                    name: template.name,
                    width: template.width,
                    height: template.height,
                    background_url: `${R2_PUBLIC_URL}/${template.background_r2_key}`,
                    foreground_url: template.foreground_r2_key ? `${R2_PUBLIC_URL}/${template.foreground_r2_key}` : null,
                    avatar_slot: JSON.parse(template.avatar_slot)
                },
                avatar: avatarInfo,
                message: 'Compose client-side using scene layers and avatar'
            });
        }

        // POST /api/admin/assets/scenes/compose/:sceneId/:companyId/cache - Cache composed scene
        if (action === 'scenes' && param1 === 'compose' && method === 'POST' && param2 && param3 === 'cache') {
            // Path is /scenes/compose/:sceneId/:companyId/cache but we have a mismatch
            // Let's fix: param2 = sceneId, param3 should be companyId
            // But param3 = 'cache' means the path parsing needs adjustment
            // Actually the path would be: /scenes/compose/sceneId/companyId/cache
            // So pathParts = ['scenes', 'compose', 'sceneId', 'companyId', 'cache']
            // param1 = 'compose', param2 = sceneId, param3 = companyId
            // We need to check pathParts[4] === 'cache'
        }

        // Handle the cache route separately with full path parsing
        if (pathParts.length === 5 && pathParts[0] === 'scenes' && pathParts[1] === 'compose' && pathParts[4] === 'cache' && method === 'POST') {
            const sceneId = pathParts[2];
            const companyId = pathParts[3];
            const { imageData } = await request.json();

            if (!imageData) {
                return Response.json({ error: 'imageData is required (base64 PNG)' }, { status: 400 });
            }

            // Get template for hash
            const template = await env.DB.prepare(`
                SELECT * FROM scene_templates WHERE id = ?
            `).bind(sceneId).first();

            if (!template) {
                return Response.json({ error: 'Scene template not found' }, { status: 404 });
            }

            // Get avatar hash
            const avatarComposite = await env.DB.prepare(`
                SELECT avatar_hash FROM avatar_composites WHERE company_id = ? AND context = 'main'
            `).bind(companyId).first();

            if (!avatarComposite) {
                return Response.json({
                    error: 'Avatar composite must be cached first. Call POST /avatar/composite/:companyId'
                }, { status: 400 });
            }

            const templateHash = await hashString(`${template.background_r2_key}|${template.foreground_r2_key || ''}`);

            // Decode and store
            const imageBuffer = Uint8Array.from(atob(imageData.split(',')[1] || imageData), c => c.charCodeAt(0));

            const r2Key = `scenes/composed/${sceneId}_${companyId}.png`;
            await env.R2_PUBLIC.put(r2Key, imageBuffer, {
                httpMetadata: { contentType: 'image/png' }
            });

            const r2Url = `${R2_PUBLIC_URL}/${r2Key}`;

            // Upsert cache record
            await env.DB.prepare(`
                INSERT INTO composed_scene_cache (scene_template_id, company_id, r2_key, r2_url, avatar_hash, template_hash)
                VALUES (?, ?, ?, ?, ?, ?)
                ON CONFLICT(scene_template_id, company_id)
                DO UPDATE SET
                    r2_key = excluded.r2_key,
                    r2_url = excluded.r2_url,
                    avatar_hash = excluded.avatar_hash,
                    template_hash = excluded.template_hash,
                    last_accessed_at = CURRENT_TIMESTAMP
            `).bind(sceneId, companyId, r2Key, r2Url, avatarComposite.avatar_hash, templateHash).run();

            return Response.json({ success: true, r2_url: r2Url });
        }

        // POST /api/admin/assets/process/:id - Process asset for game use
        if (action === 'process' && method === 'POST' && param1) {
            const id = param1;
            const { targetWidth, targetHeight, outputFormat = 'webp' } = await request.json();

            const asset = await env.DB.prepare(`
                SELECT * FROM generated_assets WHERE id = ?
            `).bind(id).first();

            if (!asset || !asset.r2_key_private) {
                return Response.json({ error: 'Asset not found' }, { status: 404 });
            }

            // Determine game-ready path in PUBLIC bucket
            let gameReadyKey;
            if (asset.category.endsWith('_ref')) {
                // Reference sheets stay as PNG (for admin preview only)
                return Response.json({
                    error: 'Reference sheets are not processed to game-ready. Use sprite generation instead.'
                }, { status: 400 });
            } else if (asset.category === 'scene') {
                gameReadyKey = `scenes/${asset.asset_key}_v${asset.variant}.${outputFormat}`;
            } else {
                // Sprites: buildings, terrain, effects, overlays, ui, npc
                gameReadyKey = `sprites/${asset.category}/${asset.asset_key}_v${asset.variant}.${outputFormat}`;
            }

            // Fetch original from PRIVATE bucket
            const originalObj = await env.R2_PRIVATE.get(asset.r2_key_private);
            if (!originalObj) {
                return Response.json({ error: 'Original not found in private bucket' }, { status: 404 });
            }

            // Store in PUBLIC bucket (game-ready)
            // Note: WebP conversion would require image processing library
            await env.R2_PUBLIC.put(gameReadyKey, originalObj.body, {
                httpMetadata: { contentType: `image/${outputFormat}` }
            });

            // Public bucket URL
            const gameReadyUrl = `${R2_PUBLIC_URL}/${gameReadyKey}`;

            // Update record with game-ready URL
            await env.DB.prepare(`
                UPDATE generated_assets
                SET r2_key_public = ?, r2_url = ?, updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
            `).bind(gameReadyKey, gameReadyUrl, id).run();

            await logAudit(env, 'process', parseInt(id), user?.username, { format: outputFormat });

            return Response.json({
                success: true,
                game_ready_url: gameReadyUrl,
                public_key: gameReadyKey,
                format: outputFormat,
                note: 'Asset published to public bucket. For resizing, use Cloudflare Images or process client-side.'
            });
        }

        // POST /api/admin/assets/batch-generate - Batch generate multiple assets
        if (action === 'batch-generate' && method === 'POST') {
            const { assets } = await request.json();
            // assets = [{ category, asset_key, prompt, variant }, ...]

            const results = [];
            for (const asset of assets) {
                // Create records and queue
                const result = await env.DB.prepare(`
                    INSERT INTO generated_assets (category, asset_key, variant, base_prompt, current_prompt, status)
                    VALUES (?, ?, ?, ?, ?, 'queued')
                    ON CONFLICT(category, asset_key, variant)
                    DO UPDATE SET base_prompt = excluded.base_prompt, current_prompt = excluded.current_prompt, status = 'queued'
                    RETURNING id
                `).bind(asset.category, asset.asset_key, asset.variant || 1, asset.prompt, asset.prompt).first();

                await env.DB.prepare(`
                    INSERT INTO asset_generation_queue (asset_id)
                    VALUES (?)
                `).bind(result.id).run();

                results.push({ id: result.id, asset_key: asset.asset_key });
            }

            return Response.json({ success: true, queued: results.length, assets: results });
        }

        // GET /api/admin/assets/categories - Get all asset categories
        if (action === 'categories' && method === 'GET') {
            const categories = await env.DB.prepare(`
                SELECT * FROM asset_categories ORDER BY id
            `).all();

            return Response.json({ categories: categories.results });
        }

        // Default: route not found
        return Response.json({ error: 'Asset route not found', path, method }, { status: 404 });

    } catch (error) {
        console.error('Asset route error:', error);
        return Response.json({ error: error.message }, { status: 500 });
    }
}
