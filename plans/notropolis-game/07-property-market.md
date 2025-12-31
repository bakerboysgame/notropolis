# Stage 07: Property Market

## Objective

Implement property sales including sell to state, list for sale, and buy from other players with inflated pricing.

## Dependencies

`[Requires: Stage 05 complete]` - Needs buildings to sell.
`[Requires: Stage 06 complete]` - Needs tick system for ongoing context.

## Complexity

**Medium** - Market mechanics with pricing calculations.

## Files to Modify

| File | Changes |
|------|---------|
| `authentication-dashboard-system/src/components/game/TileInfo.tsx` | Add sell/buy buttons |
| `authentication-dashboard-system/src/components/game/MapCanvas.tsx` | Highlight for-sale properties |

## Files to Create

| File | Purpose |
|------|---------|
| `authentication-dashboard-system/src/components/game/SellModal.tsx` | Sell options modal |
| `authentication-dashboard-system/src/components/game/BuyPropertyModal.tsx` | Buy from other player |
| `authentication-dashboard-system/src/components/game/MarketListings.tsx` | List of properties for sale |
| `authentication-dashboard-system/src/pages/Market.tsx` | Market overview page |
| `authentication-dashboard-system/worker/src/routes/game/market.js` | Market API routes |
| `authentication-dashboard-system/worker/src/utils/marketPricing.js` | Pricing calculation utilities |

## Implementation Details

### API Endpoints

```typescript
// POST /api/game/market/sell-to-state
interface SellToStateRequest {
  building_id: string;
}
// Returns 50% of building cost + land value

// POST /api/game/market/list-for-sale
interface ListForSaleRequest {
  building_id: string;
  price: number; // Player sets price
}

// POST /api/game/market/cancel-listing
interface CancelListingRequest {
  building_id: string;
}

// POST /api/game/market/buy-property
interface BuyPropertyRequest {
  building_id: string;
}
// Pays listing price to seller

// GET /api/game/market/listings?map_id=xxx
// Returns all properties for sale on a map

// POST /api/game/market/demolish
interface DemolishRequest {
  building_id: string;
}
// Only for collapsed buildings, returns land to free state
```

### Pricing Logic

```javascript
// worker/src/utils/marketPricing.js
// Import calculateLandCost from adjacencyCalculator
import { calculateLandCost } from '../adjacencyCalculator.js';

export function calculateSellToStateValue(building, buildingType, tile, map) {
  // Base: 50% of building cost
  const buildingValue = Math.round(buildingType.cost * 0.5);

  // Damage reduces value (using same formula as profit: 85% damage = 15% health = worthless)
  const healthMultiplier = Math.max(0, (100 - building.damage_percent * 1.176) / 100);
  const adjustedBuildingValue = Math.round(buildingValue * healthMultiplier);

  // Land value (original purchase price, stored or calculated)
  const landValue = calculateLandCost(tile, map);

  return adjustedBuildingValue + landValue;
}

export function calculateMinListingPrice(building, buildingType) {
  // Minimum listing: 80% of building cost
  return Math.round(buildingType.cost * 0.8);
}

export function calculateBuyFromPlayerPrice(building, buildingType, tile, map) {
  // If not for sale, calculate inflated price
  // 200% of building cost + land value + profit premium
  const buildingValue = buildingType.cost * 2;
  const landValue = calculateLandCost(tile, map);
  const profitPremium = building.calculated_profit * 10; // 10 ticks worth

  return Math.round(buildingValue + landValue + profitPremium);
}
```

### Sell to State API

