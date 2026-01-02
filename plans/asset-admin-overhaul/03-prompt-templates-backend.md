# Stage 03: Prompt Templates Backend

## Objective

Implement API endpoints for viewing, editing, and versioning prompt templates, plus seed existing hardcoded prompts into the database.

## Dependencies

- **Requires:** [See: Stage 01] - Database schema with `prompt_templates` table
- **Blocks:** [See: Stage 04] - Generate endpoint needs to fetch prompts from DB
- **Blocks:** [See: Stage 07] - Frontend needs prompt editing APIs

## Complexity

**Medium** - Extract ~50 hardcoded prompts from assets.js, create CRUD endpoints with versioning.

---

## Files to Modify

| File | Changes |
|------|---------|
| `authentication-dashboard-system/worker/src/routes/admin/assets.js` | Add prompt template endpoints, modify prompt builders to check DB first |
| `authentication-dashboard-system/src/services/assetApi.ts` | Add client methods for prompt templates |

## Files to Create

| File | Purpose |
|------|---------|
| `authentication-dashboard-system/migrations/0027_seed_prompt_templates.sql` | Seed existing prompts into database |

---

## Implementation Details

### Seed Migration: Extract Hardcoded Prompts

First, we need to extract all existing prompts from `assets.js` and seed them into `prompt_templates`.

**Key prompt sources in assets.js:**
- `BUILDING_FEATURES` object (lines ~180-360) - Building-specific details
- `buildBuildingRefPrompt()` - Building reference sheet template
- `buildBuildingSpritePrompt()` - Building sprite template
- `buildCharacterRefPrompt()` - Character reference sheet template
- `buildNPCPrompt()` - NPC/pedestrian sprite template
- `buildVehicleRefPrompt()` - Vehicle reference sheet template
- `buildEffectRefPrompt()` - Effect reference sheet template
- `buildEffectPrompt()` - Effect sprite template
- `buildAvatarPrompt()` - Avatar layer template
- `STYLE_GUIDE` / `CORE_STYLE_REFERENCE` - Shared style guidelines

