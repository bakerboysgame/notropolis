# Stage 17: Achievements

## Objective

Implement the trophy and badge system for heroic achievements, country completion, and milestones.

## Dependencies

`[Requires: Stage 12 complete]` - Needs hero tracking for location achievements.
`[Requires: Stage 15 complete]` - Needs avatar system for cosmetic rewards.

## Complexity

**Medium** - Achievement tracking and reward distribution.

## Files to Create

| File | Purpose |
|------|---------|
| `authentication-dashboard-system/src/pages/Achievements.tsx` | Achievements display page |
| `authentication-dashboard-system/src/components/game/AchievementCard.tsx` | Individual achievement |
| `authentication-dashboard-system/src/components/game/AchievementUnlock.tsx` | Unlock notification |
| `authentication-dashboard-system/src/hooks/useAchievements.ts` | Achievement data hook |
| `authentication-dashboard-system/worker/src/routes/game/achievements.js` | Achievement API |
| `authentication-dashboard-system/migrations/0025_create_achievements.sql` | Achievement tables |

## Files to Modify

| File | Purpose |
|------|---------|
| `authentication-dashboard-system/worker/index.js` | Register achievement routes |

## Implementation Details

### Database Migration

```sql
-- 0025_create_achievements.sql

-- Achievement definitions
CREATE TABLE achievements (
  id TEXT PRIMARY KEY,
  category TEXT NOT NULL,
  -- Categories: hero, combat, wealth, social, exploration, special
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  icon TEXT, -- Emoji or R2 key
  rarity TEXT DEFAULT 'common',
  points INTEGER DEFAULT 10,

  -- Conditions (JSON)
  conditions TEXT NOT NULL,
  -- e.g., {"type": "hero_location", "location_type": "town"}
  -- e.g., {"type": "total_heroes", "count": 10}
  -- e.g., {"type": "net_worth", "amount": 100000000}

  -- Rewards (JSON)
  rewards TEXT,
  -- e.g., {"avatar_items": ["gold_crown"], "badge_id": "hero_badge"}

  sort_order INTEGER DEFAULT 0,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_achievements_category ON achievements(category);

-- User achievement progress
CREATE TABLE user_achievements (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  achievement_id TEXT NOT NULL,
  progress INTEGER DEFAULT 0,
  completed INTEGER DEFAULT 0,
  completed_at TEXT,
  claimed INTEGER DEFAULT 0,
  claimed_at TEXT,

  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (achievement_id) REFERENCES achievements(id),
  UNIQUE(user_id, achievement_id)
);

CREATE INDEX idx_user_achievements_user ON user_achievements(user_id);

-- Badges (displayed on profile)
CREATE TABLE badges (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  icon_r2_key TEXT NOT NULL,
  description TEXT,
  rarity TEXT DEFAULT 'common'
);

CREATE TABLE user_badges (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  badge_id TEXT NOT NULL,
  earned_at TEXT DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (badge_id) REFERENCES badges(id),
  UNIQUE(user_id, badge_id)
);
```

### Achievement Definitions

