# Stage 12: R2 Asset Archival

## Objective

Archive all existing generated assets (except avatars) to make way for fresh assets with corrected specifications. This is a one-time cleanup operation.

## Prerequisites

- All stages 1-10 complete
- UI testing (Stage 11) complete
- Backup plan understood
- Off-peak hours recommended

---

## What Gets Archived

| Category | R2 Path | Action |
|----------|---------|--------|
| Building refs | `sprites/building_ref/` | Archive |
| Building sprites | `sprites/building_sprite/` | Archive |
| Terrain refs | `sprites/terrain_ref/` | Archive |
| Terrain sprites | `sprites/terrain_sprite/` | Archive |
| NPC refs | `sprites/npc_ref/` | Archive |
| NPC sprites | `sprites/npc_sprite/` | Archive |
| Vehicle refs | `sprites/vehicle_ref/` | Archive |
| Vehicle sprites | `sprites/vehicle_sprite/` | Archive |
| Effect refs | `sprites/effect_ref/` | Archive |
| Effect sprites | `sprites/effect_sprite/` | Archive |
| **Avatars** | `sprites/avatars/` | **KEEP - DO NOT TOUCH** |
| Reference Library | `reference-library/` | **KEEP** |

---

## R2 Bucket Information

```
Public Bucket: notropolis-game-assets
Private Bucket: notropolis-assets-private
```

---

## Step 1: Audit Current R2 Contents

First, understand what exists in the buckets.

### 1.1 List Public Bucket Contents

```bash
cd /Users/riki/notropolis/authentication-dashboard-system

# List all top-level folders
CLOUDFLARE_API_TOKEN="RQeVAceZ3VT-McbFF9DnYem0ZDc8YXbnHPH8wbg_" \
CLOUDFLARE_ACCOUNT_ID="329dc0e016dd5cd512d6566d64d8aa0c" \
npx wrangler r2 object list notropolis-game-assets --prefix="" 2>&1 | head -50
```

### 1.2 Count Assets by Category

```bash
# Count building assets
CLOUDFLARE_API_TOKEN="RQeVAceZ3VT-McbFF9DnYem0ZDc8YXbnHPH8wbg_" \
CLOUDFLARE_ACCOUNT_ID="329dc0e016dd5cd512d6566d64d8aa0c" \
npx wrangler r2 object list notropolis-game-assets --prefix="sprites/building" 2>&1 | grep -c "key"

# Count terrain assets
CLOUDFLARE_API_TOKEN="RQeVAceZ3VT-McbFF9DnYem0ZDc8YXbnHPH8wbg_" \
CLOUDFLARE_ACCOUNT_ID="329dc0e016dd5cd512d6566d64d8aa0c" \
npx wrangler r2 object list notropolis-game-assets --prefix="sprites/terrain" 2>&1 | grep -c "key"

# Count avatar assets (these stay)
CLOUDFLARE_API_TOKEN="RQeVAceZ3VT-McbFF9DnYem0ZDc8YXbnHPH8wbg_" \
CLOUDFLARE_ACCOUNT_ID="329dc0e016dd5cd512d6566d64d8aa0c" \
npx wrangler r2 object list notropolis-game-assets --prefix="sprites/avatar" 2>&1 | grep -c "key"
```

### 1.3 Document Current State

Record the counts before archival:

| Category | Public Count | Private Count |
|----------|--------------|---------------|
| building_ref | | |
| building_sprite | | |
| terrain_ref | | |
| terrain_sprite | | |
| npc_ref | | |
| npc_sprite | | |
| vehicle_ref | | |
| vehicle_sprite | | |
| effect_ref | | |
| effect_sprite | | |
| avatars (KEEP) | | |
| **TOTAL to archive** | | |

---

## Step 2: Create Archive Script

Create a Python script to handle the archival since wrangler doesn't have a native "move" command.

### 2.1 Create Archive Script

