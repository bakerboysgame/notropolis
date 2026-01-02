# Stage 06: Regenerate Flow

## Objective

Modify the regenerate endpoint to preserve old versions (as "Ready for Review") and accept optional prompt/reference/settings overrides for the new version.

## Dependencies

- **Requires:** [See: Stage 01] - Database schema
- **Requires:** [See: Stage 04] - Enhanced generate with settings
- **Blocks:** [See: Stage 08] - Frontend regenerate modal

## Complexity

**Medium** - Preserve old version, create new version with overrides, maintain links.

---

## Files to Modify

| File | Changes |
|------|---------|
| `authentication-dashboard-system/worker/src/routes/admin/assets.js` | Modify regenerate endpoint |
| `authentication-dashboard-system/src/services/assetApi.ts` | Update regenerate method |

---

## Implementation Details

### Current Regenerate Behavior

The current regenerate endpoint:
1. Keeps the same asset record
2. Updates status to 'pending'
3. Regenerates in place
4. Old image is lost

### New Regenerate Behavior

The new regenerate endpoint:
1. **Preserves old version** - status stays as 'review' or 'completed' (visible in history)
2. **Creates NEW version** - incremented variant number
3. **Accepts overrides** - custom prompt, new references, new settings
4. **Links to same parent** - for sprites, maintains reference to parent ref

### Updated Regenerate Endpoint