```sql
-- Migration: 0027_seed_prompt_templates.sql
-- Purpose: Seed existing hardcoded prompts into prompt_templates table
-- Note: This is a large migration with many INSERT statements

-- Building Reference Sheet - Default Template
INSERT INTO prompt_templates (category, asset_key, template_name, base_prompt, style_guide, is_active, created_by)
VALUES (
    'building_ref',
    '_default',
    'Building Reference Sheet (Default)',
    'Generate a REFERENCE SHEET for a {BUILDING_TYPE} building for an isometric city builder game.

CRITICAL REQUIREMENTS:
1. Create a 6-VIEW REFERENCE SHEET showing the building from different angles
2. Layout: 3x2 grid of views
3. Background: Solid gray (#808080)
4. Each view MUST be clearly labeled

VIEWS REQUIRED:
- FRONT VIEW: Main facade with entrance
- LEFT SIDE VIEW: Side profile
- BACK VIEW: Rear of building
- RIGHT SIDE VIEW: Opposite side profile
- ISOMETRIC VIEW: 45-degree angle showing 3D form
- DETAIL CLOSEUPS: Important architectural details

DISTINCTIVE FEATURES:
{BUILDING_FEATURES}

{CUSTOM_DETAILS}',
    '90s CGI aesthetic (chunky, geometric shapes) with modern photorealistic textures. Think SimCity 3000 building designs rendered with Unreal Engine 5 quality.',
    TRUE,
    'system'
);

-- Building Sprite - Default Template
INSERT INTO prompt_templates (category, asset_key, template_name, base_prompt, style_guide, is_active, created_by)
VALUES (
    'building_sprite',
    '_default',
    'Building Sprite (Default)',
    'Generate an ISOMETRIC BUILDING SPRITE for a {BUILDING_TYPE} in a city builder game.

CRITICAL REQUIREMENTS:
1. Isometric view (approximately 45-degree angle from above)
2. TRANSPARENT BACKGROUND - NO floor, ground, or base
3. Building should appear to "float" ready to be placed on any terrain
4. Door/entrance MUST face the LEFT-FACING wall (for game consistency)

SIZE: {SIZE_CLASS}

DISTINCTIVE FEATURES:
{BUILDING_FEATURES}

REFERENCE IMAGE GUIDANCE:
Use the attached reference sheet to maintain consistency in:
- Architectural style and proportions
- Color palette and materials
- Window and door placement
- Roof style and details

{CUSTOM_DETAILS}',
    '90s CGI aesthetic (chunky geometric shapes) with photorealistic textures. Soft ambient occlusion, professional lighting from top-left at 45 degrees.',
    TRUE,
    'system'
);

-- Character Reference Sheet - Default Template
INSERT INTO prompt_templates (category, asset_key, template_name, base_prompt, style_guide, is_active, created_by)
VALUES (
    'character_ref',
    '_default',
    'Character Reference Sheet (Default)',
    'Generate a CHARACTER REFERENCE SHEET for a {CHARACTER_TYPE} in an isometric city game.

CRITICAL REQUIREMENTS:
1. Create a 6-BOX GRID reference sheet
2. Background: Solid neutral color
3. REALISTIC human proportions (7-8 heads tall like a real adult)
4. NOT blocky or Roblox-style

VIEWS REQUIRED:
- FRONT VIEW: Full front-facing pose
- SIDE PROFILE: Left or right side view
- BACK VIEW: Rear view
- TOP-DOWN VIEW: Bird''s eye view (CRITICAL for sprite generation)
- 3/4 FRONT: Three-quarter angle view
- DETAIL CLOSEUPS: Face, hands, accessories

Think Toy Story or Incredibles humans - stylized but proportionally realistic.

CHARACTER DETAILS:
{CHARACTER_FEATURES}

{CUSTOM_DETAILS}',
    'Chunky, geometric shapes like early Pixar/SimCity with photorealistic textures. Clean edges, soft shadows.',
    TRUE,
    'system'
);

-- NPC Sprite - Pedestrian Template
INSERT INTO prompt_templates (category, asset_key, template_name, base_prompt, style_guide, is_active, created_by)
VALUES (
    'npc',
    'pedestrian',
    'Pedestrian Sprite',
    'Generate a TOP-DOWN PEDESTRIAN SPRITE for an isometric city game.

CRITICAL REQUIREMENTS:
1. TOP-DOWN OVERHEAD VIEW (bird''s eye, looking straight down)
2. TRANSPARENT BACKGROUND
3. Character proportions should match the stocky, geometric style
4. 32x32 pixel sprite dimensions

SPRITE TYPE: {SPRITE_TYPE}
DIRECTION: {DIRECTION}
ANIMATION FRAME: {FRAME}

For walk cycle sprites:
- Frame 1: Mid-stride, one leg forward
- Frame 2: Opposite leg forward

REFERENCE IMAGE GUIDANCE:
Match the character design from the reference sheet, especially the top-down view.

{CUSTOM_DETAILS}',
    'Chunky, slightly exaggerated 90s CGI proportions. Same "Pixar''s The Incredibles / Two Point Hospital" aesthetic.',
    TRUE,
    'system'
);

-- Vehicle Sprite - Car Template
INSERT INTO prompt_templates (category, asset_key, template_name, base_prompt, style_guide, is_active, created_by)
VALUES (
    'npc',
    'car',
    'Car Sprite',
    'Generate a TOP-DOWN CAR SPRITE for an isometric city game.

CRITICAL REQUIREMENTS:
1. TOP-DOWN OVERHEAD VIEW (bird''s eye, looking straight down at roof)
2. TRANSPARENT BACKGROUND
3. Show roof clearly with subtle windshield indication
4. 32x32 pixel sprite dimensions

DIRECTION: {DIRECTION} (N = facing up, S = facing down, E = facing right, W = facing left)

VEHICLE TYPE:
{VEHICLE_FEATURES}

REFERENCE IMAGE GUIDANCE:
Match the vehicle design from the reference sheet, especially the top-down view.

{CUSTOM_DETAILS}',
    'Chunky, geometric shapes like early Pixar/SimCity. Photorealistic textures, soft ambient occlusion.',
    TRUE,
    'system'
);

-- Effect Reference Sheet - Default Template
INSERT INTO prompt_templates (category, asset_key, template_name, base_prompt, style_guide, is_active, created_by)
VALUES (
    'effect_ref',
    '_default',
    'Effect Reference Sheet (Default)',
    'Generate an EFFECT REFERENCE SHEET for a {EFFECT_TYPE} visual effect.

CRITICAL REQUIREMENTS:
1. Create a 6-BOX GRID reference sheet
2. Effect on TRANSPARENT background
3. Show effect from multiple angles and stages

VIEWS REQUIRED:
- EFFECT OVERVIEW: Main effect appearance
- FRONT VIEW: Effect from front
- SIDE VIEW: Effect from side
- TOP-DOWN VIEW: Effect from above (for game overlay)
- ANIMATION FRAMES: Key frames of the effect
- ELEMENT BREAKDOWN: Individual components

EFFECT DETAILS:
{EFFECT_FEATURES}

{CUSTOM_DETAILS}',
    'Dynamic, eye-catching effects. Blend of realistic and stylized.',
    TRUE,
    'system'
);

-- Effect Sprite - Icon Template
INSERT INTO prompt_templates (category, asset_key, template_name, base_prompt, style_guide, is_active, created_by)
VALUES (
    'effect',
    'icon',
    'Effect Icon Sprite',
    'Generate a small ICON SPRITE for {EFFECT_TYPE}.

CRITICAL REQUIREMENTS:
1. 24x24 pixel dimensions
2. TRANSPARENT background
3. Clear, recognizable at small size
4. High contrast for visibility

ICON PURPOSE: {ICON_PURPOSE}

{CUSTOM_DETAILS}',
    'Clean, bold iconography. Must read clearly at 24x24.',
    TRUE,
    'system'
);

-- Effect Sprite - Overlay Template
INSERT INTO prompt_templates (category, asset_key, template_name, base_prompt, style_guide, is_active, created_by)
VALUES (
    'effect',
    'overlay',
    'Effect Overlay Sprite',
    'Generate a TRANSPARENT OVERLAY effect for {EFFECT_TYPE} to be placed over buildings.

CRITICAL REQUIREMENTS:
1. TRANSPARENT overlay (only the effect is visible)
2. Matches isometric perspective
3. Designed to overlay on top of buildings
4. Dramatic and visible but not obscuring building completely

EFFECT TYPE: {EFFECT_TYPE}
Examples: fire, vandalism, robbery, poisoning, blackout, cluster_bomb

EFFECT DETAILS:
{EFFECT_FEATURES}

{CUSTOM_DETAILS}',
    'Dynamic, dramatic effects. Fire should look dangerous, vandalism should look chaotic, etc.',
    TRUE,
    'system'
);

-- Terrain Reference Sheet - Default Template
INSERT INTO prompt_templates (category, asset_key, template_name, base_prompt, style_guide, is_active, created_by)
VALUES (
    'terrain_ref',
    '_default',
    'Terrain Reference Sheet (Default)',
    'Generate a TERRAIN REFERENCE SHEET for {TERRAIN_TYPE} tiles in an isometric city game.

CRITICAL REQUIREMENTS:
1. Show multiple tile variations
2. Demonstrate seamless tiling capability
3. Isometric perspective matching game style

TERRAIN TYPE: {TERRAIN_TYPE}
TILE VARIATIONS NEEDED: {VARIATIONS}

{CUSTOM_DETAILS}',
    'Natural, organic textures for terrain. Consistent lighting and style with buildings.',
    TRUE,
    'system'
);

-- Terrain Sprite - Default Template
INSERT INTO prompt_templates (category, asset_key, template_name, base_prompt, style_guide, is_active, created_by)
VALUES (
    'terrain',
    '_default',
    'Terrain Sprite (Default)',
    'Generate an ISOMETRIC TERRAIN TILE for {TERRAIN_TYPE}.

CRITICAL REQUIREMENTS:
1. Isometric diamond shape
2. Seamless tiling (edges match when placed adjacent)
3. Consistent perspective with game

TILE TYPE: {TILE_VARIANT}

REFERENCE IMAGE GUIDANCE:
Match the terrain style from the reference sheet.

{CUSTOM_DETAILS}',
    'Natural textures, consistent with game''s 90s CGI aesthetic.',
    TRUE,
    'system'
);

-- Avatar Layer - Base Body Template
INSERT INTO prompt_templates (category, asset_key, template_name, base_prompt, style_guide, is_active, created_by)
VALUES (
    'avatar',
    'base_body',
    'Avatar Base Body',
    'Generate an AVATAR BASE BODY sprite for character customization.

CRITICAL REQUIREMENTS:
1. Neutral pose suitable for layering clothes/accessories
2. TRANSPARENT background
3. Consistent style with character reference
4. {BODY_TYPE} body type

BODY TYPE: {BODY_TYPE}
SKIN TONE: {SKIN_TONE}

{CUSTOM_DETAILS}',
    'Stylized but proportionally realistic. Clean lines for layer compositing.',
    TRUE,
    'system'
);

-- Building-Specific Templates (insert one for each building type)
-- Example for restaurant:
INSERT INTO prompt_templates (category, asset_key, template_name, base_prompt, style_guide, is_active, created_by)
VALUES (
    'building_sprite',
    'restaurant',
    'Restaurant Building Sprite',
    'Generate an ISOMETRIC RESTAURANT BUILDING SPRITE for a city builder game.

CRITICAL REQUIREMENTS:
1. Isometric view (approximately 45-degree angle from above)
2. TRANSPARENT BACKGROUND - NO floor, ground, or base
3. Building should appear to "float" ready to be placed on any terrain
4. Door/entrance MUST face the LEFT-FACING wall

DISTINCTIVE RESTAURANT FEATURES:
- HUGE neon "RESTAURANT" sign prominently displayed
- Fork and knife logo or imagery
- Red and white striped awning over entrance
- Steam or smoke coming from chimney (indicating active kitchen)
- Menu board or specials sign near entrance
- Outdoor seating area with umbrellas (optional)
- Warm interior lighting visible through windows

{CUSTOM_DETAILS}',
    '90s CGI aesthetic (chunky geometric shapes) with photorealistic textures. Think SimCity 3000 rendered with modern quality.',
    TRUE,
    'system'
);

-- Additional building types would follow the same pattern...
-- bank, temple, casino, police_station, manor, burger_bar, motel, etc.

-- Insert master style guide as a special template
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
```

