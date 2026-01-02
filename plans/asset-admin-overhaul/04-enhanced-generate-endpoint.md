# Stage 04: Enhanced Generate Endpoint

## Objective

Modify the generate endpoint to accept custom prompts, reference images, and Gemini generation settings; update `generateWithGemini` function to use configurable parameters.

## Dependencies

- **Requires:** [See: Stage 01] - Database schema with generation_settings column
- **Requires:** [See: Stage 02] - Reference library for fetching reference images
- **Requires:** [See: Stage 03] - Prompt templates for fetching/editing prompts
- **Blocks:** [See: Stage 07] - Frontend needs these parameters

## Complexity

**High** - Core generation logic modification, multiple reference image handling, settings integration.

---

## Files to Modify

| File | Changes |
|------|---------|
| `authentication-dashboard-system/worker/src/routes/admin/assets.js` | Modify generate endpoint and generateWithGemini function |
| `authentication-dashboard-system/src/services/assetApi.ts` | Update generate method signature |

---

## Implementation Details

### Updated Generate Endpoint Schema

**Current Request:**
```javascript
{
    category: 'building_ref',
    asset_key: 'restaurant',
    variant: 1,              // optional
    custom_details: 'string' // optional
}
```

**New Request:**
```javascript
{
    category: 'building_ref',
    asset_key: 'restaurant',
    variant: 1,                          // optional, auto-increment if empty

    // NEW: Custom prompt (optional - uses template if not provided)
    prompt: 'Full custom prompt...',     // optional, overrides template

    // NEW: Custom details (appended to prompt)
    custom_details: 'Additional notes',  // optional

    // NEW: Reference images to include
    reference_images: [                  // optional
        { type: 'library', id: 123 },    // from reference_images table
        { type: 'approved_asset', id: 456 } // from generated_assets table
    ],

    // NEW: Gemini generation settings
    generation_settings: {               // optional
        temperature: 0.7,                // 0.0 - 2.0, default 0.7
        topK: 40,                        // 1 - 100, default 40
        topP: 0.95,                      // 0.0 - 1.0, default 0.95
        maxOutputTokens: null            // optional limit
    }
}
```

### Updated generateWithGemini Function

```javascript
// Location: assets.js, around line 1948

/**
 * Generate image using Gemini API with configurable settings
 *
 * @param {Object} env - Cloudflare environment
 * @param {string} prompt - The generation prompt
 * @param {Array} referenceImages - Array of { buffer: Uint8Array, mimeType: string, name: string }
 * @param {Object} settings - Generation settings { temperature, topK, topP, maxOutputTokens }
 * @returns {Object} - { success, imageBuffer, error, modelResponse }
 */
async function generateWithGemini(env, prompt, referenceImages = [], settings = {}) {
    const GEMINI_API_KEY = env.GEMINI_API_KEY;
    const MODEL = 'gemini-3-pro-image-preview';
    const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${GEMINI_API_KEY}`;

    // Default settings
    const generationConfig = {
        temperature: settings.temperature ?? 0.7,
        topK: settings.topK ?? 40,
        topP: settings.topP ?? 0.95,
        responseModalities: ['IMAGE', 'TEXT']
    };

    // Add maxOutputTokens if specified
    if (settings.maxOutputTokens) {
        generationConfig.maxOutputTokens = settings.maxOutputTokens;
    }

    // Build request parts
    const parts = [];

    // Add prompt text
    parts.push({ text: prompt });

    // Add reference images as inline data
    for (const refImage of referenceImages) {
        try {
            // Convert buffer to base64 in chunks to avoid stack overflow
            const base64 = bufferToBase64(refImage.buffer);

            parts.push({
                inlineData: {
                    mimeType: refImage.mimeType || 'image/png',
                    data: base64
                }
            });

            console.log(`Added reference image: ${refImage.name} (${refImage.buffer.length} bytes)`);
        } catch (err) {
            console.error(`Failed to add reference image ${refImage.name}:`, err);
        }
    }

    const requestBody = {
        contents: [{
            parts: parts
        }],
        generationConfig: generationConfig
    };

    try {
        console.log(`Calling Gemini with settings:`, JSON.stringify(generationConfig));
        console.log(`Prompt length: ${prompt.length}, Reference images: ${referenceImages.length}`);

        const response = await fetch(GEMINI_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(requestBody)
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('Gemini API error:', errorText);
            return {
                success: false,
                error: `Gemini API error: ${response.status} - ${errorText}`
            };
        }

        const data = await response.json();

        // Extract image from response
        const imagePart = data.candidates?.[0]?.content?.parts?.find(p => p.inlineData);

        if (!imagePart) {
            // Check for text response (might contain error or explanation)
            const textPart = data.candidates?.[0]?.content?.parts?.find(p => p.text);
            return {
                success: false,
                error: 'No image in response',
                modelResponse: textPart?.text || null
            };
        }

        // Convert base64 to buffer
        const imageBuffer = base64ToBuffer(imagePart.inlineData.data);

        return {
            success: true,
            imageBuffer: imageBuffer,
            mimeType: imagePart.inlineData.mimeType,
            modelResponse: data.candidates?.[0]?.content?.parts?.find(p => p.text)?.text || null
        };

    } catch (error) {
        console.error('Gemini generation error:', error);
        return {
            success: false,
            error: error.message
        };
    }
}