```javascript
// POST /api/admin/assets/regenerate/:id

/**
 * Request body:
 * {
 *   prompt?: string,                    // Optional: override prompt
 *   custom_details?: string,            // Optional: additional details
 *   reference_images?: ReferenceSpec[], // Optional: new references
 *   generation_settings?: Settings,     // Optional: override settings
 *   preserve_old?: boolean              // Default: true (keep old as review)
 * }
 */

router.post('/regenerate/:id', async (c) => {
    const { id } = c.req.param();
    const env = c.env;
    const user = c.get('user');

    try {
        const body = await c.req.json().catch(() => ({}));
        const {
            prompt: customPrompt,
            custom_details,
            reference_images,
            generation_settings,
            preserve_old = true  // Default: preserve old version
        } = body;

        // Get original asset
        const original = await env.DB.prepare(`
            SELECT * FROM generated_assets WHERE id = ?
        `).bind(id).first();

        if (!original) {
            return c.json({ success: false, error: 'Asset not found' }, 404);
        }

        // Validate status - can regenerate from review, completed, rejected, failed
        const allowedStatuses = ['review', 'completed', 'rejected', 'failed', 'approved'];
        if (!allowedStatuses.includes(original.status)) {
            return c.json({
                success: false,
                error: `Cannot regenerate asset with status: ${original.status}`
            }, 400);
        }

        // Calculate new variant number
        const maxVariant = await env.DB.prepare(`
            SELECT MAX(variant) as max FROM generated_assets
            WHERE category = ? AND asset_key = ?
        `).bind(original.category, original.asset_key).first();

        const newVariant = (maxVariant?.max || 0) + 1;

        // Determine the prompt
        let finalPrompt;
        if (customPrompt) {
            finalPrompt = customPrompt;
            if (custom_details) {
                finalPrompt += `\n\n${custom_details}`;
            }
        } else {
            // Use original prompt with optional custom details
            finalPrompt = original.current_prompt;
            if (custom_details) {
                finalPrompt += `\n\n${custom_details}`;
            }
        }

        // Determine settings (use overrides or inherit from original)
        const originalSettings = original.generation_settings
            ? JSON.parse(original.generation_settings)
            : {};

        const mergedSettings = {
            temperature: generation_settings?.temperature ?? originalSettings.temperature ?? 0.7,
            topK: generation_settings?.topK ?? originalSettings.topK ?? 40,
            topP: generation_settings?.topP ?? originalSettings.topP ?? 0.95
        };

        // Update old version status if preserving
        if (preserve_old) {
            // Mark old as "completed" (ready for review/comparison)
            // Don't change if already approved
            if (original.status !== 'approved') {
                await env.DB.prepare(`
                    UPDATE generated_assets
                    SET status = 'completed',
                        updated_at = CURRENT_TIMESTAMP
                    WHERE id = ?
                `).bind(id).run();
            }
        }

        // Create new version
        const insertResult = await env.DB.prepare(`
            INSERT INTO generated_assets (
                category, asset_key, variant,
                base_prompt, current_prompt,
                status, parent_asset_id,
                generation_settings,
                auto_created, auto_created_from
            )
            VALUES (?, ?, ?, ?, ?, 'pending', ?, ?, ?, ?)
            RETURNING id
        `).bind(
            original.category,
            original.asset_key,
            newVariant,
            original.base_prompt,  // Keep original base prompt
            finalPrompt,           // Use new/modified prompt as current
            original.parent_asset_id,
            JSON.stringify(mergedSettings),
            original.auto_created || false,
            original.auto_created_from
        ).first();

        const newAssetId = insertResult.id;

        // Copy or create reference links
        if (reference_images && reference_images.length > 0) {
            // Use new reference images
            for (let i = 0; i < reference_images.length; i++) {
                const ref = reference_images[i];
                await env.DB.prepare(`
                    INSERT INTO asset_reference_links (
                        asset_id, reference_image_id, approved_asset_id,
                        link_type, sort_order
                    )
                    VALUES (?, ?, ?, ?, ?)
                `).bind(
                    newAssetId,
                    ref.type === 'library' ? ref.id : null,
                    ref.type === 'approved_asset' ? ref.id : null,
                    ref.type,
                    i
                ).run();
            }
        } else {
            // Copy reference links from original
            const originalLinks = await env.DB.prepare(`
                SELECT reference_image_id, approved_asset_id, link_type, sort_order
                FROM asset_reference_links
                WHERE asset_id = ?
            `).bind(id).all();

            for (const link of originalLinks.results) {
                await env.DB.prepare(`
                    INSERT INTO asset_reference_links (
                        asset_id, reference_image_id, approved_asset_id,
                        link_type, sort_order
                    )
                    VALUES (?, ?, ?, ?, ?)
                `).bind(
                    newAssetId,
                    link.reference_image_id,
                    link.approved_asset_id,
                    link.link_type,
                    link.sort_order
                ).run();
            }
        }

        // Queue for generation
        await env.DB.prepare(`
            INSERT INTO asset_generation_queue (asset_id, priority)
            VALUES (?, 3)
        `).bind(newAssetId).run();

        // Update status to generating
        await env.DB.prepare(`
            UPDATE generated_assets SET status = 'generating' WHERE id = ?
        `).bind(newAssetId).run();

        // Log audit
        await logAudit(env, 'regenerate', newAssetId, user?.username, {
            original_id: parseInt(id),
            original_variant: original.variant,
            new_variant: newVariant,
            had_custom_prompt: !!customPrompt,
            had_new_references: !!(reference_images && reference_images.length > 0),
            had_new_settings: !!generation_settings,
            preserved_old: preserve_old
        });

        // Fetch reference images for generation
        const referenceImageBuffers = await fetchReferenceImagesForAsset(env, newAssetId);

        // Start generation asynchronously
        c.executionCtx.waitUntil(
            processAssetGeneration(env, newAssetId, finalPrompt, referenceImageBuffers, mergedSettings)
        );

        return c.json({
            success: true,
            originalId: parseInt(id),
            originalVariant: original.variant,
            newAssetId,
            newVariant,
            message: `Created new version (variant ${newVariant}). ${preserve_old ? 'Old version preserved.' : ''}`
        });

    } catch (error) {
        console.error('Regenerate error:', error);
        return c.json({ success: false, error: error.message }, 500);
    }
});

// Helper: Fetch reference images for an asset
async function fetchReferenceImagesForAsset(env, assetId) {
    const links = await env.DB.prepare(`
        SELECT
            arl.reference_image_id,
            arl.approved_asset_id,
            arl.link_type,
            ri.r2_key as lib_r2_key,
            ri.name as lib_name,
            ga.r2_key_private as asset_r2_key,
            ga.asset_key as asset_name
        FROM asset_reference_links arl
        LEFT JOIN reference_images ri ON arl.reference_image_id = ri.id
        LEFT JOIN generated_assets ga ON arl.approved_asset_id = ga.id
        WHERE arl.asset_id = ?
        ORDER BY arl.sort_order
    `).bind(assetId).all();

    const images = [];

    for (const link of links.results) {
        const r2Key = link.link_type === 'library' ? link.lib_r2_key : link.asset_r2_key;
        const name = link.link_type === 'library' ? link.lib_name : link.asset_name;

        if (!r2Key) continue;

        try {
            const object = await env.R2_PRIVATE.get(r2Key);
            if (object) {
                images.push({
                    buffer: new Uint8Array(await object.arrayBuffer()),
                    mimeType: object.httpMetadata?.contentType || 'image/png',
                    name: name || 'reference'
                });
            }
        } catch (err) {
            console.error(`Failed to fetch reference ${r2Key}:`, err);
        }
    }

    // Also fetch parent reference if this is a sprite
    const asset = await env.DB.prepare(`
        SELECT parent_asset_id FROM generated_assets WHERE id = ?
    `).bind(assetId).first();

    if (asset?.parent_asset_id) {
        const parentRef = await fetchParentReferenceById(env, asset.parent_asset_id);
        if (parentRef) {
            images.unshift(parentRef); // Parent goes first
        }
    }

    return images;
}
```

### API Client Updates (assetApi.ts)

