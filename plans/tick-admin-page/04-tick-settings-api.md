# Stage 4: Tick Settings API

## Objective
Create backend API endpoints for reading, updating, and resetting tick settings, with change logging.

## Dependencies
`[Requires: Stage 1 complete]` (tick_settings table)
`[Requires: Stage 2 complete]` (tick_settings_log table)

## Complexity
**Medium** — New route file with 4 endpoints, validation logic, change logging

## Files to Create

### `authentication-dashboard-system/worker/src/routes/admin/tickSettings.js`
API handlers for tick settings CRUD operations.

## Files to Modify

### `authentication-dashboard-system/worker/index.js`
Register the new tick settings routes.

## Implementation Details

### Endpoint 1: GET /api/admin/tick/settings

**Purpose:** Get current tick settings with metadata

**Response:**
```json
{
  "success": true,
  "data": {
    "settings": {
      "fire_damage_base": 10,
      "fire_damage_with_sprinklers": 5,
      "fire_spread_chance": 0.20,
      "...all other settings..."
    },
    "metadata": {
      "updated_at": "2026-01-05T12:00:00Z",
      "updated_by": "user_id",
      "updated_by_email": "admin@example.com"
    },
    "defaults": {
      "fire_damage_base": 10,
      "fire_damage_with_sprinklers": 5,
      "...all default values..."
    }
  }
}
```

### Endpoint 2: PUT /api/admin/tick/settings

**Purpose:** Update one or more settings

**Request Body:**
```json
{
  "fire_damage_base": 15,
  "tax_rate_town": 0.12
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "updated": ["fire_damage_base", "tax_rate_town"],
    "settings": { "...full settings object..." }
  }
}
```

### Endpoint 3: POST /api/admin/tick/settings/reset

**Purpose:** Reset all settings to defaults

**Request Body:**
```json
{
  "confirm": true
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "message": "All settings reset to defaults",
    "settings": { "...default values..." }
  }
}
```

### Endpoint 4: GET /api/admin/tick/settings/log

**Purpose:** Get settings change log

**Query Parameters:**
- `page` (default: 1)
- `limit` (default: 20, max: 50)

**Response:**
```json
{
  "success": true,
  "data": {
    "logs": [
      {
        "id": "log_abc123",
        "user_email": "admin@example.com",
        "changed_at": "2026-01-05T12:30:00Z",
        "changes": {
          "fire_damage_base": { "old": 10, "new": 15 }
        },
        "category": "fire",
        "summary": "Increased fire damage"
      }
    ],
    "pagination": { "page": 1, "limit": 20, "total": 5 }
  }
}
```

### Validation Rules