```javascript
// worker/src/routes/game/market.js
// Import pricing utilities
import { calculateSellToStateValue } from '../utils/marketPricing.js';
import { markAffectedBuildingsDirty } from '../adjacencyCalculator.js';

export async function sellToState(request, env, company) {
  const { building_id } = await request.json();

  // Get building with type and tile info
  const building = await env.DB.prepare(`
    SELECT bi.*, bt.cost as type_cost, bt.name as type_name,
           t.id as tile_id, t.x, t.y, t.map_id, t.terrain_type
    FROM building_instances bi
    JOIN building_types bt ON bi.building_type_id = bt.id
    JOIN tiles t ON bi.tile_id = t.id
    WHERE bi.id = ? AND bi.company_id = ?
  `).bind(building_id, company.id).first();

  if (!building) throw new Error('Building not found or not owned by you');
  if (building.is_collapsed) throw new Error('Cannot sell collapsed buildings');

  const map = await env.DB.prepare(
    'SELECT * FROM maps WHERE id = ?'
  ).bind(building.map_id).first();

  // Calculate sale value
  const saleValue = calculateSellToStateValue(
    building,
    { cost: building.type_cost },
    building, // Has x, y from tile join
    map
  );

  await env.DB.batch([
    // Delete building
    env.DB.prepare('DELETE FROM building_instances WHERE id = ?').bind(building_id),

    // Delete security if exists
    env.DB.prepare('DELETE FROM building_security WHERE building_id = ?').bind(building_id),

    // Clear tile ownership
    env.DB.prepare(
      'UPDATE tiles SET owner_company_id = NULL, purchased_at = NULL WHERE id = ?'
    ).bind(building.tile_id),

    // Add cash to company and reset tick counter
    env.DB.prepare(
      'UPDATE game_companies SET cash = cash + ?, total_actions = total_actions + 1, last_action_at = ?, ticks_since_action = 0 WHERE id = ?'
    ).bind(saleValue, new Date().toISOString(), company.id),

    // Log transaction
    env.DB.prepare(`
      INSERT INTO game_transactions (id, company_id, map_id, action_type, target_building_id, amount)
      VALUES (?, ?, ?, 'sell_to_state', ?, ?)
    `).bind(crypto.randomUUID(), company.id, building.map_id, building_id, saleValue),
  ]);

  // Mark adjacent buildings dirty for profit recalc (tile is now empty)
  await markAffectedBuildingsDirty(env, building.x, building.y, building.map_id);

  return { success: true, sale_value: saleValue };
}
```

### List for Sale API

```javascript
import { calculateMinListingPrice } from '../utils/marketPricing.js';

export async function listForSale(request, env, company) {
  const { building_id, price } = await request.json();

  const building = await env.DB.prepare(`
    SELECT bi.*, bt.cost as type_cost
    FROM building_instances bi
    JOIN building_types bt ON bi.building_type_id = bt.id
    WHERE bi.id = ? AND bi.company_id = ?
  `).bind(building_id, company.id).first();

  if (!building) throw new Error('Building not found or not owned');
  if (building.is_collapsed) throw new Error('Cannot sell collapsed buildings');
  if (building.is_for_sale) throw new Error('Already listed for sale');

  // Validate price (minimum 80% of building cost)
  const minPrice = calculateMinListingPrice(building, { cost: building.type_cost });
  if (price < minPrice) {
    throw new Error(`Minimum listing price is $${minPrice.toLocaleString()}`);
  }

  await env.DB.batch([
    // Mark building for sale
    env.DB.prepare(`
      UPDATE building_instances SET is_for_sale = 1, sale_price = ? WHERE id = ?
    `).bind(price, building_id),

    // Reset tick counter for strategic action
    env.DB.prepare(
      'UPDATE game_companies SET total_actions = total_actions + 1, last_action_at = ?, ticks_since_action = 0 WHERE id = ?'
    ).bind(new Date().toISOString(), company.id)
  ]);

  return { success: true, listing_price: price };
}

export async function cancelListing(request, env, company) {
  const { building_id } = await request.json();

  await env.DB.batch([
    // Remove listing
    env.DB.prepare(`
      UPDATE building_instances
      SET is_for_sale = 0, sale_price = NULL
      WHERE id = ? AND company_id = ?
    `).bind(building_id, company.id),

    // Reset tick counter for strategic action
    env.DB.prepare(
      'UPDATE game_companies SET total_actions = total_actions + 1, last_action_at = ?, ticks_since_action = 0 WHERE id = ?'
    ).bind(new Date().toISOString(), company.id)
  ]);

  return { success: true };
}
```

