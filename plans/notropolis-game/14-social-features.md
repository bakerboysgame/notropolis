# Stage 14: Social Features

## Objective

Implement message boards, temple donations, and casino for social/entertainment features.

## Dependencies

`[Requires: Stage 03 complete]` - Needs companies for posting.
`[Requires: Stage 04 complete]` - Needs map context.

## Complexity

**Medium** - Multiple independent features.

## Files to Create

| File | Purpose |
|------|---------|
| `authentication-dashboard-system/src/pages/MessageBoard.tsx` | Town message board |
| `authentication-dashboard-system/src/pages/Temple.tsx` | Donation page |
| `authentication-dashboard-system/src/pages/Casino.tsx` | Roulette game |
| `authentication-dashboard-system/src/components/game/RouletteWheel.tsx` | Roulette UI |
| `authentication-dashboard-system/src/worker/routes/game/social.ts` | Social APIs |
| `authentication-dashboard-system/migrations/0018_create_social_tables.sql` | Social tables |

## Implementation Details

### Database Migration

```sql
-- 0018_create_social_tables.sql

-- Message boards
CREATE TABLE messages (
  id TEXT PRIMARY KEY,
  map_id TEXT NOT NULL,
  company_id TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (map_id) REFERENCES maps(id),
  FOREIGN KEY (company_id) REFERENCES game_companies(id)
);

CREATE INDEX idx_messages_map ON messages(map_id);
CREATE INDEX idx_messages_time ON messages(created_at);

-- Track when each company last read messages for each map
CREATE TABLE message_read_status (
  company_id TEXT NOT NULL,
  map_id TEXT NOT NULL,
  last_read_at TEXT DEFAULT CURRENT_TIMESTAMP,

  PRIMARY KEY (company_id, map_id),
  FOREIGN KEY (company_id) REFERENCES game_companies(id),
  FOREIGN KEY (map_id) REFERENCES maps(id)
);

-- Temple donations
CREATE TABLE donations (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL,
  amount INTEGER NOT NULL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (company_id) REFERENCES game_companies(id)
);

CREATE INDEX idx_donations_company ON donations(company_id);
CREATE INDEX idx_donations_time ON donations(created_at);

-- Casino games
CREATE TABLE casino_games (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL,
  game_type TEXT NOT NULL DEFAULT 'roulette',
  bet_amount INTEGER NOT NULL,
  bet_type TEXT NOT NULL,
  bet_value TEXT,
  result INTEGER,
  won INTEGER DEFAULT 0,
  payout INTEGER DEFAULT 0,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (company_id) REFERENCES game_companies(id)
);

CREATE INDEX idx_casino_company ON casino_games(company_id);
```

### Message Board API

