/**
 * Avatar System API Routes
 *
 * Handles avatar customization with preloaded outfits, headwear, and accessories,
 * plus an unlock system for earning items through gameplay achievements.
 */

// R2 public URL for avatar assets
const R2_PUBLIC_URL = 'https://pub-874867b18f8b4b4882277d8a2b7dfe80.r2.dev';

// Get all items with unlock status for a user
export async function getAvatarItems(env, userId, companyId) {
  // Get all items
  const items = await env.DB.prepare(
    'SELECT * FROM avatar_items ORDER BY category, sort_order'
  ).all();

  // Get unlocked items for this user
  const unlocks = await env.DB.prepare(
    'SELECT item_id FROM avatar_unlocks WHERE user_id = ?'
  ).bind(userId).all();

  const unlockedIds = new Set(unlocks.results.map(u => u.item_id));

  // Get current selection for this company
  const selection = await env.DB.prepare(
    'SELECT * FROM company_avatars WHERE company_id = ?'
  ).bind(companyId).first();

  // Mark items as available/locked
  const itemsWithStatus = items.results.map(item => ({
    ...item,
    isUnlocked: item.unlock_condition === null || unlockedIds.has(item.id),
    isSelected: selection && Object.values(selection).includes(item.id),
    // Parse unlock condition for display
    unlockRequirement: item.unlock_condition ? JSON.parse(item.unlock_condition) : null,
  }));

  return {
    items: itemsWithStatus,
    selection: selection || {},
  };
}

// Update avatar selection
export async function updateAvatar(env, userId, companyId, category, itemId) {
  const VALID_CATEGORIES = ['base', 'skin', 'hair', 'outfit', 'headwear', 'accessory', 'background'];

  if (!VALID_CATEGORIES.includes(category)) {
    throw new Error('Invalid category');
  }

  // Validate item if provided
  if (itemId) {
    const item = await env.DB.prepare(
      'SELECT * FROM avatar_items WHERE id = ? AND category = ?'
    ).bind(itemId, category).first();

    if (!item) throw new Error('Item not found');

    // Check if unlocked (if has unlock condition)
    if (item.unlock_condition) {
      const unlock = await env.DB.prepare(
        'SELECT * FROM avatar_unlocks WHERE user_id = ? AND item_id = ?'
      ).bind(userId, itemId).first();

      if (!unlock) throw new Error('Item is locked');
    }
  }

  // Check if avatar record exists
  const existing = await env.DB.prepare(
    'SELECT id FROM company_avatars WHERE company_id = ?'
  ).bind(companyId).first();

  const column = `${category}_id`;

  if (existing) {
    await env.DB.prepare(`
      UPDATE company_avatars SET ${column} = ?, updated_at = CURRENT_TIMESTAMP WHERE company_id = ?
    `).bind(itemId, companyId).run();
  } else {
    await env.DB.prepare(`
      INSERT INTO company_avatars (id, company_id, ${column}, updated_at)
      VALUES (?, ?, ?, CURRENT_TIMESTAMP)
    `).bind(crypto.randomUUID(), companyId, itemId).run();
  }

  return { success: true };
}

// Get avatar layers for rendering
export async function getAvatarImage(env, companyId) {
  const selection = await env.DB.prepare(
    'SELECT * FROM company_avatars WHERE company_id = ?'
  ).bind(companyId).first();

  if (!selection) {
    return { layers: [] };
  }

  // Get R2 keys for selected items
  const itemIds = [
    selection.background_id,
    selection.base_id,
    selection.skin_id,
    selection.outfit_id,
    selection.hair_id,
    selection.headwear_id,
    selection.accessory_id,
  ].filter(Boolean);

  if (itemIds.length === 0) {
    return { layers: [] };
  }

  const placeholders = itemIds.map(() => '?').join(',');
  const items = await env.DB.prepare(`
    SELECT id, r2_key, category FROM avatar_items WHERE id IN (${placeholders})
  `).bind(...itemIds).all();

  // Return layers in correct order for compositing
  const categoryOrder = ['background', 'base', 'skin', 'outfit', 'hair', 'headwear', 'accessory'];
  const layers = categoryOrder
    .map(cat => {
      const item = items.results.find(i => i.category === cat);
      if (item) {
        return {
          category: cat,
          url: `${R2_PUBLIC_URL}/${item.r2_key}`,
        };
      }
      return null;
    })
    .filter(Boolean);

  return { layers };
}

// ============================================================
// UNLOCK SYSTEM
// ============================================================

// Check and grant any newly unlocked items for a user
// Called after hero_out action
export async function checkAvatarUnlocks(env, userId) {
  // Get all items with unlock conditions that user hasn't unlocked yet
  const lockedItems = await env.DB.prepare(`
    SELECT ai.* FROM avatar_items ai
    WHERE ai.unlock_condition IS NOT NULL
    AND ai.id NOT IN (
      SELECT item_id FROM avatar_unlocks WHERE user_id = ?
    )
  `).bind(userId).all();

  if (lockedItems.results.length === 0) {
    return { newlyUnlocked: [] };
  }

  // Get user stats for condition evaluation
  const stats = await getUserStats(env, userId);

  const newlyUnlocked = [];

  for (const item of lockedItems.results) {
    const condition = JSON.parse(item.unlock_condition);
    const isMet = evaluateUnlockCondition(condition, stats);

    if (isMet) {
      // Grant the unlock
      await env.DB.prepare(`
        INSERT INTO avatar_unlocks (id, user_id, item_id, unlocked_at)
        VALUES (?, ?, ?, CURRENT_TIMESTAMP)
      `).bind(crypto.randomUUID(), userId, item.id).run();

      newlyUnlocked.push({
        id: item.id,
        name: item.name,
        category: item.category,
        rarity: item.rarity,
        r2_key: item.r2_key,
      });
    }
  }

  return { newlyUnlocked };
}

// Get user stats for unlock condition evaluation
async function getUserStats(env, userId) {
  // Count total hero completions across all user's companies
  const heroCount = await env.DB.prepare(`
    SELECT COUNT(*) as count FROM game_transactions t
    JOIN game_companies c ON t.company_id = c.id
    WHERE c.user_id = ? AND t.action_type = 'hero_out'
  `).bind(userId).first();

  return {
    hero_count: heroCount?.count || 0,
    // Add more stats here as needed for future unlock types:
    // attack_count: ...,
    // total_donated: ...,
    // etc.
  };
}

// Evaluate a single unlock condition against user stats
function evaluateUnlockCondition(condition, stats) {
  switch (condition.type) {
    case 'hero_count':
      return stats.hero_count >= condition.count;

    // Add more condition types here as needed:
    // case 'attack_count':
    //   return stats.attack_count >= condition.count;
    // case 'total_donated':
    //   return stats.total_donated >= condition.amount;

    default:
      // Unknown condition type - don't unlock
      return false;
  }
}