```python
# save as: scripts/archive_r2_assets.py

import subprocess
import json
import sys
from datetime import datetime

# Configuration
ACCOUNT_ID = "329dc0e016dd5cd512d6566d64d8aa0c"
API_TOKEN = "RQeVAceZ3VT-McbFF9DnYem0ZDc8YXbnHPH8wbg_"
PUBLIC_BUCKET = "notropolis-game-assets"
PRIVATE_BUCKET = "notropolis-assets-private"
ARCHIVE_PREFIX = f"archive/2026-01-pre-overhaul"

# Categories to archive (NOT avatars)
CATEGORIES_TO_ARCHIVE = [
    "sprites/building_ref",
    "sprites/building_sprite",
    "sprites/terrain_ref",
    "sprites/terrain_sprite",
    "sprites/npc_ref",
    "sprites/npc_sprite",
    "sprites/vehicle_ref",
    "sprites/vehicle_sprite",
    "sprites/effect_ref",
    "sprites/effect_sprite",
]

def run_wrangler(args):
    """Run a wrangler command and return output"""
    env = {
        "CLOUDFLARE_API_TOKEN": API_TOKEN,
        "CLOUDFLARE_ACCOUNT_ID": ACCOUNT_ID,
        "PATH": "/usr/local/bin:/usr/bin:/bin"
    }
    cmd = ["npx", "wrangler"] + args
    result = subprocess.run(cmd, capture_output=True, text=True, env=env, cwd="/Users/riki/notropolis/authentication-dashboard-system")
    return result.stdout, result.stderr

def list_objects(bucket, prefix):
    """List all objects with a given prefix"""
    stdout, stderr = run_wrangler(["r2", "object", "list", bucket, f"--prefix={prefix}"])
    # Parse the output to get keys
    objects = []
    for line in stdout.split('\n'):
        if '"key":' in line:
            # Extract key from JSON-like output
            key = line.split('"key":')[1].split('"')[1]
            objects.append(key)
    return objects

def copy_object(bucket, source_key, dest_key):
    """Copy an object within the same bucket"""
    # Download then upload (wrangler doesn't have copy)
    # For large operations, consider using the R2 API directly
    print(f"  Archiving: {source_key} -> {dest_key}")
    # This is a placeholder - actual implementation needs R2 API
    pass

def main():
    print(f"R2 Asset Archival Script")
    print(f"Archive prefix: {ARCHIVE_PREFIX}")
    print(f"=" * 60)

    dry_run = "--dry-run" in sys.argv
    if dry_run:
        print("DRY RUN MODE - No changes will be made")

    total_files = 0

    for category in CATEGORIES_TO_ARCHIVE:
        print(f"\nProcessing: {category}")
        objects = list_objects(PUBLIC_BUCKET, category)
        print(f"  Found {len(objects)} objects")
        total_files += len(objects)

        if not dry_run:
            for obj in objects:
                new_key = obj.replace("sprites/", f"{ARCHIVE_PREFIX}/")
                copy_object(PUBLIC_BUCKET, obj, new_key)

    print(f"\n{'=' * 60}")
    print(f"Total files to archive: {total_files}")

    if dry_run:
        print("\nRun without --dry-run to perform actual archival")

if __name__ == "__main__":
    main()
```

### 2.2 Alternative: Use rclone

If you have rclone configured with Cloudflare R2:

```bash
# Configure rclone for R2 (one-time setup)
rclone config

# Name: r2
# Type: s3
# Provider: Cloudflare
# Access Key ID: (from R2 dashboard)
# Secret Access Key: (from R2 dashboard)
# Endpoint: https://<account_id>.r2.cloudflarestorage.com

# Then move files:
rclone move r2:notropolis-game-assets/sprites/building_ref r2:notropolis-game-assets/archive/2026-01-pre-overhaul/building_ref --dry-run
rclone move r2:notropolis-game-assets/sprites/building_sprite r2:notropolis-game-assets/archive/2026-01-pre-overhaul/building_sprite --dry-run
# ... repeat for other categories (NOT avatars)
```

---

## Step 3: Archive R2 Assets

### 3.1 Execute Archival (Dry Run First)

```bash
# Dry run - see what would be moved
python3 scripts/archive_r2_assets.py --dry-run

# If using rclone:
rclone move r2:notropolis-game-assets/sprites/building_ref r2:notropolis-game-assets/archive/2026-01-pre-overhaul/building_ref --dry-run
```

### 3.2 Execute Archival (For Real)

