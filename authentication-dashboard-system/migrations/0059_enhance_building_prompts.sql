-- Migration: 0059_enhance_building_prompts.sql
-- Purpose: Update building reference and sprite prompts to be more specific and eye-catching
-- Date: 2026-01-05
-- Note: Focus on distinctive features only - system_instructions already covers style, canvas, orientation

-- ============================================
-- BUILDING REFERENCE PROMPTS - Enhanced
-- ============================================

-- Market Stall
UPDATE prompt_templates
SET base_prompt = 'Create a building reference sheet for a MARKET STALL.

The market stall: Rustic farmer''s market booth bursting with character.
- Weathered timber frame with hand-carved "FRESH GOODS" sign
- Striped canvas awning in earthy greens and browns
- Overflowing wooden crates of colorful produce - bright red tomatoes, orange pumpkins, yellow corn
- Hanging bunches of herbs and dried flowers from the canopy poles
- Chalkboard price signs with hand-drawn lettering
- Old brass weighing scale on the counter
- Wicker baskets and burlap sacks adding texture
- Oil lantern hanging from corner post (warm glow)

The stall should SCREAM "artisan market vendor" - warm, inviting, abundant.'
WHERE category = 'building_ref' AND asset_key = 'market_stall';

-- Hot Dog Stand
UPDATE prompt_templates
SET base_prompt = 'Create a building reference sheet for a HOT DOG STAND.

The hot dog stand: Classic New York-style street vendor cart with maximum personality.
- GIANT fiberglass hot dog model mounted on top (foot-long with mustard zigzag)
- Bright yellow and red color scheme - impossible to miss
- Polished stainless steel serving counter with steam rising
- Red and white striped umbrella with "HOT DOGS" text
- Visible condiment station: mustard, ketchup, relish, onions
- Illuminated menu board with hot dog illustrations
- Chrome warming box with glass display
- "BEST IN TOWN" banner or badge
- Small wheels visible at base (mobile cart style)

The stand should SCREAM "classic street food" - bold, appetizing, iconic.'
WHERE category = 'building_ref' AND asset_key = 'hot_dog_stand';

-- Campsite
UPDATE prompt_templates
SET base_prompt = 'Create a building reference sheet for a CAMPSITE.

The campsite: Cozy wilderness outpost with rugged outdoor charm.
- Large canvas bell tent or A-frame in khaki/olive green
- Stone-ringed campfire with crackling flames and smoke wisps
- Wooden "CAMP" sign on a post with carved lettering
- Stack of split firewood and chopping block with axe
- Vintage oil lantern on a tall post (amber glow)
- Canvas camp chair and wooden crate table
- Hanging cast iron pot over fire
- Coiled rope, fishing rod, and outdoor gear props
- Small flag or pennant on tent peak

The site should SCREAM "wilderness adventure" - rugged, cozy, outdoorsy.'
WHERE category = 'building_ref' AND asset_key = 'campsite';

-- Shop
UPDATE prompt_templates
SET base_prompt = 'Create a building reference sheet for a SHOP.

The shop: Charming neighborhood corner store with friendly appeal.
- Painted brick facade in warm cream or soft green
- Classic striped fabric awning (red and white or green and white)
- Large display window with stacked goods and "OPEN" neon sign
- Wooden door with brass bell and "Welcome" mat
- Sandwich board A-frame sign on sidewalk with daily specials
- Flower boxes under windows with colorful blooms
- Vintage "GENERAL STORE" or "SHOP" signage above
- String of small pennant flags across storefront
- Barrel or crate of goods by entrance

The shop should SCREAM "friendly local store" - welcoming, cozy, trustworthy.'
WHERE category = 'building_ref' AND asset_key = 'shop';

-- Motel
UPDATE prompt_templates
SET base_prompt = 'Create a building reference sheet for a MOTEL.

The motel: Classic 1960s roadside Americana motor lodge.
- TALL arrow-shaped neon "MOTEL" sign with animated effect design
- Glowing "VACANCY" / "NO VACANCY" sign underneath
- Long single-story building with repeating room doors
- Each door numbered with retro-style brass numbers
- Aqua and coral/pink color scheme (Miami Vice meets Route 66)
- Flat roof with distinctive angular overhang
- Ice machine and vending machine alcove visible
- Small kidney-shaped pool glimpse (optional)
- "COLOR TV" and "AIR CONDITIONED" badges on sign
- Period-appropriate car silhouette in lot (optional)

The motel should SCREAM "retro road trip" - nostalgic, neon-lit, Americana.'
WHERE category = 'building_ref' AND asset_key = 'motel';