```typescript
// utils/achievements.ts
export interface AchievementCondition {
  type: string;
  [key: string]: any;
}

export interface AchievementReward {
  avatar_items?: string[];
  badge_id?: string;
  // NOTE: No offshore_bonus - offshore can ONLY be increased by heroing a location
}

export const ACHIEVEMENT_CATEGORIES = [
  { id: 'hero', name: 'Hero', icon: '🏆' },
  { id: 'combat', name: 'Combat', icon: '⚔️' },
  { id: 'wealth', name: 'Wealth', icon: '💰' },
  { id: 'social', name: 'Social', icon: '💬' },
  { id: 'exploration', name: 'Exploration', icon: '🗺️' },
  { id: 'special', name: 'Special', icon: '⭐' },
];

// Example achievements to seed
export const ACHIEVEMENTS = [
  // Hero achievements
  {
    id: 'first_hero',
    category: 'hero',
    name: 'First Hero',
    description: 'Hero out of your first town',
    icon: '🏆',
    rarity: 'common',
    points: 50,
    conditions: { type: 'hero_count', count: 1 },
    rewards: { badge_id: 'first_hero_badge' },
  },
  {
    id: 'hero_10',
    category: 'hero',
    name: 'Serial Hero',
    description: 'Hero out of 10 locations',
    icon: '🏅',
    rarity: 'rare',
    points: 200,
    conditions: { type: 'hero_count', count: 10 },
    rewards: { avatar_items: ['gold_cape'] },
  },
  {
    id: 'hero_city',
    category: 'hero',
    name: 'City Slicker',
    description: 'Hero out of a city',
    icon: '🌆',
    rarity: 'uncommon',
    points: 100,
    conditions: { type: 'hero_location_type', location_type: 'city' },
  },
  {
    id: 'hero_capital',
    category: 'hero',
    name: 'Capital Conqueror',
    description: 'Hero out of a capital',
    icon: '🏛️',
    rarity: 'epic',
    points: 500,
    conditions: { type: 'hero_location_type', location_type: 'capital' },
    rewards: { avatar_items: ['crown'], badge_id: 'capital_hero' },
  },
  {
    id: 'hero_country',
    category: 'hero',
    name: 'National Hero',
    description: 'Hero all locations in a country',
    icon: '🎖️',
    rarity: 'legendary',
    points: 1000,
    conditions: { type: 'hero_country_complete' },
    rewards: { badge_id: 'national_hero', avatar_items: ['national_hero_outfit'] },
    // NOTE: No offshore bonus - offshore can ONLY be increased by heroing
  },

  // Combat achievements
  {
    id: 'first_attack',
    category: 'combat',
    name: 'First Strike',
    description: 'Perform your first attack',
    icon: '💥',
    rarity: 'common',
    points: 10,
    conditions: { type: 'attack_count', count: 1 },
  },
  {
    id: 'attack_100',
    category: 'combat',
    name: 'War Machine',
    description: 'Perform 100 attacks',
    icon: '🔥',
    rarity: 'rare',
    points: 100,
    conditions: { type: 'attack_count', count: 100 },
  },
  {
    id: 'collapse_building',
    category: 'combat',
    name: 'Demolition Expert',
    description: 'Collapse an enemy building',
    icon: '💀',
    rarity: 'uncommon',
    points: 50,
    conditions: { type: 'buildings_collapsed', count: 1 },
  },
  {
    id: 'never_caught',
    category: 'combat',
    name: 'Ghost',
    description: 'Perform 50 attacks without being caught',
    icon: '👻',
    rarity: 'epic',
    points: 300,
    conditions: { type: 'attack_streak_uncaught', count: 50 },
  },

  // Wealth achievements
  {
    id: 'millionaire',
    category: 'wealth',
    name: 'Millionaire',
    description: 'Accumulate $1,000,000 in cash',
    icon: '💵',
    rarity: 'common',
    points: 25,
    conditions: { type: 'max_cash', amount: 1000000 },
  },
  {
    id: 'billionaire',
    category: 'wealth',
    name: 'Billionaire',
    description: 'Accumulate $1,000,000,000 in offshore',
    icon: '💎',
    rarity: 'legendary',
    points: 1000,
    conditions: { type: 'offshore', amount: 1000000000 },
    rewards: { badge_id: 'billionaire', avatar_items: ['diamond_suit'] },
  },
  {
    id: 'property_mogul',
    category: 'wealth',
    name: 'Property Mogul',
    description: 'Own 50 buildings simultaneously',
    icon: '🏢',
    rarity: 'rare',
    points: 150,
    conditions: { type: 'buildings_owned', count: 50 },
  },

  // Social achievements
  {
    id: 'first_post',
    category: 'social',
    name: 'Hello World',
    description: 'Post your first message',
    icon: '📝',
    rarity: 'common',
    points: 5,
    conditions: { type: 'messages_posted', count: 1 },
  },
  {
    id: 'generous_donor',
    category: 'social',
    name: 'Generous Donor',
    description: 'Donate $1,000,000 to temples',
    icon: '🙏',
    rarity: 'rare',
    points: 100,
    conditions: { type: 'total_donated', amount: 1000000 },
  },
];
```

### Achievement Checker

