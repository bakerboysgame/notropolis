# D1 Database Optimization Reference

## Critical Limits

| Limit | Value | Source |
|-------|-------|--------|
| **Bind parameters per query** | **100** | Cloudflare D1 docs |
| **Batch statements** | 20,000+ tested | Benchmark verified |
| **Query timeout** | 30 seconds | Cloudflare D1 docs |
| **Optimal INSERT chunk size** | 20 rows | 20 rows × 5 params = 100 |

## The Problem

D1 limits bind parameters to **100 per query** (not 999 like standard SQLite).

```javascript
// FAILS at 25+ rows (125 params)
const placeholders = tiles.map(() => '(?, ?, ?, ?, ?)').join(', ');
await env.DB.prepare(`INSERT INTO tiles VALUES ${placeholders}`).bind(...values).run();
// Error: "too many SQL variables at offset 399"
```

## The Solution: batch() + Chunked Multi-value INSERT

```javascript
// OPTIMAL: Combines efficiency of multi-value INSERT with single network call of batch()
const CHUNK_SIZE = 20; // 20 rows × 5 params = 100 (at limit)
const statements = [];

for (let i = 0; i < tiles.length; i += CHUNK_SIZE) {
  const chunk = tiles.slice(i, i + CHUNK_SIZE);
  const placeholders = chunk.map(() => '(?, ?, ?, ?, ?)').join(', ');
  const values = chunk.flatMap(t => [t.id, t.map_id, t.x, t.y, t.terrain_type]);
  statements.push(
    env.DB.prepare(`INSERT INTO tiles (id, map_id, x, y, terrain_type) VALUES ${placeholders}`)
      .bind(...values)
  );
}

// Single network call - all statements execute atomically
await env.DB.batch(statements);
```

## Performance Benchmarks (December 2024)

### INSERT Performance

| Approach | 1,000 rows | 10,000 rows | Network calls |
|----------|------------|-------------|---------------|
| Sequential chunked INSERTs | 2,700-3,300ms | ~30 sec | Many |
| batch() with individual statements | 177ms | ~1.7 sec | 1 |
| **batch() + chunked multi-value** | **46-50ms** | **~500ms** | **1** |

### UPDATE Performance (Tick System)

| Rows | Time | Notes |
|------|------|-------|
| 100 | 35ms | Single batch() call |
| 400 | 59ms | Single batch() call |
| 1,000 | ~150ms | Extrapolated |
| 5,000 | ~475ms | Tested |
| 10,000 | ~1.1 sec | Tested |
| 20,000 | ~2.0 sec | Tested |

### Tick System Feasibility

| Scenario | Updates | Estimated Time |
|----------|---------|----------------|
| 10 maps × 200 buildings | 2,000 | ~300ms |
| 50 maps × 200 buildings | 10,000 | ~1.1 sec |
| 50 maps × 400 buildings | 20,000 | ~2.0 sec |
| 100 maps × 200 buildings | 20,000 | ~2.0 sec |

## Code Patterns

### Pattern 1: Bulk INSERT (Map Creation)

```javascript
async function createTilesOptimized(env, mapId, width, height) {
  const tiles = [];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      tiles.push({
        id: crypto.randomUUID(),
        map_id: mapId,
        x, y,
        terrain_type: 'free_land'
      });
    }
  }

  const CHUNK_SIZE = 20;
  const statements = [];

  for (let i = 0; i < tiles.length; i += CHUNK_SIZE) {
    const chunk = tiles.slice(i, i + CHUNK_SIZE);
    const placeholders = chunk.map(() => '(?, ?, ?, ?, ?)').join(', ');
    const values = chunk.flatMap(t => [t.id, t.map_id, t.x, t.y, t.terrain_type]);
    statements.push(
      env.DB.prepare(`INSERT INTO tiles (id, map_id, x, y, terrain_type) VALUES ${placeholders}`)
        .bind(...values)
    );
  }

  await env.DB.batch(statements);
  return tiles.length;
}
```

### Pattern 2: Bulk UPDATE (Tick System)

```javascript
async function updateBuildingProfits(env, buildings) {
  // Prepare all UPDATE statements
  const statements = buildings.map(b =>
    env.DB.prepare(`
      UPDATE buildings
      SET calculated_profit = ?, profit_modifiers = ?, updated_at = datetime('now')
      WHERE id = ?
    `).bind(b.calculated_profit, JSON.stringify(b.modifiers), b.id)
  );

  // Single batch call - atomic transaction
  await env.DB.batch(statements);
}
```

### Pattern 3: Bulk READ + Process + Bulk UPDATE

```javascript
async function processMapTick(env, mapId) {
  // 1. Read all data for the map in parallel
  const [tiles, buildings, companies] = await Promise.all([
    env.DB.prepare('SELECT * FROM tiles WHERE map_id = ?').bind(mapId).all(),
    env.DB.prepare('SELECT * FROM buildings WHERE map_id = ?').bind(mapId).all(),
    env.DB.prepare('SELECT DISTINCT c.* FROM game_companies c JOIN tiles t ON t.owner_company_id = c.id WHERE t.map_id = ?').bind(mapId).all()
  ]);

  // 2. Build lookup maps for O(1) access
  const tileMap = new Map(tiles.results.map(t => [`${t.x},${t.y}`, t]));
  const buildingByTile = new Map(buildings.results.map(b => [b.tile_id, b]));

  // 3. Calculate profits in memory
  const updates = [];
  for (const building of buildings.results) {
    const profit = calculateBuildingProfit(building, tileMap, buildingByTile);
    updates.push({ id: building.id, profit });
  }

  // 4. Batch update
  const statements = updates.map(u =>
    env.DB.prepare('UPDATE buildings SET calculated_profit = ? WHERE id = ?')
      .bind(u.profit, u.id)
  );
  await env.DB.batch(statements);

  return updates.length;
}
```

### Pattern 4: Calculate Chunk Size Dynamically

```javascript
function calculateChunkSize(columnsPerRow) {
  // D1 limit is 100 params
  // Leave some margin for safety
  return Math.floor(95 / columnsPerRow);
}

// Examples:
// 5 columns -> chunk size 19
// 3 columns -> chunk size 31
// 10 columns -> chunk size 9
```

## Anti-Patterns to Avoid

### DON'T: Sequential Individual Inserts

```javascript
// BAD - N network round trips
for (const tile of tiles) {
  await env.DB.prepare('INSERT INTO tiles VALUES (?, ?, ?, ?, ?)')
    .bind(...).run();
}
```

### DON'T: Exceed Parameter Limit

```javascript
// BAD - Will fail at ~20+ rows
const allPlaceholders = tiles.map(() => '(?, ?, ?, ?, ?)').join(', ');
await env.DB.prepare(`INSERT ... VALUES ${allPlaceholders}`).bind(...allValues).run();
```

### DON'T: Multiple Separate batch() Calls

```javascript
// SUBOPTIMAL - Multiple network calls
for (let i = 0; i < statements.length; i += 100) {
  await env.DB.batch(statements.slice(i, i + 100));
}

// BETTER - Single batch call (D1 handles 20k+ statements)
await env.DB.batch(statements);
```

## References

- [Cloudflare D1 Limits](https://developers.cloudflare.com/d1/platform/limits/)
- [D1 batch() API](https://developers.cloudflare.com/d1/worker-api/d1-database/)
- [D1 Prepared Statements](https://developers.cloudflare.com/d1/worker-api/prepared-statements/)
