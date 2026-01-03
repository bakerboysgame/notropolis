# Stage 03: Backend API Updates

## Objective

Update configuration API endpoints to include map_scale in responses and accept it in updates.

## Dependencies

`[Requires: Stage 01 complete]` - map_scale column must exist in database.
`[Requires: Stage 02 complete]` - getDefaultMapScale() helper must be available.

## Complexity

**Medium** - Modifying SELECT queries and update handlers.

---

## Files to Modify

| File | Changes |
|------|---------|
| `worker/src/routes/admin/assets.js` | Update GET/PUT configuration endpoints |

---

## Implementation Details

### 1. Update GET /configurations/buildings Endpoint

**Location:** `worker/src/routes/admin/assets.js` around line 6095

Add map_scale and default_map_scale to the SELECT and response:

```javascript
// GET /api/admin/assets/configurations/buildings
if (action === 'configurations' && method === 'GET' && param1 === 'buildings') {
    const configs = await env.DB.prepare(`
        SELECT
            bt.id as building_type_id,
            bt.name as building_name,
            bt.cost as default_cost,
            bt.base_profit as default_profit,
            bt.level_required,
            bt.requires_license,
            bc.active_sprite_id,
            bc.cost_override,
            bc.base_profit_override,
            bc.map_scale,                          -- ADD THIS
            bc.is_published,
            bc.published_at,
            bc.published_by,
            ga.r2_url as sprite_url,
            (SELECT COUNT(*) FROM generated_assets
             WHERE category = 'building_sprite'
             AND asset_key = bt.id
             AND status = 'approved') as available_sprites
        FROM building_types bt
        LEFT JOIN building_configurations bc ON bt.id = bc.building_type_id
        LEFT JOIN generated_assets ga ON bc.active_sprite_id = ga.id
        ORDER BY bt.level_required, bt.name
    `).all();

    // Add default_map_scale from code constants
    const configurationsWithDefaults = configs.results.map(config => ({
        ...config,
        default_map_scale: getDefaultMapScale('building_sprite', config.building_type_id),
        effective_map_scale: config.map_scale ?? getDefaultMapScale('building_sprite', config.building_type_id)
    }));

    return Response.json({
        success: true,
        configurations: configurationsWithDefaults
    });
}
```

### 2. Update PUT /configurations/buildings/:assetKey Endpoint

**Location:** `worker/src/routes/admin/assets.js` around line 6192

Add map_scale to the UPDATE statement:

```javascript
// PUT /api/admin/assets/configurations/buildings/:buildingType
if (action === 'configurations' && method === 'PUT' && param1 === 'buildings' && param2) {
    const buildingType = param2;
    const { active_sprite_id, cost_override, base_profit_override, map_scale } = await request.json();

    // Upsert building configuration
    await env.DB.prepare(`
        INSERT INTO building_configurations (building_type_id, active_sprite_id, cost_override, base_profit_override, map_scale, updated_at)
        VALUES (?, ?, ?, ?, ?, datetime('now'))
        ON CONFLICT(building_type_id) DO UPDATE SET
            active_sprite_id = excluded.active_sprite_id,
            cost_override = excluded.cost_override,
            base_profit_override = excluded.base_profit_override,
            map_scale = excluded.map_scale,
            updated_at = excluded.updated_at
    `).bind(buildingType, active_sprite_id, cost_override, base_profit_override, map_scale).run();

    return Response.json({ success: true, message: 'Configuration updated' });
}
```

### 3. Update GET /configurations/:category Endpoint (for non-buildings)

**Location:** Search for generic configurations endpoint

```javascript
// GET /api/admin/assets/configurations/:category (non-buildings)
if (action === 'configurations' && method === 'GET' && param1 && param1 !== 'buildings') {
    const category = param1;

    const configs = await env.DB.prepare(`
        SELECT
            ac.id,
            ac.category,
            ac.asset_key,
            ac.active_sprite_id,
            ac.config,
            ac.map_scale,                          -- ADD THIS
            ac.is_active,
            ac.is_published,
            ac.published_at,
            ac.published_by,
            ga.r2_url as sprite_url,
            (SELECT COUNT(*) FROM generated_assets
             WHERE category = ac.category
             AND asset_key = ac.asset_key
             AND status = 'approved') as available_sprites
        FROM asset_configurations ac
        LEFT JOIN generated_assets ga ON ac.active_sprite_id = ga.id
        WHERE ac.category = ?
        ORDER BY ac.asset_key
    `).bind(category).all();

    // Add default_map_scale from code constants
    const configurationsWithDefaults = configs.results.map(config => ({
        ...config,
        default_map_scale: getDefaultMapScale(config.category, config.asset_key),
        effective_map_scale: config.map_scale ?? getDefaultMapScale(config.category, config.asset_key)
    }));

    return Response.json({
        success: true,
        configurations: configurationsWithDefaults
    });
}
```

