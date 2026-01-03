# Stage 04: Reprocess All Sprites

## Objective

Batch reprocess all approved sprites to new tiered sizes using the existing `/reprocess-sprites` endpoint.

## Dependencies

`[Requires: Stage 02 complete]` - Pipeline must use new tiered sizes before reprocessing.

## Complexity

**Low** - Uses existing endpoint, just need to run for each category.

---

## Files to Modify

None - uses existing `/api/admin/assets/reprocess-sprites` endpoint.

---

## Implementation Details

### Existing Endpoint

The worker already has a reprocess endpoint at:
`[Ref: worker/src/routes/admin/assets.js#reprocess-sprites]`

This endpoint:
1. Queries all approved sprites with `background_removed = TRUE`
2. Fetches transparent PNG from private bucket
3. Resizes via Cloudflare to target dimensions (now using SPRITE_OUTPUT_SIZES)
4. Saves to public bucket as WebP
5. Updates r2_url in database

### Categories to Reprocess

| Category | Current Size | New Size | Est. Count |
|----------|--------------|----------|------------|
| building_sprite | 64-320px (variable) | 320x320 | ~15 |
| npc | 32x32 | 64x64 | ~10 |
| vehicle | 64x32 | 128x128 | ~8 |
| terrain | 64x32 | 320x320 | ~15 |
| effect | 64x64 | 320x320 | ~10 |
| overlay | 64x32 | 128x128 | ~4 |

### Reprocess Script

```bash
#!/bin/bash
# reprocess-all-sprites.sh

API="https://api.notropolis.net"
TOKEN="036b7beb53be2a9bc37a0cbddaa5e979dd87bd8ade3310a9e91cd0b4624ca5e5"

echo "=== Reprocessing All Sprites to Tiered Sizes ==="

# Buildings (320x320)
echo ""
echo "Processing building_sprite..."
curl -X POST "$API/api/admin/assets/reprocess-sprites" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"category": "building_sprite"}' | jq .

sleep 2

# NPCs (64x64)
echo ""
echo "Processing npc..."
curl -X POST "$API/api/admin/assets/reprocess-sprites" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"category": "npc"}' | jq .

sleep 2

# Vehicles (128x128)
echo ""
echo "Processing vehicle..."
curl -X POST "$API/api/admin/assets/reprocess-sprites" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"category": "vehicle"}' | jq .

sleep 2

# Terrain (320x320)
echo ""
echo "Processing terrain..."
curl -X POST "$API/api/admin/assets/reprocess-sprites" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"category": "terrain"}' | jq .

sleep 2

# Effects (320x320)
echo ""
echo "Processing effect..."
curl -X POST "$API/api/admin/assets/reprocess-sprites" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"category": "effect"}' | jq .

sleep 2

# Overlays (128x128)
echo ""
echo "Processing overlay..."
curl -X POST "$API/api/admin/assets/reprocess-sprites" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"category": "overlay"}' | jq .

echo ""
echo "=== Reprocessing Complete ==="
```

---

## Test Cases

### 1. Verify building sprites are 320x320
```bash
ts=$(date +%s)
curl -s "https://assets.notropolis.net/sprites/building_sprite/bank_v8.webp?t=$ts" -o /tmp/test.webp
sips -g pixelWidth -g pixelHeight /tmp/test.webp
```
**Expected:** pixelWidth: 320, pixelHeight: ≤320

### 2. Verify NPC sprites are 64x64
```bash
ts=$(date +%s)
curl -s "https://assets.notropolis.net/sprites/npc/pedestrian_walk_v1.webp?t=$ts" -o /tmp/test.webp
sips -g pixelWidth -g pixelHeight /tmp/test.webp
```
**Expected:** pixelWidth: 64, pixelHeight: ≤64

### 3. Verify vehicle sprites are 128x128
```bash
ts=$(date +%s)
curl -s "https://assets.notropolis.net/sprites/vehicle/car_sedan_v1.webp?t=$ts" -o /tmp/test.webp
sips -g pixelWidth -g pixelHeight /tmp/test.webp
```
**Expected:** pixelWidth: 128, pixelHeight: ≤128

### 4. Verify terrain sprites are 320x320
```bash
ts=$(date +%s)
curl -s "https://assets.notropolis.net/sprites/terrain/grass_v1.webp?t=$ts" -o /tmp/test.webp
sips -g pixelWidth -g pixelHeight /tmp/test.webp
```
**Expected:** pixelWidth: 320, pixelHeight: ≤320

### 5. File sizes are reasonable
```bash
ls -la /tmp/test.webp
```
**Expected:**
- Buildings: 10-30KB
- NPCs: 2-5KB
- Vehicles: 3-8KB

---

## Cache Purging

After reprocessing, purge Cloudflare CDN cache:

```bash
# Get zone ID
ZONE_ID=$(curl -s 'https://api.cloudflare.com/client/v4/zones?name=notropolis.net' \
  -H 'Authorization: Bearer RQeVAceZ3VT-McbFF9DnYem0ZDc8YXbnHPH8wbg_' | jq -r '.result[0].id')

# Purge everything under assets.notropolis.net/sprites/
curl -X POST "https://api.cloudflare.com/client/v4/zones/$ZONE_ID/purge_cache" \
  -H 'Authorization: Bearer YOUR_CACHE_PURGE_TOKEN' \
  -H 'Content-Type: application/json' \
  -d '{"purge_everything": true}'
```

**Note:** If cache purge token doesn't have permission, user must purge manually from Cloudflare dashboard.

---

## Acceptance Checklist

- [x] All building sprites reprocessed to 320x320 ✅ (15/15)
- [x] All NPC sprites reprocessed to 64x64 ✅ (0 - no approved sprites)
- [x] All vehicle sprites reprocessed to 128x128 ✅ (4/4)
- [x] All terrain sprites reprocessed to 320x320 ✅ (1/1)
- [x] All effect sprites reprocessed to 320x320 ✅ (4/4)
- [x] All overlay sprites reprocessed to 128x128 ✅ (0 - no approved sprites)
- [x] CDN cache purged ✅ (manual purge completed)
- [x] File sizes verified as reasonable ✅
- [x] No errors in reprocess response ✅

**Completed:** 2026-01-03

---

## Deployment

```bash
# Make script executable
chmod +x reprocess-all-sprites.sh

# Run reprocessing
./reprocess-all-sprites.sh

# Or run individually
curl -X POST "https://api.notropolis.net/api/admin/assets/reprocess-sprites" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"category": "building_sprite"}'
```

**Verification:**
Download sprites with cache-busting and check dimensions with sips.

---

## Handoff Notes

- Sprites are now at new tiered sizes
- Old cached versions may persist until CDN cache expires or is purged
- If any sprites fail to reprocess, check wrangler tail for errors
- The reprocess endpoint logs detailed progress - monitor with `npx wrangler tail --env production`
- `[See: Stage 05]` for frontend UI to control map_scale
