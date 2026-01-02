# Stage 01: Database Schema

## Objective

Create database migration with new tables for reference images, asset-reference links, and prompt templates; add new columns to generated_assets for generation settings and auto-creation tracking.

## Dependencies

- **Requires:** None (this is the first stage)
- **Blocks:** All subsequent stages

## Complexity

**Medium** - Multiple table creations and ALTER statements; requires careful consideration of foreign keys and indexes.

---

## Files to Create

| File | Purpose |
|------|---------|
| `authentication-dashboard-system/migrations/0026_asset_generation_overhaul.sql` | Main migration with all schema changes |

## Files to Modify

None - this stage only creates database objects.

---

## Database Changes

### New Table: `reference_images`

Stores uploaded reference images for the reference library.

```sql
CREATE TABLE IF NOT EXISTS reference_images (
    id INTEGER PRIMARY KEY AUTOINCREMENT,

    -- Metadata
    name TEXT NOT NULL,                    -- User-friendly display name
    description TEXT,                      -- Optional description/notes
    category TEXT,                         -- Filter category: 'buildings', 'characters', 'vehicles', 'effects', 'general'
    tags TEXT,                             -- JSON array of tags for search

    -- Storage
    r2_key TEXT NOT NULL,                  -- R2 private bucket key (full path)
    thumbnail_r2_key TEXT,                 -- Thumbnail R2 key for grid display (256x256)

    -- Image properties
    width INTEGER,                         -- Original width in pixels
    height INTEGER,                        -- Original height in pixels
    file_size INTEGER,                     -- File size in bytes
    mime_type TEXT DEFAULT 'image/png',    -- MIME type

    -- Tracking
    uploaded_by TEXT,                      -- Username who uploaded
    usage_count INTEGER DEFAULT 0,         -- How many times used in generations

    -- Timestamps
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,

    -- Soft delete
    is_archived BOOLEAN DEFAULT FALSE,
    archived_at DATETIME
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_ref_images_category ON reference_images(category);
CREATE INDEX IF NOT EXISTS idx_ref_images_archived ON reference_images(is_archived);
CREATE INDEX IF NOT EXISTS idx_ref_images_created ON reference_images(created_at DESC);
```

### New Table: `asset_reference_links`

Links reference images (from library or approved assets) to generated assets.

```sql
CREATE TABLE IF NOT EXISTS asset_reference_links (
    id INTEGER PRIMARY KEY AUTOINCREMENT,

    -- The generated asset this reference was used for
    asset_id INTEGER NOT NULL,

    -- The reference source (one of these must be set)
    reference_image_id INTEGER,            -- From reference_images table (uploaded)
    approved_asset_id INTEGER,             -- From generated_assets table (approved asset as ref)

    -- Link metadata
    link_type TEXT NOT NULL,               -- 'library' or 'approved_asset'
    sort_order INTEGER DEFAULT 0,          -- Order refs are passed to Gemini (0 = first)

    -- Timestamps
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,

    -- Foreign keys
    FOREIGN KEY (asset_id) REFERENCES generated_assets(id) ON DELETE CASCADE,
    FOREIGN KEY (reference_image_id) REFERENCES reference_images(id) ON DELETE SET NULL,
    FOREIGN KEY (approved_asset_id) REFERENCES generated_assets(id) ON DELETE SET NULL,

    -- Ensure exactly one reference type is set
    CHECK (
        (reference_image_id IS NOT NULL AND approved_asset_id IS NULL AND link_type = 'library') OR
        (reference_image_id IS NULL AND approved_asset_id IS NOT NULL AND link_type = 'approved_asset')
    )
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_asset_refs_asset ON asset_reference_links(asset_id);
CREATE INDEX IF NOT EXISTS idx_asset_refs_image ON asset_reference_links(reference_image_id);
CREATE INDEX IF NOT EXISTS idx_asset_refs_approved ON asset_reference_links(approved_asset_id);
```

### New Table: `prompt_templates`

Stores editable prompt templates per category/asset_key (replaces hardcoded prompts).

```sql
CREATE TABLE IF NOT EXISTS prompt_templates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,

    -- Template identification
    category TEXT NOT NULL,                -- Asset category (building_ref, building_sprite, etc.)
    asset_key TEXT NOT NULL,               -- Specific asset type (restaurant, bank, etc.) or '_default'
    template_name TEXT,                    -- Optional friendly name

    -- Prompt content
    base_prompt TEXT NOT NULL,             -- The editable prompt template
    style_guide TEXT,                      -- Style guide additions (appended to prompt)
    system_instructions TEXT,              -- Any system-level instructions

    -- Versioning
    version INTEGER DEFAULT 1,             -- Version number for history
    is_active BOOLEAN DEFAULT TRUE,        -- Whether this is the current active version

    -- Tracking
    created_by TEXT,                       -- Username who created/edited
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,

    -- Notes
    change_notes TEXT                      -- Description of what changed in this version
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_prompt_templates_lookup ON prompt_templates(category, asset_key, is_active);
CREATE INDEX IF NOT EXISTS idx_prompt_templates_category ON prompt_templates(category);

-- Unique constraint: only one active version per category/asset_key
CREATE UNIQUE INDEX IF NOT EXISTS idx_prompt_templates_active
ON prompt_templates(category, asset_key) WHERE is_active = TRUE;
```