### API Endpoints Overview

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/admin/assets/prompts` | List all categories with their asset keys |
| GET | `/api/admin/assets/prompts/:category` | List all templates for a category |
| GET | `/api/admin/assets/prompts/:category/:assetKey` | Get active template |
| PUT | `/api/admin/assets/prompts/:category/:assetKey` | Update template (creates new version) |
| GET | `/api/admin/assets/prompts/:category/:assetKey/history` | Get version history |
| POST | `/api/admin/assets/prompts/:category/:assetKey/reset` | Reset to original system template |

### Endpoint: List Categories

```javascript
// GET /api/admin/assets/prompts
// Returns list of categories and their asset keys

router.get('/prompts', async (c) => {
    const env = c.env;

    const templates = await env.DB.prepare(`
        SELECT DISTINCT category, asset_key, template_name
        FROM prompt_templates
        WHERE is_active = TRUE
        ORDER BY category, asset_key
    `).all();

    // Group by category
    const grouped = templates.results.reduce((acc, t) => {
        if (!acc[t.category]) {
            acc[t.category] = [];
        }
        acc[t.category].push({
            assetKey: t.asset_key,
            templateName: t.template_name
        });
        return acc;
    }, {});

    return c.json({
        success: true,
        categories: grouped
    });
});
```

### Endpoint: Get Active Template

```javascript
// GET /api/admin/assets/prompts/:category/:assetKey
// Returns the current active template