```javascript
const SETTING_VALIDATION = {
  // Fire settings
  fire_damage_base: { min: 1, max: 50, type: 'integer' },
  fire_damage_with_sprinklers: { min: 0, max: 25, type: 'integer' },
  fire_spread_chance: { min: 0, max: 1, type: 'decimal' },
  fire_spread_chance_trees: { min: 0, max: 1, type: 'decimal' },
  sprinkler_extinguish_chance: { min: 0, max: 1, type: 'decimal' },
  collapse_threshold: { min: 50, max: 100, type: 'integer' },

  // Tax rates
  tax_rate_town: { min: 0, max: 0.5, type: 'decimal' },
  tax_rate_city: { min: 0, max: 0.5, type: 'decimal' },
  tax_rate_capital: { min: 0, max: 0.5, type: 'decimal' },

  // Profit settings
  earning_threshold_ticks: { min: 1, max: 100, type: 'integer' },
  collapsed_maintenance_rate: { min: 0, max: 0.5, type: 'decimal' },
  security_cost_divisor: { min: 1, max: 1000, type: 'integer' },
  damage_profit_multiplier: { min: 1, max: 2, type: 'decimal' },

  // Adjacency settings
  adjacency_range: { min: 1, max: 5, type: 'integer' },
  competition_penalty: { min: 0, max: 0.5, type: 'decimal' },
  collapsed_neighbor_profit_penalty: { min: 0, max: 0.5, type: 'decimal' },
  collapsed_neighbor_value_penalty: { min: 0, max: 0.5, type: 'decimal' },
  damaged_neighbor_max_penalty: { min: 0, max: 0.5, type: 'decimal' },
  commercial_synergy_bonus: { min: 0, max: 0.2, type: 'decimal' },
  premium_terrain_trees: { min: 0, max: 0.3, type: 'decimal' },
  premium_terrain_water: { min: 0, max: 0.3, type: 'decimal' },
  penalty_terrain_dirt_track: { min: 0, max: 0.2, type: 'decimal' },
  min_building_value_floor: { min: 0.1, max: 1, type: 'decimal' },

  // Hero settings
  default_forced_hero_ticks: { min: 1, max: 50, type: 'integer' },
  land_streak_requirement: { min: 1, max: 50, type: 'integer' },

  // Land costs
  base_land_cost: { min: 100, max: 10000, type: 'integer' },
  land_multiplier_town: { min: 0.1, max: 10, type: 'decimal' },
  land_multiplier_city: { min: 1, max: 50, type: 'decimal' },
  land_multiplier_capital: { min: 5, max: 100, type: 'decimal' },
  terrain_multiplier_free_land: { min: 0.5, max: 2, type: 'decimal' },
  terrain_multiplier_dirt_track: { min: 0.1, max: 2, type: 'decimal' },
  terrain_multiplier_trees: { min: 0.5, max: 3, type: 'decimal' },

  // Combat settings (Dirty Tricks / Prison)
  prison_fine_multiplier: { min: 1, max: 20, type: 'decimal' },
  fine_multiplier_town: { min: 0.5, max: 5, type: 'decimal' },
  fine_multiplier_city: { min: 0.5, max: 5, type: 'decimal' },
  fine_multiplier_capital: { min: 0.5, max: 5, type: 'decimal' },
  security_bonus_cameras: { min: 0, max: 0.5, type: 'decimal' },
  security_bonus_guard_dogs: { min: 0, max: 0.5, type: 'decimal' },
  security_bonus_security_guards: { min: 0, max: 0.5, type: 'decimal' },
  cleanup_cost_percent: { min: 0, max: 0.2, type: 'decimal' },

  // Market settings
  sell_to_state_percent: { min: 0.1, max: 1, type: 'decimal' },
  min_listing_price_percent: { min: 0.5, max: 1.5, type: 'decimal' },
  forced_buy_multiplier: { min: 1, max: 20, type: 'decimal' },

  // Category synergy settings
  synergy_food_accommodation: { min: 0, max: 0.2, type: 'decimal' },
  synergy_retail_food: { min: 0, max: 0.2, type: 'decimal' },
  synergy_leisure_accommodation: { min: 0, max: 0.2, type: 'decimal' },
  synergy_competition_food: { min: 0, max: 0.2, type: 'decimal' },
  synergy_competition_leisure: { min: 0, max: 0.2, type: 'decimal' },
  synergy_competition_retail: { min: 0, max: 0.2, type: 'decimal' },
  synergy_competition_accommodation: { min: 0, max: 0.2, type: 'decimal' },
  synergy_positive_range: { min: 1, max: 5, type: 'integer' },
  synergy_competition_range: { min: 1, max: 3, type: 'integer' },
};
```

### Route Handler Code

