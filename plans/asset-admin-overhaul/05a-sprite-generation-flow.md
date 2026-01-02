# Stage 05a: Sprite Generation Flow

## Objective

Enable manual sprite generation with full control over:
- Custom/editable prompts
- Parent reference selection (approved ref as input)
- Additional reference images (uploaded or approved assets)
- Gemini settings (temperature, topK, topP)
- Per-sprite generation (1 at a time)

The system tracks which sprites each asset type needs and allows the user to generate them individually with full visibility and control.

## Dependencies

- **Requires:** [See: Stage 01] - Database schema
- **Requires:** [See: Stage 04] - Enhanced generate endpoint (already supports refs + settings)
- **Requires:** [See: Stage 05] - Post-approval pipeline for processing
- **Blocks:** [See: Stage 07] - Frontend needs API support

## Complexity

**Medium** - Extend existing generate endpoint, add sprite requirements tracking, add sprite status API.

---

## Files to Modify

| File | Changes |
|------|---------|
| `authentication-dashboard-system/worker/src/routes/admin/assets.js` | Add sprite requirements and status endpoints |
| `authentication-dashboard-system/src/services/assetApi.ts` | Add API methods for sprite requirements |

---

## Core Concept: Sprite Requirements

Each reference type has specific sprites it needs. This is hardcoded as it relates to game functionality:

| Reference Type | Sprites Needed | Variants |
|----------------|----------------|----------|
| `building_ref` | `building_sprite` | main (1 total) |
| `terrain_ref` | `terrain` | straight, corner, t_junction, crossroads, end (5 total) |
| `character_ref` | `npc` | 8 directional sprites |
| `vehicle_ref` | `vehicle` | 4 directional sprites |
| `effect_ref` | `effect` | main (1 total) |

---

## Implementation Details

### Sprite Requirements Definition (Hardcoded)

```javascript
// In assets.js - Hardcoded sprite requirements per reference type
const SPRITE_REQUIREMENTS = {
    building_ref: [
        { spriteCategory: 'building_sprite', variant: 'main', displayName: 'Building Sprite', required: true }
    ],
    terrain_ref: [
        { spriteCategory: 'terrain', variant: 'straight', displayName: 'Straight', required: true },
        { spriteCategory: 'terrain', variant: 'corner', displayName: 'Corner', required: true },
        { spriteCategory: 'terrain', variant: 't_junction', displayName: 'T-Junction', required: true },
        { spriteCategory: 'terrain', variant: 'crossroads', displayName: 'Crossroads', required: true },
        { spriteCategory: 'terrain', variant: 'end', displayName: 'Dead End', required: true }
    ],
    character_ref: [
        { spriteCategory: 'npc', variant: 'n', displayName: 'North', required: true },
        { spriteCategory: 'npc', variant: 'ne', displayName: 'North-East', required: true },
        { spriteCategory: 'npc', variant: 'e', displayName: 'East', required: true },
        { spriteCategory: 'npc', variant: 'se', displayName: 'South-East', required: true },
        { spriteCategory: 'npc', variant: 's', displayName: 'South', required: true },
        { spriteCategory: 'npc', variant: 'sw', displayName: 'South-West', required: true },
        { spriteCategory: 'npc', variant: 'w', displayName: 'West', required: true },
        { spriteCategory: 'npc', variant: 'nw', displayName: 'North-West', required: true }
    ],
    vehicle_ref: [
        { spriteCategory: 'vehicle', variant: 'n', displayName: 'North', required: true },
        { spriteCategory: 'vehicle', variant: 'e', displayName: 'East', required: true },
        { spriteCategory: 'vehicle', variant: 's', displayName: 'South', required: true },
        { spriteCategory: 'vehicle', variant: 'w', displayName: 'West', required: true }
    ],
    effect_ref: [
        { spriteCategory: 'effect', variant: 'main', displayName: 'Effect Sprite', required: true }
    ]
};
```

### API: Get Sprite Requirements

```javascript
// GET /api/admin/assets/sprite-requirements/:refCategory
// Returns what sprites are needed for a reference type
router.get('/sprite-requirements/:refCategory', async (c) => {
    const { refCategory } = c.req.param();

    const requirements = SPRITE_REQUIREMENTS[refCategory];
    if (!requirements) {
        return c.json({
            success: true,
            refCategory,
            requirements: [],
            message: 'No sprite requirements for this category'
        });
    }

    return c.json({
        success: true,
        refCategory,
        requirements
    });
});
```

### API: Get Sprite Status for Reference

