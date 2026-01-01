#!/usr/bin/env node

// CONFIGURATION
// Get admin token from: docs/REFERENCE-test-tokens/CLAUDE.md
const WORKER_URL = 'https://api.notropolis.net';
const AUTH_TOKEN = 'eyJhbGciOiJIUzI1NiJ9.eyJ1c2VySWQiOiJtYXN0ZXItYWRtaW4tMDAxIiwiY29tcGFueUlkIjoic3lzdGVtIiwicm9sZSI6Im1hc3Rlcl9hZG1pbiIsInBoaUFjY2Vzc0xldmVsIjoibm9uZSIsImlzTW9iaWxlIjpmYWxzZSwiaXNzdWVkQXQiOjE3NjcyNzU3NDksImRhdGFDbGFzc2lmaWNhdGlvbiI6InB1YmxpYyIsInNlc3Npb25JZCI6IjMwNGU1MGJlLWRlMmQtNGE4YS1hMjRlLTcyNjI5YTc3ZGU4ZiIsImNvbXBhbnlDb250ZXh0Ijp7ImlkIjoic3lzdGVtIiwicm9sZSI6Im1hc3Rlcl9hZG1pbiIsInBlcm1pc3Npb25zIjpbXX0sImlhdCI6MTc2NzI3NTc0OSwiZXhwIjoxNzY3MzYyMTQ5LCJpc3MiOiJodHRwczovL2FwaS5ub3Ryb3BvbGlzLm5ldCIsImF1ZCI6Imh0dHBzOi8vYm9zcy5ub3Ryb3BvbGlzLm5ldCIsImp0aSI6Ijg4NjQ5MThlLTJjNzQtNDg3NS05OWZiLWIxNjBhZTUxZTNkMSJ9.jLfCZDja5Qn56_AcjZBp-SKoeTu96rsOk-0hfbLMRB0';

const buildings = [
    {
        key: 'market_stall',
        name: 'Market Stall',
        distinctive: 'Wooden booth, canvas awning, "MARKET" or "FRESH PRODUCE" signage, crates of colorful fruits/vegetables, hand-lettered price signs, rustic charm'
    },
    {
        key: 'hot_dog_stand',
        name: 'Hot Dog Stand',
        distinctive: 'Metal wheeled cart, large "HOT DOGS" umbrella, visible hot dogs on rotisserie, mustard/ketchup bottles, steaming water tray, menu board with prices'
    },
    {
        key: 'campsite',
        name: 'Campsite',
        distinctive: 'Canvas A-frame tent, stone campfire ring with logs, "CAMP" flag or sign, wooden supply crates, oil lantern, outdoor cooking pot'
    },
    {
        key: 'shop',
        name: 'Shop',
        distinctive: 'Brick facade, large "SHOP" sign, display window with goods, striped awning, "OPEN" sign, doorbell, modest corner store feel'
    },
    {
        key: 'burger_bar',
        name: 'Burger Bar',
        distinctive: '1950s chrome diner, neon "BURGERS" sign, large hamburger logo/mascot, red and white colors, checkered floor visible, jukebox silhouette inside'
    },
    {
        key: 'motel',
        name: 'Motel',
        distinctive: 'Row of numbered doors, tall "MOTEL" sign with arrow, "VACANCY" in neon, room keys hanging in office window, ice machine, parking spaces marked'
    },
    {
        key: 'high_street_store',
        name: 'High Street Store',
        distinctive: 'Two-story Victorian retail, "DEPARTMENT STORE" signage, multiple shop windows with mannequins, ornate cornices, revolving door entrance'
    },
    {
        key: 'restaurant',
        name: 'Restaurant',
        distinctive: 'Large "RESTAURANT" sign, diners visible at tables through windows, outdoor menu board, checkered tablecloths, chef hat logo, wine bottles in window'
    },
    {
        key: 'manor',
        name: 'Manor',
        distinctive: 'Grand mansion, columned entrance portico, "PRIVATE ESTATE" sign, many windows with shutters, ornate iron gates visible, multiple chimneys'
    },
    {
        key: 'casino',
        name: 'Casino',
        distinctive: 'Hundreds of decorative lights, massive "CASINO" sign, playing card/dice motifs, gold and red everywhere, red carpet entrance, glamorous facade'
    },
    {
        key: 'temple',
        name: 'Temple',
        distinctive: 'Multi-tiered pagoda-style roof, curved eaves, grand stone stairs, "TEMPLE" or symbol, incense burner outside, prayer bells, serene atmosphere'
    },
    {
        key: 'bank',
        name: 'Bank',
        distinctive: 'Massive stone columns, "BANK" carved in stone, bronze vault-style doors, barred windows, clock above entrance, marble steps, imposing and secure'
    },
    {
        key: 'police_station',
        name: 'Police Station',
        distinctive: 'Brick government building, large "POLICE" sign, traditional blue lamp glowing, reinforced doors, barred windows, official and authoritative'
    }
];

