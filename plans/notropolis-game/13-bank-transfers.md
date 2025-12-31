# Stage 13: Bank Transfers

## Objective

Implement the bank system allowing transfers between a user's own companies with daily limits.

## Dependencies

`[Requires: Stage 03 complete]` - Needs multiple companies.
`[Requires: Stage 10 complete]` - Prison can receive but not send.

## Complexity

**Medium** - Cross-company transfers with rate limiting.

## Files to Modify

| File | Changes |
|------|---------|
| `authentication-dashboard-system/src/pages/CompanyDashboard.tsx` | Add bank button |

## Files to Create

| File | Purpose |
|------|---------|
| `authentication-dashboard-system/src/pages/Bank.tsx` | Bank interface |
| `authentication-dashboard-system/src/components/game/TransferModal.tsx` | Transfer confirmation |
| `authentication-dashboard-system/src/worker/routes/game/bank.ts` | Bank API |
| `authentication-dashboard-system/migrations/0017_create_transfers_table.sql` | Transfer tracking |

## Implementation Details

### Database Migration

```sql
-- 0017_create_transfers_table.sql
CREATE TABLE bank_transfers (
  id TEXT PRIMARY KEY,
  from_company_id TEXT NOT NULL,
  to_company_id TEXT NOT NULL,
  amount INTEGER NOT NULL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (from_company_id) REFERENCES game_companies(id),
  FOREIGN KEY (to_company_id) REFERENCES game_companies(id)
);

CREATE INDEX idx_transfers_from ON bank_transfers(from_company_id);
CREATE INDEX idx_transfers_to ON bank_transfers(to_company_id);
CREATE INDEX idx_transfers_time ON bank_transfers(created_at);
```

### Transfer Limits

```typescript
// utils/bankLimits.ts
export const TRANSFER_LIMITS = {
  town: {
    maxPerTransfer: 50_000,
    maxTransfersPerDay: 3,
  },
  city: {
    maxPerTransfer: 500_000,
    maxTransfersPerDay: 3,
  },
  capital: {
    maxPerTransfer: 1_000_000,
    maxTransfersPerDay: 3,
  },
} as const;

export function getTransferLimits(locationType: 'town' | 'city' | 'capital') {
  return TRANSFER_LIMITS[locationType];
}
```

### Bank API