```javascript
// worker/src/routes/admin/tickSettings.js

// Default values (must match migration)
const DEFAULT_SETTINGS = {
  fire_damage_base: 10,
  fire_damage_with_sprinklers: 5,
  fire_spread_chance: 0.20,
  fire_spread_chance_trees: 0.35,
  sprinkler_extinguish_chance: 0.60,
  collapse_threshold: 100,
  tax_rate_town: 0.10,
  tax_rate_city: 0.15,
  tax_rate_capital: 0.20,
  earning_threshold_ticks: 6,
  collapsed_maintenance_rate: 0.05,
  security_cost_divisor: 144,
  damage_profit_multiplier: 1.176,
  adjacency_range: 2,
  competition_penalty: 0.08,
  collapsed_neighbor_profit_penalty: 0.12,
  collapsed_neighbor_value_penalty: 0.15,
  damaged_neighbor_max_penalty: 0.08,
  commercial_synergy_bonus: 0.03,
  premium_terrain_trees: 0.05,
  premium_terrain_water: 0.08,
  penalty_terrain_dirt_track: 0.02,
  min_building_value_floor: 0.50,
  default_forced_hero_ticks: 6,
  land_streak_requirement: 6,
  base_land_cost: 500,
  land_multiplier_town: 1.0,
  land_multiplier_city: 5.0,
  land_multiplier_capital: 20.0,
  terrain_multiplier_free_land: 1.0,
  terrain_multiplier_dirt_track: 0.8,
  terrain_multiplier_trees: 1.2,
  // Combat settings
  prison_fine_multiplier: 8.0,
  fine_multiplier_town: 1.0,
  fine_multiplier_city: 1.5,
  fine_multiplier_capital: 2.0,
  security_bonus_cameras: 0.10,
  security_bonus_guard_dogs: 0.15,
  security_bonus_security_guards: 0.25,
  cleanup_cost_percent: 0.05,
  // Market settings
  sell_to_state_percent: 0.50,
  min_listing_price_percent: 0.80,
  forced_buy_multiplier: 6.0,
  // Category synergy settings
  synergy_food_accommodation: 0.05,
  synergy_retail_food: 0.03,
  synergy_leisure_accommodation: 0.04,
  synergy_competition_food: 0.04,
  synergy_competition_leisure: 0.05,
  synergy_competition_retail: 0.03,
  synergy_competition_accommodation: 0.02,
  synergy_positive_range: 2,
  synergy_competition_range: 1,
};

// Validation rules (as defined above)
const SETTING_VALIDATION = { /* ... */ };

// Helper: validate a single setting
function validateSetting(name, value) {
  const rule = SETTING_VALIDATION[name];
  if (!rule) return { valid: false, error: `Unknown setting: ${name}` };

  if (rule.type === 'integer') {
    if (!Number.isInteger(value)) return { valid: false, error: `${name} must be an integer` };
  }
  if (typeof value !== 'number') return { valid: false, error: `${name} must be a number` };
  if (value < rule.min || value > rule.max) {
    return { valid: false, error: `${name} must be between ${rule.min} and ${rule.max}` };
  }
  return { valid: true };
}

// Helper: determine category from settings changed
function determineCategory(settingNames) {
  const categories = new Set();
  for (const name of settingNames) {
    if (name.startsWith('fire_') || name === 'collapse_threshold' || name.startsWith('sprinkler_')) {
      categories.add('fire');
    } else if (name.startsWith('tax_')) {
      categories.add('tax');
    } else if (name.includes('profit') || name.includes('earning') || name.includes('maintenance') || name.includes('security_cost') || name.includes('damage_profit')) {
      categories.add('profit');
    } else if (name.startsWith('synergy_')) {
      // Category synergy settings (synergy_food_accommodation, synergy_retail_food, etc.)
      categories.add('synergy');
    } else if (name.includes('adjacency') || name.includes('neighbor') || name.includes('premium_terrain') || name.includes('penalty_terrain') || name.includes('competition') || name.includes('building_value')) {
      categories.add('adjacency');
    } else if (name.includes('hero') || name.includes('streak')) {
      categories.add('hero');
    } else if (name.includes('land') || name.includes('terrain_multiplier')) {
      categories.add('land');
    } else if (name.includes('prison') || name.includes('fine_multiplier') || name.includes('security_bonus') || name.includes('cleanup')) {
      categories.add('combat');
    } else if (name.includes('sell_to_state') || name.includes('listing_price') || name.includes('forced_buy')) {
      categories.add('market');
    }
  }
  return categories.size === 1 ? [...categories][0] : 'multiple';
}

// Helper: generate UUID
function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

export async function handleGetTickSettings(request, authService, env, corsHeaders) {
  // Auth check
  const authHeader = request.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return new Response(JSON.stringify({ success: false, error: 'Unauthorized' }), {
      status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  const { user } = await authService.getUserFromToken(authHeader.split(' ')[1]);
  if (user.role !== 'master_admin') {
    return new Response(JSON.stringify({ success: false, error: 'Admin access required' }), {
      status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  // Get settings
  const settings = await env.DB.prepare('SELECT * FROM tick_settings WHERE id = ?')
    .bind('global').first();

  // Get last updater info
  let updatedByEmail = null;
  if (settings?.updated_by) {
    const updater = await env.DB.prepare('SELECT email FROM users WHERE id = ?')
      .bind(settings.updated_by).first();
    updatedByEmail = updater?.email;
  }

  // Remove metadata columns from settings object
  const { id, created_at, updated_at, updated_by, ...settingsOnly } = settings || DEFAULT_SETTINGS;

  return new Response(JSON.stringify({
    success: true,
    data: {
      settings: settingsOnly,
      metadata: {
        updated_at: settings?.updated_at,
        updated_by: settings?.updated_by,
        updated_by_email: updatedByEmail
      },
      defaults: DEFAULT_SETTINGS
    }
  }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}

export async function handleUpdateTickSettings(request, authService, env, corsHeaders) {
  // Auth check
  const authHeader = request.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return new Response(JSON.stringify({ success: false, error: 'Unauthorized' }), {
      status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  const { user } = await authService.getUserFromToken(authHeader.split(' ')[1]);
  if (user.role !== 'master_admin') {
    return new Response(JSON.stringify({ success: false, error: 'Admin access required' }), {
      status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  // Parse request body
  const updates = await request.json();

  // Validate all settings
  const errors = [];
  for (const [name, value] of Object.entries(updates)) {
    const result = validateSetting(name, value);
    if (!result.valid) errors.push(result.error);
  }

  if (errors.length > 0) {
    return new Response(JSON.stringify({ success: false, error: errors.join('; ') }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  // Get current settings for change tracking
  const current = await env.DB.prepare('SELECT * FROM tick_settings WHERE id = ?')
    .bind('global').first();

  // Build changes object for log
  const changes = {};
  const updatedFields = [];
  for (const [name, newValue] of Object.entries(updates)) {
    if (current[name] !== newValue) {
      changes[name] = { old: current[name], new: newValue };
      updatedFields.push(name);
    }
  }

  if (updatedFields.length === 0) {
    return new Response(JSON.stringify({
      success: true,
      data: { updated: [], settings: current, message: 'No changes detected' }
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  // Build UPDATE query dynamically
  const setClauses = updatedFields.map(f => `${f} = ?`).join(', ');
  const values = updatedFields.map(f => updates[f]);

  await env.DB.prepare(`
    UPDATE tick_settings
    SET ${setClauses}, updated_at = datetime('now'), updated_by = ?
    WHERE id = 'global'
  `).bind(...values, user.id).run();

  // Log the change
  const logId = generateUUID();
  const category = determineCategory(updatedFields);
  const summary = `Updated ${updatedFields.length} setting(s): ${updatedFields.join(', ')}`;

  await env.DB.prepare(`
    INSERT INTO tick_settings_log (id, user_id, user_email, changes, category, summary)
    VALUES (?, ?, ?, ?, ?, ?)
  `).bind(logId, user.id, user.email, JSON.stringify(changes), category, summary).run();

  // Get updated settings
  const newSettings = await env.DB.prepare('SELECT * FROM tick_settings WHERE id = ?')
    .bind('global').first();

  return new Response(JSON.stringify({
    success: true,
    data: { updated: updatedFields, settings: newSettings }
  }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}

export async function handleResetTickSettings(request, authService, env, corsHeaders) {
  // Auth check
  const authHeader = request.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return new Response(JSON.stringify({ success: false, error: 'Unauthorized' }), {
      status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  const { user } = await authService.getUserFromToken(authHeader.split(' ')[1]);
  if (user.role !== 'master_admin') {
    return new Response(JSON.stringify({ success: false, error: 'Admin access required' }), {
      status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  // Require confirmation
  const body = await request.json();
  if (!body.confirm) {
    return new Response(JSON.stringify({
      success: false,
      error: 'Confirmation required. Send { "confirm": true } to reset all settings.'
    }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  // Get current settings for logging
  const current = await env.DB.prepare('SELECT * FROM tick_settings WHERE id = ?')
    .bind('global').first();

  // Build changes object
  const changes = {};
  for (const [name, defaultValue] of Object.entries(DEFAULT_SETTINGS)) {
    if (current[name] !== defaultValue) {
      changes[name] = { old: current[name], new: defaultValue };
    }
  }

  // Delete and reinsert with defaults
  await env.DB.prepare('DELETE FROM tick_settings WHERE id = ?').bind('global').run();
  await env.DB.prepare('INSERT INTO tick_settings (id, updated_by) VALUES (?, ?)')
    .bind('global', user.id).run();

  // Log the reset
  if (Object.keys(changes).length > 0) {
    const logId = generateUUID();
    await env.DB.prepare(`
      INSERT INTO tick_settings_log (id, user_id, user_email, changes, category, summary)
      VALUES (?, ?, ?, ?, ?, ?)
    `).bind(logId, user.id, user.email, JSON.stringify(changes), 'multiple', 'Reset all settings to defaults').run();
  }

  return new Response(JSON.stringify({
    success: true,
    data: { message: 'All settings reset to defaults', settings: DEFAULT_SETTINGS }
  }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}

export async function handleGetTickSettingsLog(request, authService, env, corsHeaders) {
  // Auth check
  const authHeader = request.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return new Response(JSON.stringify({ success: false, error: 'Unauthorized' }), {
      status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  const { user } = await authService.getUserFromToken(authHeader.split(' ')[1]);
  if (user.role !== 'master_admin') {
    return new Response(JSON.stringify({ success: false, error: 'Admin access required' }), {
      status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  // Parse pagination
  const url = new URL(request.url);
  const page = Math.max(1, parseInt(url.searchParams.get('page') || '1'));
  const limit = Math.min(50, Math.max(1, parseInt(url.searchParams.get('limit') || '20')));
  const offset = (page - 1) * limit;

  // Get total count
  const countResult = await env.DB.prepare('SELECT COUNT(*) as total FROM tick_settings_log').first();

  // Get logs
  const logs = await env.DB.prepare(`
    SELECT id, user_email, changed_at, changes, category, summary
    FROM tick_settings_log
    ORDER BY changed_at DESC
    LIMIT ? OFFSET ?
  `).bind(limit, offset).all();

  // Parse changes JSON
  const parsedLogs = logs.results.map(log => ({
    ...log,
    changes: JSON.parse(log.changes)
  }));

  return new Response(JSON.stringify({
    success: true,
    data: {
      logs: parsedLogs,
      pagination: {
        page,
        limit,
        total: countResult.total,
        total_pages: Math.ceil(countResult.total / limit)
      }
    }
  }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}
```