// Helper: Convert Uint8Array to base64 in chunks
function bufferToBase64(buffer) {
    const CHUNK_SIZE = 8192;
    let base64 = '';
    for (let i = 0; i < buffer.length; i += CHUNK_SIZE) {
        const chunk = buffer.slice(i, i + CHUNK_SIZE);
        base64 += String.fromCharCode.apply(null, chunk);
    }
    return btoa(base64);
}

// Helper: Convert base64 to Uint8Array
function base64ToBuffer(base64) {
    const binaryString = atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
}
```

### Updated Generate Endpoint

```javascript
// POST /api/admin/assets/generate
router.post('/generate', async (c) => {
    const env = c.env;
    const user = c.get('user');

    try {
        const body = await c.req.json();
        const {
            category,
            asset_key,
            variant,
            prompt: customPrompt,
            custom_details,
            reference_images = [],
            generation_settings = {}
        } = body;

        // Validate required fields
        if (!category || !asset_key) {
            return c.json({
                success: false,
                error: 'category and asset_key are required'
            }, 400);
        }

        // Validate generation settings
        const validatedSettings = validateGenerationSettings(generation_settings);

        // Determine variant number
        let targetVariant = variant;
        if (!targetVariant) {
            // Auto-increment: find max variant for this category/asset_key
            const maxVariant = await env.DB.prepare(`
                SELECT MAX(variant) as max FROM generated_assets
                WHERE category = ? AND asset_key = ?
            `).bind(category, asset_key).first();
            targetVariant = (maxVariant?.max || 0) + 1;
        }

        // Check for duplicate
        const existing = await env.DB.prepare(`
            SELECT id FROM generated_assets
            WHERE category = ? AND asset_key = ? AND variant = ?
        `).bind(category, asset_key, targetVariant).first();

        if (existing) {
            return c.json({
                success: false,
                error: `Asset ${category}/${asset_key} variant ${targetVariant} already exists`
            }, 400);
        }

        // Build the prompt
        let finalPrompt;
        if (customPrompt) {
            // Use custom prompt directly
            finalPrompt = customPrompt;
            if (custom_details) {
                finalPrompt += `\n\n${custom_details}`;
            }
        } else {
            // Get prompt from database/template
            finalPrompt = await getPromptForGeneration(env, category, asset_key, custom_details);
        }

        // Fetch reference images
        const referenceImageBuffers = await fetchReferenceImages(env, reference_images);

        // Also fetch parent reference if this is a sprite category
        const parentRefBuffer = await fetchParentReference(env, category, asset_key);
        if (parentRefBuffer) {
            referenceImageBuffers.unshift(parentRefBuffer); // Parent ref goes first
        }

        // Create asset record in pending state
        const insertResult = await env.DB.prepare(`
            INSERT INTO generated_assets (
                category, asset_key, variant,
                base_prompt, current_prompt,
                status, generation_settings
            )
            VALUES (?, ?, ?, ?, ?, 'pending', ?)
            RETURNING id
        `).bind(
            category, asset_key, targetVariant,
            finalPrompt, finalPrompt,
            JSON.stringify(validatedSettings)
        ).first();

        const assetId = insertResult.id;

        // Store reference image links
        for (let i = 0; i < reference_images.length; i++) {
            const ref = reference_images[i];
            await env.DB.prepare(`
                INSERT INTO asset_reference_links (
                    asset_id, reference_image_id, approved_asset_id,
                    link_type, sort_order
                )
                VALUES (?, ?, ?, ?, ?)
            `).bind(
                assetId,
                ref.type === 'library' ? ref.id : null,
                ref.type === 'approved_asset' ? ref.id : null,
                ref.type,
                i
            ).run();

            // Increment usage count for library references
            if (ref.type === 'library') {
                await env.DB.prepare(`
                    UPDATE reference_images
                    SET usage_count = usage_count + 1
                    WHERE id = ?
                `).bind(ref.id).run();
            }
        }

        // Queue for generation
        await env.DB.prepare(`
            INSERT INTO asset_generation_queue (asset_id, priority)
            VALUES (?, ?)
        `).bind(assetId, 5).run();

        // Update status to 'generating'
        await env.DB.prepare(`
            UPDATE generated_assets SET status = 'generating' WHERE id = ?
        `).bind(assetId).run();

        // Log audit
        await logAudit(env, 'generate', assetId, user?.username, {
            category, asset_key, variant: targetVariant,
            hasCustomPrompt: !!customPrompt,
            referenceCount: reference_images.length,
            settings: validatedSettings
        });

        // Start generation asynchronously
        c.executionCtx.waitUntil(
            processAssetGeneration(env, assetId, finalPrompt, referenceImageBuffers, validatedSettings)
        );

        return c.json({
            success: true,
            assetId,
            variant: targetVariant,
            message: 'Generation started'
        });

    } catch (error) {
        console.error('Generate error:', error);
        return c.json({ success: false, error: error.message }, 500);
    }
});