function buildPrompt(building) {
    return `Create a building reference sheet for a ${building.name.toUpperCase()}.

OUTPUT REQUIREMENTS:
- Resolution: 3840×2160 pixels (4K landscape)
- Format: PNG with solid background (not transparent)
- Orientation: Landscape (wider than tall)

TEMPLATE LAYOUT (match exactly):
- Gray background (#808080), white border boxes, bold label text
- Views: FRONT VIEW (top left), SIDE PROFILE VIEW (top right), BACK VIEW (middle left), 45 DEGREE ISOMETRIC VIEW (middle right), CLOSE UP DETAILS (bottom strip)
- Title at top: "BUILDING REFERENCE SHEET: 90s CGI ${building.name.toUpperCase()}"
- 45 degree isometric view: Entry/door on BOTTOM LEFT side, building extends toward top-right

The ${building.name.toLowerCase()}: MUST BE CLEARLY IDENTIFIABLE with these distinctive features:
${building.distinctive}

CRITICAL RULES:
- Entry point/door on BOTTOM LEFT in isometric view
- Country-neutral (no flags, no currency symbols, no country-specific elements)
- Building ONLY - no vehicles, people, animals, or surrounding objects
- Clean isolated building on its footprint

STYLE: 90s CGI chunky polygonal aesthetic (RenderWare, SimCity 3000, early Pixar) with MODERN render quality:
- Soft ambient occlusion in corners
- Subtle global illumination
- Clean anti-aliased edges
- Professional studio lighting from top-left
- "Box art" promotional render quality`;
}

async function generateAsset(category, assetKey, prompt, variant) {
    const response = await fetch(`${WORKER_URL}/api/admin/assets/generate`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${AUTH_TOKEN}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ category, asset_key: assetKey, prompt, variant })
    });
    return response.json();
}

async function main() {
    console.log('Starting building reference sheet generation...\n');
    console.log(`Total buildings: ${buildings.length}`);
    console.log(`Variants per building: 2`);
    console.log(`Total assets to generate: ${buildings.length * 2}\n`);

    let successCount = 0;
    let failCount = 0;

    for (const building of buildings) {
        const prompt = buildPrompt(building);

        console.log(`\n[${buildings.indexOf(building) + 1}/${buildings.length}] Generating: ${building.name}`);

        // Generate variant 1
        console.log(`  Variant 1...`);
        try {
            const result1 = await generateAsset('building_ref', building.key, prompt, 1);
            if (result1.success) {
                console.log(`    ✓ ${result1.r2_key}`);
                successCount++;
            } else {
                console.log(`    ✗ ${result1.error || 'Unknown error'}`);
                failCount++;
            }
        } catch (err) {
            console.log(`    ✗ Network error: ${err.message}`);
            failCount++;
        }

        // Small delay to avoid rate limits
        await new Promise(r => setTimeout(r, 2000));

        // Generate variant 2
        console.log(`  Variant 2...`);
        try {
            const result2 = await generateAsset('building_ref', building.key, prompt, 2);
            if (result2.success) {
                console.log(`    ✓ ${result2.r2_key}`);
                successCount++;
            } else {
                console.log(`    ✗ ${result2.error || 'Unknown error'}`);
                failCount++;
            }
        } catch (err) {
            console.log(`    ✗ Network error: ${err.message}`);
            failCount++;
        }

        // Delay between buildings
        await new Promise(r => setTimeout(r, 3000));
    }

    console.log('\n========================================');
    console.log('Generation complete!');
    console.log(`  Success: ${successCount}`);
    console.log(`  Failed: ${failCount}`);
    console.log('========================================');
    console.log('\nNext steps:');
    console.log('1. List assets: curl -s "https://api.notropolis.net/api/admin/assets/list/building_ref" -H "Authorization: Bearer TOKEN"');
    console.log('2. Preview assets: GET /api/admin/assets/preview/:id');
    console.log('3. Approve/reject assets via admin panel or API');
}

main().catch(console.error);
