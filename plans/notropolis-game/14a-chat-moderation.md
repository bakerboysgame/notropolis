# Stage 14a: Chat Moderation System

## Objective

Implement an AI-powered content moderation system for the location chat (message board). Master admins can configure the moderator prompt, model, and temperature. All messages are validated through the LLM before publishing.

## Dependencies

`[Requires: Stage 03 complete]` - Needs companies for posting.
`[Should be completed before: Stage 14]` - Messages feature depends on this.

## Complexity

**Medium** - Admin UI, database settings, DeepSeek API integration.

## Files to Create

| File | Purpose |
|------|---------|
| `authentication-dashboard-system/src/pages/ModerationAdminPage.tsx` | Master admin config page |
| `authentication-dashboard-system/src/services/moderationAdminApi.ts` | Frontend API service |
| `authentication-dashboard-system/worker/src/routes/game/moderation.js` | Moderation APIs |
| `authentication-dashboard-system/migrations/0020_create_moderation_settings.sql` | Settings table |

## Files to Modify

| File | Change |
|------|--------|
| `authentication-dashboard-system/src/components/Sidebar.tsx` | Add moderation nav item for master_admin |
| `authentication-dashboard-system/src/App.tsx` | Add route for `/admin/moderation` |

## Sidebar Integration

Add to `Sidebar.tsx` in the master_admin navigation section (around line 179):

```tsx
// Add Shield to imports
import { ..., Shield } from 'lucide-react'

// In the allNavigation useMemo, after Map Builder:
if (user?.role === 'master_admin') {
  // ... existing items ...
  items.push({ name: 'Map Builder', href: '/admin/maps', icon: Map, pageKey: 'admin_maps', requiresMasterAdmin: true })
  items.push({ name: 'Chat Moderation', href: '/admin/moderation', icon: Shield, pageKey: 'admin_moderation', requiresMasterAdmin: true })
}
```

## Route Registration (App.tsx)

```tsx
// Add to imports
import ModerationAdminPage from './pages/ModerationAdminPage'

// Add route BEFORE the fallback route (around line 276), following existing admin route pattern:
<Route path="/admin/moderation" element={
  <ProtectedRoute>
    <ProtectedPageRoute pageKey="admin_moderation">
      <Layout>
        <ModerationAdminPage />
      </Layout>
    </ProtectedPageRoute>
  </ProtectedRoute>
} />
```

## DeepSeek Configuration

### Available Models

| Model ID | Name | Use Case | Cost |
|----------|------|----------|------|
| `deepseek-chat` | DeepSeek-V3 | General purpose, fast | ~$0.14/1M input |
| `deepseek-reasoner` | DeepSeek-R1 | Complex reasoning | ~$0.55/1M input |

### Worker Secret

```bash
# Add DeepSeek API key as worker secret
npx wrangler secret put DEEPSEEK_API_KEY
# Enter: sk-cb83615f28e8442782e6277fb2a01637
```

## Implementation Details

### Database Migration

```sql
-- 0020_create_moderation_settings.sql

-- Single row table for global moderation settings
CREATE TABLE moderation_settings (
  id TEXT PRIMARY KEY DEFAULT 'global',
  model TEXT NOT NULL DEFAULT 'deepseek-chat',
  temperature REAL NOT NULL DEFAULT 0,
  max_tokens INTEGER NOT NULL DEFAULT 256,
  system_prompt TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 1,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_by TEXT,

  FOREIGN KEY (updated_by) REFERENCES users(id)
);

-- Moderation log for audit trail
CREATE TABLE moderation_log (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL,
  message_content TEXT NOT NULL,
  model_used TEXT NOT NULL,
  allowed INTEGER NOT NULL,
  rejection_reason TEXT,
  response_time_ms INTEGER,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (company_id) REFERENCES game_companies(id)
);

CREATE INDEX idx_moderation_log_company ON moderation_log(company_id);
CREATE INDEX idx_moderation_log_time ON moderation_log(created_at);
CREATE INDEX idx_moderation_log_rejected ON moderation_log(allowed) WHERE allowed = 0;

-- Insert default settings
INSERT INTO moderation_settings (id, model, temperature, max_tokens, system_prompt, enabled)
VALUES (
  'global',
  'deepseek-chat',
  0,
  256,
  'You are a content moderator for a multiplayer business strategy game called Notropolis.

Review the following message and determine if it should be allowed on the public message board.

REJECT messages that contain:
- Hate speech, slurs, or discrimination
- Sexual or explicit content
- Real threats or violence
- Personal information or doxxing attempts
- External links or advertisements
- Real-money trading offers (RMT)
- Excessive spam or caps lock (>50% caps)
- Impersonation of admins or staff

ALLOW messages that contain:
- Normal game discussion and strategy
- Friendly banter and trash talk (within reason)
- In-game trading offers
- Questions and help requests

Respond with ONLY valid JSON:
{"allowed": true} or {"allowed": false, "reason": "brief explanation"}',
  1
);
```

