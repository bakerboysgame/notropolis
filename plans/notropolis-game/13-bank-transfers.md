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
| `authentication-dashboard-system/src/components/game/TransferHistory.tsx` | Transfer history display |
| `authentication-dashboard-system/worker/src/routes/game/bank.js` | Bank API |
| `authentication-dashboard-system/migrations/0019_create_transfers_table.sql` | Transfer tracking |

## Implementation Details

### Database Migration

```sql
-- 0019_create_transfers_table.sql
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

**Key Rules:**
- Each company can **SEND** max 3 transfers per day
- Each company can **RECEIVE** max 3 transfers per day
- Max amount per transfer depends on **receiving** company's location type
- Transfers only move **cash** - **offshore can ONLY be increased by heroing a location**

```javascript
// worker/src/routes/game/bank.js (at top of file)

// Universal daily limits (applies to ALL location types)
export const DAILY_SEND_LIMIT = 3;    // Per company
export const DAILY_RECEIVE_LIMIT = 3; // Per company

export const TRANSFER_LIMITS = {
  town: {
    maxPerTransfer: 50_000,
  },
  city: {
    maxPerTransfer: 500_000,
  },
  capital: {
    maxPerTransfer: 1_000_000,
  },
};

export function getTransferLimits(locationType) {
  return {
    ...TRANSFER_LIMITS[locationType],
    maxSendPerDay: DAILY_SEND_LIMIT,
    maxReceivePerDay: DAILY_RECEIVE_LIMIT,
  };
}
```

### Bank API

```javascript
// worker/src/routes/game/bank.js
export async function getTransferStatus(env, companyId) {
  const company = await env.DB.prepare(
    'SELECT * FROM game_companies WHERE id = ?'
  ).bind(companyId).first();

  const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

  // Count today's transfers FROM this company (sending limit)
  const sentToday = await env.DB.prepare(`
    SELECT COUNT(*) as count
    FROM bank_transfers
    WHERE from_company_id = ?
      AND date(created_at) = date(?)
  `).bind(companyId, today).first();

  // Count today's transfers TO this company (receiving limit)
  const receivedToday = await env.DB.prepare(`
    SELECT COUNT(*) as count, COALESCE(SUM(amount), 0) as total
    FROM bank_transfers
    WHERE to_company_id = ?
      AND date(created_at) = date(?)
  `).bind(companyId, today).first();

  const limits = company.current_map_id
    ? getTransferLimits(company.location_type)
    : { maxPerTransfer: 0, maxSendPerDay: DAILY_SEND_LIMIT, maxReceivePerDay: DAILY_RECEIVE_LIMIT };

  return {
    // Sending status
    canSend: !company.is_in_prison && sentToday.count < DAILY_SEND_LIMIT,
    sentToday: sentToday.count,
    maxSendPerDay: DAILY_SEND_LIMIT,

    // Receiving status
    canReceive: company.current_map_id && receivedToday.count < DAILY_RECEIVE_LIMIT,
    receivedToday: receivedToday.count,
    amountReceivedToday: receivedToday.total,
    maxReceivePerDay: DAILY_RECEIVE_LIMIT,
    maxPerTransfer: limits.maxPerTransfer,

    locationType: company.location_type,
    isInPrison: company.is_in_prison,
  };
}