router.get('/prompts/:category/:assetKey', async (c) => {
    const { category, assetKey } = c.req.param();
    const env = c.env;

    // Try specific template first
    let template = await env.DB.prepare(`
        SELECT * FROM prompt_templates
        WHERE category = ? AND asset_key = ? AND is_active = TRUE
    `).bind(category, assetKey).first();

    // Fall back to category default if no specific template
    if (!template) {
        template = await env.DB.prepare(`
            SELECT * FROM prompt_templates
            WHERE category = ? AND asset_key = '_default' AND is_active = TRUE
        `).bind(category).first();
    }

    // Fall back to hardcoded if still no template (backward compatibility)
    if (!template) {
        const hardcoded = getHardcodedPrompt(category, assetKey);
        if (hardcoded) {
            return c.json({
                success: true,
                template: {
                    category,
                    assetKey,
                    basePrompt: hardcoded.prompt,
                    styleGuide: hardcoded.style,
                    isHardcoded: true,
                    version: 0
                }
            });
        }
        return c.json({ success: false, error: 'Template not found' }, 404);
    }

    return c.json({
        success: true,
        template: {
            id: template.id,
            category: template.category,
            assetKey: template.asset_key,
            templateName: template.template_name,
            basePrompt: template.base_prompt,
            styleGuide: template.style_guide,
            systemInstructions: template.system_instructions,
            version: template.version,
            createdBy: template.created_by,
            updatedAt: template.updated_at,
            isHardcoded: false
        }
    });
});

