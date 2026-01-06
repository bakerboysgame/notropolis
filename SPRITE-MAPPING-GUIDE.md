# Notropolis Building Sprite Mapping Guide

## Overview
This guide maps Notropolis building types to pogocity sprites for upload to the Asset Manager at https://boss.notropolis.net/admin/assets.

**Important**:
- All sprites should use the **SOUTH-facing** version
- Buildings are placed on **single tiles** but have multi-tile **visual footprints**
- Upload sprites with the exact `asset_key` names listed below
- Category: `buildings`

---

## Sprite Mappings

### Level 1 Buildings (1×1 footprint)

| Notropolis Building | Asset Key | Source File | Notes |
|---------------------|-----------|-------------|-------|
| **market_stall** | `market_stall` | `commercial/2x2dunkin_south.png` | Small food vendor |
| **hot_dog_stand** | `hot_dog_stand` | `commercial/2x2popeyes_south.png` | Fast food stand |
| **campsite** | `campsite` | `residential/2x2english_townhouse_south.png` | Small shelter |
| **shop** | `shop` | `commercial/2x2checkers_south.png` | Small retail |

### Level 2 Buildings

| Notropolis Building | Asset Key | Source File | Footprint | Notes |
|---------------------|-----------|-------------|-----------|-------|
| **burger_bar** | `burger_bar` | `commercial/2x2martini_bar_south.png` | 1×1 | Restaurant/bar |
| **motel** | `motel` | `residential/2x3brownstone_south.png` | 2×1 | Small hotel |

### Level 3 Buildings (2×2 footprint)

| Notropolis Building | Asset Key | Source File | Notes |
|---------------------|-----------|-------------|-------|
| **high_street_store** | `high_street_store` | `commercial/4x4bookstore_south.png` | Large retail |
| **restaurant** | `restaurant` | `commercial/2x3promptlayer_office_south.png` | Dining establishment |

### Level 4 Buildings

| Notropolis Building | Asset Key | Source File | Footprint | Notes |
|---------------------|-----------|-------------|-----------|-------|
| **manor** | `manor` | `residential/2x3full_house_house_south.png` | 2×3 | Large residence |

### Level 5 Buildings (3×3 footprint)

| Notropolis Building | Asset Key | Source File | Notes |
|---------------------|-----------|-------------|-------|
| **casino** | `casino` | `landmark/4x4hp_house_south.png` | Entertainment venue |

### Special Buildings

| Notropolis Building | Asset Key | Source File | Footprint | Notes |
|---------------------|-----------|-------------|-----------|-------|
| **bank** | `bank` | `landmark/6x3carnagie_mansion_south.png` | 3×3 | Financial institution |
| **temple** | `temple` | `landmark/6x6church_south2.png` | 3×3 | Religious building |
| **police_station** | `police_station` | `civic/6x3private_school_south.png` | 3×2 | Law enforcement |

### State Buildings (1×1 footprint)

| Notropolis Building | Asset Key | Source File | Notes |
|---------------------|-----------|-------------|-------|
| **demolished** | `demolished` | Create simple rubble sprite | Collapsed building |
| **claim_stake** | `claim_stake` | Create simple stake sprite | Empty plot marker |

---

## Upload Instructions

### Step 1: Prepare Sprites
For each building type above, copy the source file:

```bash
# Example for market_stall
cp public/Building/commercial/2x2dunkin_south.png /tmp/market_stall.png
```

### Step 2: Upload to Asset Manager
1. Visit https://boss.notropolis.net/admin/assets
2. Click "Upload Asset"
3. Fill in the form:
   - **Asset Key**: Use exact name from table (e.g., `market_stall`)
   - **Category**: `buildings`
   - **File**: Select the prepared PNG file
4. Click "Upload"
5. Wait for processing to complete
6. Click "Publish" to make it live

### Step 3: Verify
After uploading all sprites:
1. Visit any map with buildings
2. Buildings should now use the new pogocity sprites
3. Check console for any texture loading errors

---

## Alternative: Batch Upload Script

Create a script to automate copying:

```bash
#!/bin/bash
cd /Users/riki/notropolis/authentication-dashboard-system

# Level 1
cp public/Building/commercial/2x2dunkin_south.png /tmp/sprites/market_stall.png
cp public/Building/commercial/2x2popeyes_south.png /tmp/sprites/hot_dog_stand.png
cp public/Building/residential/2x2english_townhouse_south.png /tmp/sprites/campsite.png
cp public/Building/commercial/2x2checkers_south.png /tmp/sprites/shop.png

# Level 2
cp public/Building/commercial/2x2martini_bar_south.png /tmp/sprites/burger_bar.png
cp public/Building/residential/2x3brownstone_south.png /tmp/sprites/motel.png

# Level 3
cp public/Building/commercial/4x4bookstore_south.png /tmp/sprites/high_street_store.png
cp public/Building/commercial/2x3promptlayer_office_south.png /tmp/sprites/restaurant.png

# Level 4
cp public/Building/residential/2x3full_house_house_south.png /tmp/sprites/manor.png

# Level 5
cp public/Building/landmark/4x4hp_house_south.png /tmp/sprites/casino.png

# Special
cp public/Building/landmark/6x3carnagie_mansion_south.png /tmp/sprites/bank.png
cp public/Building/landmark/6x6church_south2.png /tmp/sprites/temple.png
cp public/Building/civic/6x3private_school_south.png /tmp/sprites/police_station.png

echo "Sprites prepared in /tmp/sprites/"
echo "Upload them manually via https://boss.notropolis.net/admin/assets"
```

---

## Notes

- **Visual Size vs Placement**: Buildings have large visual footprints (2x2, 3x3) but are placed on single tiles
- **Depth Sorting**: The vertical slice renderer will handle proper depth sorting automatically
- **Fallback**: If Asset Manager sprite fails to load, the system falls back to `/public/Building/` sprites
- **Glow Effects**: Restaurant has a warm orange glow effect (configured in EffectsRenderer.ts)

---

## Future Improvements

To create more accurate sprites for `demolished` and `claim_stake`:
1. Use an image editor to create small 1x1 sprites
2. `demolished`: Rubble/debris pile
3. `claim_stake`: Simple wooden stake or sign
4. Export as PNG and upload to Asset Manager
