# Stage 05: Post-Approval Pipeline

## Objective

When a **sprite** is approved, automatically run the post-processing pipeline:
1. Background removal (Slazzer API)
2. Trim transparent pixels
3. Save PNG to private bucket
4. Resize + WebP conversion (Cloudflare)
5. Save to public bucket for game consumption

**IMPORTANT:** This stage does NOT create any sprites automatically. All sprites are generated manually via Stage 05a with full control over prompts, references, and Gemini settings.

## Dependencies

- **Requires:** [See: Stage 01] - Database schema with r2_url columns
- **Requires:** [See: Stage 04] - Enhanced generate for sprite creation
- **Blocks:** [See: Stage 10] - Asset Manager needs public URLs

## Complexity

**Medium** - External API integration (Slazzer), image processing, R2 bucket management.

---

## Files to Modify

| File | Changes |
|------|---------|
| `authentication-dashboard-system/worker/src/routes/admin/assets.js` | Add post-approval pipeline to approve endpoint |

---

## What This Stage Does NOT Do

This stage **REMOVES** all auto-sprite creation logic. Specifically:

- **NO** `building_ref → building_sprite` auto-creation
- **NO** `terrain_ref → terrain` auto-creation
- **NO** `character_ref → npc` auto-creation
- **NO** `vehicle_ref → vehicle` auto-creation
- **NO** `effect_ref → effect` auto-creation

All sprites are created manually via the Generate endpoint (Stage 05a) with full user control.

---

## Implementation Details

### Updated Approve Endpoint

```javascript
// PUT /api/admin/assets/approve/:id
router.put('/approve/:id', async (c) => {
    const { id } = c.req.param();
    const env = c.env;
    const user = c.get('user');

    try {
        // Get asset details
        const asset = await env.DB.prepare(`
            SELECT * FROM generated_assets WHERE id = ?
        `).bind(id).first();

        if (!asset) {
            return c.json({ success: false, error: 'Asset not found' }, 404);
        }

        if (asset.status !== 'review' && asset.status !== 'completed') {
            return c.json({
                success: false,
                error: `Cannot approve asset with status: ${asset.status}`
            }, 400);
        }

        // Update to approved
        await env.DB.prepare(`
            UPDATE generated_assets
            SET status = 'approved',
                approved_at = CURRENT_TIMESTAMP,
                approved_by = ?,
                is_active = TRUE,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `).bind(user?.username || 'system', id).run();

        // Deactivate other variants of same category/asset_key
        await env.DB.prepare(`
            UPDATE generated_assets
            SET is_active = FALSE
            WHERE category = ? AND asset_key = ? AND id != ? AND is_active = TRUE
        `).bind(asset.category, asset.asset_key, id).run();

        // Log audit
        await logAudit(env, 'approve', parseInt(id), user?.username, {
            category: asset.category,
            asset_key: asset.asset_key
        });

        // ===========================================
        // POST-APPROVAL PIPELINE (SPRITES ONLY)
        // ===========================================

        const SPRITE_CATEGORIES = [
            'building_sprite',
            'terrain',
            'npc',
            'effect',
            'vehicle',
            'avatar'
        ];

        if (SPRITE_CATEGORIES.includes(asset.category)) {
            // Run pipeline asynchronously
            c.executionCtx.waitUntil(
                postApprovalPipeline(env, parseInt(id), asset)
            );

            return c.json({
                success: true,
                approved: true,
                pipeline: 'started',
                message: 'Approved. Processing pipeline started (bg removal → trim → resize → publish).'
            });
        }

        // For non-sprite assets (references, backgrounds), just approve
        return c.json({
            success: true,
            approved: true,
            message: 'Approved successfully.'
        });

    } catch (error) {
        console.error('Approve error:', error);
        return c.json({ success: false, error: error.message }, 500);
    }
});
```

### Post-Approval Pipeline Function