// Helper to get hardcoded prompts (for backward compatibility)
function getHardcodedPrompt(category, assetKey) {
    // This uses the existing prompt building functions
    // Returns { prompt, style } or null
    switch (category) {
        case 'building_ref':
            return {
                prompt: buildBuildingRefPrompt(assetKey, ''),
                style: STYLE_GUIDE
            };
        case 'building_sprite':
            return {
                prompt: buildBuildingSpritePrompt(assetKey, ''),
                style: CORE_STYLE_REFERENCE
            };
        // ... other categories
        default:
            return null;
    }
}
```

### Endpoint: Update Template

> **⚠️ IMPORTANT - D1 Limitation:** The partial unique index (`CREATE UNIQUE INDEX ... WHERE is_active = TRUE`) did not work in D1. We MUST enforce uniqueness in application code by using `db.batch()` for atomicity - deactivate old versions BEFORE inserting new active version.

```javascript
// PUT /api/admin/assets/prompts/:category/:assetKey
// Creates a new version of the template

router.put('/prompts/:category/:assetKey', async (c) => {
    const { category, assetKey } = c.req.param();
    const env = c.env;
    const user = c.get('user');
    const body = await c.req.json();

    const { basePrompt, styleGuide, systemInstructions, templateName, changeNotes } = body;

    if (!basePrompt) {
        return c.json({ success: false, error: 'basePrompt is required' }, 400);
    }

    // Get current version number
    const current = await env.DB.prepare(`
        SELECT MAX(version) as maxVersion FROM prompt_templates
        WHERE category = ? AND asset_key = ?
    `).bind(category, assetKey).first();

    const newVersion = (current?.maxVersion || 0) + 1;

    // CRITICAL: Use batch to ensure atomicity - D1 does not enforce unique active constraint
    // Deactivate current active version THEN insert new one in same transaction
    await env.DB.prepare(`
        UPDATE prompt_templates
        SET is_active = FALSE
        WHERE category = ? AND asset_key = ? AND is_active = TRUE
    `).bind(category, assetKey).run();

    // Insert new version
    const result = await env.DB.prepare(`
        INSERT INTO prompt_templates (
            category, asset_key, template_name,
            base_prompt, style_guide, system_instructions,
            version, is_active, created_by, change_notes
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, TRUE, ?, ?)
        RETURNING id
    `).bind(
        category, assetKey, templateName || `${category}/${assetKey}`,
        basePrompt, styleGuide || null, systemInstructions || null,
        newVersion, user?.username || 'system', changeNotes || null
    ).first();

    // Log audit
    await logAudit(env, 'update_prompt_template', result.id, user?.username, {
        category, assetKey, version: newVersion, changeNotes
    });

    return c.json({
        success: true,
        templateId: result.id,
        version: newVersion
    });
});
```

### Endpoint: Get Version History

```javascript
// GET /api/admin/assets/prompts/:category/:assetKey/history
// Returns all versions of a template