```typescript
// worker/routes/game/bank.ts
export async function getTransferStatus(env: Env, companyId: string) {
  const company = await env.DB.prepare(
    'SELECT * FROM game_companies WHERE id = ?'
  ).bind(companyId).first();

  if (!company.current_map_id) {
    return { canReceive: false, reason: 'Not in a location' };
  }

  const limits = getTransferLimits(company.location_type);

  // Count today's transfers TO this company
  const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

  const todayTransfers = await env.DB.prepare(`
    SELECT COUNT(*) as count, COALESCE(SUM(amount), 0) as total
    FROM bank_transfers
    WHERE to_company_id = ?
      AND date(created_at) = date(?)
  `).bind(companyId, today).first();

  return {
    canReceive: todayTransfers.count < limits.maxTransfersPerDay,
    transfersToday: todayTransfers.count,
    amountReceivedToday: todayTransfers.total,
    maxTransfersPerDay: limits.maxTransfersPerDay,
    maxPerTransfer: limits.maxPerTransfer,
    locationType: company.location_type,
  };
}

export async function transfer(request: Request, env: Env, user: User) {
  const { from_company_id, to_company_id, amount } = await request.json();

  // Validate ownership of both companies
  const fromCompany = await env.DB.prepare(
    'SELECT * FROM game_companies WHERE id = ? AND user_id = ?'
  ).bind(from_company_id, user.id).first();

  const toCompany = await env.DB.prepare(
    'SELECT * FROM game_companies WHERE id = ? AND user_id = ?'
  ).bind(to_company_id, user.id).first();

  if (!fromCompany) throw new Error('Source company not found or not owned');
  if (!toCompany) throw new Error('Destination company not found or not owned');

  // Cannot send from prison
  if (fromCompany.is_in_prison) {
    throw new Error('Cannot send transfers while in prison');
  }

  // Destination must be in a location
  if (!toCompany.current_map_id) {
    throw new Error('Destination company is not in a location');
  }

  // Get limits for destination
  const limits = getTransferLimits(toCompany.location_type);

  // Validate amount
  if (amount <= 0) throw new Error('Invalid amount');
  if (amount > limits.maxPerTransfer) {
    throw new Error(`Maximum transfer to ${toCompany.location_type} is $${limits.maxPerTransfer.toLocaleString()}`);
  }
  if (amount > fromCompany.cash) {
    throw new Error('Insufficient funds');
  }

  // Check daily limit
  const today = new Date().toISOString().split('T')[0];
  const todayTransfers = await env.DB.prepare(`
    SELECT COUNT(*) as count
    FROM bank_transfers
    WHERE to_company_id = ?
      AND date(created_at) = date(?)
  `).bind(to_company_id, today).first();

  if (todayTransfers.count >= limits.maxTransfersPerDay) {
    throw new Error(`Destination company has reached daily transfer limit (${limits.maxTransfersPerDay})`);
  }

  // Perform transfer
  await env.DB.batch([
    // Deduct from sender
    // NOTE: Does NOT reset ticks_since_action - bank transfers are not strategic actions
    env.DB.prepare(
      'UPDATE game_companies SET cash = cash - ? WHERE id = ?'
    ).bind(amount, from_company_id),

    // Add to receiver (passive receipt, no tick reset)
    env.DB.prepare(
      'UPDATE game_companies SET cash = cash + ? WHERE id = ?'
    ).bind(amount, to_company_id),

    // Log transfer
    env.DB.prepare(`
      INSERT INTO bank_transfers (id, from_company_id, to_company_id, amount)
      VALUES (?, ?, ?, ?)
    `).bind(crypto.randomUUID(), from_company_id, to_company_id, amount),

    // Log transaction for sender
    env.DB.prepare(`
      INSERT INTO game_transactions (id, company_id, action_type, target_company_id, amount)
      VALUES (?, ?, 'bank_transfer_sent', ?, ?)
    `).bind(crypto.randomUUID(), from_company_id, to_company_id, -amount),

    // Log transaction for receiver
    env.DB.prepare(`
      INSERT INTO game_transactions (id, company_id, action_type, target_company_id, amount)
      VALUES (?, ?, 'bank_transfer_received', ?, ?)
    `).bind(crypto.randomUUID(), to_company_id, from_company_id, amount),
  ]);

  return {
    success: true,
    amount,
    from_remaining: fromCompany.cash - amount,
    to_new_balance: toCompany.cash + amount,
  };
}

export async function getTransferHistory(env: Env, companyId: string) {
  const transfers = await env.DB.prepare(`
    SELECT
      bt.*,
      fc.name as from_company_name,
      tc.name as to_company_name
    FROM bank_transfers bt
    JOIN game_companies fc ON bt.from_company_id = fc.id
    JOIN game_companies tc ON bt.to_company_id = tc.id
    WHERE bt.from_company_id = ? OR bt.to_company_id = ?
    ORDER BY bt.created_at DESC
    LIMIT 50
  `).bind(companyId, companyId).all();

  return transfers.results;
}
```

### Bank Page

```tsx
// pages/Bank.tsx
export function Bank() {
  const { activeCompany } = useCompany();
  const { data: companies } = useUserCompanies();
  const { data: transferStatus } = useTransferStatus(activeCompany?.id);
  const [selectedTarget, setSelectedTarget] = useState<string | null>(null);
  const [amount, setAmount] = useState('');
  const [showTransferModal, setShowTransferModal] = useState(false);

  const otherCompanies = companies?.filter(c => c.id !== activeCompany?.id) || [];

  const handleTransfer = async () => {
    if (!selectedTarget || !amount) return;
    await api.bank.transfer(activeCompany.id, selectedTarget, parseInt(amount));
    setShowTransferModal(false);
    setAmount('');
  };

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold text-white mb-6">🏦 Bank</h1>

      {/* Current company status */}
      <div className="bg-gray-800 rounded-lg p-4 mb-6">
        <h2 className="font-bold text-white mb-2">{activeCompany?.name}</h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-gray-400 text-sm">Cash Balance</p>
            <p className="text-2xl font-mono text-green-400">
              ${activeCompany?.cash.toLocaleString()}
            </p>
          </div>
          <div>
            <p className="text-gray-400 text-sm">Offshore</p>
            <p className="text-2xl font-mono text-blue-400">
              ${activeCompany?.offshore.toLocaleString()}
            </p>
          </div>
        </div>
      </div>

      {/* Transfer limits */}
      {transferStatus && (
        <div className="bg-gray-800 rounded-lg p-4 mb-6">
          <h3 className="font-bold text-white mb-2">Transfer Limits (Receiving)</h3>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-gray-400">Transfers today</p>
              <p className="text-white">
                {transferStatus.transfersToday} / {transferStatus.maxTransfersPerDay}
              </p>
            </div>
            <div>
              <p className="text-gray-400">Max per transfer</p>
              <p className="text-white">${transferStatus.maxPerTransfer.toLocaleString()}</p>
            </div>
          </div>
        </div>
      )}

      {/* Send transfer */}
      <div className="bg-gray-800 rounded-lg p-4 mb-6">
        <h3 className="font-bold text-white mb-4">Send Transfer</h3>

        {activeCompany?.is_in_prison ? (
          <div className="text-red-400 p-4 bg-red-900/30 rounded">
            🔒 Cannot send transfers while in prison
          </div>
        ) : otherCompanies.length === 0 ? (
          <p className="text-gray-400">No other companies to transfer to</p>
        ) : (
          <>
            <div className="mb-4">
              <label className="block text-gray-400 text-sm mb-2">To Company</label>
              <select
                value={selectedTarget || ''}
                onChange={(e) => setSelectedTarget(e.target.value)}
                className="w-full p-3 bg-gray-700 text-white rounded"
              >
                <option value="">Select company...</option>
                {otherCompanies.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.location_type || 'No location'}) - ${c.cash.toLocaleString()}
                  </option>
                ))}
              </select>
            </div>

            {selectedTarget && (
              <>
                <div className="mb-4">
                  <label className="block text-gray-400 text-sm mb-2">Amount</label>
                  <input
                    type="number"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="Enter amount"
                    className="w-full p-3 bg-gray-700 text-white rounded"
                  />
                </div>

                <button
                  onClick={() => setShowTransferModal(true)}
                  disabled={!amount || parseInt(amount) <= 0}
                  className="w-full py-3 bg-blue-600 text-white rounded disabled:opacity-50"
                >
                  Transfer ${parseInt(amount || '0').toLocaleString()}
                </button>
              </>
            )}
          </>
        )}
      </div>

      {/* Transfer history */}
      <TransferHistory companyId={activeCompany?.id} />

      {showTransferModal && (
        <TransferModal
          fromCompany={activeCompany}
          toCompany={otherCompanies.find(c => c.id === selectedTarget)}
          amount={parseInt(amount)}
          onConfirm={handleTransfer}
          onClose={() => setShowTransferModal(false)}
        />
      )}
    </div>
  );
}
```

