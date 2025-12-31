# Stage 03: Company Management

## Objective

Enable users to create and manage up to 3 anonymous companies, each assignable to one game location.

## Dependencies

`[Requires: Stage 01 complete]` - Needs game_companies table.
`[Requires: Stage 02 complete]` - Needs at least one map to join.

## Complexity

**Medium** - CRUD operations with business rules (3 company limit, anonymity).

## Files to Modify

| File | Changes |
|------|---------|
| `authentication-dashboard-system/src/App.tsx` | Add company routes |
| `authentication-dashboard-system/src/components/Sidebar.tsx` | Add companies menu |
| `authentication-dashboard-system/src/contexts/AuthContext.tsx` | Add company context |

## Files to Create

| File | Purpose |
|------|---------|
| `authentication-dashboard-system/src/pages/Companies.tsx` | Company list/management page |
| `authentication-dashboard-system/src/pages/CompanyCreate.tsx` | Create new company flow |
| `authentication-dashboard-system/src/pages/CompanyDashboard.tsx` | Single company view |
| `authentication-dashboard-system/src/components/CompanyCard.tsx` | Company summary card |
| `authentication-dashboard-system/src/components/LocationPicker.tsx` | Map/location selector |
| `authentication-dashboard-system/src/api/companies.ts` | Company API client |
| `authentication-dashboard-system/src/contexts/CompanyContext.tsx` | Active company state |
| `authentication-dashboard-system/src/worker/routes/companies.ts` | API routes |

## Implementation Details

### API Endpoints

```typescript
// GET /api/companies - List user's companies
interface CompanyListResponse {
  companies: GameCompany[];
  max_companies: number; // 3 by default
}

// POST /api/companies - Create new company
interface CreateCompanyRequest {
  name: string;
}

// GET /api/companies/:id - Get company details
// PUT /api/companies/:id - Update company (name only)
// DELETE /api/companies/:id - Delete company (confirmation required)

// POST /api/companies/:id/join-location - Join a map
interface JoinLocationRequest {
  map_id: string;
}

// POST /api/companies/:id/leave-location - Leave current map
// Sells all buildings, returns to location selection
```

### Company List Page

```tsx
// Companies.tsx
export function Companies() {
  const { companies, isLoading, refetch } = useCompanies();
  const navigate = useNavigate();

  const canCreateMore = companies.length < 3;

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-white">Your Companies</h1>
        {canCreateMore && (
          <button
            onClick={() => navigate('/companies/new')}
            className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
          >
            + New Company
          </button>
        )}
      </div>

      {companies.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-gray-400 mb-4">You don't have any companies yet.</p>
          <button
            onClick={() => navigate('/companies/new')}
            className="px-6 py-3 bg-green-600 text-white rounded-lg"
          >
            Create Your First Company
          </button>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-3">
          {companies.map(company => (
            <CompanyCard
              key={company.id}
              company={company}
              onSelect={() => navigate(`/companies/${company.id}`)}
            />
          ))}

          {canCreateMore && (
            <div
              onClick={() => navigate('/companies/new')}
              className="border-2 border-dashed border-gray-600 rounded-lg p-6 flex items-center justify-center cursor-pointer hover:border-gray-400"
            >
              <span className="text-gray-400">+ Add Company</span>
            </div>
          )}
        </div>
      )}

      <p className="text-sm text-gray-500 mt-4">
        {companies.length}/3 company slots used
      </p>
    </div>
  );
}
```

### Company Card