### Alter Table: `generated_assets`

Add columns for generation settings and auto-creation tracking.

```sql
-- Store Gemini generation settings as JSON
ALTER TABLE generated_assets ADD COLUMN generation_settings TEXT;

-- Track auto-created sprites from reference approval
ALTER TABLE generated_assets ADD COLUMN auto_created BOOLEAN DEFAULT FALSE;
ALTER TABLE generated_assets ADD COLUMN auto_created_from INTEGER REFERENCES generated_assets(id);

-- Track active asset for a given category/asset_key (only one can be active)
ALTER TABLE generated_assets ADD COLUMN is_active BOOLEAN DEFAULT FALSE;

-- Indexes for finding auto-created and active assets
CREATE INDEX IF NOT EXISTS idx_assets_auto_created ON generated_assets(auto_created_from);
CREATE INDEX IF NOT EXISTS idx_assets_active ON generated_assets(category, asset_key, is_active);
```

### Generation Settings JSON Schema

The `generation_settings` column stores a JSON object:

```json
{
    "temperature": 0.7,
    "topK": 40,
    "topP": 0.95,
    "model": "gemini-3-pro-image-preview",
    "responseModalities": ["IMAGE", "TEXT"],
    "maxOutputTokens": null
}
```

---

## Implementation Details

### Full Migration File

```sql
-- Migration: 0026_asset_generation_overhaul.sql
-- Purpose: Add tables for reference image library, prompt templates, and generation settings
-- Author: Asset Admin Overhaul Plan
-- Date: 2026-01-02

-- ============================================
-- REFERENCE IMAGE LIBRARY
-- Stores uploaded reference images for generation context
-- ============================================

CREATE TABLE IF NOT EXISTS reference_images (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,
    category TEXT,
    tags TEXT,
    r2_key TEXT NOT NULL,
    thumbnail_r2_key TEXT,
    width INTEGER,
    height INTEGER,
    file_size INTEGER,
    mime_type TEXT DEFAULT 'image/png',
    uploaded_by TEXT,
    usage_count INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    is_archived BOOLEAN DEFAULT FALSE,
    archived_at DATETIME
);

CREATE INDEX IF NOT EXISTS idx_ref_images_category ON reference_images(category);
CREATE INDEX IF NOT EXISTS idx_ref_images_archived ON reference_images(is_archived);
CREATE INDEX IF NOT EXISTS idx_ref_images_created ON reference_images(created_at DESC);

-- ============================================
-- ASSET REFERENCE LINKS
-- Links reference images to specific generations
-- ============================================

CREATE TABLE IF NOT EXISTS asset_reference_links (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    asset_id INTEGER NOT NULL,
    reference_image_id INTEGER,
    approved_asset_id INTEGER,
    link_type TEXT NOT NULL,
    sort_order INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (asset_id) REFERENCES generated_assets(id) ON DELETE CASCADE,
    FOREIGN KEY (reference_image_id) REFERENCES reference_images(id) ON DELETE SET NULL,
    FOREIGN KEY (approved_asset_id) REFERENCES generated_assets(id) ON DELETE SET NULL,
    CHECK (
        (reference_image_id IS NOT NULL AND approved_asset_id IS NULL AND link_type = 'library') OR
        (reference_image_id IS NULL AND approved_asset_id IS NOT NULL AND link_type = 'approved_asset')
    )
);

CREATE INDEX IF NOT EXISTS idx_asset_refs_asset ON asset_reference_links(asset_id);
CREATE INDEX IF NOT EXISTS idx_asset_refs_image ON asset_reference_links(reference_image_id);
CREATE INDEX IF NOT EXISTS idx_asset_refs_approved ON asset_reference_links(approved_asset_id);

-- ============================================
-- PROMPT TEMPLATES
-- Editable prompts per category/asset_key (replaces hardcoded)
-- ============================================

CREATE TABLE IF NOT EXISTS prompt_templates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    category TEXT NOT NULL,
    asset_key TEXT NOT NULL,
    template_name TEXT,
    base_prompt TEXT NOT NULL,
    style_guide TEXT,
    system_instructions TEXT,
    version INTEGER DEFAULT 1,
    is_active BOOLEAN DEFAULT TRUE,
    created_by TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    change_notes TEXT
);

CREATE INDEX IF NOT EXISTS idx_prompt_templates_lookup ON prompt_templates(category, asset_key, is_active);
CREATE INDEX IF NOT EXISTS idx_prompt_templates_category ON prompt_templates(category);

-- ============================================
-- ALTER GENERATED_ASSETS
-- Add generation settings and auto-creation tracking
-- ============================================

-- Add new columns (will error if already exist - run migration only once)
ALTER TABLE generated_assets ADD COLUMN generation_settings TEXT;
ALTER TABLE generated_assets ADD COLUMN auto_created BOOLEAN DEFAULT FALSE;
ALTER TABLE generated_assets ADD COLUMN auto_created_from INTEGER;
ALTER TABLE generated_assets ADD COLUMN is_active BOOLEAN DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_assets_auto_created ON generated_assets(auto_created_from);
CREATE INDEX IF NOT EXISTS idx_assets_active ON generated_assets(category, asset_key, is_active);

-- ============================================
-- VIEWS FOR COMMON QUERIES
-- ============================================

-- View: Active prompt templates
CREATE VIEW IF NOT EXISTS v_active_prompt_templates AS
SELECT
    id,
    category,
    asset_key,
    template_name,
    base_prompt,
    style_guide,
    system_instructions,
    version,
    created_by,
    updated_at
FROM prompt_templates
WHERE is_active = TRUE;

-- View: Reference library (non-archived)
CREATE VIEW IF NOT EXISTS v_reference_library AS
SELECT
    id,
    name,
    description,
    category,
    tags,
    r2_key,
    thumbnail_r2_key,
    width,
    height,
    file_size,
    usage_count,
    uploaded_by,
    created_at
FROM reference_images
WHERE is_archived = FALSE
ORDER BY created_at DESC;

-- View: Asset with references
CREATE VIEW IF NOT EXISTS v_asset_references AS
SELECT
    ga.id AS asset_id,
    ga.category,
    ga.asset_key,
    ga.status,
    arl.id AS link_id,
    arl.link_type,
    arl.sort_order,
    CASE
        WHEN arl.link_type = 'library' THEN ri.name
        WHEN arl.link_type = 'approved_asset' THEN ref_asset.asset_key || ' v' || ref_asset.variant
    END AS reference_name,
    CASE
        WHEN arl.link_type = 'library' THEN ri.thumbnail_r2_key
        WHEN arl.link_type = 'approved_asset' THEN ref_asset.r2_key_private
    END AS reference_thumbnail
FROM generated_assets ga
LEFT JOIN asset_reference_links arl ON ga.id = arl.asset_id
LEFT JOIN reference_images ri ON arl.reference_image_id = ri.id
LEFT JOIN generated_assets ref_asset ON arl.approved_asset_id = ref_asset.id;
```