### DeepSeek API Integration

```javascript
// worker/src/routes/game/moderation.js

const DEEPSEEK_API_URL = 'https://api.deepseek.com/v1/chat/completions';

const DEEPSEEK_MODELS = [
  { id: 'deepseek-chat', name: 'DeepSeek-V3', description: 'Fast, cost-effective general purpose model' },
  { id: 'deepseek-reasoner', name: 'DeepSeek-R1', description: 'Advanced reasoning capabilities' },
];

// Get current moderation settings (cached in memory for performance)
let settingsCache = null;
let settingsCacheTime = 0;
const CACHE_TTL_MS = 5000; // 5 second cache - instant enough for admin updates

async function getModerationSettings(env) {
  const now = Date.now();
  if (settingsCache && (now - settingsCacheTime) < CACHE_TTL_MS) {
    return settingsCache;
  }

  const settings = await env.DB.prepare(
    'SELECT * FROM moderation_settings WHERE id = ?'
  ).bind('global').first();

  settingsCache = settings;
  settingsCacheTime = now;
  return settings;
}

// Invalidate cache when settings are updated
function invalidateSettingsCache() {
  settingsCache = null;
  settingsCacheTime = 0;
}

// Moderate a message using DeepSeek
export async function moderateMessage(env, companyId, messageContent) {
  const settings = await getModerationSettings(env);

  // If moderation is disabled, allow all
  if (!settings || !settings.enabled) {
    return { allowed: true, cached: false };
  }

  const startTime = Date.now();

  try {
    const response = await fetch(DEEPSEEK_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${env.DEEPSEEK_API_KEY}`,
      },
      body: JSON.stringify({
        model: settings.model,
        messages: [
          { role: 'system', content: settings.system_prompt },
          { role: 'user', content: `Message to review:\n\n${messageContent}` },
        ],
        temperature: settings.temperature,
        max_tokens: settings.max_tokens,
      }),
    });

    if (!response.ok) {
      console.error('DeepSeek API error:', response.status);
      // On API error, allow message but log it
      return { allowed: true, error: 'API error' };
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '';

    // Parse JSON response
    let result;
    try {
      // Handle markdown code blocks
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      result = JSON.parse(jsonMatch ? jsonMatch[0] : content);
    } catch {
      console.error('Failed to parse moderation response:', content);
      // On parse error, allow message
      return { allowed: true, error: 'Parse error' };
    }

    const responseTimeMs = Date.now() - startTime;

    // Log the moderation decision
    await env.DB.prepare(`
      INSERT INTO moderation_log (id, company_id, message_content, model_used, allowed, rejection_reason, response_time_ms)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).bind(
      crypto.randomUUID(),
      companyId,
      messageContent,
      settings.model,
      result.allowed ? 1 : 0,
      result.reason || null,
      responseTimeMs
    ).run();

    return {
      allowed: result.allowed,
      reason: result.reason,
      responseTimeMs,
    };
  } catch (error) {
    console.error('Moderation error:', error);
    // On error, allow message to avoid blocking users
    return { allowed: true, error: error.message };
  }
}

// Admin API: Get settings (master_admin only)
export async function handleGetModerationSettings(request, authService, env, corsHeaders) {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return new Response(JSON.stringify({ success: false, error: 'Unauthorized' }), {
      status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  const { user } = await authService.getUserFromToken(authHeader.split(' ')[1]);
  if (user.role !== 'master_admin') {
    return new Response(JSON.stringify({ success: false, error: 'Master admin only' }), {
      status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  const settings = await env.DB.prepare(
    'SELECT * FROM moderation_settings WHERE id = ?'
  ).bind('global').first();

  return new Response(JSON.stringify({
    success: true,
    data: {
      ...settings,
      available_models: DEEPSEEK_MODELS,
    },
  }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}

// Admin API: Update settings (master_admin only)
export async function handleUpdateModerationSettings(request, authService, env, corsHeaders) {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return new Response(JSON.stringify({ success: false, error: 'Unauthorized' }), {
      status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  const { user } = await authService.getUserFromToken(authHeader.split(' ')[1]);
  if (user.role !== 'master_admin') {
    return new Response(JSON.stringify({ success: false, error: 'Master admin only' }), {
      status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  const { model, temperature, max_tokens, system_prompt, enabled } = await request.json();

  // Validate model
  if (model && !DEEPSEEK_MODELS.find(m => m.id === model)) {
    return new Response(JSON.stringify({ success: false, error: 'Invalid model' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  // Validate temperature
  if (temperature !== undefined && (temperature < 0 || temperature > 2)) {
    return new Response(JSON.stringify({ success: false, error: 'Temperature must be 0-2' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  // Validate max_tokens
  if (max_tokens !== undefined && (max_tokens < 64 || max_tokens > 4096)) {
    return new Response(JSON.stringify({ success: false, error: 'Max tokens must be 64-4096' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  await env.DB.prepare(`
    UPDATE moderation_settings
    SET model = COALESCE(?, model),
        temperature = COALESCE(?, temperature),
        max_tokens = COALESCE(?, max_tokens),
        system_prompt = COALESCE(?, system_prompt),
        enabled = COALESCE(?, enabled),
        updated_at = CURRENT_TIMESTAMP,
        updated_by = ?
    WHERE id = 'global'
  `).bind(
    model || null,
    temperature ?? null,
    max_tokens || null,
    system_prompt || null,
    enabled !== undefined ? (enabled ? 1 : 0) : null,
    user.id
  ).run();

  // Invalidate cache so new settings apply immediately
  invalidateSettingsCache();

  return new Response(JSON.stringify({ success: true }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
}

// Admin API: Test moderation with sample message (master_admin only)
export async function handleTestModeration(request, authService, env, corsHeaders) {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return new Response(JSON.stringify({ success: false, error: 'Unauthorized' }), {
      status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  const { user } = await authService.getUserFromToken(authHeader.split(' ')[1]);
  if (user.role !== 'master_admin') {
    return new Response(JSON.stringify({ success: false, error: 'Master admin only' }), {
      status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  const { message } = await request.json();

  if (!message || message.trim().length === 0) {
    return new Response(JSON.stringify({ success: false, error: 'Message required' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  // Use a test company ID
  const result = await moderateMessage(env, 'test', message);

  return new Response(JSON.stringify({
    success: true,
    data: result,
  }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}

// Admin API: Get moderation log (master_admin only)
export async function handleGetModerationLog(request, authService, env, corsHeaders) {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return new Response(JSON.stringify({ success: false, error: 'Unauthorized' }), {
      status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  const { user } = await authService.getUserFromToken(authHeader.split(' ')[1]);
  if (user.role !== 'master_admin') {
    return new Response(JSON.stringify({ success: false, error: 'Master admin only' }), {
      status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  const url = new URL(request.url);
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '50'), 100);
  const rejectedOnly = url.searchParams.get('rejected') === 'true';

  let query = `
    SELECT ml.*, gc.name as company_name
    FROM moderation_log ml
    LEFT JOIN game_companies gc ON ml.company_id = gc.id
  `;

  if (rejectedOnly) {
    query += ' WHERE ml.allowed = 0';
  }

  query += ' ORDER BY ml.created_at DESC LIMIT ?';

  const logs = await env.DB.prepare(query).bind(limit).all();

  return new Response(JSON.stringify({
    success: true,
    data: logs.results,
  }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}
```

### Route Registration

```javascript
// 1. Add to imports at top of worker/index.js (around line 40):
import {
  handleGetModerationSettings,
  handleUpdateModerationSettings,
  handleTestModeration,
  handleGetModerationLog
} from './src/routes/game/moderation.js';

// 2. Add to the switch statement BEFORE "// ==================== GAME COMPANY ENDPOINTS ====================" (around line 308):

        // ==================== GAME MODERATION ADMIN ENDPOINTS ====================
        case path === '/api/game/moderation/settings' && method === 'GET':
          return handleGetModerationSettings(request, authService, env, corsHeaders);

        case path === '/api/game/moderation/settings' && method === 'PUT':
          return handleUpdateModerationSettings(request, authService, env, corsHeaders);

        case path === '/api/game/moderation/test' && method === 'POST':
          return handleTestModeration(request, authService, env, corsHeaders);

        case path === '/api/game/moderation/log' && method === 'GET':
          return handleGetModerationLog(request, authService, env, corsHeaders);
```

### Frontend API Service

```typescript
// src/services/moderationAdminApi.ts

export interface ModerationSettings {
  id: string;
  model: string;
  temperature: number;
  max_tokens: number;
  system_prompt: string;
  enabled: boolean;
  updated_at: string;
  updated_by: string | null;
  available_models: Array<{
    id: string;
    name: string;
    description: string;
  }>;
}

export interface ModerationLogEntry {
  id: string;
  company_id: string;
  company_name: string | null;
  message_content: string;
  model_used: string;
  allowed: number;
  rejection_reason: string | null;
  response_time_ms: number;
  created_at: string;
}

export interface TestResult {
  allowed: boolean;
  reason?: string;
  responseTimeMs: number;
  error?: string;
}

class ModerationAdminApi {
  private baseUrl = '/api/game/moderation';

  private async fetch<T>(path: string, options?: RequestInit): Promise<T> {
    const token = localStorage.getItem('auth_token');
    const response = await fetch(`${this.baseUrl}${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        ...options?.headers,
      },
    });
    const data = await response.json();
    if (!data.success) throw new Error(data.error || 'Request failed');
    return data.data;
  }

  async getSettings(): Promise<ModerationSettings> {
    return this.fetch('/settings');
  }

  async updateSettings(settings: Partial<ModerationSettings>): Promise<void> {
    await this.fetch('/settings', {
      method: 'PUT',
      body: JSON.stringify(settings),
    });
  }

  async testMessage(message: string): Promise<TestResult> {
    return this.fetch('/test', {
      method: 'POST',
      body: JSON.stringify({ message }),
    });
  }

  async getLog(options?: { limit?: number; rejectedOnly?: boolean }): Promise<ModerationLogEntry[]> {
    const params = new URLSearchParams();
    if (options?.limit) params.set('limit', options.limit.toString());
    if (options?.rejectedOnly) params.set('rejected', 'true');
    return this.fetch(`/log?${params}`);
  }
}