```tsx
// CompanyCard.tsx
export function CompanyCard({ company, onSelect }: { company: GameCompany; onSelect: () => void }) {
  return (
    <div
      onClick={onSelect}
      className="bg-gray-800 rounded-lg p-6 cursor-pointer hover:bg-gray-700 transition"
    >
      <h3 className="text-xl font-bold text-white mb-2">{company.name}</h3>

      {company.current_map_id ? (
        <>
          <div className="flex items-center gap-2 text-sm text-gray-400 mb-4">
            <span className="capitalize">{company.location_type}</span>
            <span>•</span>
            <span>Level {company.level}</span>
          </div>

          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-gray-500">Cash</p>
              <p className="text-green-400 font-mono">${company.cash.toLocaleString()}</p>
            </div>
            <div>
              <p className="text-gray-500">Offshore</p>
              <p className="text-blue-400 font-mono">${company.offshore.toLocaleString()}</p>
            </div>
          </div>

          {company.is_in_prison && (
            <div className="mt-4 p-2 bg-red-900/50 rounded text-red-400 text-sm">
              🚔 In Prison - Fine: ${company.prison_fine.toLocaleString()}
            </div>
          )}
        </>
      ) : (
        <p className="text-gray-500">No location - Click to join a town</p>
      )}
    </div>
  );
}
```

### Create Company Flow

```tsx
// CompanyCreate.tsx
export function CompanyCreate() {
  const [step, setStep] = useState<'name' | 'location'>('name');
  const [name, setName] = useState('');
  const [selectedMap, setSelectedMap] = useState<string | null>(null);
  const navigate = useNavigate();
  const { createCompany } = useCompanies();

  const handleCreate = async () => {
    const company = await createCompany({ name });
    if (selectedMap) {
      await joinLocation(company.id, selectedMap);
    }
    navigate(`/companies/${company.id}`);
  };

  if (step === 'name') {
    return (
      <div className="max-w-md mx-auto p-6">
        <h1 className="text-2xl font-bold text-white mb-6">Create Company</h1>

        <label className="block text-white mb-2">
          Company Name
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Enter a name for your company"
            className="w-full p-3 mt-1 rounded bg-gray-700 text-white"
            maxLength={30}
          />
        </label>

        <p className="text-sm text-gray-500 mb-6">
          Your company identity is anonymous. Other players cannot see who owns it.
        </p>

        <button
          onClick={() => setStep('location')}
          disabled={!name.trim()}
          className="w-full py-3 bg-blue-600 text-white rounded disabled:opacity-50"
        >
          Next: Choose Location
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto p-6">
      <h1 className="text-2xl font-bold text-white mb-2">Choose Starting Location</h1>
      <p className="text-gray-400 mb-6">Select a town to begin your journey.</p>

      <LocationPicker
        locationType="town"
        selectedMap={selectedMap}
        onSelect={setSelectedMap}
      />

      <div className="flex gap-4 mt-6">
        <button
          onClick={() => setStep('name')}
          className="px-6 py-3 bg-gray-600 text-white rounded"
        >
          Back
        </button>
        <button
          onClick={handleCreate}
          disabled={!selectedMap}
          className="flex-1 py-3 bg-green-600 text-white rounded disabled:opacity-50"
        >
          Create Company & Start
        </button>
      </div>
    </div>
  );
}
```

### Location Picker

```tsx
// LocationPicker.tsx
export function LocationPicker({ locationType, selectedMap, onSelect }) {
  const { maps, isLoading } = useMaps({ type: locationType });

  if (isLoading) return <div>Loading locations...</div>;

  // Group by country
  const byCountry = maps.reduce((acc, map) => {
    if (!acc[map.country]) acc[map.country] = [];
    acc[map.country].push(map);
    return acc;
  }, {} as Record<string, GameMap[]>);

  return (
    <div className="space-y-4">
      {Object.entries(byCountry).map(([country, countryMaps]) => (
        <div key={country}>
          <h3 className="text-lg font-bold text-white mb-2">{country}</h3>
          <div className="grid gap-2 md:grid-cols-2">
            {countryMaps.map(map => (
              <div
                key={map.id}
                onClick={() => onSelect(map.id)}
                className={`p-4 rounded-lg cursor-pointer transition ${
                  selectedMap === map.id
                    ? 'bg-blue-600 ring-2 ring-blue-400'
                    : 'bg-gray-700 hover:bg-gray-600'
                }`}
              >
                <p className="font-bold text-white">{map.name}</p>
                <p className="text-sm text-gray-300">
                  {map.width}x{map.height} • Hero: ${map.hero_net_worth.toLocaleString()}
                </p>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
```