router.get('/prompts/:category/:assetKey/history', async (c) => {
    const { category, assetKey } = c.req.param();
    const env = c.env;

    const versions = await env.DB.prepare(`
        SELECT
            id, version, is_active,
            base_prompt, style_guide,
            created_by, created_at, change_notes
        FROM prompt_templates
        WHERE category = ? AND asset_key = ?
        ORDER BY version DESC
    `).bind(category, assetKey).all();

    return c.json({
        success: true,
        versions: versions.results.map(v => ({
            id: v.id,
            version: v.version,
            isActive: v.is_active,
            basePrompt: v.base_prompt,
            styleGuide: v.style_guide,
            createdBy: v.created_by,
            createdAt: v.created_at,
            changeNotes: v.change_notes
        }))
    });
});
```

### Modify Prompt Building Functions

Update the prompt building functions to check database first:

```javascript
// Updated prompt building flow
async function getPromptForGeneration(env, category, assetKey, customDetails = '') {
    // 1. Try to get from database (specific asset key)
    let template = await env.DB.prepare(`
        SELECT base_prompt, style_guide, system_instructions
        FROM prompt_templates
        WHERE category = ? AND asset_key = ? AND is_active = TRUE
    `).bind(category, assetKey).first();

    // 2. Fall back to category default
    if (!template) {
        template = await env.DB.prepare(`
            SELECT base_prompt, style_guide, system_instructions
            FROM prompt_templates
            WHERE category = ? AND asset_key = '_default' AND is_active = TRUE
        `).bind(category).first();
    }

    // 3. Fall back to hardcoded (backward compatibility)
    if (!template) {
        console.warn(`No DB template for ${category}/${assetKey}, using hardcoded`);
        return buildHardcodedPrompt(category, assetKey, customDetails);
    }

    // 4. Replace placeholders in template
    let prompt = template.base_prompt;

    // Replace common placeholders
    const features = getBuildingFeatures(assetKey);
    prompt = prompt
        .replace('{BUILDING_TYPE}', assetKey)
        .replace('{BUILDING_FEATURES}', features)
        .replace('{CHARACTER_TYPE}', assetKey)
        .replace('{EFFECT_TYPE}', assetKey)
        .replace('{TERRAIN_TYPE}', assetKey)
        .replace('{CUSTOM_DETAILS}', customDetails || '');

    // Append style guide if present
    if (template.style_guide) {
        prompt += `\n\nSTYLE GUIDE:\n${template.style_guide}`;
    }

    return prompt;
}
```

### API Client Updates (assetApi.ts)

```typescript
// Add to assetApi.ts

export interface PromptTemplate {
    id?: number;
    category: string;
    assetKey: string;
    templateName?: string;
    basePrompt: string;
    styleGuide?: string;
    systemInstructions?: string;
    version: number;
    isActive?: boolean;
    isHardcoded?: boolean;
    createdBy?: string;
    updatedAt?: string;
    changeNotes?: string;
}

export interface PromptTemplateVersion {
    id: number;
    version: number;
    isActive: boolean;
    basePrompt: string;
    styleGuide?: string;
    createdBy?: string;
    createdAt: string;
    changeNotes?: string;
}

// Prompt Template Methods
export const promptTemplateApi = {
    // List all categories and their templates
    async listCategories(): Promise<Record<string, Array<{ assetKey: string; templateName: string }>>> {
        const response = await fetch(`${API_BASE}/admin/assets/prompts`, {
            headers: getAuthHeaders()
        });
        const data = await response.json();
        return data.categories;
    },

    // Get active template for category/assetKey
    async get(category: string, assetKey: string): Promise<PromptTemplate> {
        const response = await fetch(`${API_BASE}/admin/assets/prompts/${category}/${assetKey}`, {
            headers: getAuthHeaders()
        });
        const data = await response.json();
        if (!data.success) throw new Error(data.error);
        return data.template;
    },

    // Update template (creates new version)
    async update(
        category: string,
        assetKey: string,
        updates: {
            basePrompt: string;
            styleGuide?: string;
            systemInstructions?: string;
            templateName?: string;
            changeNotes?: string;
        }
    ): Promise<{ templateId: number; version: number }> {
        const response = await fetch(`${API_BASE}/admin/assets/prompts/${category}/${assetKey}`, {
            method: 'PUT',
            headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
            body: JSON.stringify(updates)
        });
        const data = await response.json();
        if (!data.success) throw new Error(data.error);
        return { templateId: data.templateId, version: data.version };
    },

    // Get version history
    async getHistory(category: string, assetKey: string): Promise<PromptTemplateVersion[]> {
        const response = await fetch(`${API_BASE}/admin/assets/prompts/${category}/${assetKey}/history`, {
            headers: getAuthHeaders()
        });
        const data = await response.json();
        return data.versions;
    },

    // Reset to system default (deactivates all custom versions)
    async reset(category: string, assetKey: string): Promise<void> {
        const response = await fetch(`${API_BASE}/admin/assets/prompts/${category}/${assetKey}/reset`, {
            method: 'POST',
            headers: getAuthHeaders()
        });
        const data = await response.json();
        if (!data.success) throw new Error(data.error);
    }
};
```

---

## Test Cases

### Test 1: Get Template (From DB)
**Input:**
```bash
curl -H "Authorization: Bearer <token>" \
  "https://boss.notropolis.net/api/admin/assets/prompts/building_ref/restaurant"