### Register Routes in index.js

Add to `worker/index.js`:

```javascript
import {
  handleGetTickSettings,
  handleUpdateTickSettings,
  handleResetTickSettings,
  handleGetTickSettingsLog
} from './src/routes/admin/tickSettings.js';

// In the fetch handler:
if (path === '/api/admin/tick/settings' && method === 'GET') {
  return handleGetTickSettings(request, authService, env, corsHeaders);
}
if (path === '/api/admin/tick/settings' && method === 'PUT') {
  return handleUpdateTickSettings(request, authService, env, corsHeaders);
}
if (path === '/api/admin/tick/settings/reset' && method === 'POST') {
  return handleResetTickSettings(request, authService, env, corsHeaders);
}
if (path === '/api/admin/tick/settings/log' && method === 'GET') {
  return handleGetTickSettingsLog(request, authService, env, corsHeaders);
}
```

## Database Changes

None — uses tables created in Stage 1 and Stage 2

## Test Cases

### Test 1: Get Settings
```bash
curl -H "Authorization: Bearer $TOKEN" \
  "https://api.example.com/api/admin/tick/settings"
# Expected: settings object + defaults + metadata
```

### Test 2: Update Valid Setting
```bash
curl -X PUT -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"fire_damage_base": 15}' \
  "https://api.example.com/api/admin/tick/settings"
# Expected: success, updated: ["fire_damage_base"]
```