```javascript
// GET /api/admin/assets/sprite-status/:refId
// Shows which sprites exist/need generating for a specific approved reference
router.get('/sprite-status/:refId', async (c) => {
    const { refId } = c.req.param();
    const env = c.env;

    // Get the reference asset
    const refAsset = await env.DB.prepare(`
        SELECT id, category, asset_key, status
        FROM generated_assets
        WHERE id = ?
    `).bind(refId).first();

    if (!refAsset) {
        return c.json({ success: false, error: 'Reference not found' }, 404);
    }

    if (refAsset.status !== 'approved') {
        return c.json({
            success: false,
            error: 'Reference must be approved before generating sprites'
        }, 400);
    }

    // Get requirements for this reference type
    const requirements = SPRITE_REQUIREMENTS[refAsset.category];
    if (!requirements) {
        return c.json({
            success: true,
            reference: refAsset,
            sprites: [],
            message: 'No sprites needed for this reference type'
        });
    }

    // Check which sprites exist
    const sprites = [];
    for (const req of requirements) {
        // Build the expected asset_key for the sprite
        // For terrain: road_straight, road_corner, etc.
        // For buildings: restaurant (same as ref)
        const spriteAssetKey = req.variant === 'main'
            ? refAsset.asset_key
            : `${refAsset.asset_key}_${req.variant}`;

        // Find existing sprite
        const existingSprite = await env.DB.prepare(`
            SELECT id, status, r2_url, pipeline_status, generation_settings
            FROM generated_assets
            WHERE category = ?
            AND asset_key = ?
            AND parent_asset_id = ?
            ORDER BY created_at DESC
            LIMIT 1
        `).bind(req.spriteCategory, spriteAssetKey, refId).first();

        sprites.push({
            variant: req.variant,
            displayName: req.displayName,
            required: req.required,
            spriteCategory: req.spriteCategory,
            spriteAssetKey: spriteAssetKey,
            // Existing sprite info (null if not created)
            spriteId: existingSprite?.id || null,
            status: existingSprite?.status || null,
            pipelineStatus: existingSprite?.pipeline_status || null,
            publicUrl: existingSprite?.r2_url || null,
            generationSettings: existingSprite?.generation_settings
                ? JSON.parse(existingSprite.generation_settings)
                : null
        });
    }

    // Calculate completion status
    const total = sprites.length;
    const completed = sprites.filter(s => s.status === 'approved' && s.pipelineStatus === 'completed').length;
    const inProgress = sprites.filter(s => s.status === 'generating' || s.status === 'review').length;
    const notStarted = sprites.filter(s => s.status === null).length;

    return c.json({
        success: true,
        reference: {
            id: refAsset.id,
            category: refAsset.category,
            asset_key: refAsset.asset_key,
            status: refAsset.status
        },
        sprites,
        summary: {
            total,
            completed,
            inProgress,
            notStarted,
            percentComplete: Math.round((completed / total) * 100)
        }
    });
});
```

### Enhanced Generate Endpoint (Stage 04 already supports this)

The Stage 04 generate endpoint already accepts:
- `prompt` - Custom prompt
- `reference_images` - Array of refs (library uploads or approved assets)
- `generation_settings` - Gemini params

**New parameters for sprites:**

```javascript
// Additional parameters for sprite generation
{
    category: 'building_sprite',
    asset_key: 'restaurant',           // Same as parent ref for buildings
    parent_asset_id: 123,              // The approved reference ID
    sprite_variant: 'main',            // Which variant this is
    prompt: '...',
    reference_images: [
        { type: 'approved_asset', id: 123 }  // Parent ref as reference
    ],
    generation_settings: {
        temperature: 0.7,
        topK: 40,
        topP: 0.95
    }
}
```

### API: Generate Sprite (uses existing endpoint with parent_asset_id)

The existing `/generate` endpoint should be updated to:

```javascript
// In the generate endpoint, add parent_asset_id handling

const {
    category,
    asset_key,
    variant,
    prompt: customPrompt,
    custom_details,
    reference_images = [],
    generation_settings = {},
    parent_asset_id,       // NEW: Link to parent reference
    sprite_variant         // NEW: Which variant this is
} = body;

// Validate parent reference if provided
if (parent_asset_id) {
    const parentRef = await env.DB.prepare(`
        SELECT id, category, asset_key, status, r2_key_private
        FROM generated_assets
        WHERE id = ? AND status = 'approved'
    `).bind(parent_asset_id).first();

    if (!parentRef) {
        return c.json({
            success: false,
            error: 'Parent reference not found or not approved'
        }, 400);
    }

    // Validate sprite/reference relationship
    const validRelationship = validateSpriteRefRelationship(category, parentRef.category);
    if (!validRelationship) {
        return c.json({
            success: false,
            error: `Cannot create ${category} from ${parentRef.category}`
        }, 400);
    }
}

// ... rest of generate logic ...

// When creating asset record, include parent_asset_id
const insertResult = await env.DB.prepare(`
    INSERT INTO generated_assets (
        category, asset_key, variant,
        base_prompt, current_prompt,
        status, generation_settings,
        parent_asset_id, sprite_variant
    )
    VALUES (?, ?, ?, ?, ?, 'pending', ?, ?, ?)
    RETURNING id
