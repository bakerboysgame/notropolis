# Stage 2: Asset Manager + Pipeline

## Objective
Update terrain tab with all types, import pogicity placeholders, and add terrain-specific pipeline processing.

## Dependencies
[Requires: Stage 1 complete]

## Complexity
High

## Files to Modify

| File | Changes |
|------|---------|
| `worker/src/routes/admin/assets.js` | Terrain pipeline processing, output size 63x32 |
| `src/pages/AssetAdminPage.tsx` | Import pogicity tiles button |
| `src/components/admin/TerrainPalette.tsx` | Add snow, sand, mountain terrain tools |
| `src/services/assetApi.ts` | Add terrain asset types if needed |

## Files to Create

None - all changes to existing files.

## Implementation Details

### 1. Update TerrainPalette (TerrainPalette.tsx)

Add new terrain tools:
```typescript
const TERRAIN_TOOLS: Tool[] = [
  { id: 'free_land', label: 'Free Land', color: '#90EE90' },
  { id: 'water', label: 'Water', color: '#4169E1' },
  { id: 'road', label: 'Road', color: '#696969' },
  { id: 'dirt_track', label: 'Dirt Track', color: '#8B4513' },
  { id: 'trees', label: 'Trees', color: '#228B22' },
  { id: 'snow', label: 'Snow', color: '#F0F8FF' },
  { id: 'sand', label: 'Sand', color: '#F4A460' },
  { id: 'mountain', label: 'Mountain', color: '#808080' },
];
```

### 2. Import Pogicity Button (AssetAdminPage.tsx)

Add button to terrain tab header:
```typescript
{activeTab === 'terrain' && (
  <button
    onClick={handleImportPogicityTiles}
    className="px-3 py-1 bg-purple-600 hover:bg-purple-700 rounded text-sm"
  >
    Import Pogicity Tiles
  </button>
)}
```

Handler creates assets via API:
```typescript
const handleImportPogicityTiles = async () => {
  const pogicityMappings = [
    { file: '1x1grass.png', assetKey: 'grass', terrainType: 'free_land' },
    { file: '1x1asphalt.png', assetKey: 'road', terrainType: 'road' },
    { file: '1x1tile.png', assetKey: 'dirt_track', terrainType: 'dirt_track' },
    { file: '1x1snow_tile_1.png', assetKey: 'snow', terrainType: 'snow' },
  ];

  for (const mapping of pogicityMappings) {
    // Fetch local file, upload to R2, create asset record as 'approved'
    await importPogicityTile(mapping);
  }
};
```

### 3. Terrain Pipeline Processing (worker/src/routes/admin/assets.js)

Update SPRITE_OUTPUT_SIZES (~line 1489):
```javascript
const SPRITE_OUTPUT_SIZES = {
  // ... existing
  terrain: { width: 63, height: 32 },  // Isometric tile dimensions
};
```

Add terrain-specific processing in pipeline (~line 239):
```javascript
async function processTerrainSprite(asset, env) {
  // 1. Get source image
  const sourceBuffer = await getFromR2(asset.r2_key_private, env);

  // 2. Background removal (if not already transparent)
  let processed = sourceBuffer;
  if (!asset.skip_bg_removal) {
    processed = await removeBackground(sourceBuffer, env);
  }

  // 3. Resize to exact 63x32 (Cloudflare image transforms)
  const resized = await resizeWithCloudflare(processed, {
    width: 63,
    height: 32,
    fit: 'contain',
    background: 'transparent'
  });

  // 4. Save as PNG (preserve transparency)
  const publicKey = `sprites/terrain/${asset.asset_key}.png`;
  await env.R2_PUBLIC.put(publicKey, resized);

  return publicKey;
}
```

Update pipeline dispatch to use terrain processor:
```javascript
if (asset.category === 'terrain') {
  return await processTerrainSprite(asset, env);
}
```

### 4. Backend Import Endpoint (worker/src/routes/admin/assets.js)

Add endpoint for importing pogicity tiles:
```javascript
// POST /api/admin/assets/import-pogicity-tile
router.post('/import-pogicity-tile', async (req, env) => {
  const { assetKey, terrainType, fileUrl } = req.body;

  // Fetch file from local/URL
  const fileBuffer = await fetch(fileUrl).then(r => r.arrayBuffer());

  // Upload to R2
  const r2Key = `raw/terrain/${assetKey}.png`;
  await env.R2_PRIVATE.put(r2Key, fileBuffer);

  // Create asset record as approved
  await env.DB.prepare(`
    INSERT INTO generated_assets (category, asset_key, status, r2_key_private, approved_at)
    VALUES ('terrain', ?, 'approved', ?, datetime('now'))
  `).bind(assetKey, r2Key).run();

  // Run through pipeline
  await triggerPipeline(assetId, env);

  return { success: true };
});
```

## Database Changes

None - uses existing generated_assets table.

## Test Cases

1. **Import pogicity grass tile**
   - Click "Import Pogicity Tiles"
   - Expected: Asset created with status='approved', processed to 63x32

2. **New terrain types in palette**
   - Open map builder
   - Expected: Snow, Sand, Mountain tools visible

3. **Pipeline processes terrain to correct size**
   - Approve terrain sprite
   - Check output: 63x32 PNG in R2

## Acceptance Checklist

- [ ] TerrainPalette shows all 8 terrain types
- [ ] "Import Pogicity Tiles" button visible on terrain tab
- [ ] Import creates approved assets in database
- [ ] Pipeline resizes terrain to 63x32
- [ ] Pogicity tiles accessible at /sprites/terrain/*.png

## Deployment

```bash
cd authentication-dashboard-system
npm run build
npx wrangler deploy
```

Verify: Visit https://boss.notropolis.net/admin/assets, terrain tab shows import button.

## Handoff Notes

- Pogicity tiles imported as base placeholders
- Pipeline configured for 63x32 terrain output
- Stage 3 will use these sprites for auto-tile rendering