```javascript
// worker/src/routes/game/achievements.js

/**
 * GET /api/game/achievements
 * Get all achievements with user progress
 */
export async function getAchievements(request, env, userId) {
  const achievements = await env.DB.prepare(
    'SELECT * FROM achievements ORDER BY category, sort_order'
  ).all();

  const userProgress = await env.DB.prepare(
    'SELECT * FROM user_achievements WHERE user_id = ?'
  ).bind(userId).all();

  const progressMap = new Map(userProgress.results.map(p => [p.achievement_id, p]));

  const result = achievements.results.map(a => {
    const progress = progressMap.get(a.id);
    return {
      ...a,
      conditions: JSON.parse(a.conditions),
      rewards: a.rewards ? JSON.parse(a.rewards) : null,
      progress: progress?.progress || 0,
      completed: progress?.completed === 1,
      completed_at: progress?.completed_at,
      claimed: progress?.claimed === 1,
    };
  });

  return {
    success: true,
    achievements: result,
    summary: {
      total: achievements.results.length,
      completed: result.filter(a => a.completed).length,
      points: result.filter(a => a.completed).reduce((sum, a) => sum + a.points, 0),
    },
  };
}

/**
 * Check all achievements for a user and grant any newly completed ones
 */
export async function checkAchievements(env, userId) {
  const achievements = await env.DB.prepare(
    'SELECT * FROM achievements'
  ).all();

  const userProgress = await env.DB.prepare(
    'SELECT * FROM user_achievements WHERE user_id = ?'
  ).bind(userId).all();

  const progressMap = new Map(userProgress.results.map(p => [p.achievement_id, p]));

  const newlyCompleted = [];

  for (const achievement of achievements.results) {
    const existing = progressMap.get(achievement.id);

    if (existing?.completed) continue; // Already done

    const conditions = JSON.parse(achievement.conditions);
    const { completed, progress } = await evaluateCondition(env, userId, conditions);

    if (completed && !existing?.completed) {
      // New completion!
      newlyCompleted.push(achievement);

      await env.DB.prepare(`
        INSERT INTO user_achievements (id, user_id, achievement_id, progress, completed, completed_at)
        VALUES (?, ?, ?, ?, 1, ?)
        ON CONFLICT(user_id, achievement_id) DO UPDATE SET
          progress = ?, completed = 1, completed_at = ?
      `).bind(
        crypto.randomUUID(),
        userId,
        achievement.id,
        progress,
        new Date().toISOString(),
        progress,
        new Date().toISOString()
      ).run();

      // Grant rewards
      if (achievement.rewards) {
        await grantRewards(env, userId, JSON.parse(achievement.rewards));
      }
    } else if (progress !== existing?.progress) {
      // Update progress
      await env.DB.prepare(`
        INSERT INTO user_achievements (id, user_id, achievement_id, progress)
        VALUES (?, ?, ?, ?)
        ON CONFLICT(user_id, achievement_id) DO UPDATE SET progress = ?
      `).bind(
        crypto.randomUUID(),
        userId,
        achievement.id,
        progress,
        progress
      ).run();
    }
  }

  return newlyCompleted;
}

async function evaluateCondition(env, userId, condition) {
  switch (condition.type) {
    case 'hero_count': {
      const result = await env.DB.prepare(`
        SELECT COUNT(*) as count FROM game_transactions t
        JOIN game_companies c ON t.company_id = c.id
        WHERE c.user_id = ? AND t.action_type = 'hero_out'
      `).bind(userId).first();
      return {
        completed: result.count >= condition.count,
        progress: result.count,
      };
    }

    case 'hero_location_type': {
      const result = await env.DB.prepare(`
        SELECT COUNT(*) as count FROM game_transactions t
        JOIN game_companies c ON t.company_id = c.id
        WHERE c.user_id = ? AND t.action_type = 'hero_out'
          AND t.details LIKE ?
      `).bind(userId, `%"location_type":"${condition.location_type}"%`).first();
      return {
        completed: result.count > 0,
        progress: result.count,
      };
    }

    case 'attack_count': {
      const result = await env.DB.prepare(`
        SELECT COUNT(*) as count FROM attacks a
        JOIN game_companies c ON a.attacker_company_id = c.id
        WHERE c.user_id = ?
      `).bind(userId).first();
      return {
        completed: result.count >= condition.count,
        progress: result.count,
      };
    }

    case 'offshore': {
      const result = await env.DB.prepare(`
        SELECT COALESCE(SUM(offshore), 0) as total FROM game_companies WHERE user_id = ?
      `).bind(userId).first();
      return {
        completed: result.total >= condition.amount,
        progress: result.total,
      };
    }

    case 'total_donated': {
      const result = await env.DB.prepare(`
        SELECT COALESCE(SUM(d.amount), 0) as total FROM donations d
        JOIN game_companies c ON d.company_id = c.id
        WHERE c.user_id = ?
      `).bind(userId).first();
      return {
        completed: result.total >= condition.amount,
        progress: result.total,
      };
    }

    // Add more condition types...

    default:
      return { completed: false, progress: 0 };
  }
}

async function grantRewards(env, userId, rewards) {
  if (rewards.badge_id) {
    await env.DB.prepare(`
      INSERT OR IGNORE INTO user_badges (id, user_id, badge_id)
      VALUES (?, ?, ?)
    `).bind(crypto.randomUUID(), userId, rewards.badge_id).run();
  }

  if (rewards.avatar_items) {
    for (const itemId of rewards.avatar_items) {
      // Avatar unlocks are user-level (not company-level)
      await env.DB.prepare(`
        INSERT OR IGNORE INTO avatar_unlocks (id, user_id, item_id)
        VALUES (?, ?, ?)
      `).bind(crypto.randomUUID(), userId, itemId).run();
    }
  }

  // NOTE: No offshore_bonus handling - offshore can ONLY be increased by heroing a location
}
```