-- High Street Store
UPDATE prompt_templates
SET base_prompt = 'Create a building reference sheet for a HIGH STREET STORE.

The high street store: Grand Victorian-era department store with elegant retail presence.
- Two-story ornate facade with decorative cornices and moldings
- Multiple large display windows with mannequin silhouettes
- Central revolving door with brass frame
- "DEPARTMENT STORE" in gold Art Deco lettering above entrance
- Decorative upper floor with arched windows and balustrade
- Striped awnings over each ground floor window
- Window displays with "SALE" and "NEW ARRIVALS" signage
- Ornamental clock mounted above main entrance
- Cast iron street lamp integration
- Shopping bag logo or crest on facade

The store should SCREAM "upscale shopping destination" - prestigious, elegant, bustling.'
WHERE category = 'building_ref' AND asset_key = 'high_street_store';

-- Restaurant (already good but enhance)
UPDATE prompt_templates
SET base_prompt = 'Create a building reference sheet for a RESTAURANT.

The restaurant: Upscale bistro with unmistakable fine dining presence.
- Large illuminated "RESTAURANT" text signage (warm bulbs or neon)
- Elegant facade with rendered walls in cream or terracotta
- Floor-to-ceiling windows revealing white tablecloths and wine glasses
- Red and white checkered elements in decor
- Chef''s hat logo prominently displayed on door or awning
- Small bistro awning in burgundy or forest green
- Outdoor menu board with "TODAY''S SPECIAL" in chalk style
- Warm golden interior glow with chandelier silhouettes
- Wine bottles displayed in window rack
- Brass door handles and decorative planters flanking entrance

The restaurant should SCREAM "fine dining experience" - elegant, warm, appetizing.'
WHERE category = 'building_ref' AND asset_key = 'restaurant';

-- Manor
UPDATE prompt_templates
SET base_prompt = 'Create a building reference sheet for a MANOR.

The manor: Imposing aristocratic estate radiating old money prestige.
- Grand Georgian or Colonial facade in cream stone or white
- Massive columned entrance portico with stone steps
- Symmetrical design with many tall sash windows
- Ornate pediment above entrance with family crest motif
- Multiple chimneys on steep slate rooflines
- Wrought iron gates and fence elements visible
- Manicured topiary flanking entrance
- Brass lion door knocker and polished hardware
- Carriage lamp sconces on either side of door
- Ivy creeping on one corner (tasteful, not overgrown)

The manor should SCREAM "wealthy estate" - imposing, prestigious, aristocratic.'
WHERE category = 'building_ref' AND asset_key = 'manor';

-- Casino
UPDATE prompt_templates
SET base_prompt = 'Create a building reference sheet for a CASINO.

The casino: Dazzling Las Vegas-style gambling palace dripping with glamour.
- MASSIVE illuminated "CASINO" marquee with hundreds of light bulbs
- Gold and crimson red color scheme throughout
- Giant playing card suits (♠♥♦♣) as architectural decorations
- Oversized dice or roulette wheel sculpture on facade
- Red carpet leading to grand glass and brass double doors
- Flashing chase lights outlining the entire building
- "JACKPOT" or lucky 7s imagery integrated into design
- Showgirl silhouette or star motif in neon
- Plush red interior visible through glass entrance
- Spotlights pointing skyward from rooftop

The casino should SCREAM "Las Vegas glamour" - flashy, exciting, decadent.'
WHERE category = 'building_ref' AND asset_key = 'casino';

-- Bank
UPDATE prompt_templates
SET base_prompt = 'Create a building reference sheet for a BANK.

The bank: Monumental neoclassical institution exuding financial power.
- Imposing Greek temple facade with massive stone columns (Corinthian or Ionic)
- "BANK" carved deeply into stone pediment or on polished brass letters
- Heavy bronze double doors with serious security appearance
- Decorative iron bars on all windows (ornate but secure)
- Large clock mounted prominently above entrance
- Stone steps leading up to elevated entrance
- Gold/brass accents on door hardware and window frames
- Coin stack or money bag relief carved into stonework
- Security lamp or eagle statue on parapet
- Solid marble or limestone facade - no windows on ground floor sides

The bank should SCREAM "fortress of wealth" - imposing, trustworthy, impenetrable.'
WHERE category = 'building_ref' AND asset_key = 'bank';

-- Temple
UPDATE prompt_templates
SET base_prompt = 'Create a building reference sheet for a TEMPLE.