// Validate and sanitize generation settings
// NOTE: Model is stored for full reproducibility
function validateGenerationSettings(settings) {
    return {
        model: 'gemini-3-pro-image-preview',  // Always record model used
        temperature: Math.min(2.0, Math.max(0.0, settings.temperature ?? 0.7)),
        topK: Math.min(100, Math.max(1, Math.round(settings.topK ?? 40))),
        topP: Math.min(1.0, Math.max(0.0, settings.topP ?? 0.95)),
        maxOutputTokens: settings.maxOutputTokens || null
    };
}

// Fetch reference images from library and approved assets
async function fetchReferenceImages(env, referenceSpecs) {
    const images = [];

    for (const spec of referenceSpecs) {
        try {
            let r2Key, name;

            if (spec.type === 'library') {
                // Fetch from reference_images table
                const refImage = await env.DB.prepare(`
                    SELECT r2_key, name FROM reference_images WHERE id = ?
                `).bind(spec.id).first();

                if (!refImage) {
                    console.warn(`Reference image ${spec.id} not found`);
                    continue;
                }
                r2Key = refImage.r2_key;
                name = refImage.name;

            } else if (spec.type === 'approved_asset') {
                // Fetch from generated_assets table
                const asset = await env.DB.prepare(`
                    SELECT r2_key_private, asset_key, category FROM generated_assets
                    WHERE id = ? AND status = 'approved'
                `).bind(spec.id).first();

                if (!asset) {
                    console.warn(`Approved asset ${spec.id} not found`);
                    continue;
                }
                r2Key = asset.r2_key_private;
                name = `${asset.category}/${asset.asset_key}`;
            }

            // Fetch image from R2
            const object = await env.R2_PRIVATE.get(r2Key);
            if (!object) {
                console.warn(`R2 object not found: ${r2Key}`);
                continue;
            }

            const buffer = new Uint8Array(await object.arrayBuffer());
            images.push({
                buffer,
                mimeType: object.httpMetadata?.contentType || 'image/png',
                name
            });

        } catch (err) {
            console.error(`Error fetching reference ${spec.type}/${spec.id}:`, err);
        }
    }

    return images;
}

// Fetch parent reference sheet for sprite categories
async function fetchParentReference(env, category, assetKey) {
    // Map sprite categories to their reference categories
    const SPRITE_TO_REF = {
        'building_sprite': 'building_ref',
        'npc': 'character_ref',
        'effect': 'effect_ref',
        'avatar': 'character_ref',
        'terrain': 'terrain_ref'
    };

    const refCategory = SPRITE_TO_REF[category];
    if (!refCategory) return null;

    // Get the matching asset key for the reference
    const refAssetKey = getRefAssetKey(category, assetKey);

    // Find approved reference
    const refAsset = await env.DB.prepare(`
        SELECT r2_key_private, asset_key FROM generated_assets
        WHERE category = ? AND asset_key = ? AND status = 'approved'
        ORDER BY is_active DESC, approved_at DESC
        LIMIT 1
    `).bind(refCategory, refAssetKey).first();

    if (!refAsset) return null;

    // Fetch from R2
    const object = await env.R2_PRIVATE.get(refAsset.r2_key_private);
    if (!object) return null;

    return {
        buffer: new Uint8Array(await object.arrayBuffer()),
        mimeType: 'image/png',
        name: `Parent: ${refCategory}/${refAsset.asset_key}`
    };
}