### Buy Property API

```javascript
export async function buyProperty(request, env, company) {
  const { building_id } = await request.json();

  const building = await env.DB.prepare(`
    SELECT bi.*, bt.cost as type_cost, bt.name as type_name,
           t.id as tile_id, t.map_id
    FROM building_instances bi
    JOIN building_types bt ON bi.building_type_id = bt.id
    JOIN tiles t ON bi.tile_id = t.id
    WHERE bi.id = ?
  `).bind(building_id).first();

  if (!building) throw new Error('Building not found');
  if (building.company_id === company.id) throw new Error('You already own this building');
  if (!building.is_for_sale) throw new Error('This building is not for sale');

  const price = building.sale_price;
  if (company.cash < price) throw new Error('Insufficient funds');

  const sellerId = building.company_id;

  await env.DB.batch([
    // Deduct cash from buyer and reset tick counter
    env.DB.prepare(
      'UPDATE game_companies SET cash = cash - ?, total_actions = total_actions + 1, last_action_at = ?, ticks_since_action = 0 WHERE id = ?'
    ).bind(price, new Date().toISOString(), company.id),

    // Add cash to seller
    env.DB.prepare(
      'UPDATE game_companies SET cash = cash + ? WHERE id = ?'
    ).bind(price, sellerId),

    // Transfer building ownership
    env.DB.prepare(`
      UPDATE building_instances
      SET company_id = ?, is_for_sale = 0, sale_price = NULL
      WHERE id = ?
    `).bind(company.id, building_id),

    // Transfer tile ownership
    env.DB.prepare(
      'UPDATE tiles SET owner_company_id = ?, purchased_at = ? WHERE id = ?'
    ).bind(company.id, new Date().toISOString(), building.tile_id),

    // Log buyer transaction
    env.DB.prepare(`
      INSERT INTO game_transactions (id, company_id, map_id, action_type, target_building_id, target_company_id, amount)
      VALUES (?, ?, ?, 'buy_property', ?, ?, ?)
    `).bind(crypto.randomUUID(), company.id, building.map_id, building_id, sellerId, -price),

    // Log seller transaction
    env.DB.prepare(`
      INSERT INTO game_transactions (id, company_id, map_id, action_type, target_building_id, target_company_id, amount)
      VALUES (?, ?, ?, 'sell_property', ?, ?, ?)
    `).bind(crypto.randomUUID(), sellerId, building.map_id, building_id, company.id, price),
  ]);

  return { success: true, purchase_price: price };
}
```

### Demolish Collapsed Building

```javascript
import { markAffectedBuildingsDirty } from '../adjacencyCalculator.js';

export async function demolishBuilding(request, env, company) {
  const { building_id } = await request.json();

  const building = await env.DB.prepare(`
    SELECT bi.*, t.id as tile_id, t.x, t.y, t.map_id
    FROM building_instances bi
    JOIN tiles t ON bi.tile_id = t.id
    WHERE bi.id = ? AND bi.company_id = ?
  `).bind(building_id, company.id).first();

  if (!building) throw new Error('Building not found or not owned');
  if (!building.is_collapsed) throw new Error('Can only demolish collapsed buildings');

  // Demolition cost (10% of original building cost)
  const buildingType = await env.DB.prepare(
    'SELECT cost FROM building_types WHERE id = ?'
  ).bind(building.building_type_id).first();

  const demolitionCost = Math.round(buildingType.cost * 0.10);

  if (company.cash < demolitionCost) throw new Error('Insufficient funds for demolition');

  await env.DB.batch([
    // Delete building
    env.DB.prepare('DELETE FROM building_instances WHERE id = ?').bind(building_id),

    // Delete security
    env.DB.prepare('DELETE FROM building_security WHERE building_id = ?').bind(building_id),

    // Deduct demolition cost (keep tile ownership) and reset tick counter
    env.DB.prepare(
      'UPDATE game_companies SET cash = cash - ?, total_actions = total_actions + 1, last_action_at = ?, ticks_since_action = 0 WHERE id = ?'
    ).bind(demolitionCost, new Date().toISOString(), company.id),

    // Log transaction
    env.DB.prepare(`
      INSERT INTO game_transactions (id, company_id, map_id, action_type, target_building_id, amount)
      VALUES (?, ?, ?, 'demolish', ?, ?)
    `).bind(crypto.randomUUID(), company.id, building.map_id, building_id, -demolitionCost),
  ]);

  // Mark adjacent buildings dirty for profit recalc (tile is now empty)
  await markAffectedBuildingsDirty(env, building.x, building.y, building.map_id);

  return { success: true, demolition_cost: demolitionCost };
}
```