### Company Context

```tsx
// CompanyContext.tsx
interface CompanyContextType {
  activeCompany: GameCompany | null;
  setActiveCompany: (company: GameCompany | null) => void;
  refreshCompany: () => Promise<void>;
}

export const CompanyContext = createContext<CompanyContextType | null>(null);

export function CompanyProvider({ children }) {
  const [activeCompany, setActiveCompany] = useState<GameCompany | null>(null);

  const refreshCompany = async () => {
    if (!activeCompany) return;
    const updated = await fetchCompany(activeCompany.id);
    setActiveCompany(updated);
  };

  return (
    <CompanyContext.Provider value={{ activeCompany, setActiveCompany, refreshCompany }}>
      {children}
    </CompanyContext.Provider>
  );
}
```

### API Implementation

```typescript
// worker/routes/companies.ts
export async function handleCompanies(request: Request, env: Env, user: User) {
  const url = new URL(request.url);
  const method = request.method;

  // GET /api/companies
  if (method === 'GET' && !url.pathname.includes('/companies/')) {
    const companies = await env.DB.prepare(
      'SELECT * FROM game_companies WHERE user_id = ?'
    ).bind(user.id).all();

    return json({ companies: companies.results, max_companies: 3 });
  }

  // POST /api/companies
  if (method === 'POST' && url.pathname === '/api/companies') {
    const { name } = await request.json();

    // Check limit
    const count = await env.DB.prepare(
      'SELECT COUNT(*) as count FROM game_companies WHERE user_id = ?'
    ).bind(user.id).first();

    if (count.count >= 3) {
      return json({ error: 'Maximum 3 companies allowed' }, { status: 400 });
    }

    const id = crypto.randomUUID();
    await env.DB.prepare(`
      INSERT INTO game_companies (id, user_id, name, cash, offshore, level, total_actions)
      VALUES (?, ?, ?, 50000, 0, 1, 0)
    `).bind(id, user.id, name).run();

    const company = await env.DB.prepare(
      'SELECT * FROM game_companies WHERE id = ?'
    ).bind(id).first();

    return json({ company });
  }

  // ... other routes
}
```

## Database Changes

No new tables. Uses game_companies table from Stage 01.

## Test Cases

| Test | Input | Expected Output |
|------|-------|-----------------|
| Create first company | Valid name | Company created with 50k cash |
| Create 4th company | User has 3 companies | Error: limit reached |
| Join location | Valid map_id | Company assigned to map |
| Leave location | Company in location | Buildings sold, cash returned |
| Company isolation | User A checks User B's company | Cannot access |
| Anonymous check | View company list | No user info visible |

## Acceptance Checklist

- [ ] Can create up to 3 companies
- [ ] Cannot create more than 3 companies
- [ ] Can name company (max 30 chars)
- [ ] Can view list of own companies
- [ ] Cannot view other users' companies
- [ ] Can join a town (first location)
- [ ] Company starts with 50k cash
- [ ] Company starts at level 1
- [ ] Company context tracks active company
- [ ] Can switch between companies

## Deployment

```bash
npm run build
CLOUDFLARE_API_TOKEN="..." CLOUDFLARE_ACCOUNT_ID="..." npx wrangler pages deploy ./dist --project-name=notropolis-dashboard
```

## Handoff Notes

- Companies are linked to users but this relationship is never exposed to other players
- The `active company` concept is important - most game actions require a selected company
- Starting cash varies by location type: Town=50k, City=1M, Capital=5M
- Companies without a location are in a "lobby" state
- Consider adding company deletion confirmation (maybe require typing company name)