// Process the actual generation
async function processAssetGeneration(env, assetId, prompt, referenceImages, settings) {
    try {
        // Call Gemini
        const result = await generateWithGemini(env, prompt, referenceImages, settings);

        if (!result.success) {
            // Mark as failed
            await env.DB.prepare(`
                UPDATE generated_assets
                SET status = 'failed', error_message = ?, updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
            `).bind(result.error, assetId).run();

            await env.DB.prepare(`
                UPDATE asset_generation_queue
                SET status = 'failed', error_message = ?, completed_at = CURRENT_TIMESTAMP
                WHERE asset_id = ?
            `).bind(result.error, assetId).run();

            return;
        }

        // Store image in R2
        const asset = await env.DB.prepare(`
            SELECT category, asset_key, variant FROM generated_assets WHERE id = ?
        `).bind(assetId).first();

        const r2Key = `raw/${asset.category}/${asset.asset_key}_v${asset.variant}_${Date.now()}.png`;

        await env.R2_PRIVATE.put(r2Key, result.imageBuffer, {
            httpMetadata: { contentType: result.mimeType || 'image/png' }
        });

        // Update asset record
        await env.DB.prepare(`
            UPDATE generated_assets
            SET status = 'review',
                r2_key_private = ?,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `).bind(r2Key, assetId).run();

        // Update queue
        await env.DB.prepare(`
            UPDATE asset_generation_queue
            SET status = 'completed', completed_at = CURRENT_TIMESTAMP
            WHERE asset_id = ?
        `).bind(assetId).run();

        console.log(`Generation complete for asset ${assetId}`);

    } catch (error) {
        console.error(`Generation failed for asset ${assetId}:`, error);

        await env.DB.prepare(`
            UPDATE generated_assets
            SET status = 'failed', error_message = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `).bind(error.message, assetId).run();
    }
}
```

### API Client Updates (assetApi.ts)

```typescript
// Update in assetApi.ts

export interface GenerationSettings {
    temperature?: number;  // 0.0 - 2.0, default 0.7
    topK?: number;         // 1 - 100, default 40
    topP?: number;         // 0.0 - 1.0, default 0.95
    maxOutputTokens?: number;
}

export interface ReferenceImageSpec {
    type: 'library' | 'approved_asset';
    id: number;
}

export interface GenerateParams {
    category: AssetCategory;
    asset_key: string;
    variant?: number;
    prompt?: string;                          // Custom prompt (optional)
    custom_details?: string;                  // Additional details
    reference_images?: ReferenceImageSpec[];  // Reference images to include
    generation_settings?: GenerationSettings; // Gemini settings
}

export interface GenerateResponse {
    success: boolean;
    assetId?: number;
    variant?: number;
    message?: string;
    error?: string;
}

// Updated generate method
export async function generate(params: GenerateParams): Promise<GenerateResponse> {
    const response = await fetch(`${API_BASE}/admin/assets/generate`, {
        method: 'POST',
        headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({
            category: params.category,
            asset_key: params.asset_key,
            variant: params.variant,
            prompt: params.prompt,
            custom_details: params.custom_details,
            reference_images: params.reference_images,
            generation_settings: params.generation_settings
        })
    });

    const data = await response.json();
    return data;
}
```

---

## Test Cases

### Test 1: Generate with Custom Prompt
**Input:**
```bash
curl -X POST \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "category": "building_ref",
    "asset_key": "test_building",
    "prompt": "Custom prompt for testing...",
    "generation_settings": {
      "temperature": 0.5
    }
  }' \
  "https://boss.notropolis.net/api/admin/assets/generate"
```

**Expected Output:**
```json
{
    "success": true,
    "assetId": 123,
    "variant": 1,
    "message": "Generation started"
}
```

### Test 2: Generate with Reference Images
**Input:**
```bash
curl -X POST \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "category": "building_sprite",
    "asset_key": "restaurant",
    "reference_images": [
      { "type": "library", "id": 5 },
      { "type": "approved_asset", "id": 42 }
    ]
  }' \
  "https://boss.notropolis.net/api/admin/assets/generate"