### Route Registration (worker/index.js)

Add to imports at the top:
```javascript
import {
  getAchievements,
  checkAchievements,
} from './src/routes/game/achievements.js';
```

Add routes in the switch statement (user-authenticated section):
```javascript
// Achievements
case path === '/api/game/achievements' && method === 'GET':
  return json(await getAchievements(request, env, user.id));
```

### Achievement Hook

```typescript
// hooks/useAchievements.ts
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

export function useAchievements(userId: string | undefined) {
  return useQuery({
    queryKey: ['achievements', userId],
    queryFn: async () => {
      const response = await api.get('/game/achievements');
      return response.data;
    },
    enabled: !!userId,
  });
}
```

### Constants

```typescript
// utils/achievementConstants.ts
export const RARITY_COLORS: Record<string, string> = {
  common: '#9CA3AF',    // gray-400
  uncommon: '#10B981',  // green-500
  rare: '#3B82F6',      // blue-500
  epic: '#8B5CF6',      // purple-500
  legendary: '#F59E0B', // amber-500
};
```

### Achievements Page

```tsx
// pages/Achievements.tsx
export function Achievements() {
  const { user } = useAuth();
  const { data: achievements } = useAchievements(user?.id);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  const filteredAchievements = selectedCategory
    ? achievements?.filter(a => a.category === selectedCategory)
    : achievements;

  const completedCount = achievements?.filter(a => a.completed).length || 0;
  const totalPoints = achievements?.filter(a => a.completed).reduce((sum, a) => sum + a.points, 0) || 0;

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Achievements</h1>
        <p className="text-gray-400">
          {completedCount}/{achievements?.length || 0} completed • {totalPoints} points
        </p>
      </div>

      {/* Category filter */}
      <div className="flex gap-2 mb-6 flex-wrap">
        <button
          onClick={() => setSelectedCategory(null)}
          className={`px-4 py-2 rounded ${!selectedCategory ? 'bg-blue-600' : 'bg-gray-700'}`}
        >
          All
        </button>
        {ACHIEVEMENT_CATEGORIES.map(cat => (
          <button
            key={cat.id}
            onClick={() => setSelectedCategory(cat.id)}
            className={`px-4 py-2 rounded ${selectedCategory === cat.id ? 'bg-blue-600' : 'bg-gray-700'}`}
          >
            {cat.icon} {cat.name}
          </button>
        ))}
      </div>

      {/* Achievement grid */}
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredAchievements?.map(achievement => (
          <AchievementCard key={achievement.id} achievement={achievement} />
        ))}
      </div>
    </div>
  );
}
```

### Achievement Card