---

## Test Cases

### Test 1: Create reference_images table
**Input:** Run migration
**Expected:** Table exists with all columns and indexes

```sql
-- Verify table structure
PRAGMA table_info(reference_images);
-- Should return 14 columns

-- Verify indexes
SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='reference_images';
-- Should include: idx_ref_images_category, idx_ref_images_archived, idx_ref_images_created
```

### Test 2: Create asset_reference_links table with constraint
**Input:** Run migration
**Expected:** Table exists; constraint prevents invalid data

```sql
-- Valid: library reference
INSERT INTO asset_reference_links (asset_id, reference_image_id, link_type, sort_order)
VALUES (1, 1, 'library', 0);
-- Should succeed

-- Invalid: wrong link_type for reference_image_id
INSERT INTO asset_reference_links (asset_id, reference_image_id, link_type, sort_order)
VALUES (1, 1, 'approved_asset', 0);
-- Should fail with CHECK constraint violation

-- Invalid: both references set
INSERT INTO asset_reference_links (asset_id, reference_image_id, approved_asset_id, link_type, sort_order)
VALUES (1, 1, 2, 'library', 0);
-- Should fail with CHECK constraint violation
```

### Test 3: Create prompt_templates table
**Input:** Run migration
**Expected:** Table exists; unique active constraint works

```sql
-- First active template
INSERT INTO prompt_templates (category, asset_key, base_prompt, is_active)
VALUES ('building_ref', 'restaurant', 'Generate a restaurant...', TRUE);
-- Should succeed

-- Second active template for same category/asset_key
INSERT INTO prompt_templates (category, asset_key, base_prompt, is_active)
VALUES ('building_ref', 'restaurant', 'Different prompt...', TRUE);
-- Should fail with UNIQUE constraint violation

-- Second inactive version (allowed)
INSERT INTO prompt_templates (category, asset_key, base_prompt, is_active, version)
VALUES ('building_ref', 'restaurant', 'Different prompt...', FALSE, 2);
-- Should succeed
```