### 4. Update PUT /configurations/:category/:assetKey Endpoint

```javascript
// PUT /api/admin/assets/configurations/:category/:assetKey
if (action === 'configurations' && method === 'PUT' && param1 && param1 !== 'buildings' && param2) {
    const category = param1;
    const assetKey = param2;
    const { active_sprite_id, config, is_active, map_scale } = await request.json();

    await env.DB.prepare(`
        INSERT INTO asset_configurations (category, asset_key, active_sprite_id, config, is_active, map_scale, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
        ON CONFLICT(category, asset_key) DO UPDATE SET
            active_sprite_id = COALESCE(excluded.active_sprite_id, active_sprite_id),
            config = COALESCE(excluded.config, config),
            is_active = COALESCE(excluded.is_active, is_active),
            map_scale = COALESCE(excluded.map_scale, map_scale),
            updated_at = excluded.updated_at
    `).bind(category, assetKey, active_sprite_id, JSON.stringify(config), is_active ? 1 : 0, map_scale).run();

    return Response.json({ success: true, message: 'Configuration updated' });
}
```

---

## API Response Format

### Buildings Configuration Response
```json
{
  "success": true,
  "configurations": [
    {
      "building_type_id": "bank",
      "building_name": "Bank",
      "default_cost": 50000,
      "default_profit": 500,
      "active_sprite_id": 393,
      "cost_override": null,
      "base_profit_override": null,
      "map_scale": 1.0,
      "default_map_scale": 1.0,
      "effective_map_scale": 1.0,
      "sprite_url": "https://assets.notropolis.net/sprites/building_sprite/bank_v8.webp",
      "is_published": true
    }
  ]
}
```

### Asset Configuration Response
```json
{
  "success": true,
  "configurations": [
    {
      "category": "npc",
      "asset_key": "pedestrian_walk",
      "active_sprite_id": 500,
      "map_scale": 0.1,
      "default_map_scale": 0.1,
      "effective_map_scale": 0.1,
      "sprite_url": "https://assets.notropolis.net/sprites/npc/pedestrian_walk_v1.webp"
    }
  ]
}
```

---

## Test Cases

### 1. GET buildings configuration returns map_scale
```bash
curl -s "https://api.notropolis.net/api/admin/assets/configurations/buildings" \
  -H "Authorization: Bearer $TOKEN" | jq '.configurations[0] | {building_type_id, map_scale, default_map_scale}'
```
**Expected:** `{"building_type_id": "bank", "map_scale": 1.0, "default_map_scale": 1.0}`

### 2. PUT buildings configuration updates map_scale
```bash
curl -X PUT "https://api.notropolis.net/api/admin/assets/configurations/buildings/bank" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"map_scale": 0.9}'

# Verify
curl -s "https://api.notropolis.net/api/admin/assets/configurations/buildings" \
  -H "Authorization: Bearer $TOKEN" | jq '.configurations[] | select(.building_type_id=="bank") | .map_scale'
```
**Expected:** `0.9`

### 3. GET NPC configuration returns map_scale
```bash
curl -s "https://api.notropolis.net/api/admin/assets/configurations/npc" \
  -H "Authorization: Bearer $TOKEN" | jq '.configurations[0]'
```
**Expected:** Contains `map_scale`, `default_map_scale`, `effective_map_scale`

---

## Acceptance Checklist

- [x] GET /configurations/buildings returns map_scale, default_map_scale, effective_map_scale ✅
- [x] PUT /configurations/buildings/:id accepts and saves map_scale ✅
- [x] GET /configurations/:category returns map_scale for non-building categories ✅
- [x] PUT /configurations/:category/:key accepts and saves map_scale ✅
- [x] effective_map_scale falls back to default when map_scale is NULL ✅
- [x] Worker deploys without errors ✅

**Completed:** 2026-01-03

---

## Deployment

```bash
cd /Users/riki/notropolis/authentication-dashboard-system/worker
npx wrangler deploy --env production
```

**Verification:**
```bash
# Test buildings endpoint
curl -s "https://api.notropolis.net/api/admin/assets/configurations/buildings" \
  -H "Authorization: Bearer $TOKEN" | jq '.configurations[0].map_scale'

# Should return a number (not null or undefined)
```

---

## Handoff Notes

- API now returns map_scale but frontend doesn't display it yet
- `[See: Stage 05]` for frontend UI updates
- The `effective_map_scale` field is computed: uses map_scale if set, otherwise default_map_scale
- Game client should use `effective_map_scale` for rendering