### Test 3: Update Invalid Setting (out of range)
```bash
curl -X PUT -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"fire_damage_base": 100}' \
  "https://api.example.com/api/admin/tick/settings"
# Expected: 400, error about range
```

### Test 4: Reset Without Confirmation
```bash
curl -X POST -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{}' \
  "https://api.example.com/api/admin/tick/settings/reset"
# Expected: 400, "Confirmation required"
```

### Test 5: Reset With Confirmation
```bash
curl -X POST -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"confirm": true}' \
  "https://api.example.com/api/admin/tick/settings/reset"
# Expected: success, settings reset to defaults
```

### Test 6: Get Settings Log
```bash
curl -H "Authorization: Bearer $TOKEN" \
  "https://api.example.com/api/admin/tick/settings/log"
# Expected: Array of log entries with parsed changes
```

## Acceptance Checklist

- [ ] `worker/src/routes/admin/tickSettings.js` created with 4 handlers
- [ ] Routes registered in `worker/index.js`
- [ ] All endpoints require master_admin role
- [ ] GET /settings returns current + defaults + metadata
- [ ] PUT /settings validates all values against rules
- [ ] PUT /settings logs changes to tick_settings_log
- [ ] POST /settings/reset requires confirmation
- [ ] POST /settings/reset logs the reset
- [ ] GET /settings/log returns paginated change history
- [ ] Validation error messages are clear and helpful

## Deployment

```bash
cd authentication-dashboard-system/worker
npx wrangler deploy
```

## Handoff Notes

- Settings API is now available for CRUD operations
- All changes are logged to tick_settings_log with full audit trail
- [See: Stage 5] will update tick processor to read these settings
- [See: Stage 9] will build UI for settings form and log viewer
- DEFAULT_SETTINGS object must stay in sync with migration defaults
- Validation rules prevent game-breaking values