```tsx
// components/game/AchievementCard.tsx
export function AchievementCard({ achievement }) {
  const isCompleted = achievement.completed;
  const progress = achievement.progress || 0;
  const target = achievement.conditions?.count || achievement.conditions?.amount || 1;
  const progressPercent = Math.min(100, (progress / target) * 100);

  return (
    <div
      className={`rounded-lg p-4 ${
        isCompleted ? 'bg-green-900/30 border border-green-600' : 'bg-gray-800'
      }`}
    >
      <div className="flex items-start gap-3">
        <div className="text-3xl">{achievement.icon}</div>
        <div className="flex-1">
          <div className="flex justify-between items-start">
            <h3 className="font-bold text-white">{achievement.name}</h3>
            <span
              className="text-xs px-2 py-1 rounded"
              style={{ backgroundColor: RARITY_COLORS[achievement.rarity] + '30', color: RARITY_COLORS[achievement.rarity] }}
            >
              {achievement.rarity}
            </span>
          </div>
          <p className="text-sm text-gray-400 mt-1">{achievement.description}</p>

          {/* Progress bar */}
          {!isCompleted && target > 1 && (
            <div className="mt-3">
              <div className="flex justify-between text-xs text-gray-500 mb-1">
                <span>Progress</span>
                <span>{progress.toLocaleString()} / {target.toLocaleString()}</span>
              </div>
              <div className="h-2 bg-gray-700 rounded-full">
                <div
                  className="h-full bg-blue-500 rounded-full"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            </div>
          )}

          {/* Completed badge */}
          {isCompleted && (
            <div className="mt-2 flex items-center gap-2 text-green-400 text-sm">
              <span>✓</span>
              <span>Completed {new Date(achievement.completed_at).toLocaleDateString()}</span>
            </div>
          )}

          {/* Points */}
          <div className="mt-2 text-sm text-yellow-400">
            {achievement.points} points
          </div>
        </div>
      </div>
    </div>
  );
}
```

### Achievement Unlock Notification

```tsx
// components/game/AchievementUnlock.tsx
export function AchievementUnlock({ achievement, onDismiss }) {
  useEffect(() => {
    const timer = setTimeout(onDismiss, 5000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="fixed top-4 right-4 z-50 animate-slide-in">
      <div className="bg-gray-800 border border-yellow-600 rounded-lg p-4 shadow-lg max-w-sm">
        <div className="flex items-center gap-3">
          <div className="text-4xl">{achievement.icon}</div>
          <div>
            <p className="text-yellow-400 text-sm font-bold">Achievement Unlocked!</p>
            <p className="text-white font-bold">{achievement.name}</p>
            <p className="text-gray-400 text-sm">{achievement.description}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
```

## Database Changes

- New `achievements` table (definitions)
- New `user_achievements` table (progress/completion)
- New `badges` table
- New `user_badges` table

## Test Cases

| Test | Input | Expected Output |
|------|-------|-----------------|
| First hero | Complete first hero | Achievement unlocked |
| Progress tracking | Partial completion | Progress updated |
| Badge reward | Complete with badge reward | Badge granted |
| Avatar reward | Complete with avatar reward | Item unlocked |
| Category filter | Select combat | Only combat shown |
| **No offshore change** | Any achievement | Offshore only changes via hero |

## Acceptance Checklist

- [x] Achievement definitions seeded (14 achievements, 3 badges)
- [x] Progress tracked automatically
- [x] Completion detected and recorded
- [x] Rewards granted on completion
- [x] Achievement page displays all
- [x] Category filter works
- [x] Progress bars show correctly
- [x] Unlock notification appears
- [x] Badges displayed on profile
- [x] Rarity colors shown

## Deployment

```bash
# From authentication-dashboard-system directory:

# 1. Run migration
CLOUDFLARE_API_TOKEN="..." npx wrangler d1 execute notropolis-database --file=migrations/0025_create_achievements.sql --remote

# 2. Seed achievements (SQL file with INSERT statements)
CLOUDFLARE_API_TOKEN="..." npx wrangler d1 execute notropolis-database --file=migrations/0025a_seed_achievements.sql --remote

# 3. Build and deploy worker
cd worker && npm run build
CLOUDFLARE_API_TOKEN="..." npx wrangler deploy

# 4. Build and deploy frontend
cd .. && npm run build
CLOUDFLARE_API_TOKEN="..." CLOUDFLARE_ACCOUNT_ID="..." npx wrangler pages deploy ./dist --project-name=notropolis-dashboard
```

