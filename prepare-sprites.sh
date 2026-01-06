#!/bin/bash

# Prepare Notropolis building sprites for Asset Manager upload
# Run this script, then upload files from /tmp/notropolis-sprites/ via https://boss.notropolis.net/admin/assets

set -e

echo "🎨 Preparing Notropolis building sprites..."

# Create output directory
mkdir -p /tmp/notropolis-sprites
cd /Users/riki/notropolis/authentication-dashboard-system

# Level 1 Buildings (1×1 footprint)
echo "📦 Level 1 buildings..."
cp public/Building/commercial/2x2dunkin_south.png /tmp/notropolis-sprites/market_stall.png
cp public/Building/commercial/2x2popeyes_south.png /tmp/notropolis-sprites/hot_dog_stand.png
cp public/Building/residential/2x2english_townhouse_south.png /tmp/notropolis-sprites/campsite.png
cp public/Building/commercial/2x2checkers_south.png /tmp/notropolis-sprites/shop.png

# Level 2 Buildings
echo "📦 Level 2 buildings..."
cp public/Building/commercial/2x2martini_bar_south.png /tmp/notropolis-sprites/burger_bar.png
cp public/Building/residential/2x3brownstone_south.png /tmp/notropolis-sprites/motel.png

# Level 3 Buildings (2×2 footprint)
echo "📦 Level 3 buildings..."
cp public/Building/commercial/4x4bookstore_south.png /tmp/notropolis-sprites/high_street_store.png
cp public/Building/commercial/2x3promptlayer_office_south.png /tmp/notropolis-sprites/restaurant.png

# Level 4 Buildings
echo "📦 Level 4 buildings..."
cp public/Building/residential/2x3full_house_house_south.png /tmp/notropolis-sprites/manor.png

# Level 5 Buildings (3×3 footprint)
echo "📦 Level 5 buildings..."
cp public/Building/landmark/4x4hp_house_south.png /tmp/notropolis-sprites/casino.png

# Special Buildings
echo "📦 Special buildings..."
cp public/Building/landmark/6x3carnagie_mansion_south.png /tmp/notropolis-sprites/bank.png
cp public/Building/landmark/6x6church_south2.png /tmp/notropolis-sprites/temple.png
cp public/Building/civic/6x3private_school_south.png /tmp/notropolis-sprites/police_station.png

# Count prepared sprites
SPRITE_COUNT=$(ls -1 /tmp/notropolis-sprites/*.png | wc -l | tr -d ' ')

echo ""
echo "✅ Prepared $SPRITE_COUNT building sprites in /tmp/notropolis-sprites/"
echo ""
echo "📋 Next steps:"
echo "1. Visit https://boss.notropolis.net/admin/assets"
echo "2. For each sprite in /tmp/notropolis-sprites/:"
echo "   - Click 'Upload Asset'"
echo "   - Asset Key: filename without .png (e.g., 'market_stall')"
echo "   - Category: 'buildings'"
echo "   - Upload the PNG file"
echo "   - Click 'Publish'"
echo ""
echo "🚨 Missing sprites (create manually):"
echo "   - demolished.png (rubble/debris)"
echo "   - claim_stake.png (wooden stake)"
echo ""
echo "Files ready at: /tmp/notropolis-sprites/"
ls -1 /tmp/notropolis-sprites/