### UI Components

```tsx
// SellModal.tsx
export function SellModal({ building, buildingType, tile, map, onClose }) {
  const [mode, setMode] = useState<'options' | 'list' | 'state'>('options');
  const [listPrice, setListPrice] = useState(buildingType.cost);

  const stateValue = calculateSellToStateValue(building, buildingType, tile, map);
  const minListPrice = calculateMinListingPrice(building, buildingType);

  const handleSellToState = async () => {
    await api.market.sellToState(building.id);
    onClose();
  };

  const handleListForSale = async () => {
    await api.market.listForSale(building.id, listPrice);
    onClose();
  };

  if (mode === 'options') {
    return (
      <Modal onClose={onClose}>
        <h2 className="text-xl font-bold text-white mb-4">Sell {buildingType.name}</h2>

        <div className="space-y-4">
          <button
            onClick={() => setMode('state')}
            className="w-full p-4 bg-gray-700 rounded-lg text-left hover:bg-gray-600"
          >
            <p className="font-bold text-white">Sell to State</p>
            <p className="text-sm text-gray-400">Instant sale for ${stateValue.toLocaleString()}</p>
            <p className="text-xs text-gray-500">Building and land returned to state</p>
          </button>

          <button
            onClick={() => setMode('list')}
            className="w-full p-4 bg-gray-700 rounded-lg text-left hover:bg-gray-600"
          >
            <p className="font-bold text-white">List on Market</p>
            <p className="text-sm text-gray-400">Set your own price for other players</p>
            <p className="text-xs text-gray-500">Minimum: ${minListPrice.toLocaleString()}</p>
          </button>
        </div>
      </Modal>
    );
  }

  if (mode === 'state') {
    return (
      <Modal onClose={onClose}>
        <h2 className="text-xl font-bold text-white mb-4">Confirm Sale to State</h2>
        <p className="text-gray-300 mb-4">
          You will receive <span className="text-green-400 font-bold">${stateValue.toLocaleString()}</span>
        </p>
        <p className="text-sm text-gray-500 mb-6">
          The building will be demolished and land returned to the state.
        </p>
        <div className="flex gap-4">
          <button onClick={() => setMode('options')} className="flex-1 py-2 bg-gray-600 text-white rounded">
            Back
          </button>
          <button onClick={handleSellToState} className="flex-1 py-2 bg-green-600 text-white rounded">
            Sell for ${stateValue.toLocaleString()}
          </button>
        </div>
      </Modal>
    );
  }

  return (
    <Modal onClose={onClose}>
      <h2 className="text-xl font-bold text-white mb-4">List for Sale</h2>

      <label className="block text-white mb-4">
        <span className="text-gray-400">Listing Price</span>
        <input
          type="number"
          value={listPrice}
          onChange={(e) => setListPrice(Math.max(minListPrice, Number(e.target.value)))}
          min={minListPrice}
          className="w-full p-3 mt-1 rounded bg-gray-700 text-white"
        />
        <span className="text-sm text-gray-500">Minimum: ${minListPrice.toLocaleString()}</span>
      </label>

      <div className="flex gap-4">
        <button onClick={() => setMode('options')} className="flex-1 py-2 bg-gray-600 text-white rounded">
          Back
        </button>
        <button onClick={handleListForSale} className="flex-1 py-2 bg-blue-600 text-white rounded">
          List for ${listPrice.toLocaleString()}
        </button>
      </div>
    </Modal>
  );
}
```