export const moderationAdminApi = new ModerationAdminApi();
```

### Admin Page Component

```tsx
// src/pages/ModerationAdminPage.tsx
import { useState, useEffect } from 'react';
import {
  Shield,
  Save,
  RefreshCw,
  Zap,
  AlertCircle,
  CheckCircle,
  X,
  Loader2,
  MessageSquare,
  Clock,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../components/ui/Toast';
import {
  moderationAdminApi,
  ModerationSettings,
  ModerationLogEntry,
  TestResult,
} from '../services/moderationAdminApi';

export default function ModerationAdminPage() {
  const { user } = useAuth();
  const { showToast } = useToast();

  // Access control
  const isMasterAdmin = user?.role === 'master_admin';

  // State
  const [settings, setSettings] = useState<ModerationSettings | null>(null);
  const [log, setLog] = useState<ModerationLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Form state
  const [model, setModel] = useState('deepseek-chat');
  const [temperature, setTemperature] = useState(0);
  const [maxTokens, setMaxTokens] = useState(256);
  const [systemPrompt, setSystemPrompt] = useState('');
  const [enabled, setEnabled] = useState(true);

  // Test state
  const [testMessage, setTestMessage] = useState('');
  const [testResult, setTestResult] = useState<TestResult | null>(null);
  const [testing, setTesting] = useState(false);

  // Tab state
  const [activeTab, setActiveTab] = useState<'settings' | 'log'>('settings');
  const [showRejectedOnly, setShowRejectedOnly] = useState(false);

  // Load data
  useEffect(() => {
    if (isMasterAdmin) {
      loadData();
    }
  }, [isMasterAdmin]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [settingsData, logData] = await Promise.all([
        moderationAdminApi.getSettings(),
        moderationAdminApi.getLog({ limit: 50 }),
      ]);
      setSettings(settingsData);
      setLog(logData);

      // Populate form
      setModel(settingsData.model);
      setTemperature(settingsData.temperature);
      setMaxTokens(settingsData.max_tokens);
      setSystemPrompt(settingsData.system_prompt);
      setEnabled(!!settingsData.enabled);
    } catch (err) {
      showToast('Failed to load settings', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await moderationAdminApi.updateSettings({
        model,
        temperature,
        max_tokens: maxTokens,
        system_prompt: systemPrompt,
        enabled,
      });
      showToast('Settings saved - changes apply immediately', 'success');
      loadData();
    } catch (err) {
      showToast('Failed to save settings', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    if (!testMessage.trim()) return;
    setTesting(true);
    setTestResult(null);
    try {
      const result = await moderationAdminApi.testMessage(testMessage);
      setTestResult(result);
    } catch (err) {
      showToast('Test failed', 'error');
    } finally {
      setTesting(false);
    }
  };

  const loadLog = async () => {
    try {
      const logData = await moderationAdminApi.getLog({
        limit: 50,
        rejectedOnly: showRejectedOnly,
      });
      setLog(logData);
    } catch (err) {
      showToast('Failed to load log', 'error');
    }
  };

  useEffect(() => {
    if (activeTab === 'log') {
      loadLog();
    }
  }, [activeTab, showRejectedOnly]);

  // Access denied
  if (!isMasterAdmin) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-6 text-center">
          <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-lg font-semibold text-red-900 dark:text-red-100">Access Denied</h2>
          <p className="text-red-700 dark:text-red-300 mt-2">
            Only master administrators can access moderation settings.
          </p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-purple-600" />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 shadow-sm rounded-lg p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Shield className="w-8 h-8 text-purple-600" />
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                Chat Moderation
              </h1>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                Configure AI moderation for the location message board
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className={`flex items-center gap-2 px-3 py-1 rounded-full text-sm ${
              enabled
                ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
                : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
            }`}>
              {enabled ? <CheckCircle className="w-4 h-4" /> : <X className="w-4 h-4" />}
              {enabled ? 'Active' : 'Disabled'}
            </div>
            <button
              onClick={loadData}
              className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
              <RefreshCw className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 dark:border-gray-700">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab('settings')}
            className={`py-4 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'settings'
                ? 'border-purple-500 text-purple-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Settings
          </button>
          <button
            onClick={() => setActiveTab('log')}
            className={`py-4 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'log'
                ? 'border-purple-500 text-purple-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Moderation Log ({log.length})
          </button>
        </nav>
      </div>

      {/* Settings Tab */}
      {activeTab === 'settings' && (
        <div className="grid grid-cols-3 gap-6">
          {/* Left: Configuration */}
          <div className="col-span-2 space-y-6">
            <div className="bg-white dark:bg-gray-800 shadow-sm rounded-lg p-6">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
                Moderation Configuration
              </h2>

              {/* Enable toggle */}
              <div className="flex items-center gap-3 mb-6 p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
                <input
                  type="checkbox"
                  id="enabled"
                  checked={enabled}
                  onChange={(e) => setEnabled(e.target.checked)}
                  className="h-5 w-5 text-purple-600 rounded"
                />
                <label htmlFor="enabled" className="text-gray-700 dark:text-gray-300">
                  Enable AI moderation for all messages
                </label>
              </div>

              {/* Model selector */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Model
                </label>
                <select
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                >
                  {settings?.available_models.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name} - {m.description}
                    </option>
                  ))}
                </select>
              </div>

              {/* Temperature */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Temperature: {temperature}
                </label>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={temperature}
                  onChange={(e) => setTemperature(parseFloat(e.target.value))}
                  className="w-full h-2 bg-gray-200 rounded-lg cursor-pointer accent-purple-600"
                />
                <p className="text-xs text-gray-500 mt-1">
                  0 = deterministic (recommended for moderation), 1 = creative
                </p>
              </div>

              {/* Max tokens */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Max Tokens
                </label>
                <input
                  type="number"
                  min="64"
                  max="4096"
                  value={maxTokens}
                  onChange={(e) => setMaxTokens(parseInt(e.target.value) || 256)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                />
              </div>

              {/* System prompt */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  System Prompt
                </label>
                <textarea
                  value={systemPrompt}
                  onChange={(e) => setSystemPrompt(e.target.value)}
                  rows={16}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 font-mono text-xs"
                />
              </div>

              {/* Save button */}
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Save Settings
              </button>
            </div>
          </div>

          {/* Right: Test panel */}
          <div className="space-y-6">
            <div className="bg-white dark:bg-gray-800 shadow-sm rounded-lg p-6">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
                Test Moderation
              </h2>

              <textarea
                value={testMessage}
                onChange={(e) => setTestMessage(e.target.value)}
                rows={4}
                placeholder="Enter a test message..."
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 mb-4"
              />

              <button
                onClick={handleTest}
                disabled={testing || !testMessage.trim()}
                className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50"
              >
                {testing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
                Test Message
              </button>

              {/* Test result */}
              {testResult && (
                <div className={`mt-4 p-4 rounded-lg ${
                  testResult.allowed
                    ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800'
                    : 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800'
                }`}>
                  <div className="flex items-center gap-2 mb-2">
                    {testResult.allowed ? (
                      <CheckCircle className="w-5 h-5 text-green-600" />
                    ) : (
                      <X className="w-5 h-5 text-red-600" />
                    )}
                    <span className={`font-medium ${testResult.allowed ? 'text-green-700 dark:text-green-300' : 'text-red-700 dark:text-red-300'}`}>
                      {testResult.allowed ? 'ALLOWED' : 'REJECTED'}
                    </span>
                  </div>
                  {testResult.reason && (
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Reason: {testResult.reason}
                    </p>
                  )}
                  <p className="text-xs text-gray-500 mt-2">
                    Response time: {testResult.responseTimeMs}ms
                  </p>
                </div>
              )}
            </div>

            {/* Quick examples */}
            <div className="bg-white dark:bg-gray-800 shadow-sm rounded-lg p-6">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">
                Test Examples
              </h3>
              <div className="space-y-2">
                {[
                  'Anyone want to trade land in the north district?',
                  'Check out my website at spam.com',
                  'You guys are all trash, I own this town!',
                  'Selling $10k in-game cash for $5 PayPal',
                ].map((example, i) => (
                  <button
                    key={i}
                    onClick={() => setTestMessage(example)}
                    className="w-full text-left text-xs p-2 bg-gray-50 dark:bg-gray-900 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400"
                  >
                    {example}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Log Tab */}
      {activeTab === 'log' && (
        <div className="bg-white dark:bg-gray-800 shadow-sm rounded-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              Moderation Log
            </h2>
            <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
              <input
                type="checkbox"
                checked={showRejectedOnly}
                onChange={(e) => setShowRejectedOnly(e.target.checked)}
                className="h-4 w-4 text-purple-600 rounded"
              />
              Show rejected only
            </label>
          </div>

          <div className="space-y-3">
            {log.length === 0 ? (
              <p className="text-gray-500 text-center py-8">No moderation logs yet.</p>
            ) : (
              log.map((entry) => (
                <div
                  key={entry.id}
                  className={`p-4 rounded-lg border ${
                    entry.allowed
                      ? 'border-gray-200 dark:border-gray-700'
                      : 'border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/10'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        {entry.allowed ? (
                          <CheckCircle className="w-4 h-4 text-green-600" />
                        ) : (
                          <X className="w-4 h-4 text-red-600" />
                        )}
                        <span className="font-medium text-gray-900 dark:text-gray-100">
                          {entry.company_name || 'Unknown'}
                        </span>
                        <span className="text-xs text-gray-500">
                          {new Date(entry.created_at).toLocaleString()}
                        </span>
                      </div>
                      <p className="text-sm text-gray-700 dark:text-gray-300 mb-1">
                        {entry.message_content}
                      </p>
                      {entry.rejection_reason && (
                        <p className="text-xs text-red-600 dark:text-red-400">
                          Reason: {entry.rejection_reason}
                        </p>
                      )}
                    </div>
                    <div className="text-xs text-gray-500 flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {entry.response_time_ms}ms
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
```

### Integration with Message Posting

When Stage 14 is implemented, the `postMessage` function should call `moderateMessage` first:

```javascript
// In worker/routes/game/social.js - updated postMessage

import { moderateMessage } from './moderation.js';

export async function postMessage(request, env, company) {
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

  // === AI MODERATION ===
  const moderation = await moderateMessage(env, company.id, content.trim());

  if (!moderation.allowed) {
    throw new Error(moderation.reason || 'Message was rejected by moderation');
  }
  // === END MODERATION ===

  await env.DB.prepare(`
    INSERT INTO messages (id, map_id, company_id, content)
    VALUES (?, ?, ?, ?)
  `).bind(crypto.randomUUID(), company.current_map_id, company.id, content.trim()).run();

  return { success: true };
}
```

## Test Cases

| Test | Input | Expected Output |
|------|-------|-----------------|
| Settings load | GET /settings | Returns current config |
| Settings update | PUT /settings | Updates and cache invalidates |
| Test allowed | "Anyone want to trade?" | allowed: true |
| Test rejected | "Buy gold at mysite.com" | allowed: false, reason: external link |
| Test rejected | Hate speech | allowed: false |
| Post moderated | Blocked message | Error thrown |
| Post clean | Clean message | Message posted |
| Log shows entries | After posts | Log contains decisions |

## Acceptance Checklist

- [ ] Migration creates settings and log tables
- [ ] DEEPSEEK_API_KEY worker secret added
- [ ] Admin page loads for master_admin only
- [ ] Can update model, temperature, prompt
- [ ] Settings apply instantly (5s cache max)
- [ ] Test panel works with sample messages
- [ ] Moderation log shows all decisions
- [ ] Clean messages post successfully
- [ ] Blocked messages return error
- [ ] API errors fail open (allow message)

## Deployment

```bash
# 1. Add worker secret
npx wrangler secret put DEEPSEEK_API_KEY
# Enter: sk-cb83615f28e8442782e6277fb2a01637

# 2. Run migration
CLOUDFLARE_API_TOKEN="..." npx wrangler d1 execute notropolis-database --file=migrations/0020_create_moderation_settings.sql --remote

# 3. Deploy
npm run build
CLOUDFLARE_API_TOKEN="..." CLOUDFLARE_ACCOUNT_ID="..." npx wrangler pages deploy ./dist --project-name=notropolis-dashboard
```

## Handoff Notes

- Settings use 5-second cache for performance while allowing near-instant updates
- On API errors, moderation fails open (allows message) to avoid blocking users
- Moderation log stores all decisions for audit purposes
- DeepSeek-V3 (`deepseek-chat`) recommended for cost efficiency
- Temperature 0 recommended for consistent moderation decisions
- Stage 14's `postMessage` function must import and call `moderateMessage`
