# Stage 3: Tick History API

## Objective
Create backend API endpoints for fetching tick history, single tick details with company stats, and aggregate statistics.

## Dependencies
`[Requires: Stage 1 complete]` (tick_settings table for stats endpoint)

## Complexity
**Medium** — New route file with 3 endpoints, SQL queries with joins

## Files to Create

### `authentication-dashboard-system/worker/src/routes/admin/tick.js`
API handlers for tick history endpoints.

## Files to Modify

### `authentication-dashboard-system/worker/index.js`
Register the new tick admin routes.

## Implementation Details

### Endpoint 1: GET /api/admin/tick/history

**Purpose:** Paginated list of tick history entries

**Query Parameters:**
- `page` (default: 1)
- `limit` (default: 50, max: 100)
- `start_date` (ISO string, optional)
- `end_date` (ISO string, optional)

**Response:**
```json
{
  "success": true,
  "data": {
    "ticks": [
      {
        "id": "uuid",
        "processed_at": "2026-01-05T01:10:20Z",
        "execution_time_ms": 921,
        "maps_processed": 3,
        "companies_updated": 5,
        "buildings_recalculated": 0,
        "gross_profit": 20078,
        "tax_amount": 2008,
        "net_profit": 18070,
        "fires_started": 0,
        "fires_extinguished": 0,
        "buildings_damaged": 0,
        "buildings_collapsed": 0,
        "has_errors": false
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 50,
      "total": 907,
      "total_pages": 19
    }
  }
}
```

**SQL Query:**
```sql
SELECT
  id,
  processed_at,
  execution_time_ms,
  maps_processed,
  companies_updated,
  buildings_recalculated,
  gross_profit,
  tax_amount,
  net_profit,
  fires_started,
  fires_extinguished,
  buildings_damaged,
  buildings_collapsed,
  CASE WHEN errors IS NOT NULL AND errors != '[]' THEN 1 ELSE 0 END as has_errors
FROM tick_history
WHERE processed_at >= ? AND processed_at <= ?
ORDER BY processed_at DESC
LIMIT ? OFFSET ?
```

### Endpoint 2: GET /api/admin/tick/history/:tickId

**Purpose:** Single tick with company statistics breakdown

**Response:**
```json
{
  "success": true,
  "data": {
    "tick": {
      "id": "uuid",
      "processed_at": "2026-01-05T01:10:20Z",
      "execution_time_ms": 921,
      "maps_processed": 3,
      "companies_updated": 5,
      "buildings_recalculated": 0,
      "gross_profit": 20078,
      "tax_amount": 2008,
      "net_profit": 18070,
      "fires_started": 0,
      "fires_extinguished": 0,
      "buildings_damaged": 0,
      "buildings_collapsed": 0,
      "errors": []
    },
    "company_stats": [
      {
        "company_id": "gc_liam_001",
        "company_name": "Liam Corp",
        "map_id": "map_xyz",
        "map_name": "Testerville",
        "building_count": 3,
        "collapsed_count": 0,
        "base_profit": 1310,
        "gross_profit": 1310,
        "tax_rate": 0.1,
        "tax_amount": 131,
        "security_cost": 0,
        "net_profit": 1179,
        "total_building_value": 8500,
        "damaged_building_value": 8500,
        "average_damage_percent": 0,
        "buildings_on_fire": 0,
        "is_earning": false
      }
    ]
  }
}
```

**SQL Queries:**
```sql
-- Get tick
SELECT * FROM tick_history WHERE id = ?

-- Get company stats (snapshot closest to tick time)
SELECT
  cs.*,
  gc.name as company_name,
  m.name as map_name
FROM company_statistics cs
JOIN game_companies gc ON cs.company_id = gc.id
JOIN maps m ON cs.map_id = m.id
WHERE cs.last_tick_at <= ?
ORDER BY cs.last_tick_at DESC
```

### Endpoint 3: GET /api/admin/tick/stats