```javascript
/**
 * Post-approval processing pipeline for sprites
 *
 * Steps:
 * 1. Background removal (Slazzer API)
 * 2. Trim transparent pixels
 * 3. Save processed PNG to private bucket
 * 4. Resize + WebP conversion (Cloudflare)
 * 5. Save to public bucket for game
 * 6. Update database with public URL
 */
async function postApprovalPipeline(env, assetId, asset) {
    console.log(`Starting post-approval pipeline for asset ${assetId} (${asset.category}/${asset.asset_key})`);

    try {
        // Update status to processing
        await env.DB.prepare(`
            UPDATE generated_assets
            SET pipeline_status = 'processing',
                pipeline_started_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `).bind(assetId).run();

        // 1. Fetch original image from private bucket
        const originalObject = await env.R2_PRIVATE.get(asset.r2_key_private);
        if (!originalObject) {
            throw new Error(`Original image not found: ${asset.r2_key_private}`);
        }
        let imageBuffer = new Uint8Array(await originalObject.arrayBuffer());
        console.log(`Fetched original image: ${imageBuffer.length} bytes`);

        // 2. Background removal (Slazzer API)
        console.log('Removing background via Slazzer...');
        const bgRemovedBuffer = await removeBackground(env, imageBuffer);
        console.log(`Background removed: ${bgRemovedBuffer.length} bytes`);

        // 3. Trim transparent pixels
        console.log('Trimming transparent pixels...');
        const trimmedBuffer = await trimTransparent(bgRemovedBuffer);
        console.log(`Trimmed: ${trimmedBuffer.length} bytes`);

        // 4. Save processed PNG to private bucket
        const processedKey = `processed/${asset.category}/${asset.asset_key}_v${asset.variant}_${Date.now()}.png`;
        await env.R2_PRIVATE.put(processedKey, trimmedBuffer, {
            httpMetadata: { contentType: 'image/png' }
        });
        console.log(`Saved processed PNG: ${processedKey}`);

        // 5. Resize + WebP conversion via Cloudflare
        // Get target dimensions from category
        const dimensions = getSpriteTargetDimensions(asset.category);
        console.log(`Resizing to ${dimensions.width}x${dimensions.height}...`);

        const webpBuffer = await resizeAndConvertToWebP(env, trimmedBuffer, dimensions);
        console.log(`Converted to WebP: ${webpBuffer.length} bytes`);

        // 6. Save to public bucket
        const publicKey = `sprites/${asset.category}/${asset.asset_key}.webp`;
        await env.R2_PUBLIC.put(publicKey, webpBuffer, {
            httpMetadata: { contentType: 'image/webp' }
        });
        console.log(`Saved to public bucket: ${publicKey}`);

        // 7. Update database with public URL
        const publicUrl = `${env.PUBLIC_ASSETS_URL}/${publicKey}`;
        await env.DB.prepare(`
            UPDATE generated_assets
            SET r2_key_processed = ?,
                r2_key_public = ?,
                r2_url = ?,
                pipeline_status = 'completed',
                pipeline_completed_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `).bind(processedKey, publicKey, publicUrl, assetId).run();

        console.log(`Pipeline completed for asset ${assetId}. Public URL: ${publicUrl}`);

        // Log audit
        await logAudit(env, 'pipeline_complete', assetId, 'system', {
            processedKey,
            publicKey,
            publicUrl
        });

    } catch (error) {
        console.error(`Pipeline failed for asset ${assetId}:`, error);

        // Update status to failed
        await env.DB.prepare(`
            UPDATE generated_assets
            SET pipeline_status = 'failed',
                pipeline_error = ?,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `).bind(error.message, assetId).run();

        // Log audit
        await logAudit(env, 'pipeline_failed', assetId, 'system', {
            error: error.message
        });
    }
}
```

### Background Removal (Slazzer API)

```javascript
/**
 * Remove background from image using Slazzer API
 */
async function removeBackground(env, imageBuffer) {
    const SLAZZER_API_KEY = env.SLAZZER_API_KEY;
    const SLAZZER_URL = 'https://api.slazzer.com/v2.0/remove_image_background';

    // Convert to base64 for API
    const base64Image = bufferToBase64(imageBuffer);

    const formData = new FormData();
    formData.append('source_image_url', `data:image/png;base64,${base64Image}`);

    const response = await fetch(SLAZZER_URL, {
        method: 'POST',
        headers: {
            'API-KEY': SLAZZER_API_KEY
        },
        body: formData
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Slazzer API error: ${response.status} - ${errorText}`);
    }

    // Response is the processed image
    const resultBuffer = new Uint8Array(await response.arrayBuffer());
    return resultBuffer;
}
```

### Trim Transparent Pixels

```javascript
/**
 * Trim transparent pixels from image edges
 * Uses a simple approach - can be enhanced with sharp/jimp if needed
 */
async function trimTransparent(imageBuffer) {
    // For now, return as-is - implement actual trimming if needed
    // This could use a WASM-based image library or external service

    // TODO: Implement actual transparent pixel trimming
    // Options:
    // 1. Use sharp via WASM
    // 2. Use external image processing service
    // 3. Process client-side before upload

    return imageBuffer;
}
```

### Resize and Convert to WebP

```javascript
/**
 * Resize image and convert to WebP using Cloudflare Image Transformations
 */
async function resizeAndConvertToWebP(env, imageBuffer, dimensions) {
    // Option 1: Use Cloudflare Images API
    // Option 2: Use Cloudflare Image Transformations on R2

    // For now, use a temporary R2 upload + transformation URL
    const tempKey = `temp/resize_${Date.now()}.png`;
    await env.R2_PRIVATE.put(tempKey, imageBuffer, {
        httpMetadata: { contentType: 'image/png' }
    });

    // Construct Cloudflare Image Transformation URL
    const transformUrl = `${env.PRIVATE_ASSETS_URL}/${tempKey}?width=${dimensions.width}&height=${dimensions.height}&fit=contain&format=webp`;

    const response = await fetch(transformUrl);
    if (!response.ok) {
        throw new Error(`Cloudflare resize failed: ${response.status}`);
    }

    const webpBuffer = new Uint8Array(await response.arrayBuffer());

    // Clean up temp file
    await env.R2_PRIVATE.delete(tempKey);

    return webpBuffer;
}

