/**
 * Achievements System API Routes
 *
 * Handles achievement tracking, progress calculation, and reward distribution.
 * Achievements are user-level (not company-level) and track lifetime progress.
 */

/**
 * Calculate user's progress for a specific condition type
 * @param {Object} env - Environment bindings
 * @param {string} userId - User ID
 * @returns {Object} Progress values for each condition type
 */
async function calculateUserProgress(env, userId) {
  // Get all companies for this user
  const companiesResult = await env.DB.prepare(`
    SELECT id, offshore FROM game_companies WHERE user_id = ?
  `).bind(userId).all();

  const companies = companiesResult.results || [];
  const companyIds = companies.map((c) => c.id);

  // If user has no companies, return zero progress
  if (companyIds.length === 0) {
    return {
      hero_count: 0,
      attack_count: 0,
      attack_wins: 0,
      offshore_total: 0,
      buildings_owned: 0,
      land_owned: 0,
      donations_made: 0,
    };
  }

  // Build placeholders for IN clause
  const placeholders = companyIds.map(() => '?').join(',');

  // Count hero_out transactions
  const heroResult = await env.DB.prepare(`
    SELECT COUNT(*) as count FROM game_transactions
    WHERE company_id IN (${placeholders}) AND action_type = 'hero_out'
  `).bind(...companyIds).first();

  // Count attack transactions (dirty_trick)
  const attackResult = await env.DB.prepare(`
    SELECT COUNT(*) as count FROM game_transactions
    WHERE company_id IN (${placeholders}) AND action_type = 'dirty_trick'
  `).bind(...companyIds).first();

  // Count successful attacks (where damage > 0)
  const attackWinsResult = await env.DB.prepare(`
    SELECT COUNT(*) as count FROM game_transactions
    WHERE company_id IN (${placeholders}) AND action_type = 'dirty_trick'
    AND json_extract(details, '$.damage') > 0
  `).bind(...companyIds).first();

  // Sum total offshore across all companies
  const totalOffshore = companies.reduce((sum, c) => sum + (c.offshore || 0), 0);

  // Count current buildings owned
  const buildingsResult = await env.DB.prepare(`
    SELECT COUNT(*) as count FROM building_instances
    WHERE company_id IN (${placeholders})
  `).bind(...companyIds).first();

  // Count current land owned
  const landResult = await env.DB.prepare(`
    SELECT COUNT(*) as count FROM tiles
    WHERE owner_company_id IN (${placeholders})
  `).bind(...companyIds).first();

  // Count donations made
  const donationsResult = await env.DB.prepare(`
    SELECT COUNT(*) as count FROM game_transactions
    WHERE company_id IN (${placeholders}) AND action_type = 'donate'
  `).bind(...companyIds).first();

  return {
    hero_count: heroResult?.count || 0,
    attack_count: attackResult?.count || 0,
    attack_wins: attackWinsResult?.count || 0,
    offshore_total: totalOffshore,
    buildings_owned: buildingsResult?.count || 0,
    land_owned: landResult?.count || 0,
    donations_made: donationsResult?.count || 0,
  };
}

/**
 * GET /api/game/achievements
 * Get all achievements with user's progress
 */
export async function getAchievements(env, userId) {
  // Get all achievements
  const achievementsResult = await env.DB.prepare(`
    SELECT * FROM achievements ORDER BY category, sort_order
  `).all();

  const achievements = achievementsResult.results || [];

  // Get user's achievement records
  const userAchievementsResult = await env.DB.prepare(`
    SELECT * FROM user_achievements WHERE user_id = ?
  `).bind(userId).all();

  const userAchievements = userAchievementsResult.results || [];
  const userAchievementMap = new Map(userAchievements.map((ua) => [ua.achievement_id, ua]));

  // Calculate current progress
  const progress = await calculateUserProgress(env, userId);

  // Build achievement list with progress
  const achievementList = achievements.map((a) => {
    const userAch = userAchievementMap.get(a.id);
    const currentProgress = progress[a.condition_type] || 0;
    const isCompleted = userAch?.completed_at != null;

    return {
      id: a.id,
      category: a.category,
      name: a.name,
      description: a.description,
      icon: a.icon,
      rarity: a.rarity,
      points: a.points,
      conditionType: a.condition_type,
      conditionValue: a.condition_value,
      rewardType: a.reward_type,
      rewardId: a.reward_id,
      progress: currentProgress,
      percentage: Math.min(100, Math.floor((currentProgress / a.condition_value) * 100)),
      isCompleted,
      completedAt: userAch?.completed_at || null,
    };
  });

  // Calculate summary
  const completedCount = achievementList.filter((a) => a.isCompleted).length;
  const totalPoints = achievementList
    .filter((a) => a.isCompleted)
    .reduce((sum, a) => sum + a.points, 0);

  return {
    achievements: achievementList,
    summary: {
      total: achievementList.length,
      completed: completedCount,
      points: totalPoints,
    },
  };
}

