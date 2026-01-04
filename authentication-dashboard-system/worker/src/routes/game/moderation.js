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

// Moderate an attack message using DeepSeek with attack-specific prompts
export async function moderateAttackMessage(env, companyId, messageContent) {
  const settings = await getModerationSettings(env);

  // If attack moderation is disabled, allow all
  if (!settings || !settings.attack_moderation_enabled) {
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
          { role: 'system', content: settings.attack_system_prompt },
          { role: 'user', content: (settings.attack_user_prompt || 'Attack message to review:\n\n{content}').replace('{content}', messageContent) },
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
      console.error('Failed to parse attack moderation response:', content);
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
        `[ATTACK] ${messageContent}`,
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
    console.error('Attack moderation error:', error);
    // On error, allow message to avoid blocking users
    return { allowed: true, error: error.message };
  }
}

// Moderate a name (company name or boss name) for inappropriate content
// Uses configurable prompts from moderation_settings
export async function moderateName(env, nameType, name) {
  const settings = await getModerationSettings(env);

  // If name moderation is disabled, allow all
  if (!settings || !settings.name_moderation_enabled) {
    return { allowed: true };
  }

  const startTime = Date.now();

  // Use configurable system prompt, with {type} placeholder for name type
  const systemPrompt = (settings.name_system_prompt || '').replace('{type}', nameType);

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
          { role: 'system', content: systemPrompt },
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

  const {
    model, temperature, max_tokens, system_prompt, chat_user_prompt, name_user_prompt, enabled,
    attack_system_prompt, attack_user_prompt, attack_moderation_enabled,
    name_system_prompt, name_moderation_enabled
  } = await request.json();

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
        attack_system_prompt = COALESCE(?, attack_system_prompt),
        attack_user_prompt = COALESCE(?, attack_user_prompt),
        attack_moderation_enabled = COALESCE(?, attack_moderation_enabled),
        name_system_prompt = COALESCE(?, name_system_prompt),
        name_moderation_enabled = COALESCE(?, name_moderation_enabled),
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
    attack_system_prompt || null,
    attack_user_prompt || null,
    attack_moderation_enabled !== undefined ? (attack_moderation_enabled ? 1 : 0) : null,
    name_system_prompt || null,
    name_moderation_enabled !== undefined ? (name_moderation_enabled ? 1 : 0) : null,
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

// Admin API: Test attack message moderation with sample message (master_admin only)
export async function handleTestAttackModeration(request, authService, env, corsHeaders) {
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
  const result = await moderateAttackMessage(env, 'test', message);

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

// Admin API: Get attack messages pending moderation (master_admin only)
export async function handleGetAttackMessages(request, authService, env, corsHeaders) {
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
  const status = url.searchParams.get('status') || 'pending'; // pending, approved, rejected, all
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '50'), 100);

  let query = `
    SELECT a.id, a.message, a.message_status, a.trick_type, a.created_at,
           a.message_moderated_at, a.message_rejection_reason,
           attacker.name as attacker_company_name, attacker.boss_name as attacker_boss_name,
           target_company.name as target_company_name,
           bi.building_type_id, bt.name as building_name,
           t.x, t.y, m.name as map_name
    FROM attacks a
    JOIN game_companies attacker ON a.attacker_company_id = attacker.id
    JOIN building_instances bi ON a.target_building_id = bi.id
    JOIN building_types bt ON bi.building_type_id = bt.id
    JOIN game_companies target_company ON bi.company_id = target_company.id
    JOIN tiles t ON bi.tile_id = t.id
    JOIN maps m ON t.map_id = m.id
    WHERE a.message IS NOT NULL
  `;

  if (status !== 'all') {
    query += ` AND a.message_status = '${status}'`;
  }

  query += ' ORDER BY a.created_at DESC LIMIT ?';

  const messages = await env.DB.prepare(query).bind(limit).all();

  return new Response(JSON.stringify({
    success: true,
    data: messages.results,
  }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}

// Admin API: Approve attack message (master_admin only)
export async function handleApproveAttackMessage(request, authService, env, corsHeaders) {
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

  const { attack_id } = await request.json();

  if (!attack_id) {
    return new Response(JSON.stringify({ success: false, error: 'Attack ID required' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  const result = await env.DB.prepare(`
    UPDATE attacks
    SET message_status = 'approved',
        message_moderated_at = datetime('now'),
        message_moderated_by = ?
    WHERE id = ? AND message IS NOT NULL AND message_status = 'pending'
  `).bind(user.id, attack_id).run();

  if (result.meta.changes === 0) {
    return new Response(JSON.stringify({ success: false, error: 'Message not found or already moderated' }), {
      status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  return new Response(JSON.stringify({ success: true }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
}

// Admin API: Reject attack message (master_admin only)
export async function handleRejectAttackMessage(request, authService, env, corsHeaders) {
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

  const { attack_id, reason } = await request.json();

  if (!attack_id) {
    return new Response(JSON.stringify({ success: false, error: 'Attack ID required' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  const result = await env.DB.prepare(`
    UPDATE attacks
    SET message_status = 'rejected',
        message_moderated_at = datetime('now'),
        message_moderated_by = ?,
        message_rejection_reason = ?
    WHERE id = ? AND message IS NOT NULL AND message_status = 'pending'
  `).bind(user.id, reason || null, attack_id).run();

  if (result.meta.changes === 0) {
    return new Response(JSON.stringify({ success: false, error: 'Message not found or already moderated' }), {
      status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  return new Response(JSON.stringify({ success: true }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
}