The temple: Majestic spiritual sanctuary blending Eastern and Western sacred architecture.
- Multi-tiered pagoda-style roof with curved eaves and ornate ridge tiles
- Deep red and gold color scheme with black/dark accents
- Grand stone staircase leading to ornate main doors
- Decorative dragons, phoenixes, or abstract spiritual symbols on roof
- Large ceremonial bell visible in bell tower element
- Incense burner or offering urn at entrance
- Paper lanterns hanging from eaves
- Carved stone guardian figures (generic, not culture-specific)
- Polished wooden doors with brass ring pulls
- Peaceful garden elements: stone lanterns, small ornamental trees

The temple should SCREAM "sacred sanctuary" - serene, majestic, spiritual.'
WHERE category = 'building_ref' AND asset_key = 'temple';

-- Police Station
UPDATE prompt_templates
SET base_prompt = 'Create a building reference sheet for a POLICE STATION.

The police station: Authoritative civic building commanding respect.
- Bold "POLICE" lettering prominently displayed on facade
- Classic blue lamp globe outside entrance (illuminated, iconic)
- Solid red brick and concrete construction
- Blue and white color accents throughout
- Heavy-duty reinforced double doors
- Barred windows on lower level (secure but not prison-like)
- Police badge or shield emblem on building
- Small flagpole with generic flag
- Security cameras visible at corners
- Institutional clock above entrance
- "EMERGENCY" or "24 HOURS" signage

The station should SCREAM "law and order" - authoritative, secure, trustworthy.'
WHERE category = 'building_ref' AND asset_key = 'police_station';

-- ============================================
-- BUILDING SPRITE PROMPTS - Enhanced (game map tiles)
-- Focus: Eye-catching, instantly identifiable at small scale
-- ============================================

-- Market Stall sprite
UPDATE prompt_templates
SET base_prompt = 'Create a building sprite for a MARKET STALL.

Canvas: 128 x 128 px

The market stall: Rustic wooden vendor booth overflowing with colorful goods. Striped canvas awning in earthy tones. Wooden crates bursting with bright produce (reds, oranges, yellows). Hanging herbs and a glowing oil lantern. Weathered timber frame with hand-painted "FRESH" sign.

Eye-catching elements: Colorful produce pops, warm lantern glow, charming hand-painted signage.'
WHERE category = 'building_sprite' AND asset_key = 'market_stall';

-- Hot Dog Stand sprite
UPDATE prompt_templates
SET base_prompt = 'Create a building sprite for a HOT DOG STAND.

Canvas: 128 x 128 px

The hot dog stand: Classic street vendor cart with GIANT hot dog model on top (with mustard zigzag). Bright yellow and red color scheme. Polished chrome counter with steam rising. Red and white striped umbrella. Visible condiment bottles. Menu board with "HOT DOGS" text.

Eye-catching elements: Giant hot dog prop, bold yellow/red colors, steam wisps, chrome gleam.'
WHERE category = 'building_sprite' AND asset_key = 'hot_dog_stand';

-- Campsite sprite
UPDATE prompt_templates
SET base_prompt = 'Create a building sprite for a CAMPSITE.

Canvas: 128 x 128 px

The campsite: Khaki canvas tent with crackling campfire in stone ring. Orange flames and smoke wisps rising. Glowing amber oil lantern on post. Stacked firewood and rustic "CAMP" wooden sign. Cozy wilderness outpost feeling.

Eye-catching elements: Flickering campfire glow, lantern warmth, smoke wisps, rustic charm.'
WHERE category = 'building_sprite' AND asset_key = 'campsite';

-- Shop sprite
UPDATE prompt_templates
SET base_prompt = 'Create a building sprite for a SHOP.

Canvas: 192 x 192 px

The shop: Charming corner store with warm painted brick facade. Classic striped awning (red/white or green/white). Large window with glowing "OPEN" neon sign. Wooden door with brass bell. Flower boxes with bright blooms. Sandwich board sign outside. Vintage "SHOP" signage above.

Eye-catching elements: Glowing OPEN sign, colorful awning stripes, flower boxes, welcoming warmth.'
WHERE category = 'building_sprite' AND asset_key = 'shop';

-- Motel sprite
UPDATE prompt_templates
SET base_prompt = 'Create a building sprite for a MOTEL.

Canvas: 192 x 192 px

The motel: 1960s roadside motor lodge with TALL neon "MOTEL" sign (arrow-shaped, glowing). "VACANCY" sign underneath. Aqua and coral pink color scheme. Single-story with repeating numbered doors. Flat roof with angular overhang. Ice machine alcove. Retro Americana vibe.

Eye-catching elements: Glowing neon sign, retro color palette, repeating room doors, nostalgic charm.'
WHERE category = 'building_sprite' AND asset_key = 'motel';