/**
 * Check and grant achievements for a user
 * Called after actions that might trigger achievement progress
 * @param {Object} env - Environment bindings
 * @param {string} userId - User ID
 * @returns {Object} Newly unlocked achievements
 */
export async function checkAchievements(env, userId) {
  // Get all achievements
  const achievementsResult = await env.DB.prepare(`
    SELECT * FROM achievements ORDER BY category, sort_order
  `).all();

  const achievements = achievementsResult.results || [];

  // Get user's existing achievement records
  const userAchievementsResult = await env.DB.prepare(`
    SELECT * FROM user_achievements WHERE user_id = ?
  `).bind(userId).all();

  const userAchievements = userAchievementsResult.results || [];
  const completedIds = new Set(
    userAchievements.filter((ua) => ua.completed_at != null).map((ua) => ua.achievement_id)
  );

  // Calculate current progress
  const progress = await calculateUserProgress(env, userId);

  const newlyUnlocked = [];
  const statements = [];

  for (const achievement of achievements) {
    // Skip already completed
    if (completedIds.has(achievement.id)) continue;

    const currentProgress = progress[achievement.condition_type] || 0;
    const isNowComplete = currentProgress >= achievement.condition_value;

    // Check if user has a record for this achievement
    const existingRecord = userAchievements.find((ua) => ua.achievement_id === achievement.id);

    if (isNowComplete) {
      // Achievement completed!
      const now = new Date().toISOString();

      if (existingRecord) {
        // Update existing record
        statements.push(
          env.DB.prepare(`
            UPDATE user_achievements
            SET progress = ?, completed_at = ?
            WHERE user_id = ? AND achievement_id = ?
          `).bind(currentProgress, now, userId, achievement.id)
        );
      } else {
        // Create new completed record
        statements.push(
          env.DB.prepare(`
            INSERT INTO user_achievements (id, user_id, achievement_id, progress, completed_at)
            VALUES (?, ?, ?, ?, ?)
          `).bind(crypto.randomUUID(), userId, achievement.id, currentProgress, now)
        );
      }

      // Grant rewards if any
      if (achievement.reward_type === 'avatar_item' && achievement.reward_id) {
        // Check if user already has this unlock
        const existingUnlock = await env.DB.prepare(`
          SELECT id FROM avatar_unlocks WHERE user_id = ? AND item_id = ?
        `).bind(userId, achievement.reward_id).first();

        if (!existingUnlock) {
          statements.push(
            env.DB.prepare(`
              INSERT INTO avatar_unlocks (id, user_id, item_id)
              VALUES (?, ?, ?)
            `).bind(crypto.randomUUID(), userId, achievement.reward_id)
          );
        }
      } else if (achievement.reward_type === 'badge' && achievement.reward_id) {
        // Check if user already has this badge
        const existingBadge = await env.DB.prepare(`
          SELECT id FROM user_badges WHERE user_id = ? AND badge_id = ?
        `).bind(userId, achievement.reward_id).first();

        if (!existingBadge) {
          statements.push(
            env.DB.prepare(`
              INSERT INTO user_badges (id, user_id, badge_id)
              VALUES (?, ?, ?)
            `).bind(crypto.randomUUID(), userId, achievement.reward_id)
          );
        }
      }

      newlyUnlocked.push({
        id: achievement.id,
        name: achievement.name,
        description: achievement.description,
        icon: achievement.icon,
        rarity: achievement.rarity,
        points: achievement.points,
        rewardType: achievement.reward_type,
        rewardId: achievement.reward_id,
      });
    } else if (!existingRecord && currentProgress > 0) {
      // Create progress record for tracking
      statements.push(
        env.DB.prepare(`
          INSERT INTO user_achievements (id, user_id, achievement_id, progress)
          VALUES (?, ?, ?, ?)
        `).bind(crypto.randomUUID(), userId, achievement.id, currentProgress)
      );
    } else if (existingRecord && currentProgress > existingRecord.progress) {
      // Update progress
      statements.push(
        env.DB.prepare(`
          UPDATE user_achievements SET progress = ? WHERE id = ?
        `).bind(currentProgress, existingRecord.id)
      );
    }
  }

  // Execute all statements
  if (statements.length > 0) {
    await env.DB.batch(statements);
  }

  return {
    newlyUnlocked,
    totalUnlocked: newlyUnlocked.length,
  };
}

/**
 * GET /api/game/achievements/badges
 * Get user's earned badges
 */
export async function getUserBadges(env, userId) {
  const result = await env.DB.prepare(`
    SELECT b.*, ub.earned_at
    FROM badges b
    JOIN user_badges ub ON b.id = ub.badge_id
    WHERE ub.user_id = ?
    ORDER BY b.sort_order
  `).bind(userId).all();

  return {
    badges: result.results || [],
  };
}
