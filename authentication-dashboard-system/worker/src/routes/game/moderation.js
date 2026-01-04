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
          { role: 'user', content: (settings.chat_user_prompt || 'Message to review:\n\n{content}').replace('{content}', messageContent) },
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

    // Log the moderation decision (skip for test calls to avoid FK constraint)
    if (companyId !== 'test') {
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
    }

    return {
      allowed: result.allowed,
      reason: result.reason,
      censored: result.censored || null,
      responseTimeMs,
    };
  } catch (error) {
    console.error('Moderation error:', error);
    // On error, allow message to avoid blocking users
    return { allowed: true, error: error.message };
  }
}

// Moderate a name (company name or boss name) for inappropriate content
// Uses a simpler prompt focused on name validation
export async function moderateName(env, nameType, name) {
  const settings = await getModerationSettings(env);

  // If moderation is disabled, allow all
  if (!settings || !settings.enabled) {
    return { allowed: true };
  }

  const startTime = Date.now();

  const namePrompt = `You are a content moderator for a game. Your job is to check if a ${nameType} is appropriate.

REJECT names that contain:
- Profanity, slurs, or vulgar language
- Hate speech or discriminatory terms
- Sexual or explicit content
- Real-world offensive references
- Attempts to bypass filters (e.g., "f*ck", "sh1t", letter substitutions)

ALLOW names that are:
- Creative business/character names
- Funny but clean names
- Puns or wordplay (as long as not offensive)
- Normal names

Respond with JSON only:
{"allowed": true} or {"allowed": false, "reason": "brief reason"}`;

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
          { role: 'system', content: namePrompt },
          { role: 'user', content: (settings.name_user_prompt || '{type} to review: "{content}"').replace('{type}', nameType).replace('{content}', name) },
        ],
        temperature: 0, // Use 0 for consistent moderation
        max_tokens: 100,
      }),
    });

    if (!response.ok) {
      console.error('DeepSeek API error:', response.status);
      // On API error, allow name
      return { allowed: true, error: 'API error' };
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '';

    // Parse JSON response
    let result;
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      result = JSON.parse(jsonMatch ? jsonMatch[0] : content);
    } catch {
      console.error('Failed to parse name moderation response:', content);
      // On parse error, allow name
      return { allowed: true, error: 'Parse error' };
    }

    return {
      allowed: result.allowed,
      reason: result.reason,
      responseTimeMs: Date.now() - startTime,
    };
  } catch (error) {
    console.error('Name moderation error:', error);
    // On error, allow name to avoid blocking users
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

  let user;
  try {
    const result = await authService.getUserFromToken(authHeader.split(' ')[1]);
    user = result.user;
  } catch (error) {
    return new Response(JSON.stringify({ success: false, error: 'Invalid or expired token' }), {
      status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

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

  let user;
  try {
    const result = await authService.getUserFromToken(authHeader.split(' ')[1]);
    user = result.user;
  } catch (error) {
    return new Response(JSON.stringify({ success: false, error: 'Invalid or expired token' }), {
      status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  if (user.role !== 'master_admin') {
    return new Response(JSON.stringify({ success: false, error: 'Master admin only' }), {
      status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  const { model, temperature, max_tokens, system_prompt, chat_user_prompt, name_user_prompt, enabled } = await request.json();

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
        chat_user_prompt = COALESCE(?, chat_user_prompt),
        name_user_prompt = COALESCE(?, name_user_prompt),
        enabled = COALESCE(?, enabled),
        updated_at = CURRENT_TIMESTAMP,
        updated_by = ?
    WHERE id = 'global'
  `).bind(
    model || null,
    temperature ?? null,
    max_tokens || null,
    system_prompt || null,
    chat_user_prompt || null,
    name_user_prompt || null,
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

  let user;
  try {
    const result = await authService.getUserFromToken(authHeader.split(' ')[1]);
    user = result.user;
  } catch (error) {
    return new Response(JSON.stringify({ success: false, error: 'Invalid or expired token' }), {
      status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

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

  let user;
  try {
    const result = await authService.getUserFromToken(authHeader.split(' ')[1]);
    user = result.user;
  } catch (error) {
    return new Response(JSON.stringify({ success: false, error: 'Invalid or expired token' }), {
      status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

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