### Transfer History Component

```tsx
// components/game/TransferHistory.tsx
export function TransferHistory({ companyId }) {
  const { data: transfers, isLoading } = useTransferHistory(companyId);

  if (isLoading) return <div>Loading...</div>;

  return (
    <div className="bg-gray-800 rounded-lg p-4">
      <h3 className="font-bold text-white mb-4">Transfer History</h3>

      {transfers.length === 0 ? (
        <p className="text-gray-400">No transfers yet</p>
      ) : (
        <div className="space-y-2">
          {transfers.map(t => {
            const isSent = t.from_company_id === companyId;

            return (
              <div
                key={t.id}
                className="flex justify-between items-center p-3 bg-gray-700 rounded"
              >
                <div>
                  <p className="text-white">
                    {isSent ? `To ${t.to_company_name}` : `From ${t.from_company_name}`}
                  </p>
                  <p className="text-xs text-gray-400">
                    {new Date(t.created_at).toLocaleString()}
                  </p>
                </div>
                <p className={isSent ? 'text-red-400' : 'text-green-400'}>
                  {isSent ? '-' : '+'}${t.amount.toLocaleString()}
                </p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
```

## Database Changes

- New `bank_transfers` table for tracking transfers

## Test Cases

| Test | Input | Expected Output |
|------|-------|-----------------|
| Valid transfer | Own company to own company | Cash moved |
| Insufficient funds | Amount > cash | Error |
| Transfer to other user | Different user's company | Error: not owned |
| Daily limit exceeded | 4th transfer to town | Error: daily limit |
| Amount over max | 60k to town | Error: max 50k |
| Send from prison | In prison | Error |
| Receive in prison | To company in prison | Success |
| Transfer history | After transfers | Shows both sent/received |

## Acceptance Checklist

- [ ] Can transfer between own companies
- [ ] Cannot transfer to other users' companies
- [ ] Transfer limits by destination type
- [ ] Daily transfer limit enforced (3/day)
- [ ] Cannot send while in prison
- [ ] Can receive while in prison
- [ ] Transfer history shows both directions
- [ ] Balance updates immediately
- [ ] Transactions logged for both companies

## Deployment

```bash
# Run migration
CLOUDFLARE_API_TOKEN="..." npx wrangler d1 execute notropolis-database --file=migrations/0017_create_transfers_table.sql --remote

npm run build
CLOUDFLARE_API_TOKEN="..." CLOUDFLARE_ACCOUNT_ID="..." npx wrangler pages deploy ./dist --project-name=notropolis-dashboard
```

## Handoff Notes

- Transfers are between YOUR companies only (same user)
- Limits are on the RECEIVING company
- Daily limit resets at midnight UTC
- Can receive while in prison (to help pay fine)
- Cannot send while in prison
- Consider adding transfer fee in future
- Offshore funds cannot be transferred (only used for company slots)