**Purpose:** Aggregate statistics for dashboard cards and charts

**Query Parameters:**
- `period` (default: '24h', options: '1h', '24h', '7d', '30d', 'all')

**Response:**
```json
{
  "success": true,
  "data": {
    "summary": {
      "total_ticks": 144,
      "avg_execution_ms": 875,
      "min_execution_ms": 450,
      "max_execution_ms": 1500,
      "total_gross_profit": 2891232,
      "total_tax_collected": 289123,
      "total_net_profit": 2602109,
      "total_fires_started": 12,
      "total_buildings_collapsed": 2,
      "ticks_with_errors": 0
    },
    "trends": {
      "execution_time": [
        { "time": "2026-01-04T00:00:00Z", "value": 850 },
        { "time": "2026-01-04T01:00:00Z", "value": 920 }
      ],
      "profit": [
        { "time": "2026-01-04T00:00:00Z", "gross": 120000, "tax": 12000, "net": 108000 },
        { "time": "2026-01-04T01:00:00Z", "gross": 125000, "tax": 12500, "net": 112500 }
      ],
      "fires": [
        { "time": "2026-01-04T00:00:00Z", "started": 1, "extinguished": 0, "collapsed": 0 }
      ]
    }
  }
}
```

**SQL Queries:**
```sql
-- Summary stats
SELECT
  COUNT(*) as total_ticks,
  AVG(execution_time_ms) as avg_execution_ms,
  MIN(execution_time_ms) as min_execution_ms,
  MAX(execution_time_ms) as max_execution_ms,
  SUM(gross_profit) as total_gross_profit,
  SUM(tax_amount) as total_tax_collected,
  SUM(net_profit) as total_net_profit,
  SUM(fires_started) as total_fires_started,
  SUM(buildings_collapsed) as total_buildings_collapsed,
  SUM(CASE WHEN errors IS NOT NULL AND errors != '[]' THEN 1 ELSE 0 END) as ticks_with_errors
FROM tick_history
WHERE processed_at >= datetime('now', ?)

-- Hourly trends (for charts)
SELECT
  strftime('%Y-%m-%dT%H:00:00Z', processed_at) as time,
  AVG(execution_time_ms) as avg_execution,
  SUM(gross_profit) as gross,
  SUM(tax_amount) as tax,
  SUM(net_profit) as net,
  SUM(fires_started) as fires_started,
  SUM(fires_extinguished) as fires_extinguished,
  SUM(buildings_collapsed) as collapsed
FROM tick_history
WHERE processed_at >= datetime('now', ?)
GROUP BY strftime('%Y-%m-%dT%H:00:00Z', processed_at)
ORDER BY time ASC
```

### Route Handler Code