```tsx
// MarketListings.tsx
export function MarketListings({ mapId }) {
  const { listings, isLoading } = useMarketListings(mapId);
  const { activeCompany } = useCompany();

  if (isLoading) return <LoadingSpinner />;

  const otherListings = listings.filter(l => l.company_id !== activeCompany.id);
  const myListings = listings.filter(l => l.company_id === activeCompany.id);

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-white mb-6">Property Market</h1>

      {myListings.length > 0 && (
        <div className="mb-8">
          <h2 className="text-lg font-bold text-white mb-4">Your Listings</h2>
          <div className="space-y-2">
            {myListings.map(listing => (
              <div key={listing.id} className="flex justify-between items-center p-4 bg-gray-700 rounded">
                <div>
                  <p className="text-white font-bold">{listing.type_name}</p>
                  <p className="text-sm text-gray-400">({listing.x}, {listing.y})</p>
                </div>
                <div className="text-right">
                  <p className="text-yellow-400">${listing.sale_price.toLocaleString()}</p>
                  <button
                    onClick={() => api.market.cancelListing(listing.id)}
                    className="text-sm text-red-400 hover:text-red-300"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <h2 className="text-lg font-bold text-white mb-4">Available Properties</h2>
      {otherListings.length === 0 ? (
        <p className="text-gray-500">No properties currently for sale</p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {otherListings.map(listing => (
            <PropertyListingCard key={listing.id} listing={listing} />
          ))}
        </div>
      )}
    </div>
  );
}
```

## Database Changes

No new tables. Uses existing `is_for_sale` and `sale_price` columns on `building_instances`.

## Test Cases

| Test | Input | Expected Output |
|------|-------|-----------------|
| Sell to state | Owned building | Cash received, building deleted, land freed |
| Sell damaged building | 50% damaged building | Reduced payout |
| List for sale | Valid price | Building marked for sale |
| List below minimum | Price < 80% cost | Error: below minimum |
| Cancel listing | Listed building | Listing removed |
| Buy listed property | Sufficient cash | Ownership transferred, money exchanged |
| Buy unlisted property | Not for sale | Error: not for sale |
| Buy own property | Own building | Error: already own |
| Demolish collapsed | 100% damage building | Building removed, land kept |
| Demolish intact | Intact building | Error: can only demolish collapsed |

## Acceptance Checklist

- [ ] Can sell building to state (50% cost + land value)
- [ ] Damage reduces state sale value
- [ ] Can list building for sale (minimum 80% cost)
- [ ] Can cancel listing
- [ ] Can buy listed properties from others
- [ ] Money transfers to seller on purchase
- [ ] Ownership transfers correctly (building and tile)
- [ ] Can demolish collapsed buildings
- [ ] Demolition has cost (10% of building cost)
- [ ] Market page shows all listings
- [ ] For-sale buildings highlighted on map

## Deployment

```bash
# 1. Deploy worker with new market routes
cd authentication-dashboard-system/worker
CLOUDFLARE_API_TOKEN="..." npx wrangler deploy

# 2. Build and deploy frontend
cd ..
npm run build
CLOUDFLARE_API_TOKEN="..." CLOUDFLARE_ACCOUNT_ID="..." npx wrangler pages deploy ./dist --project-name=notropolis-dashboard
```

## Handoff Notes

- Sell to state = instant, lower value
- List for sale = player sets price, waits for buyer
- Buying from others transfers ownership completely
- Collapsed buildings must be demolished before rebuilding
- Demolition keeps land ownership
- Consider adding offer system in future (offer less than asking price)