-- High Street Store sprite
UPDATE prompt_templates
SET base_prompt = 'Create a building sprite for a HIGH STREET STORE.

Canvas: 256 x 256 px

The high street store: Grand Victorian two-story department store. Ornate facade with decorative moldings. Multiple display windows with mannequin silhouettes. "DEPARTMENT STORE" in gold Art Deco lettering. Revolving door with brass frame. Striped awnings. Warm interior glow.

Eye-catching elements: Gold signage, mannequin displays, ornate Victorian details, prestigious presence.'
WHERE category = 'building_sprite' AND asset_key = 'high_street_store';

-- Restaurant sprite
UPDATE prompt_templates
SET base_prompt = 'Create a building sprite for a RESTAURANT.

Canvas: 256 x 256 px

The restaurant: Elegant bistro with illuminated "RESTAURANT" signage. Cream or terracotta rendered walls. Large windows showing white tablecloths and wine glasses. Burgundy awning with chef''s hat logo. Golden chandelier glow from within. Menu board outside. Brass door hardware.

Eye-catching elements: Warm golden interior glow, illuminated signage, visible fine dining scene, elegant facade.'
WHERE category = 'building_sprite' AND asset_key = 'restaurant';

-- Manor sprite
UPDATE prompt_templates
SET base_prompt = 'Create a building sprite for a MANOR.

Canvas: 256 x 256 px

The manor: Grand Georgian estate in cream stone. Imposing columned entrance portico with stone steps. Symmetrical facade with many tall windows. Ornate pediment with crest motif. Multiple chimneys on slate roof. Wrought iron elements. Manicured topiary. Brass carriage lamps glowing.

Eye-catching elements: Grand columns, symmetrical grandeur, warm lamp glow, aristocratic presence.'
WHERE category = 'building_sprite' AND asset_key = 'manor';

-- Casino sprite
UPDATE prompt_templates
SET base_prompt = 'Create a building sprite for a CASINO.

Canvas: 320 x 320 px

The casino: Dazzling Las Vegas palace with MASSIVE "CASINO" marquee blazing with lights. Gold and crimson red everywhere. Giant playing card suits (♠♥♦♣) on facade. Chase lights outlining building. Red carpet to grand entrance. Spotlights pointing up. Neon everywhere.

Eye-catching elements: Blazing light marquee, gold and red opulence, playing card symbols, pure glamour.'
WHERE category = 'building_sprite' AND asset_key = 'casino';

-- Bank sprite
UPDATE prompt_templates
SET base_prompt = 'Create a building sprite for a BANK.

Canvas: 320 x 320 px

The bank: Imposing neoclassical temple of finance. Massive stone columns dominating the facade. "BANK" carved into stone or in polished brass. Heavy bronze doors. Barred windows with ornate ironwork. Clock above entrance. Stone steps up to elevated entrance. Marble/limestone solidity.

Eye-catching elements: Monumental columns, carved BANK lettering, bronze door gleam, fortress solidity.'
WHERE category = 'building_sprite' AND asset_key = 'bank';

-- Temple sprite
UPDATE prompt_templates
SET base_prompt = 'Create a building sprite for a TEMPLE.

Canvas: 320 x 320 px

The temple: Majestic sacred building with multi-tiered pagoda roof and curved eaves. Deep red and gold color scheme. Ornate roof decorations. Grand stone staircase. Large ceremonial bell visible. Paper lanterns glowing. Incense smoke wisps. Carved stone guardians.

Eye-catching elements: Tiered pagoda silhouette, red and gold richness, lantern glow, spiritual majesty.'
WHERE category = 'building_sprite' AND asset_key = 'temple';

-- Police Station sprite
UPDATE prompt_templates
SET base_prompt = 'Create a building sprite for a POLICE STATION.

Canvas: 256 x 256 px

The police station: Authoritative brick civic building. Bold "POLICE" lettering on facade. Classic blue lamp globe glowing at entrance. Blue and white accents. Heavy reinforced doors. Barred windows. Badge emblem on building. Security cameras. Institutional presence.

Eye-catching elements: Glowing blue police lamp, bold POLICE text, badge emblem, authoritative brick.'
WHERE category = 'building_sprite' AND asset_key = 'police_station';

-- ============================================
-- LOG THE MIGRATION
-- ============================================

INSERT INTO asset_audit_log (action, details, created_at)
VALUES ('prompt_template_migration', '{"version": "0059", "changes": "enhanced_building_prompts_eye_catching_distinctive_features"}', CURRENT_TIMESTAMP);