```javascript
// worker/src/routes/admin/tick.js

export async function handleGetTickHistory(request, authService, env, corsHeaders) {
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

  // Parse query params
  const url = new URL(request.url);
  const page = Math.max(1, parseInt(url.searchParams.get('page') || '1'));
  const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get('limit') || '50')));
  const startDate = url.searchParams.get('start_date') || '1970-01-01';
  const endDate = url.searchParams.get('end_date') || '2100-01-01';
  const offset = (page - 1) * limit;

  // Get total count
  const countResult = await env.DB.prepare(`
    SELECT COUNT(*) as total FROM tick_history
    WHERE processed_at >= ? AND processed_at <= ?
  `).bind(startDate, endDate).first();

  // Get page of ticks
  const ticks = await env.DB.prepare(`
    SELECT
      id, processed_at, execution_time_ms, maps_processed, companies_updated,
      buildings_recalculated, gross_profit, tax_amount, net_profit,
      fires_started, fires_extinguished, buildings_damaged, buildings_collapsed,
      CASE WHEN errors IS NOT NULL AND errors != '[]' THEN 1 ELSE 0 END as has_errors
    FROM tick_history
    WHERE processed_at >= ? AND processed_at <= ?
    ORDER BY processed_at DESC
    LIMIT ? OFFSET ?
  `).bind(startDate, endDate, limit, offset).all();

  return new Response(JSON.stringify({
    success: true,
    data: {
      ticks: ticks.results,
      pagination: {
        page,
        limit,
        total: countResult.total,
        total_pages: Math.ceil(countResult.total / limit)
      }
    }
  }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}

export async function handleGetTickDetail(request, authService, env, corsHeaders, tickId) {
  // Auth check (same as above)
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

  // Get tick
  const tick = await env.DB.prepare('SELECT * FROM tick_history WHERE id = ?')
    .bind(tickId).first();

  if (!tick) {
    return new Response(JSON.stringify({ success: false, error: 'Tick not found' }), {
      status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  // Parse errors JSON
  tick.errors = tick.errors ? JSON.parse(tick.errors) : [];

  // Get company stats snapshot (most recent before or at tick time)
  const companyStats = await env.DB.prepare(`
    SELECT
      cs.*,
      gc.name as company_name,
      m.name as map_name
    FROM company_statistics cs
    JOIN game_companies gc ON cs.company_id = gc.id
    JOIN maps m ON cs.map_id = m.id
    WHERE cs.last_tick_at <= ?
    ORDER BY cs.company_id, cs.last_tick_at DESC
  `).bind(tick.processed_at).all();

  return new Response(JSON.stringify({
    success: true,
    data: { tick, company_stats: companyStats.results }
  }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}

export async function handleGetTickStats(request, authService, env, corsHeaders) {
  // Auth check (same pattern)
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

  // Parse period
  const url = new URL(request.url);
  const period = url.searchParams.get('period') || '24h';

  const periodMap = {
    '1h': '-1 hour',
    '24h': '-1 day',
    '7d': '-7 days',
    '30d': '-30 days',
    'all': '-100 years'
  };
  const sqlPeriod = periodMap[period] || '-1 day';

  // Get summary
  const summary = await env.DB.prepare(`
    SELECT
      COUNT(*) as total_ticks,
      ROUND(AVG(execution_time_ms)) as avg_execution_ms,
      MIN(execution_time_ms) as min_execution_ms,
      MAX(execution_time_ms) as max_execution_ms,
      SUM(gross_profit) as total_gross_profit,
      SUM(tax_amount) as total_tax_collected,
      SUM(net_profit) as total_net_profit,
      SUM(fires_started) as total_fires_started,
      SUM(buildings_collapsed) as total_buildings_collapsed,
      SUM(CASE WHEN errors IS NOT NULL AND errors != '[]' THEN 1 ELSE 0 END) as ticks_with_errors
    FROM tick_history
    WHERE processed_at >= datetime('now', ?)
  `).bind(sqlPeriod).first();

  // Get hourly trends for charts
  const trends = await env.DB.prepare(`
    SELECT
      strftime('%Y-%m-%dT%H:00:00Z', processed_at) as time,
      ROUND(AVG(execution_time_ms)) as avg_execution,
      SUM(gross_profit) as gross,
      SUM(tax_amount) as tax,
      SUM(net_profit) as net,
      SUM(fires_started) as fires_started,
      SUM(fires_extinguished) as fires_extinguished,
      SUM(buildings_collapsed) as collapsed
    FROM tick_history
    WHERE processed_at >= datetime('now', ?)
    GROUP BY strftime('%Y-%m-%dT%H:00:00Z', processed_at)
    ORDER BY time ASC
  `).bind(sqlPeriod).all();

  return new Response(JSON.stringify({
    success: true,
    data: {
      summary,
      trends: {
        execution_time: trends.results.map(t => ({ time: t.time, value: t.avg_execution })),
        profit: trends.results.map(t => ({ time: t.time, gross: t.gross, tax: t.tax, net: t.net })),
        fires: trends.results.map(t => ({ time: t.time, started: t.fires_started, extinguished: t.fires_extinguished, collapsed: t.collapsed }))
      }
    }
  }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}
```