`).bind(
    category, asset_key, targetVariant,
    finalPrompt, finalPrompt,
    JSON.stringify(validatedSettings),
    parent_asset_id || null,
    sprite_variant || null
).first();
```

### Validate Sprite-Reference Relationship

```javascript
/**
 * Validate that a sprite category can be created from a reference category
 */
function validateSpriteRefRelationship(spriteCategory, refCategory) {
    const VALID_RELATIONSHIPS = {
        'building_sprite': ['building_ref'],
        'terrain': ['terrain_ref'],
        'npc': ['character_ref'],
        'vehicle': ['vehicle_ref'],
        'effect': ['effect_ref']
    };

    const allowedRefs = VALID_RELATIONSHIPS[spriteCategory];
    return allowedRefs && allowedRefs.includes(refCategory);
}
```

---

## API Client Updates (assetApi.ts)

```typescript
// Add to assetApi.ts

export interface SpriteRequirement {
    spriteCategory: string;
    variant: string;
    displayName: string;
    required: boolean;
}

export interface SpriteStatus {
    variant: string;
    displayName: string;
    required: boolean;
    spriteCategory: string;
    spriteAssetKey: string;
    spriteId: number | null;
    status: string | null;
    pipelineStatus: string | null;
    publicUrl: string | null;
    generationSettings: GenerationSettings | null;
}

export interface SpriteStatusResponse {
    success: boolean;
    reference: {
        id: number;
        category: string;
        asset_key: string;
        status: string;
    };
    sprites: SpriteStatus[];
    summary: {
        total: number;
        completed: number;
        inProgress: number;
        notStarted: number;
        percentComplete: number;
    };
}

// Get sprite requirements for a reference type
export async function getSpriteRequirements(refCategory: string): Promise<SpriteRequirement[]> {
    const response = await fetch(`${API_BASE}/admin/assets/sprite-requirements/${refCategory}`, {
        headers: getAuthHeaders()
    });
    const data = await response.json();
    return data.requirements || [];
}

// Get sprite status for a specific reference
export async function getSpriteStatus(refId: number): Promise<SpriteStatusResponse> {
    const response = await fetch(`${API_BASE}/admin/assets/sprite-status/${refId}`, {
        headers: getAuthHeaders()
    });
    return await response.json();
}

// Updated generate params to include parent_asset_id
export interface GenerateParams {
    category: AssetCategory;
    asset_key: string;
    variant?: number;
    prompt?: string;
    custom_details?: string;
    reference_images?: ReferenceImageSpec[];
    generation_settings?: GenerationSettings;
    parent_asset_id?: number;      // NEW: Link to parent reference
    sprite_variant?: string;       // NEW: Which variant
}
```

---

## Workflow Example

### Generating Sprites for a Building

1. **User approves `building_ref/restaurant`** (ID: 123)

2. **User clicks "Generate Sprites" on the reference**
   - UI calls `GET /api/admin/assets/sprite-status/123`
   - Response shows 1 sprite needed: `building_sprite/restaurant` (not started)

3. **User clicks "Generate" on the sprite row**
   - Opens Generate Modal with:
     - Category: `building_sprite` (pre-filled)
     - Asset Key: `restaurant` (pre-filled)
     - Parent Reference: `building_ref/restaurant v1` (pre-selected)
     - Prompt: Template loaded, editable
     - References: Parent ref shown, can add more
     - Settings: temperature, topK, topP sliders

4. **User edits prompt, adjusts settings, clicks Generate**
   - POST `/api/admin/assets/generate` with full params
   - Sprite generates with user's exact settings

5. **User reviews generated sprite**
   - Approve → triggers post-approval pipeline (Stage 05)
   - Reject → can regenerate with different settings

6. **Sprite is now live**
   - Pipeline completes: bg removal → trim → resize → public bucket
   - `sprite-status` endpoint shows 100% complete

---

## Database Schema Addition

Add columns for sprite tracking (can add to 0026 or new migration):

```sql
-- Add to generated_assets table
ALTER TABLE generated_assets ADD COLUMN sprite_variant TEXT;

-- Index for finding sprites by parent
CREATE INDEX IF NOT EXISTS idx_assets_parent ON generated_assets(parent_asset_id);
CREATE INDEX IF NOT EXISTS idx_assets_sprite_variant ON generated_assets(sprite_variant);
```

---

## Test Cases

### Test 1: Get Sprite Requirements

**Input:**
```bash
curl -H "Authorization: Bearer <token>" \
  "https://boss.notropolis.net/api/admin/assets/sprite-requirements/terrain_ref"
```

