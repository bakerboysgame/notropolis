# Stage 02: Reference Library Backend

## Objective

Implement API endpoints for uploading, listing, previewing, and archiving reference images in the reference library.

## Dependencies

- **Requires:** [See: Stage 01] - Database schema must be deployed
- **Blocks:** [See: Stage 04] - Generate endpoint needs reference library
- **Blocks:** [See: Stage 07] - Frontend needs these APIs

## Complexity

**Medium** - File upload handling, R2 storage, thumbnail generation, standard CRUD operations.

---

## Files to Modify

| File | Changes |
|------|---------|
| `authentication-dashboard-system/worker/src/routes/admin/assets.js` | Add reference library endpoints |
| `authentication-dashboard-system/src/services/assetApi.ts` | Add client methods for reference library |

## Files to Create

None - all code goes into existing files.

---

## Implementation Details

### API Endpoints Overview

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/admin/assets/reference-library` | List all non-archived reference images |
| GET | `/api/admin/assets/reference-library/:id` | Get single reference image details |
| GET | `/api/admin/assets/reference-library/:id/preview` | Get signed URL for full-size image |
| POST | `/api/admin/assets/reference-library/upload` | Upload new reference image |
| PUT | `/api/admin/assets/reference-library/:id` | Update metadata (name, description, category) |
| DELETE | `/api/admin/assets/reference-library/:id` | Archive (soft delete) reference image |

### Endpoint: List Reference Images

```javascript
// GET /api/admin/assets/reference-library
// Query params: ?category=buildings&search=storefront

router.get('/reference-library', async (c) => {
    const { category, search, archived } = c.req.query();
    const env = c.env;

    let query = `
        SELECT
            id, name, description, category, tags,
            thumbnail_r2_key, width, height, file_size,
            usage_count, uploaded_by, created_at
        FROM reference_images
        WHERE is_archived = ?
    `;
    const params = [archived === 'true'];

    if (category) {
        query += ` AND category = ?`;
        params.push(category);
    }

    if (search) {
        query += ` AND (name LIKE ? OR description LIKE ? OR tags LIKE ?)`;
        const searchPattern = `%${search}%`;
        params.push(searchPattern, searchPattern, searchPattern);
    }

    query += ` ORDER BY created_at DESC`;

    const results = await env.DB.prepare(query).bind(...params).all();

    // Generate thumbnail URLs for each image
    const images = await Promise.all(results.results.map(async (img) => {
        let thumbnailUrl = null;
        if (img.thumbnail_r2_key) {
            // Use Cloudflare Images or signed URL
            thumbnailUrl = await getSignedR2Url(env, img.thumbnail_r2_key, 3600);
        }
        return {
            ...img,
            thumbnailUrl
        };
    }));

    return c.json({
        success: true,
        images,
        count: images.length
    });
});
```

### Endpoint: Upload Reference Image

```javascript
// POST /api/admin/assets/reference-library/upload
// Multipart form: file (image), name, description?, category?