### Register Routes in index.js

Add to `worker/index.js` in the route handling section:

```javascript
import { handleGetTickHistory, handleGetTickDetail, handleGetTickStats } from './src/routes/admin/tick.js';

// In the fetch handler, add these routes:
if (path === '/api/admin/tick/history' && method === 'GET') {
  return handleGetTickHistory(request, authService, env, corsHeaders);
}
if (path.match(/^\/api\/admin\/tick\/history\/[^/]+$/) && method === 'GET') {
  const tickId = path.split('/').pop();
  return handleGetTickDetail(request, authService, env, corsHeaders, tickId);
}
if (path === '/api/admin/tick/stats' && method === 'GET') {
  return handleGetTickStats(request, authService, env, corsHeaders);
}
```

## Database Changes

None — uses existing tables (tick_history, company_statistics)

## Test Cases

### Test 1: History Endpoint - Pagination
```bash
curl -H "Authorization: Bearer $TOKEN" \
  "https://api.example.com/api/admin/tick/history?page=1&limit=10"
# Expected: 10 ticks returned, pagination.total = 907
```

### Test 2: History Endpoint - Date Filter
```bash
curl -H "Authorization: Bearer $TOKEN" \
  "https://api.example.com/api/admin/tick/history?start_date=2026-01-04&end_date=2026-01-05"
# Expected: Only ticks within date range
```

### Test 3: Detail Endpoint - Valid Tick
```bash
curl -H "Authorization: Bearer $TOKEN" \
  "https://api.example.com/api/admin/tick/history/f8d01141-44b5-4ac4-8336-cf8289887171"
# Expected: Tick data + company_stats array
```

### Test 4: Detail Endpoint - Invalid Tick
```bash
curl -H "Authorization: Bearer $TOKEN" \
  "https://api.example.com/api/admin/tick/history/invalid-id"
# Expected: 404, error: "Tick not found"
```

### Test 5: Stats Endpoint - Periods
```bash
curl -H "Authorization: Bearer $TOKEN" \
  "https://api.example.com/api/admin/tick/stats?period=24h"
# Expected: summary + trends for last 24 hours
```

### Test 6: Auth - Non-Admin
```bash
curl -H "Authorization: Bearer $NON_ADMIN_TOKEN" \
  "https://api.example.com/api/admin/tick/history"
# Expected: 403, error: "Admin access required"
```

## Acceptance Checklist

- [ ] `worker/src/routes/admin/tick.js` created with 3 handlers
- [ ] Routes registered in `worker/index.js`
- [ ] All endpoints require master_admin role
- [ ] GET /history returns paginated results
- [ ] GET /history/:id returns tick + company stats
- [ ] GET /stats returns summary + trends
- [ ] Date filtering works on history endpoint
- [ ] Period filtering works on stats endpoint
- [ ] 404 returned for invalid tick ID
- [ ] All responses follow `{ success, data/error }` format

## Deployment

### Deploy Worker
```bash
cd authentication-dashboard-system/worker
npx wrangler deploy
```

### Verify Endpoints
```bash
# Get a valid token first
TOKEN="your-master-admin-token"

# Test history
curl -H "Authorization: Bearer $TOKEN" \
  "https://notropolis-api.your-domain.workers.dev/api/admin/tick/history?limit=5"

# Test stats
curl -H "Authorization: Bearer $TOKEN" \
  "https://notropolis-api.your-domain.workers.dev/api/admin/tick/stats?period=24h"
```

## Handoff Notes

- Three endpoints now available for tick history data
- [See: Stage 6] will create TypeScript types and API service for these endpoints
- [See: Stage 8] will build the UI components that consume these endpoints
- The trends data is formatted for direct use with recharts LineChart
- Company stats join includes company_name and map_name for display