**Expected:**
```json
{
    "success": true,
    "refCategory": "terrain_ref",
    "requirements": [
        { "spriteCategory": "terrain", "variant": "straight", "displayName": "Straight", "required": true },
        { "spriteCategory": "terrain", "variant": "corner", "displayName": "Corner", "required": true },
        { "spriteCategory": "terrain", "variant": "t_junction", "displayName": "T-Junction", "required": true },
        { "spriteCategory": "terrain", "variant": "crossroads", "displayName": "Crossroads", "required": true },
        { "spriteCategory": "terrain", "variant": "end", "displayName": "Dead End", "required": true }
    ]
}
```

### Test 2: Get Sprite Status (No Sprites Created Yet)

**Input:**
```bash
curl -H "Authorization: Bearer <token>" \
  "https://boss.notropolis.net/api/admin/assets/sprite-status/123"
```

**Expected:**
```json
{
    "success": true,
    "reference": {
        "id": 123,
        "category": "building_ref",
        "asset_key": "restaurant",
        "status": "approved"
    },
    "sprites": [
        {
            "variant": "main",
            "displayName": "Building Sprite",
            "required": true,
            "spriteCategory": "building_sprite",
            "spriteAssetKey": "restaurant",
            "spriteId": null,
            "status": null,
            "pipelineStatus": null,
            "publicUrl": null,
            "generationSettings": null
        }
    ],
    "summary": {
        "total": 1,
        "completed": 0,
        "inProgress": 0,
        "notStarted": 1,
        "percentComplete": 0
    }
}
```

### Test 3: Generate Sprite with Parent Reference

**Input:**
```bash
curl -X POST \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "category": "building_sprite",
    "asset_key": "restaurant",
    "parent_asset_id": 123,
    "sprite_variant": "main",
    "prompt": "Generate an isometric building sprite...",
    "reference_images": [
      { "type": "approved_asset", "id": 123 }
    ],
    "generation_settings": {
      "temperature": 0.7,
      "topK": 40,
      "topP": 0.95
    }
  }' \
  "https://boss.notropolis.net/api/admin/assets/generate"
```

**Expected:**
```json
{
    "success": true,
    "assetId": 130,
    "variant": 1,
    "message": "Generation started"
}
```

### Test 4: Sprite Status After Generation

**After approving sprite 130:**

```bash
curl -H "Authorization: Bearer <token>" \
  "https://boss.notropolis.net/api/admin/assets/sprite-status/123"
```

**Expected:**
```json
{
    "success": true,
    "reference": { ... },
    "sprites": [
        {
            "variant": "main",
            "displayName": "Building Sprite",
            "spriteId": 130,
            "status": "approved",
            "pipelineStatus": "completed",
            "publicUrl": "https://assets.notropolis.net/sprites/building_sprite/restaurant.webp",
            "generationSettings": { "temperature": 0.7, "topK": 40, "topP": 0.95 }
        }
    ],
    "summary": {
        "total": 1,
        "completed": 1,
        "inProgress": 0,
        "notStarted": 0,
        "percentComplete": 100
    }
}
```

---

## Acceptance Checklist

- [ ] Sprite requirements hardcoded for all reference types
- [ ] `GET /sprite-requirements/:refCategory` returns correct requirements
- [ ] `GET /sprite-status/:refId` shows all sprites and their status
- [ ] Generate endpoint accepts `parent_asset_id` and `sprite_variant`
- [ ] Validation prevents invalid sprite-reference relationships
- [ ] Generation settings stored and retrievable per sprite
- [ ] Parent reference can be included in reference_images
- [ ] Sprite status summary calculates correctly
- [ ] API client methods added to assetApi.ts

---

## Deployment

### Commands

```bash
cd authentication-dashboard-system
npm run deploy
```

### Verification

```bash
# 1. Check sprite requirements
curl -H "Authorization: Bearer <token>" \
  "https://boss.notropolis.net/api/admin/assets/sprite-requirements/building_ref"

# 2. Create and approve a reference
# 3. Check sprite status
curl -H "Authorization: Bearer <token>" \
  "https://boss.notropolis.net/api/admin/assets/sprite-status/<ref_id>"

# 4. Generate a sprite with parent ref
# 5. Verify generation settings stored
```

---

## Handoff Notes

### For Stage 07 (Frontend Generate Modal)
- When generating sprites, pre-fill parent reference selector
- Show sprite requirements for the selected reference
- Auto-suggest parent ref in reference picker
- Display progress (e.g., "1 of 5 sprites complete")

### For Stage 08 (Frontend Preview Modal)
- Show parent reference link on sprite preview
- Display generation settings that were used
- Show pipeline status for sprites

### For Stage 10 (Asset Manager)
- Use sprite-status endpoint to show completion progress
- Link to generate modal for missing sprites
- Only show "Publish" when all required sprites are complete
