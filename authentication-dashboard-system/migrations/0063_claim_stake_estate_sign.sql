-- Migration: 0063_claim_stake_estate_sign.sql
-- Purpose: Update claim_stake prompts to professional estate agent SOLD sign
-- Date: 2026-01-05

-- ============================================
-- UPDATE BUILDING_REF PROMPT FOR CLAIM_STAKE
-- ============================================

UPDATE prompt_templates
SET base_prompt = 'CLAIM STAKE - Estate Agent "SOLD" Sign

A professional real estate "SOLD" sign marking purchased land:

SIGN STRUCTURE:
- Classic estate agent sign post - sturdy wooden or metal post
- Rectangular sign board mounted on top (landscape orientation)
- Clean, professional appearance - like a premium property developer sign
- Post is anchored firmly in the ground

SIGN DESIGN:
- Main text: Bold "SOLD" prominently displayed
- Professional typography - clean, readable font
- Company branding area (generic/blank or simple logo placeholder)
- Color scheme: Classic estate agent colors (navy blue, burgundy, or forest green with white/gold text)
- Subtle "NOTROPOLIS PROPERTIES" or similar branding

STYLE:
- High-quality, upmarket estate agent aesthetic
- Polished and professional - not cheap or tacky
- The kind of sign you would see outside a premium property
- Clean lines, quality materials appearance
- Small decorative finial or cap on top of post

FOOTPRINT:
- Small footprint - just the sign post and immediate base
- No buildings, fences, or other structures
- This marks purchased but undeveloped land

{CUSTOM_DETAILS}',
    version = version + 1,
    updated_at = CURRENT_TIMESTAMP
WHERE category = 'building_ref' AND asset_key = 'claim_stake';

-- ============================================
-- ADD BUILDING_SPRITE PROMPT FOR CLAIM_STAKE
-- ============================================

-- First check if it exists, if not insert it
INSERT INTO prompt_templates (category, asset_key, template_name, base_prompt, system_instructions, version, is_active, created_at, updated_at)
SELECT
    'building_sprite',
    'claim_stake',
    'Claim Stake Sprite',
    'Create a building sprite for a CLAIM STAKE - Estate Agent "SOLD" Sign.

Canvas: 96 x 96 px

The sign: Professional real estate "SOLD" sign. Sturdy post (wood or metal) with rectangular sign board on top. Bold "SOLD" text in classic estate agent style. Premium color scheme - navy blue or burgundy background with white/gold lettering. Clean, upmarket property developer aesthetic. Small decorative finial on top of post.

Eye-catching elements: Bold SOLD text, professional branding colors, quality sign construction, polished appearance.',
    (SELECT system_instructions FROM prompt_templates WHERE category = 'building_sprite' AND asset_key = '_default' LIMIT 1),
    1,
    1,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
WHERE NOT EXISTS (
    SELECT 1 FROM prompt_templates WHERE category = 'building_sprite' AND asset_key = 'claim_stake'
);

-- If it exists, update it
UPDATE prompt_templates
SET base_prompt = 'Create a building sprite for a CLAIM STAKE - Estate Agent "SOLD" Sign.

Canvas: 96 x 96 px

The sign: Professional real estate "SOLD" sign. Sturdy post (wood or metal) with rectangular sign board on top. Bold "SOLD" text in classic estate agent style. Premium color scheme - navy blue or burgundy background with white/gold lettering. Clean, upmarket property developer aesthetic. Small decorative finial on top of post.

Eye-catching elements: Bold SOLD text, professional branding colors, quality sign construction, polished appearance.',
    version = version + 1,
    updated_at = CURRENT_TIMESTAMP
WHERE category = 'building_sprite' AND asset_key = 'claim_stake';

-- ============================================
-- LOG THE MIGRATION
-- ============================================

INSERT INTO asset_audit_log (action, details, created_at)
VALUES ('prompt_template_migration', '{"version": "0063", "changes": "claim_stake_estate_agent_sold_sign"}', CURRENT_TIMESTAMP);