```bash
# CAUTION: This moves files permanently
python3 scripts/archive_r2_assets.py

# Or with rclone (remove --dry-run):
rclone move r2:notropolis-game-assets/sprites/building_ref r2:notropolis-game-assets/archive/2026-01-pre-overhaul/building_ref
rclone move r2:notropolis-game-assets/sprites/building_sprite r2:notropolis-game-assets/archive/2026-01-pre-overhaul/building_sprite
rclone move r2:notropolis-game-assets/sprites/terrain_ref r2:notropolis-game-assets/archive/2026-01-pre-overhaul/terrain_ref
rclone move r2:notropolis-game-assets/sprites/terrain_sprite r2:notropolis-game-assets/archive/2026-01-pre-overhaul/terrain_sprite
rclone move r2:notropolis-game-assets/sprites/npc_ref r2:notropolis-game-assets/archive/2026-01-pre-overhaul/npc_ref
rclone move r2:notropolis-game-assets/sprites/npc_sprite r2:notropolis-game-assets/archive/2026-01-pre-overhaul/npc_sprite
rclone move r2:notropolis-game-assets/sprites/vehicle_ref r2:notropolis-game-assets/archive/2026-01-pre-overhaul/vehicle_ref
rclone move r2:notropolis-game-assets/sprites/vehicle_sprite r2:notropolis-game-assets/archive/2026-01-pre-overhaul/vehicle_sprite
rclone move r2:notropolis-game-assets/sprites/effect_ref r2:notropolis-game-assets/archive/2026-01-pre-overhaul/effect_ref
rclone move r2:notropolis-game-assets/sprites/effect_sprite r2:notropolis-game-assets/archive/2026-01-pre-overhaul/effect_sprite
```

### 3.3 Repeat for Private Bucket

```bash
# Same process for private bucket
rclone move r2:notropolis-assets-private/sprites/building_ref r2:notropolis-assets-private/archive/2026-01-pre-overhaul/building_ref
# ... etc
```

---

## Step 4: Update Database

Mark archived assets in the database.

### 4.1 Count Assets to Update

```bash
cd /Users/riki/notropolis/authentication-dashboard-system

CLOUDFLARE_API_TOKEN="RQeVAceZ3VT-McbFF9DnYem0ZDc8YXbnHPH8wbg_" \
CLOUDFLARE_ACCOUNT_ID="329dc0e016dd5cd512d6566d64d8aa0c" \
npx wrangler d1 execute notropolis-database --remote --command "
SELECT category, COUNT(*) as count
FROM generated_assets
WHERE category NOT LIKE '%avatar%'
  AND status IN ('approved', 'review', 'pending', 'rejected', 'generating')
GROUP BY category
ORDER BY category;
"
```

### 4.2 Create Migration for Archival

```sql
-- migrations/0030_archive_pre_overhaul_assets.sql

-- Mark all non-avatar assets as archived
-- This preserves the records but indicates they're no longer active

UPDATE generated_assets
SET
    status = 'archived',
    updated_at = CURRENT_TIMESTAMP
WHERE category NOT LIKE '%avatar%'
  AND category NOT LIKE '%reference_library%'
  AND status != 'archived';

-- Clear R2 URLs since files have moved
UPDATE generated_assets
SET
    r2_url = NULL,
    r2_key_private = NULL,
    r2_key_public = NULL
WHERE status = 'archived';

-- Log the archival
INSERT INTO asset_audit_log (action, asset_id, actor, details, created_at)
VALUES ('bulk_archive', NULL, 'system', '{"reason": "pre-overhaul cleanup", "date": "2026-01-02"}', CURRENT_TIMESTAMP);
```

### 4.3 Run Migration

```bash
cd /Users/riki/notropolis/authentication-dashboard-system

CLOUDFLARE_API_TOKEN="RQeVAceZ3VT-McbFF9DnYem0ZDc8YXbnHPH8wbg_" \
CLOUDFLARE_ACCOUNT_ID="329dc0e016dd5cd512d6566d64d8aa0c" \
npx wrangler d1 execute notropolis-database --remote --file=migrations/0030_archive_pre_overhaul_assets.sql
```

---

## Step 5: Clear Building Configurations