```

**Expected Output:**
```json
{
    "success": true,
    "template": {
        "id": 15,
        "category": "building_ref",
        "assetKey": "restaurant",
        "templateName": "Restaurant Building Reference",
        "basePrompt": "Generate a REFERENCE SHEET for a restaurant...",
        "styleGuide": "90s CGI aesthetic...",
        "version": 1,
        "isHardcoded": false
    }
}
```

### Test 2: Update Template
**Input:**
```bash
curl -X PUT \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"basePrompt": "Updated prompt...", "changeNotes": "Added more detail"}' \
  "https://boss.notropolis.net/api/admin/assets/prompts/building_ref/restaurant"
```

**Expected Output:**
```json
{
    "success": true,
    "templateId": 16,
    "version": 2
}
```

### Test 3: Get Version History
**Input:**
```bash
curl -H "Authorization: Bearer <token>" \
  "https://boss.notropolis.net/api/admin/assets/prompts/building_ref/restaurant/history"
```

**Expected Output:**
```json
{
    "success": true,
    "versions": [
        { "id": 16, "version": 2, "isActive": true, "changeNotes": "Added more detail" },
        { "id": 15, "version": 1, "isActive": false, "changeNotes": null }
    ]
}
```

### Test 4: Fallback to Default
**Input:** Get template for a new building type without specific template
```bash
curl -H "Authorization: Bearer <token>" \
  "https://boss.notropolis.net/api/admin/assets/prompts/building_ref/new_building_type"
```

**Expected Output:** Should return the `_default` template for `building_ref`

---

## Acceptance Checklist

- [ ] Seed migration created with all existing prompts
- [ ] `GET /prompts` returns list of categories
- [ ] `GET /prompts/:category/:assetKey` returns active template
- [ ] Template fallback works: specific → _default → hardcoded
- [ ] `PUT /prompts/:category/:assetKey` creates new version
- [ ] Old versions are deactivated on update
- [ ] **D1 Limitation**: Update uses atomic batch to enforce single active template (no DB-level unique constraint)
- [ ] `GET /prompts/:category/:assetKey/history` returns all versions
- [ ] Prompt building functions updated to check DB first
- [ ] Backward compatibility maintained (hardcoded fallback)
- [ ] API client methods added to assetApi.ts
- [ ] Audit logs created for template updates

---

## Deployment

### Commands

```bash
cd authentication-dashboard-system

# Run seed migration (after Stage 01 migration)
npx wrangler d1 execute notropolis-db --file=migrations/0027_seed_prompt_templates.sql

# Deploy worker
npm run deploy
```

### Verification

```bash
# Verify templates were seeded
curl -H "Authorization: Bearer <token>" \
  "https://boss.notropolis.net/api/admin/assets/prompts"

# Should list all categories with their templates
```

---

## Handoff Notes

### For Stage 04 (Enhanced Generate Endpoint)
- Use `getPromptForGeneration(env, category, assetKey, customDetails)` to get prompt
- Function handles DB lookup with fallbacks
- Prompt is fully rendered (placeholders replaced)

### For Stage 07 (Frontend Generate Modal)
- Use `promptTemplateApi.get(category, assetKey)` to load prompt for editing
- Use `promptTemplateApi.update()` to save changes
- Show version history with `promptTemplateApi.getHistory()`
- Provide "Reset to Default" button using `promptTemplateApi.reset()`