```typescript
// Update in assetApi.ts

export interface RegenerateParams {
    prompt?: string;                          // Override prompt
    custom_details?: string;                  // Additional details
    reference_images?: ReferenceImageSpec[];  // New references
    generation_settings?: GenerationSettings; // Override settings
    preserve_old?: boolean;                   // Keep old version (default: true)
}

export interface RegenerateResponse {
    success: boolean;
    originalId?: number;
    originalVariant?: number;
    newAssetId?: number;
    newVariant?: number;
    message?: string;
    error?: string;
}

// Updated regenerate method
export async function regenerate(assetId: number, params?: RegenerateParams): Promise<RegenerateResponse> {
    const response = await fetch(`${API_BASE}/admin/assets/regenerate/${assetId}`, {
        method: 'POST',
        headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify(params || {})
    });

    const data = await response.json();
    return data;
}
```

---

## Test Cases

### Test 1: Basic Regenerate (Preserve Old)
**Input:**
```bash
curl -X POST \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{}' \
  "https://boss.notropolis.net/api/admin/assets/regenerate/123"
```

**Expected Output:**
```json
{
    "success": true,
    "originalId": 123,
    "originalVariant": 1,
    "newAssetId": 124,
    "newVariant": 2,
    "message": "Created new version (variant 2). Old version preserved."
}
```

**Verify:**
- Asset 123 status is 'completed' (or unchanged if was 'approved')
- Asset 124 exists with variant 2, status 'pending' → 'generating'

### Test 2: Regenerate with Custom Prompt
**Input:**
```bash
curl -X POST \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"prompt": "New custom prompt for this generation..."}' \
  "https://boss.notropolis.net/api/admin/assets/regenerate/123"
```

**Expected:** New asset uses custom prompt, original base_prompt preserved

### Test 3: Regenerate with New References
**Input:**
```bash
curl -X POST \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"reference_images": [{"type": "library", "id": 5}]}' \
  "https://boss.notropolis.net/api/admin/assets/regenerate/123"
```

**Verify:**
```sql
SELECT * FROM asset_reference_links WHERE asset_id = 124;
-- Should have new reference, not copied from 123
```

### Test 4: Regenerate with Settings Override
**Input:**
```bash
curl -X POST \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"generation_settings": {"temperature": 1.5}}' \
  "https://boss.notropolis.net/api/admin/assets/regenerate/123"
```

**Verify:**
```sql
SELECT generation_settings FROM generated_assets WHERE id = 124;
-- temperature should be 1.5, other settings inherited from original
```

### Test 5: Reference Links Copied When Not Overridden
**Setup:** Asset 123 has 2 reference links

**Input:**
```bash
curl -X POST \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{}' \
  "https://boss.notropolis.net/api/admin/assets/regenerate/123"
```

**Verify:**
```sql
SELECT COUNT(*) FROM asset_reference_links WHERE asset_id = 124;
-- Should be 2 (copied from 123)
```

### Test 6: Cannot Regenerate Pending Asset
**Input:** Regenerate an asset with status 'pending'

**Expected:**
```json
{
    "success": false,
    "error": "Cannot regenerate asset with status: pending"
}
```

---

## Acceptance Checklist

- [ ] Regenerate creates NEW asset record with incremented variant
- [ ] Old asset preserved with status 'completed' (not deleted)
- [ ] Custom prompt override works
- [ ] Custom details appended to prompt
- [ ] Reference images override works
- [ ] Reference links copied when not overridden
- [ ] Generation settings override works
- [ ] Settings inherited when not overridden
- [ ] Parent asset ID preserved for sprites
- [ ] auto_created and auto_created_from preserved
- [ ] New asset queued for generation
- [ ] Audit log includes all relevant info
- [ ] Cannot regenerate pending/generating assets
- [ ] API client updated with new signature

---

## Deployment

### Commands

```bash
cd authentication-dashboard-system
npm run deploy
```

### Verification

```bash
# 1. Find an asset to regenerate
curl -H "Authorization: Bearer <token>" \
  "https://boss.notropolis.net/api/admin/assets/list/building_ref" | jq '.assets[0]'

# 2. Regenerate it
curl -X POST \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{}' \
  "https://boss.notropolis.net/api/admin/assets/regenerate/<id>"

# 3. List to see both versions
curl -H "Authorization: Bearer <token>" \
  "https://boss.notropolis.net/api/admin/assets/list/building_ref" | jq '.assets[] | select(.asset_key == "<key>")'
```

---

## Handoff Notes

### For Stage 08 (Frontend Preview Modal)
- Regenerate now creates new version (response includes newAssetId)
- After regenerate, refresh list to show both old and new versions
- Old version visible with 'completed' status
- Show variant number clearly to distinguish versions

### For Version History
- All versions are preserved in generated_assets
- Query by category + asset_key, order by variant DESC
- Each version has its own reference links and settings