```

**Expected:** Generation includes both reference images in Gemini call

### Test 3: Validate Settings Bounds
**Input:**
```bash
curl -X POST \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "category": "building_ref",
    "asset_key": "bank",
    "generation_settings": {
      "temperature": 5.0,
      "topK": -10
    }
  }' \
  "https://boss.notropolis.net/api/admin/assets/generate"
```

**Expected:** Settings clamped to valid ranges (temperature=2.0, topK=1)

### Test 4: Auto-Increment Variant
**Input:** Generate without specifying variant when variant 1 exists

**Expected:** Creates variant 2

### Test 5: Reference Image Links Stored
**Input:** Generate with reference images

**Verify:**
```sql
SELECT * FROM asset_reference_links WHERE asset_id = <new_asset_id>;
```
**Expected:** Links created with correct type and sort_order

### Test 6: Full Reproducibility Logging
**Input:** Generate any asset with custom settings

**Verify:**
```sql
SELECT
    id,
    base_prompt,
    current_prompt,
    generation_settings,
    generation_model
FROM generated_assets
WHERE id = <new_asset_id>;
```

**Expected:**
- `base_prompt` - Contains the prompt template
- `current_prompt` - Contains the full rendered prompt (with placeholders replaced)
- `generation_settings` - JSON with `{"model": "gemini-3-pro-image-preview", "temperature": 0.7, "topK": 40, "topP": 0.95, ...}`
- `generation_model` - String: `gemini-3-pro-image-preview`

**This is CRITICAL for reproducibility** - all settings must be logged so the same asset can be regenerated with identical parameters.

---

## Acceptance Checklist

- [ ] Generate endpoint accepts `prompt` parameter for custom prompts
- [ ] Generate endpoint accepts `reference_images` array
- [ ] Generate endpoint accepts `generation_settings` object
- [ ] Settings are validated and clamped to valid ranges
- [ ] `generation_settings` stored in asset record as JSON
- [ ] Reference image links created in `asset_reference_links`
- [ ] Library reference `usage_count` incremented
- [ ] `generateWithGemini` uses configurable temperature, topK, topP
- [ ] Multiple reference images passed to Gemini correctly
- [ ] Parent reference auto-fetched for sprite categories
- [ ] Variant auto-increments when not specified
- [ ] API client updated with new parameters
- [ ] **Reproducibility**: All generation params logged (model, temperature, topK, topP in `generation_settings` JSON)
- [ ] **Reproducibility**: Full prompt stored in `current_prompt` (with all substitutions applied)

### Reproducibility Requirements (Logging)

After each generation, the following MUST be stored in the `generated_assets` record for full reproducibility:

| Field | Data Stored | Purpose |
|-------|-------------|---------|
| `base_prompt` | Original prompt template | Starting point for any regeneration |
| `current_prompt` | Full prompt sent to Gemini (with substitutions) | Exact text used |
| `generation_settings` | JSON: `{"temperature": 0.7, "topK": 40, "topP": 0.95, "model": "gemini-3-pro-image-preview"}` | Exact LLM settings used |
| `generation_model` | Model identifier string | Which Gemini model was used |

**Verification:** After generating an asset, query the database and confirm all settings are stored:
```sql
SELECT id, base_prompt, current_prompt, generation_settings, generation_model
FROM generated_assets WHERE id = <new_asset_id>;
```

All fields should be populated to allow exact reproduction of the generation.

---

## Deployment

### Commands

```bash
cd authentication-dashboard-system
npm run deploy
```

### Verification

```bash
# Test with custom settings
curl -X POST \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "category": "building_ref",
    "asset_key": "test",
    "generation_settings": { "temperature": 0.3 }
  }' \
  "https://boss.notropolis.net/api/admin/assets/generate"

# Verify settings stored
curl -H "Authorization: Bearer <token>" \
  "https://boss.notropolis.net/api/admin/assets/list/building_ref"
# Check generation_settings field in response
```

---

## Handoff Notes

### For Stage 05 (Auto-Sprite Creation)
- Sprites are auto-generated when references are approved
- Use same `processAssetGeneration` function
- Pass the reference as first element in `referenceImages` array
- Settings can use defaults or be stored per-category

### For Stage 06 (Regenerate Flow)
- Regenerate should preserve original `generation_settings`
- Allow override of settings in regenerate request
- New version should link to same reference images

### For Stage 07 (Frontend Generate Modal)
- Send all parameters in `generate()` call
- Preset buttons: Creative (temp=1.2), Balanced (temp=0.7), Precise (temp=0.3)
- Show settings sliders with current values
- Reference image picker should build `reference_images` array