### Test 4: Alter generated_assets
**Input:** Run migration
**Expected:** New columns exist with defaults

```sql
-- Verify new columns
PRAGMA table_info(generated_assets);
-- Should include: generation_settings, auto_created, auto_created_from, is_active

-- Test defaults
INSERT INTO generated_assets (category, asset_key, base_prompt, current_prompt, status)
VALUES ('test', 'test', 'prompt', 'prompt', 'pending');
SELECT auto_created, generation_settings, is_active FROM generated_assets WHERE category = 'test';
-- Should return: auto_created=FALSE (or 0), generation_settings=NULL, is_active=FALSE (or 0)
```

### Test 5: Views work correctly
**Input:** Run migration and insert test data
**Expected:** Views return correct data

```sql
-- Test v_active_prompt_templates
SELECT * FROM v_active_prompt_templates WHERE category = 'building_ref';
-- Should return active templates only

-- Test v_reference_library
SELECT * FROM v_reference_library;
-- Should return non-archived references ordered by created_at DESC
```

---

## Acceptance Checklist

- [x] Migration file created at correct path
- [x] `reference_images` table created with all columns (17 columns)
- [x] `reference_images` indexes created (3 indexes)
- [x] `asset_reference_links` table created with CHECK constraint (verified working)
- [x] `asset_reference_links` foreign keys work (cascade delete)
- [x] `prompt_templates` table created (**NOTE**: partial unique index for is_active=TRUE did not work in D1 - enforce in application code)
- [x] `generated_assets` has new columns: generation_settings, auto_created, auto_created_from (is_active already existed)
- [x] All views created successfully (v_active_prompt_templates, v_reference_library, v_asset_references)
- [ ] Migration is idempotent - NOT idempotent due to ALTER TABLE statements; run only once
- [x] Existing data in generated_assets is not affected

---

## Deployment

### Commands

```bash
# Navigate to worker directory
cd authentication-dashboard-system

# Run migration on production (remote)
npx wrangler d1 execute notropolis-database --remote --file=migrations/0026_asset_generation_overhaul.sql
```

### Verification

```bash
# Verify tables exist
npx wrangler d1 execute notropolis-database --remote --command "SELECT name FROM sqlite_master WHERE type='table' AND name IN ('reference_images', 'asset_reference_links', 'prompt_templates');"

# Verify generated_assets columns
npx wrangler d1 execute notropolis-database --remote --command "PRAGMA table_info(generated_assets);" | grep -E "generation_settings|auto_created|is_active"
```

---

## Handoff Notes

### For Stage 02 (Reference Library Backend)
- `reference_images` table is ready for CRUD operations
- Use `r2_key` for full-size image, `thumbnail_r2_key` for 256x256 preview
- Set `uploaded_by` from authenticated user
- Increment `usage_count` when image is used in generation

### For Stage 03 (Prompt Templates Backend)
- `prompt_templates` table is ready
- Use `is_active = TRUE` to get current template
- When updating, set old version `is_active = FALSE`, create new row with `is_active = TRUE`
- `_default` asset_key for category-wide defaults
- **NOTE**: The partial unique index for `is_active=TRUE` did not work in D1. Enforce uniqueness in application code when setting `is_active=TRUE`.

### For Stage 04 (Enhanced Generate Endpoint)
- Store Gemini settings in `generation_settings` as JSON
- Create `asset_reference_links` rows for each reference used
- Set `sort_order` based on order user selected references

### For Stage 05 (Auto-Sprite Creation)
- Set `auto_created = TRUE` and `auto_created_from = <ref_id>` for auto-spawned sprites

### For Frontend Stages
- Views (`v_reference_library`, `v_asset_references`) are available for efficient queries

### For Stage 10 (Asset Manager)
- `base_ground` category should be added to `asset_categories` table
- Base ground assets are terrain tiles that appear BEHIND all other terrain
- Only ONE base ground can be active at a time (configurable in Asset Manager)
- Insert seed data for `base_ground` category:

```sql
-- Add base_ground category (run separately or add to 0028 migration)
INSERT OR REPLACE INTO asset_categories (id, name, description, parent_category, requires_approval, requires_background_removal) VALUES
    ('base_ground', 'Base Ground', 'Seamless tiling ground texture that appears behind all terrain', NULL, TRUE, TRUE);
```

### Base Ground Asset Notes
- Category: `base_ground`
- Asset keys: `grass`, `desert_sand`, `tundra_snow`, etc.
- Size: 64x32 pixel isometric diamond (matches terrain tiles)
- Must tile seamlessly in all directions
- Stored in R2: `/sprites/base_ground/base_ground_grass.webp`
- Only one base ground is "active" per game map configuration