/**
 * Get target dimensions for sprite category
 */
function getSpriteTargetDimensions(category) {
    const DIMENSIONS = {
        'building_sprite': { width: 128, height: 128 },
        'terrain': { width: 64, height: 64 },
        'npc': { width: 64, height: 64 },
        'effect': { width: 64, height: 64 },
        'vehicle': { width: 64, height: 64 },
        'avatar': { width: 128, height: 128 }
    };
    return DIMENSIONS[category] || { width: 64, height: 64 };
}
```

---

## Database Schema Addition

Add pipeline tracking columns (can be added to existing migration or new one):

```sql
-- Add to generated_assets table
ALTER TABLE generated_assets ADD COLUMN r2_key_processed TEXT;
ALTER TABLE generated_assets ADD COLUMN r2_key_public TEXT;
ALTER TABLE generated_assets ADD COLUMN pipeline_status TEXT DEFAULT NULL;
ALTER TABLE generated_assets ADD COLUMN pipeline_started_at DATETIME;
ALTER TABLE generated_assets ADD COLUMN pipeline_completed_at DATETIME;
ALTER TABLE generated_assets ADD COLUMN pipeline_error TEXT;

CREATE INDEX IF NOT EXISTS idx_assets_pipeline ON generated_assets(pipeline_status);
```

---

## Test Cases

### Test 1: Approve Sprite Triggers Pipeline

**Input:**
```bash
curl -X PUT \
  -H "Authorization: Bearer <token>" \
  "https://boss.notropolis.net/api/admin/assets/approve/123"
```

**Expected Output (for sprite category):**
```json
{
    "success": true,
    "approved": true,
    "pipeline": "started",
    "message": "Approved. Processing pipeline started (bg removal → trim → resize → publish)."
}
```

### Test 2: Pipeline Completes Successfully

**After Test 1, verify:**
```sql
SELECT pipeline_status, r2_url, r2_key_public FROM generated_assets WHERE id = 123;
```

**Expected:**
- `pipeline_status` = 'completed'
- `r2_url` = public URL (e.g., `https://assets.notropolis.net/sprites/building_sprite/restaurant.webp`)
- `r2_key_public` = `sprites/building_sprite/restaurant.webp`

### Test 3: Approve Reference Does NOT Trigger Pipeline

**Input:** Approve a `building_ref` asset

**Expected:**
```json
{
    "success": true,
    "approved": true,
    "message": "Approved successfully."
}
```
- NO pipeline started
- NO auto-sprite creation

### Test 4: Pipeline Failure Handling

**Setup:** Invalid Slazzer API key

**Expected:**
- `pipeline_status` = 'failed'
- `pipeline_error` contains error message
- Asset remains approved but without public URL

---

## Acceptance Checklist

- [ ] Approving sprite triggers post-approval pipeline
- [ ] Approving reference does NOT trigger pipeline or create sprites
- [ ] Background removal via Slazzer API works
- [ ] Transparent pixels trimmed (or placeholder for future)
- [ ] Processed PNG saved to private bucket
- [ ] WebP conversion via Cloudflare works
- [ ] Final WebP saved to public bucket
- [ ] Database updated with public URL
- [ ] Pipeline status tracking (processing/completed/failed)
- [ ] Error handling with status and message stored
- [ ] Audit logging for pipeline completion/failure

---

## Deployment

### Commands

```bash
cd authentication-dashboard-system
npm run deploy
```

### Verification

```bash
# 1. Manually generate a sprite (see Stage 05a)
# 2. Approve the sprite
curl -X PUT \
  -H "Authorization: Bearer <token>" \
  "https://boss.notropolis.net/api/admin/assets/approve/<sprite_id>"

# 3. Check pipeline status
curl -H "Authorization: Bearer <token>" \
  "https://boss.notropolis.net/api/admin/assets/<sprite_id>" | jq '.asset.pipeline_status, .asset.r2_url'

# 4. Verify public URL is accessible
curl -I "https://assets.notropolis.net/sprites/building_sprite/restaurant.webp"
```

---

## Handoff Notes

### For Stage 05a (Sprite Generation Flow)
- Sprites must be manually generated before this pipeline can run
- Use parent reference and custom prompts for sprite generation
- This pipeline only runs on APPROVAL, not generation

### For Stage 10 (Asset Manager)
- `r2_url` field contains the public URL for game consumption
- `pipeline_status` can be shown in UI for debugging
- Only sprites with `pipeline_status = 'completed'` should be publishable