Reset building configurations to point to nothing (they'll need new sprites).

```bash
CLOUDFLARE_API_TOKEN="RQeVAceZ3VT-McbFF9DnYem0ZDc8YXbnHPH8wbg_" \
CLOUDFLARE_ACCOUNT_ID="329dc0e016dd5cd512d6566d64d8aa0c" \
npx wrangler d1 execute notropolis-database --remote --command "
UPDATE building_configurations
SET
    active_sprite_id = NULL,
    is_published = FALSE,
    published_at = NULL,
    published_by = NULL,
    updated_at = CURRENT_TIMESTAMP;
"
```

---

## Step 6: Verify Archival

### 6.1 Verify R2 Archive Exists

```bash
# Check archive folder has content
CLOUDFLARE_API_TOKEN="RQeVAceZ3VT-McbFF9DnYem0ZDc8YXbnHPH8wbg_" \
CLOUDFLARE_ACCOUNT_ID="329dc0e016dd5cd512d6566d64d8aa0c" \
npx wrangler r2 object list notropolis-game-assets --prefix="archive/2026-01-pre-overhaul" 2>&1 | head -20
```

### 6.2 Verify Original Locations Empty

```bash
# Should return 0 or empty (except avatars)
CLOUDFLARE_API_TOKEN="RQeVAceZ3VT-McbFF9DnYem0ZDc8YXbnHPH8wbg_" \
CLOUDFLARE_ACCOUNT_ID="329dc0e016dd5cd512d6566d64d8aa0c" \
npx wrangler r2 object list notropolis-game-assets --prefix="sprites/building" 2>&1 | grep -c "key"
```

### 6.3 Verify Avatars Untouched

```bash
# Should still have avatar files
CLOUDFLARE_API_TOKEN="RQeVAceZ3VT-McbFF9DnYem0ZDc8YXbnHPH8wbg_" \
CLOUDFLARE_ACCOUNT_ID="329dc0e016dd5cd512d6566d64d8aa0c" \
npx wrangler r2 object list notropolis-game-assets --prefix="sprites/avatar" 2>&1 | grep -c "key"
```

### 6.4 Verify Database Updates

```bash
CLOUDFLARE_API_TOKEN="RQeVAceZ3VT-McbFF9DnYem0ZDc8YXbnHPH8wbg_" \
CLOUDFLARE_ACCOUNT_ID="329dc0e016dd5cd512d6566d64d8aa0c" \
npx wrangler d1 execute notropolis-database --remote --command "
SELECT status, COUNT(*) as count
FROM generated_assets
GROUP BY status;
"
```

### 6.5 Verify UI Shows Empty State

1. Open `https://boss.notropolis.net/admin/assets`
2. Asset Manager → Buildings tab
3. **Expected:** All buildings show "NO SPRITE" status
4. Asset Generation tab
5. **Expected:** Queue is empty (or only shows archived items grayed out)

---

## Step 7: Redeploy Worker (Optional)

If any caching issues, redeploy:

```bash
cd /Users/riki/notropolis/authentication-dashboard-system
npm run deploy
```

---

## Rollback Procedure

If something goes wrong, restore from archive:

### Rollback R2 Files

```bash
# Move files back from archive
rclone move r2:notropolis-game-assets/archive/2026-01-pre-overhaul/building_ref r2:notropolis-game-assets/sprites/building_ref
rclone move r2:notropolis-game-assets/archive/2026-01-pre-overhaul/building_sprite r2:notropolis-game-assets/sprites/building_sprite
# ... etc for all categories
```

### Rollback Database

```sql
-- Restore archived assets
UPDATE generated_assets
SET
    status = 'approved',
    r2_url = REPLACE(r2_key_public, 'KEY', 'https://pub-xxx.r2.dev/KEY')
WHERE status = 'archived'
  AND category NOT LIKE '%avatar%';
```

---

## Acceptance Checklist

- [ ] Step 1: Audited current R2 contents
- [ ] Step 2: Created archive script or configured rclone
- [ ] Step 3.1: Ran dry-run successfully
- [ ] Step 3.2: Executed archival on public bucket
- [ ] Step 3.3: Executed archival on private bucket
- [ ] Step 4: Updated database (marked as archived)
- [ ] Step 5: Cleared building configurations
- [ ] Step 6.1: Archive folder has content
- [ ] Step 6.2: Original sprite folders empty (except avatars)
- [ ] Step 6.3: Avatars still present
- [ ] Step 6.4: Database shows archived status
- [ ] Step 6.5: UI shows empty/reset state

---

## Post-Archival: Ready for Fresh Start

After archival is complete, you can generate new assets with corrected specs:

| Asset Type | New Specification |
|------------|-------------------|
| Buildings | Square canvas, elevated 3D view, front + right side visible |
| Terrain | 64x64 square tiles (not diamond isometric) |
| Pedestrians | 2 frames (A/B walk cycle), game rotates for direction |
| Vehicles | 1 sprite per type, game rotates for direction |
| Base Ground | 64x64 seamless tiling texture |

---

## Sign-off

- **Executed By:**
- **Date:**
- **Assets Archived:** _____ files
- **Database Records Updated:** _____ rows
- **Avatars Preserved:** ☐ Yes
- **Rollback Tested:** ☐ Yes / ☐ No (not needed)