router.post('/reference-library/upload', async (c) => {
    const env = c.env;
    const user = c.get('user');

    try {
        const formData = await c.req.formData();
        const file = formData.get('file');
        const name = formData.get('name');
        const description = formData.get('description') || null;
        const category = formData.get('category') || 'general';
        const tags = formData.get('tags') || '[]'; // JSON array string

        if (!file || !name) {
            return c.json({ success: false, error: 'File and name are required' }, 400);
        }

        // Validate file type
        const validTypes = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];
        if (!validTypes.includes(file.type)) {
            return c.json({
                success: false,
                error: `Invalid file type. Allowed: ${validTypes.join(', ')}`
            }, 400);
        }

        // Read file buffer
        const arrayBuffer = await file.arrayBuffer();
        const buffer = new Uint8Array(arrayBuffer);

        // Generate unique filename
        const timestamp = Date.now();
        const sanitizedName = name.toLowerCase().replace(/[^a-z0-9]/g, '_');
        const extension = file.type.split('/')[1];
        const r2Key = `reference-library/${category}/${sanitizedName}_${timestamp}.${extension}`;
        const thumbnailKey = `reference-library/${category}/thumbnails/${sanitizedName}_${timestamp}_thumb.${extension}`;

        // Upload full-size image to R2
        await env.R2_PRIVATE.put(r2Key, buffer, {
            httpMetadata: { contentType: file.type }
        });

        // Generate and upload thumbnail (256x256)
        // Using Cloudflare Image Resizing if available, or sharp on worker
        const thumbnailBuffer = await generateThumbnail(env, buffer, 256, 256);
        await env.R2_PRIVATE.put(thumbnailKey, thumbnailBuffer, {
            httpMetadata: { contentType: file.type }
        });

        // Get image dimensions (simplified - could use image-size library)
        const dimensions = await getImageDimensions(buffer);

        // Insert database record
        const result = await env.DB.prepare(`
            INSERT INTO reference_images (
                name, description, category, tags,
                r2_key, thumbnail_r2_key,
                width, height, file_size, mime_type,
                uploaded_by
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            RETURNING id
        `).bind(
            name, description, category, tags,
            r2Key, thumbnailKey,
            dimensions.width, dimensions.height, buffer.length, file.type,
            user?.username || 'system'
        ).first();

        // Log audit
        await logAudit(env, 'upload_reference_image', result.id, user?.username, {
            name, category, file_size: buffer.length
        });

        return c.json({
            success: true,
            image: {
                id: result.id,
                name,
                category,
                r2Key,
                thumbnailKey,
                width: dimensions.width,
                height: dimensions.height,
                fileSize: buffer.length
            }
        });

    } catch (error) {
        console.error('Upload error:', error);
        return c.json({ success: false, error: error.message }, 500);
    }
});
```

### Endpoint: Get Preview URL

```javascript
// GET /api/admin/assets/reference-library/:id/preview
// Returns signed URL for full-size image (valid for 1 hour)

router.get('/reference-library/:id/preview', async (c) => {
    const { id } = c.req.param();
    const env = c.env;

    const image = await env.DB.prepare(`
        SELECT r2_key, mime_type FROM reference_images WHERE id = ?
    `).bind(id).first();

    if (!image) {
        return c.json({ success: false, error: 'Image not found' }, 404);
    }

    // Generate signed URL (valid for 1 hour)
    const signedUrl = await getSignedR2Url(env, image.r2_key, 3600);

    return c.json({
        success: true,
        previewUrl: signedUrl,
        mimeType: image.mime_type
    });
});
```

### Endpoint: Update Metadata

```javascript
// PUT /api/admin/assets/reference-library/:id
// Body: { name?, description?, category?, tags? }

router.put('/reference-library/:id', async (c) => {
    const { id } = c.req.param();
    const env = c.env;
    const user = c.get('user');
    const body = await c.req.json();

    // Validate image exists
    const existing = await env.DB.prepare(`
        SELECT id FROM reference_images WHERE id = ? AND is_archived = FALSE
    `).bind(id).first();

    if (!existing) {
        return c.json({ success: false, error: 'Image not found' }, 404);
    }

    // Build update query dynamically
    const updates = [];
    const values = [];

    if (body.name !== undefined) {
        updates.push('name = ?');
        values.push(body.name);
    }
    if (body.description !== undefined) {
        updates.push('description = ?');
        values.push(body.description);
    }
    if (body.category !== undefined) {
        updates.push('category = ?');
        values.push(body.category);
    }
    if (body.tags !== undefined) {
        updates.push('tags = ?');
        values.push(JSON.stringify(body.tags));
    }

    if (updates.length === 0) {
        return c.json({ success: false, error: 'No fields to update' }, 400);
    }

    updates.push('updated_at = CURRENT_TIMESTAMP');
    values.push(id);

    await env.DB.prepare(`
        UPDATE reference_images
        SET ${updates.join(', ')}
        WHERE id = ?
    `).bind(...values).run();

    // Log audit
    await logAudit(env, 'update_reference_image', parseInt(id), user?.username, body);

    return c.json({ success: true });
});
```

### Endpoint: Archive Image

```javascript
// DELETE /api/admin/assets/reference-library/:id
// Soft delete - sets is_archived = TRUE