```typescript
// worker/routes/game/social.ts
export async function getMessages(env: Env, mapId: string, page = 1) {
  const limit = 50;
  const offset = (page - 1) * limit;

  const messages = await env.DB.prepare(`
    SELECT m.*, c.name as company_name
    FROM messages m
    JOIN game_companies c ON m.company_id = c.id
    WHERE m.map_id = ?
    ORDER BY m.created_at DESC
    LIMIT ? OFFSET ?
  `).bind(mapId, limit, offset).all();

  return messages.results;
}

export async function postMessage(request: Request, env: Env, company: GameCompany) {
  requireNotInPrison(company);

  const { content } = await request.json();

  if (!content || content.trim().length === 0) {
    throw new Error('Message cannot be empty');
  }

  if (content.length > 500) {
    throw new Error('Message too long (max 500 characters)');
  }

  // Rate limit: 1 message per minute
  const lastMessage = await env.DB.prepare(`
    SELECT created_at FROM messages
    WHERE company_id = ?
    ORDER BY created_at DESC
    LIMIT 1
  `).bind(company.id).first();

  if (lastMessage) {
    const lastTime = new Date(lastMessage.created_at).getTime();
    const now = Date.now();
    if (now - lastTime < 60000) {
      throw new Error('Please wait before posting again');
    }
  }

  await env.DB.prepare(`
    INSERT INTO messages (id, map_id, company_id, content)
    VALUES (?, ?, ?, ?)
  `).bind(crypto.randomUUID(), company.current_map_id, company.id, content.trim()).run();

  return { success: true };
}

// Get unread message count for current map
export async function getUnreadCount(env: Env, company: GameCompany) {
  const result = await env.DB.prepare(`
    SELECT COUNT(*) as count
    FROM messages m
    LEFT JOIN message_read_status mrs
      ON mrs.company_id = ? AND mrs.map_id = m.map_id
    WHERE m.map_id = ?
      AND m.company_id != ?
      AND (mrs.last_read_at IS NULL OR m.created_at > mrs.last_read_at)
  `).bind(company.id, company.current_map_id, company.id).first();

  return { unread_count: result?.count || 0 };
}

// Mark messages as read (called when viewing message board)
export async function markMessagesAsRead(env: Env, company: GameCompany) {
  await env.DB.prepare(`
    INSERT INTO message_read_status (company_id, map_id, last_read_at)
    VALUES (?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT (company_id, map_id)
    DO UPDATE SET last_read_at = CURRENT_TIMESTAMP
  `).bind(company.id, company.current_map_id).run();

  return { success: true };
}
```

### Message Board Page

```tsx
// pages/MessageBoard.tsx
export function MessageBoard() {
  const { activeCompany } = useCompany();
  const { data: messages, refetch } = useMessages(activeCompany?.current_map_id);
  const [newMessage, setNewMessage] = useState('');
  const [posting, setPosting] = useState(false);

  // Mark messages as read when viewing the board
  useEffect(() => {
    if (activeCompany?.current_map_id) {
      api.social.markAsRead();
    }
  }, [activeCompany?.current_map_id]);

  const handlePost = async () => {
    if (!newMessage.trim()) return;
    setPosting(true);
    try {
      await api.social.postMessage(newMessage);
      setNewMessage('');
      refetch();
    } catch (error) {
      toast.error(error.message);
    } finally {
      setPosting(false);
    }
  };

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold text-white mb-6">📋 Message Board</h1>

      {/* New message */}
      <div className="bg-gray-800 rounded-lg p-4 mb-6">
        <textarea
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          placeholder="Write a message to this town..."
          maxLength={500}
          rows={3}
          className="w-full p-3 bg-gray-700 text-white rounded resize-none"
        />
        <div className="flex justify-between items-center mt-2">
          <span className="text-xs text-gray-500">{newMessage.length}/500</span>
          <button
            onClick={handlePost}
            disabled={posting || !newMessage.trim()}
            className="px-4 py-2 bg-blue-600 text-white rounded disabled:opacity-50"
          >
            {posting ? 'Posting...' : 'Post'}
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="space-y-4">
        {messages?.map(msg => (
          <div key={msg.id} className="bg-gray-800 rounded-lg p-4">
            <div className="flex justify-between items-start mb-2">
              <p className="font-bold text-white">{msg.company_name}</p>
              <p className="text-xs text-gray-500">
                {new Date(msg.created_at).toLocaleString()}
              </p>
            </div>
            <p className="text-gray-300 whitespace-pre-wrap">{msg.content}</p>
          </div>
        ))}

        {messages?.length === 0 && (
          <p className="text-gray-500 text-center py-8">No messages yet. Be the first!</p>
        )}
      </div>
    </div>
  );
}
```

### Temple API

```typescript
export async function donate(request: Request, env: Env, company: GameCompany) {
  requireNotInPrison(company);

  const { amount } = await request.json();

  if (amount <= 0) throw new Error('Invalid amount');
  if (amount > company.cash) throw new Error('Insufficient funds');

  await env.DB.batch([
    // Deduct cash
    // NOTE: Does NOT reset ticks_since_action - temple donations are not strategic actions
    env.DB.prepare(
      'UPDATE game_companies SET cash = cash - ? WHERE id = ?'
    ).bind(amount, company.id),

    // Log donation
    env.DB.prepare(`
      INSERT INTO donations (id, company_id, amount)
      VALUES (?, ?, ?)
    `).bind(crypto.randomUUID(), company.id, amount),

    // Log transaction
    env.DB.prepare(`
      INSERT INTO game_transactions (id, company_id, action_type, amount)
      VALUES (?, ?, 'temple_donation', ?)
    `).bind(crypto.randomUUID(), company.id, amount),
  ]);

  return { success: true, amount };
}

export async function getDonationLeaderboard(env: Env) {
  const leaderboard = await env.DB.prepare(`
    SELECT c.name, SUM(d.amount) as total_donated
    FROM donations d
    JOIN game_companies c ON d.company_id = c.id
    GROUP BY d.company_id
    ORDER BY total_donated DESC
    LIMIT 20
  `).all();

  return leaderboard.results;
}
```

### Temple Page

```tsx
// pages/Temple.tsx
export function Temple() {
  const { activeCompany, refreshCompany } = useCompany();
  const { data: leaderboard } = useDonationLeaderboard();
  const [amount, setAmount] = useState('');

  const handleDonate = async () => {
    await api.social.donate(parseInt(amount));
    await refreshCompany();
    setAmount('');
    toast.success('Thank you for your donation!');
  };

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <div className="text-center mb-8">
        <div className="text-6xl mb-4">🛕</div>
        <h1 className="text-2xl font-bold text-white">Temple</h1>
        <p className="text-gray-400">Donate to show your generosity</p>
      </div>

      <div className="bg-gray-800 rounded-lg p-6 mb-6">
        <p className="text-gray-400 mb-2">Your Cash</p>
        <p className="text-2xl font-mono text-green-400 mb-4">
          ${activeCompany?.cash.toLocaleString()}
        </p>

        <input
          type="number"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="Donation amount"
          className="w-full p-3 bg-gray-700 text-white rounded mb-4"
        />

        <button
          onClick={handleDonate}
          disabled={!amount || parseInt(amount) <= 0 || parseInt(amount) > activeCompany?.cash}
          className="w-full py-3 bg-yellow-600 text-white font-bold rounded disabled:opacity-50"
        >
          Donate ${parseInt(amount || '0').toLocaleString()}
        </button>
      </div>

      <div className="bg-gray-800 rounded-lg p-4">
        <h2 className="font-bold text-white mb-4">Top Donors</h2>
        <div className="space-y-2">
          {leaderboard?.map((donor, i) => (
            <div key={i} className="flex justify-between items-center p-2">
              <div className="flex items-center gap-3">
                <span className="text-xl">
                  {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`}
                </span>
                <span className="text-white">{donor.name}</span>
              </div>
              <span className="text-yellow-400">${donor.total_donated.toLocaleString()}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