### Seed Achievements SQL (0025a_seed_achievements.sql)

```sql
-- Seed initial achievement and badge definitions
INSERT INTO badges (id, name, icon_r2_key, description, rarity) VALUES
('first_hero_badge', 'First Hero', 'badges/first_hero.png', 'Completed your first hero', 'common'),
('capital_hero', 'Capital Conqueror', 'badges/capital_hero.png', 'Hero of a capital city', 'epic'),
('national_hero', 'National Hero', 'badges/national_hero.png', 'Completed all locations in a country', 'legendary'),
('billionaire', 'Billionaire', 'badges/billionaire.png', 'Accumulated 1 billion in offshore', 'legendary');

INSERT INTO achievements (id, category, name, description, icon, rarity, points, conditions, rewards, sort_order) VALUES
('first_hero', 'hero', 'First Hero', 'Hero out of your first town', '🏆', 'common', 50, '{"type":"hero_count","count":1}', '{"badge_id":"first_hero_badge"}', 1),
('hero_10', 'hero', 'Serial Hero', 'Hero out of 10 locations', '🏅', 'rare', 200, '{"type":"hero_count","count":10}', '{"avatar_items":["gold_cape"]}', 2),
('hero_city', 'hero', 'City Slicker', 'Hero out of a city', '🌆', 'uncommon', 100, '{"type":"hero_location_type","location_type":"city"}', NULL, 3),
('hero_capital', 'hero', 'Capital Conqueror', 'Hero out of a capital', '🏛️', 'epic', 500, '{"type":"hero_location_type","location_type":"capital"}', '{"avatar_items":["crown"],"badge_id":"capital_hero"}', 4),
('hero_country', 'hero', 'National Hero', 'Hero all locations in a country', '🎖️', 'legendary', 1000, '{"type":"hero_country_complete"}', '{"badge_id":"national_hero","avatar_items":["national_hero_outfit"]}', 5),
('first_attack', 'combat', 'First Strike', 'Perform your first attack', '💥', 'common', 10, '{"type":"attack_count","count":1}', NULL, 1),
('attack_100', 'combat', 'War Machine', 'Perform 100 attacks', '🔥', 'rare', 100, '{"type":"attack_count","count":100}', NULL, 2),
('collapse_building', 'combat', 'Demolition Expert', 'Collapse an enemy building', '💀', 'uncommon', 50, '{"type":"buildings_collapsed","count":1}', NULL, 3),
('never_caught', 'combat', 'Ghost', 'Perform 50 attacks without being caught', '👻', 'epic', 300, '{"type":"attack_streak_uncaught","count":50}', NULL, 4),
('millionaire', 'wealth', 'Millionaire', 'Accumulate $1,000,000 in cash', '💵', 'common', 25, '{"type":"max_cash","amount":1000000}', NULL, 1),
('billionaire', 'wealth', 'Billionaire', 'Accumulate $1,000,000,000 in offshore', '💎', 'legendary', 1000, '{"type":"offshore","amount":1000000000}', '{"badge_id":"billionaire","avatar_items":["diamond_suit"]}', 2),
('property_mogul', 'wealth', 'Property Mogul', 'Own 50 buildings simultaneously', '🏢', 'rare', 150, '{"type":"buildings_owned","count":50}', NULL, 3),
('first_post', 'social', 'Hello World', 'Post your first message', '📝', 'common', 5, '{"type":"messages_posted","count":1}', NULL, 1),
('generous_donor', 'social', 'Generous Donor', 'Donate $1,000,000 to temples', '🙏', 'rare', 100, '{"type":"total_donated","amount":1000000}', NULL, 2);
```

## Handoff Notes

- Achievements are checked after relevant actions
- Progress is stored per-user, not per-company
- Badges are displayed on user profile
- Avatar rewards unlock items for all companies
- **CRITICAL: Rewards do NOT include offshore bonuses. Offshore can ONLY be increased by heroing a location** (see Stage 12)
- Consider adding achievement leaderboard
- Consider adding seasonal/limited achievements
- Hook achievement checks into: hero, attack, tick, transactions