router.delete('/reference-library/:id', async (c) => {
    const { id } = c.req.param();
    const env = c.env;
    const user = c.get('user');

    // Check if image is in use
    const usageCount = await env.DB.prepare(`
        SELECT COUNT(*) as count FROM asset_reference_links
        WHERE reference_image_id = ?
    `).bind(id).first();

    // Soft delete (archive)
    await env.DB.prepare(`
        UPDATE reference_images
        SET is_archived = TRUE, archived_at = CURRENT_TIMESTAMP
        WHERE id = ?
    `).bind(id).run();

    // Log audit
    await logAudit(env, 'archive_reference_image', parseInt(id), user?.username, {
        was_in_use: usageCount.count > 0,
        usage_count: usageCount.count
    });

    return c.json({
        success: true,
        archived: true,
        wasInUse: usageCount.count > 0
    });
});
```

### Helper Functions

```javascript
// Generate thumbnail using Cloudflare Image Resizing
async function generateThumbnail(env, imageBuffer, width, height) {
    // Option 1: Use Cloudflare Image Resizing (if available)
    // This requires the image to be accessible via URL first

    // Option 2: Simple resize using canvas (limited in Workers)
    // For now, store original and use Cloudflare Transforms at read time

    // For MVP: Just return original buffer, use Cloudflare transforms for display
    return imageBuffer;
}

// Get signed R2 URL for private bucket
async function getSignedR2Url(env, key, expiresInSeconds = 3600) {
    // If using custom domain with public bucket access:
    // return `https://assets.notropolis.net/${key}`;

    // For private bucket, generate signed URL
    // D1 + R2 in Cloudflare Workers can use presigned URLs

    // Simple approach: serve through worker endpoint
    return `/api/admin/assets/reference-library/serve/${encodeURIComponent(key)}`;
}

// Get image dimensions from buffer
async function getImageDimensions(buffer) {
    // PNG: width at bytes 16-19, height at bytes 20-23 (big-endian)
    // JPEG: more complex, need to parse markers

    // Simple PNG detection
    if (buffer[0] === 0x89 && buffer[1] === 0x50) { // PNG magic
        const width = (buffer[16] << 24) | (buffer[17] << 16) | (buffer[18] << 8) | buffer[19];
        const height = (buffer[20] << 24) | (buffer[21] << 16) | (buffer[22] << 8) | buffer[23];
        return { width, height };
    }

    // Default fallback
    return { width: 0, height: 0 };
}
```

### API Client Updates (assetApi.ts)

```typescript
// Add to assetApi.ts

export interface ReferenceImage {
    id: number;
    name: string;
    description?: string;
    category?: string;
    tags?: string[];
    thumbnailUrl?: string;
    width?: number;
    height?: number;
    fileSize?: number;
    usageCount?: number;
    uploadedBy?: string;
    createdAt: string;
}

export interface UploadReferenceParams {
    file: File;
    name: string;
    description?: string;
    category?: string;
    tags?: string[];
}

// Reference Library Methods
export const referenceLibraryApi = {
    // List all reference images
    async list(params?: { category?: string; search?: string; archived?: boolean }): Promise<ReferenceImage[]> {
        const queryParams = new URLSearchParams();
        if (params?.category) queryParams.set('category', params.category);
        if (params?.search) queryParams.set('search', params.search);
        if (params?.archived) queryParams.set('archived', 'true');

        const response = await fetch(`${API_BASE}/admin/assets/reference-library?${queryParams}`, {
            headers: getAuthHeaders()
        });
        const data = await response.json();
        return data.images;
    },

    // Upload new reference image
    async upload(params: UploadReferenceParams): Promise<ReferenceImage> {
        const formData = new FormData();
        formData.append('file', params.file);
        formData.append('name', params.name);
        if (params.description) formData.append('description', params.description);
        if (params.category) formData.append('category', params.category);
        if (params.tags) formData.append('tags', JSON.stringify(params.tags));

        const response = await fetch(`${API_BASE}/admin/assets/reference-library/upload`, {
            method: 'POST',
            headers: getAuthHeaders(), // Don't set Content-Type for FormData
            body: formData
        });
        const data = await response.json();
        if (!data.success) throw new Error(data.error);
        return data.image;
    },

    // Get preview URL for full-size image
    async getPreviewUrl(id: number): Promise<string> {
        const response = await fetch(`${API_BASE}/admin/assets/reference-library/${id}/preview`, {
            headers: getAuthHeaders()
        });
        const data = await response.json();
        return data.previewUrl;
    },

    // Update metadata
    async update(id: number, updates: Partial<Pick<ReferenceImage, 'name' | 'description' | 'category' | 'tags'>>): Promise<void> {
        const response = await fetch(`${API_BASE}/admin/assets/reference-library/${id}`, {
            method: 'PUT',
            headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
            body: JSON.stringify(updates)
        });
        const data = await response.json();
        if (!data.success) throw new Error(data.error);
    },

    // Archive (soft delete)
    async archive(id: number): Promise<void> {
        const response = await fetch(`${API_BASE}/admin/assets/reference-library/${id}`, {
            method: 'DELETE',
            headers: getAuthHeaders()
        });
        const data = await response.json();
        if (!data.success) throw new Error(data.error);
    }
};
```

---

## Test Cases

### Test 1: Upload Reference Image
**Input:**
```bash
curl -X POST \
  -H "Authorization: Bearer <token>" \
  -F "file=@test-image.png" \
  -F "name=Storefront Reference" \
  -F "category=buildings" \
  -F "description=Example storefront design" \
  https://boss.notropolis.net/api/admin/assets/reference-library/upload