```

### Casino API

```typescript
const MAX_BET = 10000;

const ROULETTE_PAYOUTS = {
  straight: 35, // Single number
  red: 1,
  black: 1,
  odd: 1,
  even: 1,
  low: 1,  // 1-18
  high: 1, // 19-36
};

const RED_NUMBERS = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36];

export async function playRoulette(request: Request, env: Env, company: GameCompany) {
  requireNotInPrison(company);

  const { bet_amount, bet_type, bet_value } = await request.json();

  if (bet_amount <= 0) throw new Error('Invalid bet amount');
  if (bet_amount > MAX_BET) throw new Error(`Maximum bet is $${MAX_BET.toLocaleString()}`);
  if (bet_amount > company.cash) throw new Error('Insufficient funds');

  // Spin the wheel (0-36)
  const result = Math.floor(Math.random() * 37);

  // Determine win
  let won = false;
  let payout = 0;

  switch (bet_type) {
    case 'straight':
      won = result === parseInt(bet_value);
      break;
    case 'red':
      won = RED_NUMBERS.includes(result);
      break;
    case 'black':
      won = result !== 0 && !RED_NUMBERS.includes(result);
      break;
    case 'odd':
      won = result !== 0 && result % 2 === 1;
      break;
    case 'even':
      won = result !== 0 && result % 2 === 0;
      break;
    case 'low':
      won = result >= 1 && result <= 18;
      break;
    case 'high':
      won = result >= 19 && result <= 36;
      break;
    default:
      throw new Error('Invalid bet type');
  }

  if (won) {
    payout = bet_amount * (ROULETTE_PAYOUTS[bet_type] + 1);
  }

  const netResult = won ? payout - bet_amount : -bet_amount;

  await env.DB.batch([
    // Update cash (win or loss)
    // NOTE: Does NOT reset ticks_since_action - casino gambling is not a strategic action
    env.DB.prepare(
      'UPDATE game_companies SET cash = cash + ? WHERE id = ?'
    ).bind(netResult, company.id),

    // Log game
    env.DB.prepare(`
      INSERT INTO casino_games (id, company_id, game_type, bet_amount, bet_type, bet_value, result, won, payout)
      VALUES (?, ?, 'roulette', ?, ?, ?, ?, ?, ?)
    `).bind(
      crypto.randomUUID(),
      company.id,
      bet_amount,
      bet_type,
      bet_value || null,
      result,
      won ? 1 : 0,
      payout
    ),
  ]);

  return {
    result,
    won,
    payout,
    new_balance: company.cash + netResult,
  };
}
```

### Casino Page

```tsx
// pages/Casino.tsx
export function Casino() {
  const { activeCompany, refreshCompany } = useCompany();
  const [betAmount, setBetAmount] = useState('1000');
  const [betType, setBetType] = useState<string>('red');
  const [betValue, setBetValue] = useState<string>('');
  const [spinning, setSpinning] = useState(false);
  const [lastResult, setLastResult] = useState<any>(null);

  const handleSpin = async () => {
    setSpinning(true);
    try {
      const result = await api.social.playRoulette(parseInt(betAmount), betType, betValue);
      setLastResult(result);
      await refreshCompany();
    } finally {
      setSpinning(false);
    }
  };

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <div className="text-center mb-6">
        <div className="text-6xl mb-4">🎰</div>
        <h1 className="text-2xl font-bold text-white">Casino</h1>
        <p className="text-gray-400">Max bet: $10,000</p>
      </div>

      {/* Balance */}
      <div className="bg-gray-800 rounded-lg p-4 mb-6 text-center">
        <p className="text-gray-400">Your Cash</p>
        <p className="text-3xl font-mono text-green-400">
          ${activeCompany?.cash.toLocaleString()}
        </p>
      </div>

      {/* Last result */}
      {lastResult && (
        <div className={`rounded-lg p-4 mb-6 text-center ${lastResult.won ? 'bg-green-900/50' : 'bg-red-900/50'}`}>
          <p className="text-4xl font-bold mb-2">{lastResult.result}</p>
          <p className={lastResult.won ? 'text-green-400' : 'text-red-400'}>
            {lastResult.won ? `Won $${lastResult.payout.toLocaleString()}!` : 'Lost'}
          </p>
        </div>
      )}

      {/* Betting */}
      <div className="bg-gray-800 rounded-lg p-4 mb-6">
        <div className="mb-4">
          <label className="block text-gray-400 text-sm mb-2">Bet Amount</label>
          <input
            type="number"
            value={betAmount}
            onChange={(e) => setBetAmount(e.target.value)}
            max={10000}
            className="w-full p-3 bg-gray-700 text-white rounded"
          />
        </div>

        <div className="mb-4">
          <label className="block text-gray-400 text-sm mb-2">Bet Type</label>
          <div className="grid grid-cols-3 gap-2">
            {['red', 'black', 'odd', 'even', 'low', 'high'].map(type => (
              <button
                key={type}
                onClick={() => { setBetType(type); setBetValue(''); }}
                className={`p-2 rounded capitalize ${betType === type ? 'bg-blue-600' : 'bg-gray-700'}`}
              >
                {type}
              </button>
            ))}
          </div>
        </div>

        <button
          onClick={handleSpin}
          disabled={spinning || parseInt(betAmount) > activeCompany?.cash}
          className="w-full py-4 bg-yellow-600 text-white font-bold rounded-lg disabled:opacity-50"
        >
          {spinning ? 'Spinning...' : 'Spin!'}
        </button>
      </div>
    </div>
  );
}
```

## Database Changes

- New `messages` table
- New `message_read_status` table (tracks last read time per company per map)
- New `donations` table
- New `casino_games` table

## Test Cases

| Test | Input | Expected Output |
|------|-------|-----------------|
| Post message | Valid content | Message posted |
| Post empty | Empty string | Error |
| Post rate limit | 2 messages in 1 minute | Error: wait |
| Unread count | New messages since last visit | Returns correct count |
| Unread excludes own | User posts message | Own message not counted as unread |
| Mark as read | View message board | last_read_at updated |
| Unread after read | View then new message posted | Count shows 1 |
| Donate | Valid amount | Cash deducted, donation logged |
| Casino win | Bet on red, result is red | Payout received |
| Casino lose | Bet on red, result is black | Bet lost |
| Casino max bet | 15000 bet | Error: max 10000 |

## Acceptance Checklist

- [ ] Message board shows messages per map
- [ ] Can post messages (500 char limit)
- [ ] Rate limiting on messages (1/min)
- [ ] Unread message count API works
- [ ] Viewing message board marks messages as read
- [ ] Unread count excludes own messages
- [ ] UI shows unread badge/indicator
- [ ] Temple accepts donations
- [ ] Donation leaderboard works
- [ ] Casino roulette spins correctly
- [ ] Casino payouts calculated correctly
- [ ] Casino max bet enforced
- [ ] All games logged

## Deployment

```bash
CLOUDFLARE_API_TOKEN="..." npx wrangler d1 execute notropolis-database --file=migrations/0018_create_social_tables.sql --remote