export async function transfer(request, env, user) {
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

  const today = new Date().toISOString().split('T')[0];

  // Check SENDING limit (from_company)
  const sentToday = await env.DB.prepare(`
    SELECT COUNT(*) as count
    FROM bank_transfers
    WHERE from_company_id = ?
      AND date(created_at) = date(?)
  `).bind(from_company_id, today).first();

  if (sentToday.count >= DAILY_SEND_LIMIT) {
    throw new Error(`This company has reached its daily sending limit (${DAILY_SEND_LIMIT})`);
  }

  // Check RECEIVING limit (to_company)
  const receivedToday = await env.DB.prepare(`
    SELECT COUNT(*) as count
    FROM bank_transfers
    WHERE to_company_id = ?
      AND date(created_at) = date(?)
  `).bind(to_company_id, today).first();

  if (receivedToday.count >= DAILY_RECEIVE_LIMIT) {
    throw new Error(`Destination company has reached its daily receiving limit (${DAILY_RECEIVE_LIMIT})`);
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

export async function getTransferHistory(env, companyId) {
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

### TransferModal Component

```tsx
// components/game/TransferModal.tsx
export function TransferModal({ fromCompany, toCompany, amount, onConfirm, onClose }) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleConfirm = async () => {
    setIsSubmitting(true);
    try {
      await onConfirm();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-gray-800 rounded-lg p-6 max-w-md w-full mx-4">
        <h2 className="text-xl font-bold text-white mb-4">Confirm Transfer</h2>

        <div className="space-y-4 mb-6">
          <div className="bg-gray-700 p-3 rounded">
            <p className="text-gray-400 text-sm">From</p>
            <p className="text-white font-bold">{fromCompany?.name}</p>
            <p className="text-green-400">${fromCompany?.cash?.toLocaleString()}</p>
          </div>

          <div className="text-center text-2xl text-gray-400">↓</div>

          <div className="bg-gray-700 p-3 rounded">
            <p className="text-gray-400 text-sm">To</p>
            <p className="text-white font-bold">{toCompany?.name}</p>
            <p className="text-sm text-gray-400">{toCompany?.location_type || 'No location'}</p>
          </div>

          <div className="bg-blue-900/30 p-3 rounded text-center">
            <p className="text-gray-400 text-sm">Amount</p>
            <p className="text-2xl font-bold text-blue-400">${amount?.toLocaleString()}</p>
          </div>
        </div>

        <div className="flex gap-3">
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="flex-1 py-3 bg-gray-700 text-white rounded"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={isSubmitting}
            className="flex-1 py-3 bg-blue-600 text-white rounded disabled:opacity-50"
          >
            {isSubmitting ? 'Transferring...' : 'Confirm'}
          </button>
        </div>
      </div>
    </div>
  );
}
```

### Route Registration (worker/index.js)

Add to the switch statement in `worker/index.js` after the hero endpoints:

```javascript
// ==================== GAME BANK ENDPOINTS ====================
case path === '/api/game/bank/status' && method === 'GET':
  return handleHeroGetAction(request, authService, env, corsHeaders, getBankStatus);

case path === '/api/game/bank/transfer' && method === 'POST':
  return handleMarketAction(request, authService, env, corsHeaders, bankTransfer);

case path === '/api/game/bank/history' && method === 'GET':
  return handleHeroGetAction(request, authService, env, corsHeaders, getBankHistory);
```

Add import at top of `worker/index.js`:

```javascript
import { getTransferStatus as getBankStatus, transfer as bankTransfer, getTransferHistory as getBankHistory } from './src/routes/game/bank.js';
```

## Database Changes

- New `bank_transfers` table for tracking transfers

## Test Cases

| Test | Input | Expected Output |
|------|-------|-----------------|
| Valid transfer | Own company to own company | Cash moved |
| Insufficient funds | Amount > cash | Error |
| Transfer to other user | Different user's company | Error: not owned |
| **Sending limit exceeded** | 4th transfer FROM company | Error: sending limit |
| **Receiving limit exceeded** | 4th transfer TO company | Error: receiving limit |
| Amount over max | 60k to town | Error: max 50k |
| Send from prison | In prison | Error |
| Receive in prison | To company in prison | Success |
| Transfer history | After transfers | Shows both sent/received |
| **Offshore untouched** | Any transfer | Only cash moves, offshore unchanged |

## Acceptance Checklist

- [ ] Can transfer between own companies
- [ ] Cannot transfer to other users' companies
- [ ] Transfer amount limits by destination location type (town/city/capital)
- [ ] **Sending limit enforced (3 per day per company)**
- [ ] **Receiving limit enforced (3 per day per company)**
- [ ] Cannot send while in prison
- [ ] Can receive while in prison
- [ ] Transfer history shows both directions
- [ ] Balance updates immediately
- [ ] **Only cash is transferred, offshore is untouched**
- [ ] Transactions logged for both companies

## Deployment

```bash
# Run migration (from authentication-dashboard-system directory)
cd authentication-dashboard-system
CLOUDFLARE_API_TOKEN="..." npx wrangler d1 execute notropolis-database --file=migrations/0019_create_transfers_table.sql --remote

# Deploy worker
cd worker
CLOUDFLARE_API_TOKEN="..." CLOUDFLARE_ACCOUNT_ID="..." npx wrangler deploy

# Deploy frontend
cd ..
npm run build
CLOUDFLARE_API_TOKEN="..." CLOUDFLARE_ACCOUNT_ID="..." npx wrangler pages deploy ./dist --project-name=notropolis-dashboard
```

## Handoff Notes

- Transfers are between YOUR companies only (same user)
- Amount limit depends on the RECEIVING company's location type
- **Each company has a SENDING limit of 3 transfers per day**
- **Each company has a RECEIVING limit of 3 transfers per day**
- Daily limits reset at midnight UTC
- Can receive while in prison (to help pay fine)
- Cannot send while in prison
- Consider adding transfer fee in future
- **CRITICAL: Only CASH can be transferred. Offshore funds CANNOT be moved via bank transfers.**
- **Offshore can ONLY be increased by heroing a location** (see Stage 12)