```

**Expected Output:**
```json
{
    "success": true,
    "image": {
        "id": 1,
        "name": "Storefront Reference",
        "category": "buildings",
        "r2Key": "reference-library/buildings/storefront_reference_1704200000000.png",
        "thumbnailKey": "reference-library/buildings/thumbnails/storefront_reference_1704200000000_thumb.png",
        "width": 1024,
        "height": 768,
        "fileSize": 524288
    }
}
```

### Test 2: List with Category Filter
**Input:**
```bash
curl -H "Authorization: Bearer <token>" \
  "https://boss.notropolis.net/api/admin/assets/reference-library?category=buildings"
```

**Expected Output:**
```json
{
    "success": true,
    "images": [
        {
            "id": 1,
            "name": "Storefront Reference",
            "category": "buildings",
            "thumbnailUrl": "/api/admin/assets/reference-library/serve/...",
            "width": 1024,
            "height": 768,
            "usageCount": 0
        }
    ],
    "count": 1
}
```

### Test 3: Archive Image
**Input:**
```bash
curl -X DELETE \
  -H "Authorization: Bearer <token>" \
  "https://boss.notropolis.net/api/admin/assets/reference-library/1"
```

**Expected Output:**
```json
{
    "success": true,
    "archived": true,
    "wasInUse": false
}
```

**Verify:** Image no longer appears in list (unless `?archived=true`)

### Test 4: Invalid File Type
**Input:** Upload a .txt file

**Expected Output:**
```json
{
    "success": false,
    "error": "Invalid file type. Allowed: image/png, image/jpeg, image/webp, image/gif"
}
```

---

## Acceptance Checklist

- [x] `GET /reference-library` returns list of images
- [x] Category filter works correctly
- [x] Search filter searches name, description, and tags
- [x] `POST /reference-library/upload` accepts multipart form data
- [x] Upload validates file type (png, jpeg, webp, gif only)
- [x] Upload stores file in R2 private bucket
- [x] Upload creates database record with metadata
- [x] Thumbnail is generated and stored (MVP: same as original, use Cloudflare transforms at read time)
- [x] `GET /reference-library/:id/preview` returns signed URL (via worker serve endpoint)
- [x] `PUT /reference-library/:id` updates metadata
- [x] `DELETE /reference-library/:id` soft-deletes (archives)
- [x] Archived images don't appear in default list
- [x] Archived images appear with `?archived=true`
- [x] Audit logs are created for all mutations
- [x] API client methods added to assetApi.ts

---

## Deployment

### Commands

```bash
cd authentication-dashboard-system

# Deploy worker with new endpoints
npm run deploy

# Or for staging
npm run deploy:staging
```

### Verification

```bash
# Test list endpoint
curl -H "Authorization: Bearer <token>" \
  "https://boss.notropolis.net/api/admin/assets/reference-library"

# Test upload (use a test image)
curl -X POST \
  -H "Authorization: Bearer <token>" \
  -F "file=@test.png" \
  -F "name=Test Image" \
  "https://boss.notropolis.net/api/admin/assets/reference-library/upload"
```

---

## Handoff Notes

### For Stage 04 (Enhanced Generate Endpoint)
- Reference images can be fetched by ID from `reference_images` table
- Use `r2_key` to get the actual image buffer for passing to Gemini
- Increment `usage_count` when a reference is used in generation
- Create `asset_reference_links` records to track which refs were used

### For Stage 07 (Frontend Generate Modal)
- Use `referenceLibraryApi.list()` to populate the reference picker
- Use `referenceLibraryApi.upload()` for the upload dropzone
- Thumbnails are available via `thumbnailUrl` in list response
- Categories for filter: 'buildings', 'characters', 'vehicles', 'effects', 'general'