npm run build
CLOUDFLARE_API_TOKEN="..." CLOUDFLARE_ACCOUNT_ID="..." npx wrangler pages deploy ./dist --project-name=notropolis-dashboard
```

## Sidebar Unread Badge Implementation

The Chat nav item should show an unread count badge that matches the app branding.

### Files to Modify

| File | Change |
|------|--------|
| `src/components/Sidebar.tsx` | Add unread count fetch and badge display |
| `src/hooks/useUnreadMessages.ts` | New hook to fetch unread count |

### Unread Hook

```typescript
// src/hooks/useUnreadMessages.ts
import { useQuery } from '@tanstack/react-query';
import { useCompany } from '../contexts/CompanyContext';

export function useUnreadMessages() {
  const { activeCompany } = useCompany();

  return useQuery({
    queryKey: ['unread-messages', activeCompany?.id, activeCompany?.current_map_id],
    queryFn: async () => {
      const token = localStorage.getItem('auth_token');
      const res = await fetch('/api/game/messages/unread', {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      const data = await res.json();
      return data.unread_count || 0;
    },
    enabled: !!activeCompany,
    refetchInterval: 30000, // Poll every 30 seconds
    staleTime: 10000,
  });
}
```

### Sidebar Badge Styling

Add to `Sidebar.tsx` navigation rendering (matches existing branding):

```tsx
// In the navigation map, for the Chat item:
{item.pageKey === 'chat' && unreadCount > 0 && (
  <>
    {/* Expanded: show count badge */}
    {(!isCollapsed || isMobile) && (
      <span className="ml-auto text-[10px] bg-primary-500 text-white px-1.5 py-0.5 rounded-full font-bold min-w-[18px] text-center">
        {unreadCount > 99 ? '99+' : unreadCount}
      </span>
    )}
    {/* Collapsed: show dot indicator */}
    {isCollapsed && !isMobile && (
      <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-primary-500 rounded-full border-2 border-white dark:border-neutral-900"></span>
    )}
  </>
)}
```

### Visual States

| State | Display |
|-------|---------|
| Expanded, unread | `Chat` with `[3]` badge on right (primary-500 bg, white text) |
| Collapsed, unread | Dot indicator top-right of icon (primary-500, white border) |
| No unread | No badge shown |
| 99+ unread | Shows `99+` to prevent overflow |

### Badge Colors (matching branding)

- Background: `bg-primary-500` (same as active state accent)
- Text: `text-white` (high contrast)
- Collapsed dot: `bg-primary-500` with `border-white dark:border-neutral-900`

## Handoff Notes

- Message boards are per-map (each town has its own)
- Messages are anonymous (only company name shown)
- Unread tracking: `message_read_status` stores last_read_at per company per map
- Unread count excludes user's own messages (you don't need to "read" your own posts)
- Viewing the message board auto-marks all messages as read
- Unread badge polls every 30 seconds for new messages
- Badge uses primary-500 color to match app branding
- Temple donations are cosmetic (no gameplay benefit)
- Casino has house edge built into roulette odds
- Consider adding more casino games in future
- Consider adding message reactions/replies in future
