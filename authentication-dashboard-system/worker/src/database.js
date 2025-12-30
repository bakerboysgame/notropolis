// Enhanced Database helper functions for Cloudflare Workers
// Multi-Tenant SaaS Authentication System

export class Database {
  constructor(env) {
    this.db = env.DB;
  }

  // ==================== USER OPERATIONS ====================

  async createUser(userData) {
    const { 
      email, 
      username, 
      password, 
      firstName, 
      lastName, 
      companyId, 
      role = 'user',
      phiAccessLevel = 'none',
      dataClassification = 'public'
    } = userData;
    
    const hashedPassword = await this.hashPassword(password);
    
    const result = await this.db.prepare(`
      INSERT INTO users (
        email, username, password, first_name, last_name, 
        company_id, role, phi_access_level, data_classification
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      email, username, hashedPassword, firstName, lastName,
      companyId, role, phiAccessLevel, dataClassification
    ).run();
    
    return result;
  }

  async getUserByEmail(email) {
    const result = await this.db.prepare(`
      SELECT * FROM users 
      WHERE email = ? AND deleted_at IS NULL
    `).bind(email).first();
    
    return result;
  }

  async getUserById(id) {
    const result = await this.db.prepare(`
      SELECT * FROM users 
      WHERE id = ? AND deleted_at IS NULL
    `).bind(id).first();
    
    return result;
  }

  async updateUser(id, updateData) {
    const fields = [];
    const values = [];
    
    Object.keys(updateData).forEach(key => {
      if (updateData[key] !== undefined) {
        fields.push(`${key} = ?`);
        values.push(updateData[key]);
      }
    });
    
    if (fields.length === 0) return null;
    
    values.push(id);
    const query = `UPDATE users SET ${fields.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`;
    
    const result = await this.db.prepare(query).bind(...values).run();
    return result;
  }

  async softDeleteUser(id) {
    const result = await this.db.prepare(`
      UPDATE users 
      SET deleted_at = CURRENT_TIMESTAMP, is_active = 0, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).bind(id).run();
    
    return result;
  }

  async restoreUser(id) {
    const result = await this.db.prepare(`
      UPDATE users 
      SET deleted_at = NULL, is_active = 1, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).bind(id).run();
    
    return result;
  }

  async hardDeleteUser(id) {
    // WARNING: This permanently deletes the user. Use softDeleteUser for HIPAA compliance.
    
    // CRITICAL: Remove FK constraints before deleting
    
    // 1. Remove from companies.admin_user_id (if this user is a company admin)
    await this.db.prepare(`
      UPDATE companies SET admin_user_id = NULL WHERE admin_user_id = ?
    `).bind(id).run();
    
    // 2. Delete user sessions (FK constraint)
    await this.db.prepare(`
      DELETE FROM sessions WHERE user_id = ?
    `).bind(id).run();
    
    // 3. Delete user permissions (FK constraint)
    await this.db.prepare(`
      DELETE FROM user_permissions WHERE user_id = ? OR granted_by = ?
    `).bind(id, id).run();
    
    // 4. Delete user preferences (FK constraint)
    await this.db.prepare(`
      DELETE FROM user_preferences WHERE user_id = ?
    `).bind(id).run();
    
    // 5. Set audit logs user_id to NULL to preserve audit trail
    // NOTE: user_id column allows NULL, and audit logs ABOUT this user use related_user_id
    await this.db.prepare(`
      UPDATE audit_logs SET user_id = NULL WHERE user_id = ?
    `).bind(id).run();

    // 6. Also update audit_logs_display to preserve the user info but clear FK reference
    await this.db.prepare(`
      UPDATE audit_logs_display SET user_id = NULL WHERE user_id = ?
    `).bind(id).run();

    // 7. Finally, delete the user
    const result = await this.db.prepare(`
      DELETE FROM users WHERE id = ?
    `).bind(id).run();
    
    return result;
  }

  async canUserBeArchived(userId) {
    // Check if user can be safely archived/deleted
    // Returns { canArchive: boolean, reason: string }
    
    const user = await this.getUserById(userId);
    if (!user) {
      return { canArchive: false, reason: 'User not found' };
    }

    // Check if this user is a company admin
    const company = await this.db.prepare(`
      SELECT id, name, admin_user_id FROM companies WHERE admin_user_id = ?
    `).bind(userId).first();

    if (!company) {
      // Not a company admin, can be archived
      return { canArchive: true };
    }

    // User is a company admin - check if there are other active users
    const activeUsersCount = await this.db.prepare(`
      SELECT COUNT(*) as count 
      FROM users 
      WHERE company_id = ? 
        AND id != ? 
        AND is_active = 1 
        AND deleted_at IS NULL
    `).bind(company.id, userId).first();

    if (activeUsersCount && activeUsersCount.count > 0) {
      return { 
        canArchive: false, 
        reason: `Cannot archive company admin while ${activeUsersCount.count} other active user(s) exist. Please transfer admin rights or remove other users first.`,
        companyName: company.name,
        activeUsersCount: activeUsersCount.count
      };
    }

    // Company admin is the last remaining active user - can be archived
    return { 
      canArchive: true,
      isLastUser: true,
      companyName: company.name
    };
  }

  // ==================== COMPANY OPERATIONS ====================

  async createCompany(companyData) {
    const { 
      name, 
      domain, 
      adminUserId, 
      dataRetentionDays = 2555,
      hipaaCompliant = 1
    } = companyData;
    
    // Generate UUID ourselves since D1 DEFAULT doesn't work with RETURNING
    const companyId = crypto.randomUUID().replace(/-/g, ''); // Remove dashes to match DB format
    
    // Use conditional SQL to handle NULL values properly, explicitly provide the ID
    let sql;
    let params;
    
    if (domain === null && adminUserId === null) {
      sql = `INSERT INTO companies (id, name, data_retention_days, hipaa_compliant) VALUES (?, ?, ?, ?)`;
      params = [companyId, name, dataRetentionDays, hipaaCompliant];
    } else if (domain === null) {
      sql = `INSERT INTO companies (id, name, admin_user_id, data_retention_days, hipaa_compliant) VALUES (?, ?, ?, ?, ?)`;
      params = [companyId, name, adminUserId, dataRetentionDays, hipaaCompliant];
    } else if (adminUserId === null) {
      sql = `INSERT INTO companies (id, name, domain, data_retention_days, hipaa_compliant) VALUES (?, ?, ?, ?, ?)`;
      params = [companyId, name, domain, dataRetentionDays, hipaaCompliant];
    } else {
      sql = `INSERT INTO companies (id, name, domain, admin_user_id, data_retention_days, hipaa_compliant) VALUES (?, ?, ?, ?, ?, ?)`;
      params = [companyId, name, domain, adminUserId, dataRetentionDays, hipaaCompliant];
    }
    
    await this.db.prepare(sql).bind(...params).run();
    
    return { id: companyId }; // Return the ID we generated
  }

  async getCompanyById(id) {
    const result = await this.db.prepare(`
      SELECT c.*, u.email as admin_email, u.first_name, u.last_name 
      FROM companies c 
      LEFT JOIN users u ON c.admin_user_id = u.id 
      WHERE c.id = ?
    `).bind(id).first();
    
    return result;
  }

  async getCompanies() {
    const result = await this.db.prepare(`
      SELECT c.*, u.email as admin_email, u.first_name, u.last_name 
      FROM companies c 
      LEFT JOIN users u ON c.admin_user_id = u.id 
      ORDER BY c.created_at DESC
    `).all();
    
    return result.results || [];
  }

  async getCompaniesWithStats() {
    // Get current date range for this month and last month
    const now = new Date();
    const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().split('T')[0];
    const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59).toISOString().split('T')[0];
    
    const result = await this.db.prepare(`
      SELECT 
        c.id,
        c.name,
        c.domain,
        c.is_active,
        c.created_at,
        c.hipaa_compliant,
        u.email as admin_email,
        u.first_name as admin_first_name,
        u.last_name as admin_last_name,
        (SELECT COUNT(*) FROM users WHERE company_id = c.id AND deleted_at IS NULL) as total_users,
        (SELECT COUNT(*) FROM users WHERE company_id = c.id AND is_active = 1 AND deleted_at IS NULL) as active_users,
        (SELECT COUNT(DISTINCT user_id) FROM audit_logs WHERE company_id = c.id AND DATE(created_at) >= ?) as logins_this_month,
        (SELECT COUNT(DISTINCT user_id) FROM audit_logs WHERE company_id = c.id AND DATE(created_at) >= ? AND DATE(created_at) <= ?) as logins_last_month
      FROM companies c
      LEFT JOIN users u ON c.admin_user_id = u.id
      ORDER BY c.created_at DESC
    `).bind(thisMonthStart, lastMonthStart, lastMonthEnd).all();
    
    return result.results || [];
  }

  async updateCompanyAdmin(companyId, newAdminUserId) {
    console.log('updateCompanyAdmin called with:', { companyId, newAdminUserId });
    
    if (!companyId || !newAdminUserId) {
      console.error('Missing values for updateCompanyAdmin:', { companyId, newAdminUserId });
      throw new Error('Company ID and Admin User ID are required');
    }
    
    const result = await this.db.prepare(`
      UPDATE companies 
      SET admin_user_id = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).bind(newAdminUserId, companyId).run();
    
    console.log('updateCompanyAdmin result:', result);
    return result;
  }

  async transferAdminRights(companyId, currentAdminId, newAdminUserId) {
    // Transfer admin rights from one user to another within a company
    // Returns { success: boolean, company: object }
    
    // Validate company exists
    const company = await this.getCompanyById(companyId);
    if (!company) {
      throw new Error('Company not found');
    }

    // Validate current admin
    if (company.admin_user_id !== currentAdminId) {
      throw new Error('Current user is not the company admin');
    }

    // Validate new admin exists and is in the same company
    const newAdmin = await this.getUserById(newAdminUserId);
    if (!newAdmin) {
      throw new Error('New admin user not found');
    }

    if (newAdmin.company_id !== companyId) {
      throw new Error('New admin must be from the same company');
    }

    if (!newAdmin.is_active || newAdmin.deleted_at) {
      throw new Error('New admin must be an active user');
    }

    // Transfer admin rights
    await this.updateCompanyAdmin(companyId, newAdminUserId);

    // Return updated company
    return await this.getCompanyById(companyId);
  }

  async updateCompany(companyId, updateData) {
    // Update company information
    const fields = [];
    const values = [];
    
    // Map frontend fields to database fields
    const fieldMapping = {
      name: 'name',
      domain: 'domain',
      isActive: 'is_active',
      dataRetentionDays: 'data_retention_days',
      hipaaCompliant: 'hipaa_compliant'
    };
    
    Object.keys(updateData).forEach(key => {
      const dbField = fieldMapping[key] || key;
      if (updateData[key] !== undefined) {
        fields.push(`${dbField} = ?`);
        values.push(updateData[key]);
      }
    });
    
    if (fields.length === 0) return null;
    
    values.push(companyId);
    const query = `UPDATE companies SET ${fields.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`;
    
    const result = await this.db.prepare(query).bind(...values).run();
    return result;
  }

  async canCompanyBeDeleted(companyId) {
    // Check if company can be safely deleted
    // Returns { canDelete: boolean, reason: string, userCount: number }
    
    const company = await this.getCompanyById(companyId);
    if (!company) {
      return { canDelete: false, reason: 'Company not found' };
    }

    // Count users EXCLUDING the admin (non-admin users)
    const nonAdminUsersCount = await this.db.prepare(`
      SELECT COUNT(*) as count 
      FROM users 
      WHERE company_id = ? AND id != ?
    `).bind(companyId, company.admin_user_id || 'none').first();

    if (nonAdminUsersCount && nonAdminUsersCount.count > 0) {
      return {
        canDelete: false,
        reason: `Cannot delete company with ${nonAdminUsersCount.count} non-admin user(s) still associated. Delete all users except admin first.`,
        userCount: nonAdminUsersCount.count,
        companyName: company.name,
        adminUserId: company.admin_user_id
      };
    }

    // Check for audit logs (blocks deletion - use archive instead)
    const auditLogsCount = await this.db.prepare(`
      SELECT COUNT(*) as count 
      FROM audit_logs 
      WHERE company_id = ?
    `).bind(companyId).first();

    if (auditLogsCount && auditLogsCount.count > 0) {
      return {
        canDelete: false,
        reason: `Cannot delete company with ${auditLogsCount.count} audit log(s). For compliance, audit logs must be retained. Use ARCHIVE instead of DELETE for companies with activity.`,
        auditLogCount: auditLogsCount.count,
        companyName: company.name,
        recommendation: 'archive'
      };
    }

    // Can delete if:
    // - No non-admin users exist (admin user OK - will be deleted with company)
    // - No audit logs exist (company has no activity history)
    return {
      canDelete: true,
      companyName: company.name,
      adminUserId: company.admin_user_id,
      willDeleteAdmin: company.admin_user_id ? true : false
    };
  }

  async archiveCompany(companyId, includeAdmin = false) {
    // Archive company and optionally its users
    // Returns { success: boolean, archivedUsersCount: number }
    
    const company = await this.getCompanyById(companyId);
    if (!company) {
      throw new Error('Company not found');
    }

    // Archive all users except admin (unless includeAdmin is true)
    let archivedUsersCount = 0;
    
    if (includeAdmin) {
      // Archive ALL users including admin
      const result = await this.db.prepare(`
        UPDATE users 
        SET deleted_at = CURRENT_TIMESTAMP, is_active = 0, updated_at = CURRENT_TIMESTAMP
        WHERE company_id = ? AND deleted_at IS NULL
      `).bind(companyId).run();
      archivedUsersCount = result.meta?.changes || 0;
    } else {
      // Archive all users EXCEPT admin
      const result = await this.db.prepare(`
        UPDATE users 
        SET deleted_at = CURRENT_TIMESTAMP, is_active = 0, updated_at = CURRENT_TIMESTAMP
        WHERE company_id = ? 
          AND id != ? 
          AND deleted_at IS NULL
      `).bind(companyId, company.admin_user_id || '').run();
      archivedUsersCount = result.meta?.changes || 0;
    }

    // Mark company as inactive
    await this.db.prepare(`
      UPDATE companies 
      SET is_active = 0, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).bind(companyId).run();

    return {
      success: true,
      archivedUsersCount,
      companyName: company.name,
      adminArchived: includeAdmin
    };
  }

  async restoreCompany(companyId) {
    // Restore archived company and its users
    const company = await this.db.prepare(`
      SELECT * FROM companies WHERE id = ?
    `).bind(companyId).first();
    
    if (!company) {
      throw new Error('Company not found');
    }

    // Restore company
    await this.db.prepare(`
      UPDATE companies 
      SET is_active = 1, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).bind(companyId).run();

    // Restore all users in the company
    const result = await this.db.prepare(`
      UPDATE users 
      SET deleted_at = NULL, is_active = 1, updated_at = CURRENT_TIMESTAMP
      WHERE company_id = ? AND deleted_at IS NOT NULL
    `).bind(companyId).run();

    return {
      success: true,
      restoredUsersCount: result.meta?.changes || 0,
      companyName: company.name
    };
  }

  async deleteCompany(companyId) {
    // Permanently delete company (WARNING: Use with caution)
    // All users should be deleted first
    
    // CRITICAL: Remove FK constraints before deleting
    
    // 1. Set audit logs company_id to NULL (preserve audit trail, FK requires valid id or NULL)
    // Use related_company_id to maintain reference to deleted company
    await this.db.prepare(`
      UPDATE audit_logs
      SET company_id = NULL, related_company_id = ?
      WHERE company_id = ? AND related_company_id IS NULL
    `).bind(companyId, companyId).run();
    
    // 2. Set email_events company_id to NULL (preserve email activity history, FK requires valid id or NULL)
    await this.db.prepare(`
      UPDATE email_events
      SET company_id = NULL
      WHERE company_id = ?
    `).bind(companyId).run();
    
    // 3. Delete other related records that should not be preserved
    // Delete user_permissions
    await this.db.prepare(`
      DELETE FROM user_permissions WHERE company_id = ?
    `).bind(companyId).run();
    
    // Delete data_retention_policies
    await this.db.prepare(`
      DELETE FROM data_retention_policies WHERE company_id = ?
    `).bind(companyId).run();
    
    // Delete company_data_views
    await this.db.prepare(`
      DELETE FROM company_data_views WHERE company_id = ?
    `).bind(companyId).run();
    
    // Delete company_analytics
    await this.db.prepare(`
      DELETE FROM company_analytics WHERE company_id = ?
    `).bind(companyId).run();
    
    // Delete template_performance
    await this.db.prepare(`
      DELETE FROM template_performance WHERE company_id = ?
    `).bind(companyId).run();
    
    // Delete user_email_activity
    await this.db.prepare(`
      DELETE FROM user_email_activity WHERE company_id = ?
    `).bind(companyId).run();
    
    // 4. Finally, delete the company
    const result = await this.db.prepare(`
      DELETE FROM companies WHERE id = ?
    `).bind(companyId).run();
    
    return result;
  }

  async masterDeleteCompany(companyId) {
    // MASTER DELETE: Permanently delete company and ALL associated data
    // WARNING: This is irreversible and bypasses all safeguards
    // Should ONLY be used by master admins for test cleanup
    
    console.log(`⚠️ MASTER DELETE initiated for company: ${companyId}`);
    
    // 1. Get all users in the company
    const users = await this.db.prepare(`
      SELECT id FROM users WHERE company_id = ?
    `).bind(companyId).all();
    
    // 2. Remove company's admin_user_id (FK constraint to users)
    await this.db.prepare(`
      UPDATE companies SET admin_user_id = NULL WHERE id = ?
    `).bind(companyId).run();
    
    // 3. Delete ALL audit logs FIRST (they reference users.id)
    await this.db.prepare(`
      DELETE FROM audit_logs WHERE company_id = ? OR related_company_id = ?
    `).bind(companyId, companyId).run();
    
    // 4. Delete ALL email events (no preservation)
    await this.db.prepare(`
      DELETE FROM email_events WHERE company_id = ?
    `).bind(companyId).run();
    
    // 5. Delete all user-related data for each user
    for (const user of users.results || []) {
      // Delete sessions
      await this.db.prepare(`
        DELETE FROM sessions WHERE user_id = ?
      `).bind(user.id).run();
      
      // Delete user_permissions (by user_id)
      await this.db.prepare(`
        DELETE FROM user_permissions WHERE user_id = ?
      `).bind(user.id).run();
      
      // Delete user_preferences
      await this.db.prepare(`
        DELETE FROM user_preferences WHERE user_id = ?
      `).bind(user.id).run();
    }
    
    // 6. NOW delete all users in the company (all FK constraints removed)
    await this.db.prepare(`
      DELETE FROM users WHERE company_id = ?
    `).bind(companyId).run();
    
    // 7. Delete all company-specific records
    await this.db.prepare(`
      DELETE FROM user_permissions WHERE company_id = ?
    `).bind(companyId).run();
    
    await this.db.prepare(`
      DELETE FROM data_retention_policies WHERE company_id = ?
    `).bind(companyId).run();
    
    await this.db.prepare(`
      DELETE FROM company_data_views WHERE company_id = ?
    `).bind(companyId).run();
    
    await this.db.prepare(`
      DELETE FROM company_analytics WHERE company_id = ?
    `).bind(companyId).run();
    
    await this.db.prepare(`
      DELETE FROM template_performance WHERE company_id = ?
    `).bind(companyId).run();
    
    await this.db.prepare(`
      DELETE FROM user_email_activity WHERE company_id = ?
    `).bind(companyId).run();
    
    // 8. Finally, delete the company itself
    const result = await this.db.prepare(`
      DELETE FROM companies WHERE id = ?
    `).bind(companyId).run();
    
    console.log(`✅ MASTER DELETE completed for company: ${companyId}`);
    
    return {
      success: true,
      deletedUsers: users.results?.length || 0,
      message: `Company and all associated data permanently deleted`
    };
  }

  async getCompanyAuditLogs(companyId, options = {}) {
    // Get audit logs for a specific company with optional filtering
    const {
      limit = 100,
      offset = 0,
      actionType = null,
      entityType = null,
      userId = null,
      startDate = null,
      endDate = null
    } = options;

    let query = `
      SELECT 
        al.*,
        u.email as user_email,
        u.first_name,
        u.last_name
      FROM audit_logs al
      LEFT JOIN users u ON al.user_id = u.id
      WHERE al.company_id = ?
    `;
    const bindings = [companyId];

    if (actionType) {
      query += ` AND al.action = ?`;
      bindings.push(actionType);
    }

    if (entityType) {
      query += ` AND al.entity_type = ?`;
      bindings.push(entityType);
    }

    if (userId) {
      query += ` AND al.user_id = ?`;
      bindings.push(userId);
    }

    if (startDate) {
      query += ` AND DATE(al.created_at) >= ?`;
      bindings.push(startDate);
    }

    if (endDate) {
      query += ` AND DATE(al.created_at) <= ?`;
      bindings.push(endDate);
    }

    query += ` ORDER BY al.created_at DESC LIMIT ? OFFSET ?`;
    bindings.push(limit, offset);

    const result = await this.db.prepare(query).bind(...bindings).all();

    // Get total count for pagination
    let countQuery = `SELECT COUNT(*) as total FROM audit_logs WHERE company_id = ?`;
    const countBindings = [companyId];

    if (actionType) {
      countQuery += ` AND action = ?`;
      countBindings.push(actionType);
    }

    if (entityType) {
      countQuery += ` AND entity_type = ?`;
      countBindings.push(entityType);
    }

    if (userId) {
      countQuery += ` AND user_id = ?`;
      countBindings.push(userId);
    }

    if (startDate) {
      countQuery += ` AND DATE(created_at) >= ?`;
      countBindings.push(startDate);
    }

    if (endDate) {
      countQuery += ` AND DATE(created_at) <= ?`;
      countBindings.push(endDate);
    }

    const countResult = await this.db.prepare(countQuery).bind(...countBindings).first();

    return {
      logs: result.results || [],
      total: countResult?.total || 0,
      limit,
      offset,
      hasMore: (offset + limit) < (countResult?.total || 0)
    };
  }

  async getCompanyActivity(companyId, options = {}) {
    // Get activity metrics for a company with drill-down capability
    const {
      period = 'all', // 'all', 'today', 'week', 'month', 'year'
      breakdown = false, // if true, returns daily breakdown
      userId = null // optional: filter by specific user
    } = options;

    const now = new Date();
    let dateFilter = '';
    const bindings = [companyId];

    switch (period) {
      case 'today':
        dateFilter = `AND DATE(al.created_at) = DATE('now')`;
        break;
      case 'week':
        dateFilter = `AND DATE(al.created_at) >= DATE('now', '-7 days')`;
        break;
      case 'month':
        dateFilter = `AND DATE(al.created_at) >= DATE('now', '-30 days')`;
        break;
      case 'year':
        dateFilter = `AND DATE(al.created_at) >= DATE('now', '-365 days')`;
        break;
      default:
        dateFilter = '';
    }

    if (userId) {
      dateFilter += ` AND al.user_id = ?`;
      bindings.push(userId);
    }

    // Aggregate metrics
    const aggregateQuery = `
      SELECT
        COUNT(*) as total_events,
        COUNT(DISTINCT al.user_id) as active_users,
        COUNT(DISTINCT CASE WHEN al.action = 'LOGIN' THEN al.user_id END) as unique_logins,
        COUNT(CASE WHEN al.action = 'LOGIN' THEN 1 END) as total_logins,
        COUNT(CASE WHEN al.action LIKE 'FAILED_%' THEN 1 END) as failed_actions,
        COUNT(CASE WHEN al.entity_type = 'USER' THEN 1 END) as user_actions,
        COUNT(CASE WHEN al.entity_type = 'COMPANY' THEN 1 END) as company_actions,
        COUNT(CASE WHEN al.entity_type = 'DATA' THEN 1 END) as data_actions,
        MIN(al.created_at) as first_activity,
        MAX(al.created_at) as last_activity
      FROM audit_logs al
      WHERE al.company_id = ? ${dateFilter}
    `;

    const aggregateResult = await this.db.prepare(aggregateQuery).bind(...bindings).first();

    const response = {
      period,
      aggregate: aggregateResult || {},
      breakdown: null
    };

    // If breakdown requested, get daily breakdown
    if (breakdown) {
      const breakdownQuery = `
        SELECT
          DATE(al.created_at) as date,
          COUNT(*) as events,
          COUNT(DISTINCT al.user_id) as active_users,
          COUNT(CASE WHEN al.action = 'LOGIN' THEN 1 END) as logins
        FROM audit_logs al
        WHERE al.company_id = ? ${dateFilter}
        GROUP BY DATE(al.created_at)
        ORDER BY date DESC
        LIMIT 90
      `;

      const breakdownResult = await this.db.prepare(breakdownQuery).bind(...bindings).all();
      response.breakdown = breakdownResult.results || [];
    }

    // Get top users by activity
    const topUsersQuery = `
      SELECT
        u.id,
        u.email,
        u.first_name,
        u.last_name,
        COUNT(*) as event_count,
        MAX(al.created_at) as last_activity
      FROM audit_logs al
      JOIN users u ON al.user_id = u.id
      WHERE al.company_id = ? ${dateFilter}
      GROUP BY u.id, u.email, u.first_name, u.last_name
      ORDER BY event_count DESC
      LIMIT 10
    `;

    const topUsersResult = await this.db.prepare(topUsersQuery).bind(...bindings).all();
    response.topUsers = topUsersResult.results || [];

    // Get action breakdown
    const actionBreakdownQuery = `
      SELECT
        al.action,
        COUNT(*) as count
      FROM audit_logs al
      WHERE al.company_id = ? ${dateFilter}
      GROUP BY al.action
      ORDER BY count DESC
      LIMIT 20
    `;

    const actionBreakdownResult = await this.db.prepare(actionBreakdownQuery).bind(...bindings).all();
    response.actionBreakdown = actionBreakdownResult.results || [];

    return response;
  }

  async getCompanyUsers(companyId) {
    const result = await this.db.prepare(`
      SELECT u.*, c.name as company_name 
      FROM users u 
      JOIN companies c ON u.company_id = c.id 
      WHERE u.company_id = ? AND u.deleted_at IS NULL
      ORDER BY u.created_at DESC
    `).bind(companyId).all();
    
    const users = result.results || [];
    // Transform snake_case to camelCase for frontend
    return users.map(user => this.transformUserForAPI(user));
  }

  async getAllUsers() {
    const result = await this.db.prepare(`
      SELECT u.*, c.name as company_name 
      FROM users u 
      JOIN companies c ON u.company_id = c.id 
      WHERE u.deleted_at IS NULL
      ORDER BY u.created_at DESC
    `).all();
    
    const users = result.results || [];
    // Transform snake_case to camelCase for frontend
    return users.map(user => this.transformUserForAPI(user));
  }

  // Transform database user object (snake_case) to API format (camelCase)
  transformUserForAPI(user) {
    return {
      id: user.id,
      email: user.email,
      username: user.username,
      firstName: user.first_name,
      lastName: user.last_name,
      companyId: user.company_id,
      companyName: user.company_name, // From JOIN
      role: user.role,
      isActive: user.is_active === 1,
      verified: user.verified === 1,
      twoFactorEnabled: user.two_factor_enabled === 1,
      magicLinkEnabled: user.magic_link_enabled === 1,
      phiAccessLevel: user.phi_access_level,
      dataClassification: user.data_classification,
      lastLogin: user.last_login,
      createdAt: user.created_at,
      updatedAt: user.updated_at,
      deletedAt: user.deleted_at || null
    };
  }

  // Create user with invitation token (for admin invites)
  async createUserWithInvitation(userData) {
    const { 
      email, 
      username, 
      firstName, 
      lastName, 
      companyId, 
      role = 'admin',
      invitationToken,
      invitationExpires
    } = userData;
    
    // Validate all required fields
    if (!email || !username || !firstName || !companyId || !invitationToken || !invitationExpires) {
      console.error('Missing required fields:', { email, username, firstName, lastName, companyId, invitationToken, invitationExpires });
      throw new Error('Missing required fields for user creation');
    }
    
    // Ensure lastName is at least an empty string
    const safeLastName = lastName || '';
    
    // Generate UUID ourselves since D1 DEFAULT doesn't work with RETURNING
    const userId = crypto.randomUUID().replace(/-/g, ''); // Remove dashes to match DB format
    
    console.log('Creating user with values:', {
      userId,
      email,
      username,
      firstName,
      lastName: safeLastName,
      companyId,
      role,
      invitationToken,
      invitationExpires
    });
    
    // Create user without password (will be set when invitation is accepted)
    await this.db.prepare(`
      INSERT INTO users (
        id, email, username, password, first_name, last_name, 
        company_id, role, is_active, verified,
        magic_link_token, magic_link_expires,
        phi_access_level, data_classification
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, 0, ?, ?, ?, ?)
    `).bind(
      userId, // Explicitly provide the UUID
      email,
      username,
      '', // Empty password - will be set on invitation acceptance
      firstName,
      safeLastName,
      companyId,
      role,
      invitationToken, // Store in magic_link_token field
      invitationExpires, // Store in magic_link_expires field
      'full', // Default PHI access for admins
      'confidential' // Default data classification for admins
    ).run();
    
    return { id: userId }; // Return the ID we generated
  }

  // Verify invitation token and get user
  async verifyInvitationToken(token) {
    const user = await this.db.prepare(`
      SELECT * FROM users 
      WHERE magic_link_token = ? 
      AND magic_link_expires > datetime('now')
      AND is_active = 0
      AND verified = 0
    `).bind(token).first();
    
    return user;
  }

  // Complete invitation - set password and activate user
  async completeInvitation(userId) {
    // Complete invitation by activating user and clearing invitation token
    // No password required - user can set password later in Settings
    const result = await this.db.prepare(`
      UPDATE users 
      SET is_active = 1,
          verified = 1,
          magic_link_token = NULL,
          magic_link_expires = NULL,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).bind(userId).run();
    
    return result;
  }

  // ==================== MAGIC LINK OPERATIONS ====================

  async updateMagicLinkToken(userId, token, expiresAt, code = null) {
    const result = await this.db.prepare(`
      UPDATE users 
      SET magic_link_token = ?, magic_link_expires = ?, magic_link_code = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).bind(token, expiresAt, code, userId).run();
    
    return result;
  }

  async verifyMagicLinkToken(token) {
    const result = await this.db.prepare(`
      SELECT * FROM users 
      WHERE magic_link_token = ? 
      AND magic_link_expires > datetime('now')
      AND deleted_at IS NULL
    `).bind(token).first();
    
    return result;
  }

  async verifyMagicLinkCode(email, code) {
    const result = await this.db.prepare(`
      SELECT * FROM users 
      WHERE email = ? 
      AND magic_link_code = ? 
      AND magic_link_expires > datetime('now')
      AND is_active = 1
      AND deleted_at IS NULL
    `).bind(email, code).first();
    
    return result;
  }

  async clearMagicLinkToken(userId) {
    const result = await this.db.prepare(`
      UPDATE users
      SET magic_link_token = NULL, magic_link_code = NULL, magic_link_expires = NULL, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).bind(userId).run();

    return result;
  }

  // Verify email verification token and mark user as verified
  async verifyEmailToken(token) {
    // Find user by verification token
    const user = await this.db.prepare(`
      SELECT * FROM users
      WHERE magic_link_token = ?
      AND magic_link_expires > datetime('now')
      AND deleted_at IS NULL
    `).bind(token).first();

    if (!user) {
      return null;
    }

    // Mark user as verified and clear the token
    await this.db.prepare(`
      UPDATE users
      SET verified = 1,
          magic_link_token = NULL,
          magic_link_expires = NULL,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).bind(user.id).run();

    return user;
  }

  // ==================== 2FA CODE OPERATIONS ====================
  // NOTE: We use magic_link_code for email 2FA codes to avoid conflicts with TOTP secret

  async store2FACode(userId, code, expiresAt) {
    const result = await this.db.prepare(`
      UPDATE users 
      SET magic_link_code = ?, magic_link_expires = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).bind(code, expiresAt, userId).run();
    
    return result;
  }

  async verify2FACode(userId, code) {
    const result = await this.db.prepare(`
      SELECT * FROM users 
      WHERE id = ? 
      AND magic_link_code = ? 
      AND magic_link_expires > datetime('now')
      AND is_active = 1
      AND deleted_at IS NULL
    `).bind(userId, code).first();
    
    return result;
  }

  async clear2FACode(userId) {
    const result = await this.db.prepare(`
      UPDATE users 
      SET magic_link_code = NULL, magic_link_expires = NULL, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).bind(userId).run();
    
    return result;
  }

  // ==================== TOTP OPERATIONS ====================

  async storeTOTPSecret(userId, secret, recoveryCodes) {
    const recoveryCodesJson = JSON.stringify(recoveryCodes);
    const result = await this.db.prepare(`
      UPDATE users 
      SET two_factor_secret = ?, two_factor_recovery_codes = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).bind(secret, recoveryCodesJson, userId).run();
    
    return result;
  }

  async getTOTPSecret(userId) {
    const result = await this.db.prepare(`
      SELECT two_factor_secret, two_factor_enabled, two_factor_recovery_codes
      FROM users 
      WHERE id = ? AND is_active = 1 AND deleted_at IS NULL
    `).bind(userId).first();
    
    if (result && result.two_factor_recovery_codes) {
      try {
        result.two_factor_recovery_codes = JSON.parse(result.two_factor_recovery_codes);
      } catch (e) {
        result.two_factor_recovery_codes = [];
      }
    }
    
    return result;
  }

  async enableTOTP(userId) {
    const result = await this.db.prepare(`
      UPDATE users 
      SET two_factor_enabled = 1, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).bind(userId).run();
    
    return result;
  }

  async disableTOTP(userId) {
    const result = await this.db.prepare(`
      UPDATE users 
      SET two_factor_enabled = 0, two_factor_secret = NULL, two_factor_recovery_codes = NULL, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).bind(userId).run();
    
    return result;
  }

  async useRecoveryCode(userId, code) {
    const user = await this.getTOTPSecret(userId);
    if (!user || !user.two_factor_recovery_codes) {
      return false;
    }

    const recoveryCodes = user.two_factor_recovery_codes;

    // Hash the provided code and compare against stored hashes
    const codeIndex = await this.verifyRecoveryCode(code, recoveryCodes);

    if (codeIndex === -1) {
      return false;
    }

    // Remove the used recovery code (hash)
    recoveryCodes.splice(codeIndex, 1);
    const recoveryCodesJson = JSON.stringify(recoveryCodes);

    await this.db.prepare(`
      UPDATE users
      SET two_factor_recovery_codes = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).bind(recoveryCodesJson, userId).run();

    return true;
  }

  // ==================== SESSION OPERATIONS ====================

  async createSession(userId, token, expiresAt, isMobile = false, deviceInfo = {}) {
    const { userAgent = null, ipAddress = null, browser = null, os = null, deviceName = null } = deviceInfo;
    
    const result = await this.db.prepare(`
      INSERT INTO sessions (user_id, token, expires_at, is_mobile, user_agent, ip_address, browser, os, device_name)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(userId, token, expiresAt, isMobile, userAgent, ipAddress, browser, os, deviceName).run();
    
    return result;
  }

  async getSessionByToken(token) {
    const result = await this.db.prepare(`
      SELECT s.*, u.* FROM sessions s
      JOIN users u ON s.user_id = u.id
      WHERE s.token = ? AND s.expires_at > datetime('now')
      AND u.deleted_at IS NULL
    `).bind(token).first();
    
    return result;
  }

  async deleteSession(token) {
    const result = await this.db.prepare(`
      DELETE FROM sessions WHERE token = ?
    `).bind(token).run();
    
    return result;
  }

  async deleteAllUserSessions(userId) {
    const result = await this.db.prepare(`
      DELETE FROM sessions WHERE user_id = ?
    `).bind(userId).run();
    
    return result;
  }

  async getUserSessions(userId) {
    const result = await this.db.prepare(`
      SELECT 
        id,
        user_id,
        created_at,
        expires_at,
        is_mobile,
        user_agent,
        ip_address,
        browser,
        os,
        device_name
      FROM sessions 
      WHERE user_id = ? AND expires_at > datetime('now')
      ORDER BY created_at DESC
    `).bind(userId).all();
    
    return result.results || [];
  }

  async deleteSessionById(sessionId) {
    const result = await this.db.prepare(`
      DELETE FROM sessions WHERE id = ?
    `).bind(sessionId).run();
    
    return result;
  }

  // ==================== PERMISSION OPERATIONS ====================

  async grantPermission(userId, companyId, permission, resource, grantedBy) {
    const result = await this.db.prepare(`
      INSERT INTO user_permissions (user_id, company_id, permission, resource, granted_by)
      VALUES (?, ?, ?, ?, ?)
    `).bind(userId, companyId, permission, resource, grantedBy).run();
    
    return result;
  }

  async getUserPermissions(userId) {
    const result = await this.db.prepare(`
      SELECT p.*, u.email as user_email, g.email as granted_by_email 
      FROM user_permissions p 
      JOIN users u ON p.user_id = u.id 
      LEFT JOIN users g ON p.granted_by = g.id 
      WHERE p.user_id = ? AND p.is_active = 1
    `).bind(userId).all();
    
    return result;
  }

  async revokePermission(permissionId) {
    const result = await this.db.prepare(`
      UPDATE user_permissions 
      SET is_active = 0, expires_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).bind(permissionId).run();
    
    return result;
  }

  // ==================== AUDIT LOGGING ====================

  // Helper function to get severity level from action type
  getSeverityLevel(action) {
    const critical = ['USER_DELETED', 'COMPANY_DELETED', 'DATA_BREACH', 'MASTER_DELETE'];
    const error = ['LOGIN_FAILED', 'PERMISSION_DENIED', 'RATE_LIMITED', 'SESSION_EXPIRED'];
    const warning = ['PASSWORD_RESET_REQUESTED', 'USER_ARCHIVED', 'PASSWORD_CHANGED', '2FA_DISABLED', 'TOTP_DISABLED'];
    if (critical.includes(action)) return 'CRITICAL';
    if (error.includes(action)) return 'ERROR';
    if (warning.includes(action)) return 'WARNING';
    return 'INFO';
  }

  // Helper function to get action description
  getActionDescription(action, details = {}) {
    const descriptions = {
      'LOGIN': 'User logged in',
      'LOGOUT': 'User logged out',
      'LOGIN_FAILED': 'Failed login attempt',
      'USER_CREATED': 'New user created',
      'USER_INVITED': `Invited user: ${details?.targetEmail || 'unknown'}`,
      'USER_UPDATED': 'User details updated',
      'USER_DELETED': 'User deleted',
      'USER_ARCHIVED': 'User archived',
      'USER_RESTORED': 'User restored',
      'PASSWORD_CHANGED': 'Password changed',
      'PASSWORD_RESET_REQUESTED': 'Password reset requested',
      'MAGIC_LINK_SENT': 'Magic link sent',
      'MAGIC_LINK_USED': 'Magic link used',
      'EMAIL_VERIFIED': 'Email address verified',
      '2FA_CODE_REQUESTED': '2FA code requested',
      '2FA_CODE_VERIFIED': '2FA code verified',
      '2FA_ENABLED': '2FA enabled',
      '2FA_DISABLED': '2FA disabled',
      'TOTP_SETUP_STARTED': 'TOTP setup started',
      'TOTP_ENABLED': 'TOTP authentication enabled',
      'TOTP_DISABLED': 'TOTP authentication disabled',
      'SESSION_CREATED': 'New session created',
      'SESSION_EXPIRED': 'Session expired',
      'SESSION_REVOKED': 'Session revoked',
      'COMPANY_CREATED': 'Company created',
      'COMPANY_UPDATED': 'Company updated',
      'COMPANY_DELETED': 'Company deleted',
      'COMPANY_ARCHIVED': 'Company archived',
      'COMPANY_RESTORED': 'Company restored',
      'PERMISSION_GRANTED': 'Permission granted',
      'PERMISSION_REVOKED': 'Permission revoked',
      'INVITATION_ACCEPTED': 'Invitation accepted',
      'INVITATION_SENT': 'Invitation sent',
      'ADMIN_RIGHTS_TRANSFERRED': 'Admin rights transferred'
    };
    return descriptions[action] || action.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, l => l.toUpperCase());
  }

  async logAuditEvent(userId, companyId, action, resourceType, resourceId, details, ipAddress, userAgent, sessionId = null, phiAccessed = 0, dataClassification = null, relatedCompanyId = null, relatedUserId = null) {
    // Generate UUID for audit log (matching DB format without dashes)
    const auditLogId = crypto.randomUUID().replace(/-/g, '');

    // Insert into audit_logs (raw log)
    const result = await this.db.prepare(`
      INSERT INTO audit_logs (
        id, user_id, company_id, action, resource_type, resource_id,
        details, ip_address, user_agent, session_id, phi_accessed, data_classification, related_company_id, related_user_id
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      auditLogId, userId, companyId, action, resourceType, resourceId,
      JSON.stringify(details), ipAddress, userAgent, sessionId, phiAccessed, dataClassification, relatedCompanyId, relatedUserId
    ).run();

    // Get user info for display
    let userEmail = null;
    let userName = null;
    if (userId && userId !== 'SYSTEM') {
      const user = await this.getUserById(userId);
      if (user) {
        userEmail = user.email;
        userName = `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.email;
      }
    }

    // Get company info for display
    let companyName = null;
    if (companyId && companyId !== 'SYSTEM') {
      const company = await this.getCompanyById(companyId);
      if (company) {
        companyName = company.name;
      }
    }

    // Calculate severity and description
    const severityLevel = this.getSeverityLevel(action);
    const actionDescription = this.getActionDescription(action, details);

    // Insert into audit_logs_display (enriched log)
    await this.db.prepare(`
      INSERT INTO audit_logs_display (
        original_log_id, timestamp, action_type, severity_level,
        user_email, user_name, user_id, company_name, company_id,
        ip_address, user_agent, action_description, resource_type,
        resource_identifier, details_summary
      )
      VALUES (?, CURRENT_TIMESTAMP, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      String(auditLogId),
      action,
      severityLevel,
      userEmail,
      userName,
      userId,
      companyName,
      companyId,
      ipAddress,
      userAgent,
      actionDescription,
      resourceType,
      resourceId,
      JSON.stringify(details)
    ).run();

    return result;
  }

  // Get audit logs from display table with filters
  async getAuditLogsDisplay({ companyId = null, userId = null, action = null, actions = null, severity = null, startDate = null, endDate = null, userIds = null, companyIds = null, limit = 100, offset = 0 } = {}) {
    let query = `SELECT * FROM audit_logs_display WHERE 1=1`;
    const params = [];

    if (companyId) {
      query += ` AND company_id = ?`;
      params.push(companyId);
    }
    if (companyIds && companyIds.length > 0) {
      query += ` AND company_id IN (${companyIds.map(() => '?').join(',')})`;
      params.push(...companyIds);
    }
    if (userId) {
      query += ` AND user_id = ?`;
      params.push(userId);
    }
    if (userIds && userIds.length > 0) {
      query += ` AND user_id IN (${userIds.map(() => '?').join(',')})`;
      params.push(...userIds);
    }
    if (action) {
      query += ` AND action_type = ?`;
      params.push(action);
    }
    if (actions && actions.length > 0) {
      query += ` AND action_type IN (${actions.map(() => '?').join(',')})`;
      params.push(...actions);
    }
    if (severity) {
      query += ` AND severity_level = ?`;
      params.push(severity);
    }
    if (startDate) {
      query += ` AND timestamp >= ?`;
      params.push(startDate);
    }
    if (endDate) {
      query += ` AND timestamp <= ?`;
      params.push(endDate);
    }

    // Get total count
    const countQuery = query.replace('SELECT *', 'SELECT COUNT(*) as total');
    const countResult = await this.db.prepare(countQuery).bind(...params).first();
    const total = countResult?.total || 0;

    // Add ordering and pagination
    query += ` ORDER BY timestamp DESC LIMIT ? OFFSET ?`;
    params.push(limit, offset);

    const result = await this.db.prepare(query).bind(...params).all();

    return {
      logs: result.results || [],
      total,
      limit,
      offset,
      hasMore: (offset + limit) < total
    };
  }

  // Get audit log statistics
  async getAuditLogStatistics({ companyId = null, startDate = null, endDate = null } = {}) {
    let whereClause = '1=1';
    const params = [];

    if (companyId) {
      whereClause += ' AND company_id = ?';
      params.push(companyId);
    }
    if (startDate) {
      whereClause += ' AND timestamp >= ?';
      params.push(startDate);
    }
    if (endDate) {
      whereClause += ' AND timestamp <= ?';
      params.push(endDate);
    }

    // Get aggregated statistics
    const statsQuery = `
      SELECT
        COUNT(*) as total_events,
        COUNT(DISTINCT user_id) as unique_users,
        COUNT(DISTINCT company_id) as unique_companies,
        SUM(CASE WHEN severity_level = 'CRITICAL' THEN 1 ELSE 0 END) as critical_events,
        SUM(CASE WHEN severity_level = 'ERROR' THEN 1 ELSE 0 END) as error_events,
        SUM(CASE WHEN severity_level = 'WARNING' THEN 1 ELSE 0 END) as warning_events,
        SUM(CASE WHEN severity_level = 'INFO' THEN 1 ELSE 0 END) as info_events
      FROM audit_logs_display
      WHERE ${whereClause}
    `;

    const stats = await this.db.prepare(statsQuery).bind(...params).first();

    // Get top actions
    const topActionsQuery = `
      SELECT action_type, COUNT(*) as count
      FROM audit_logs_display
      WHERE ${whereClause}
      GROUP BY action_type
      ORDER BY count DESC
      LIMIT 10
    `;
    const topActionsResult = await this.db.prepare(topActionsQuery).bind(...params).all();

    // Get top users
    const topUsersQuery = `
      SELECT user_email, user_name, COUNT(*) as count
      FROM audit_logs_display
      WHERE ${whereClause} AND user_email IS NOT NULL
      GROUP BY user_email, user_name
      ORDER BY count DESC
      LIMIT 10
    `;
    const topUsersResult = await this.db.prepare(topUsersQuery).bind(...params).all();

    return {
      total_events: stats?.total_events || 0,
      unique_users: stats?.unique_users || 0,
      unique_companies: stats?.unique_companies || 0,
      critical_events: stats?.critical_events || 0,
      error_events: stats?.error_events || 0,
      warning_events: stats?.warning_events || 0,
      info_events: stats?.info_events || 0,
      topActions: topActionsResult.results || [],
      topUsers: topUsersResult.results || []
    };
  }

  // Get available filter options for audit logs
  async getAuditLogFilterOptions(companyId = null) {
    const whereClause = companyId ? 'WHERE company_id = ?' : '';
    const params = companyId ? [companyId] : [];

    // Get unique action types
    const actionsQuery = `
      SELECT DISTINCT action_type
      FROM audit_logs_display
      ${whereClause}
      ORDER BY action_type
    `;
    const actionsResult = await this.db.prepare(actionsQuery).bind(...params).all();

    // Get unique severity levels
    const severityQuery = `
      SELECT DISTINCT severity_level
      FROM audit_logs_display
      ${whereClause}
      ORDER BY severity_level
    `;
    const severityResult = await this.db.prepare(severityQuery).bind(...params).all();

    // Get unique users
    const usersQuery = `
      SELECT DISTINCT user_id, user_email, user_name
      FROM audit_logs_display
      ${whereClause} AND user_id IS NOT NULL
      ORDER BY user_name
    `;
    const usersResult = await this.db.prepare(usersQuery).bind(...params).all();

    // Get unique companies (master admin only - no companyId filter)
    const companiesQuery = `
      SELECT DISTINCT company_id, company_name
      FROM audit_logs_display
      WHERE company_id IS NOT NULL
      ORDER BY company_name
    `;
    const companiesResult = await this.db.prepare(companiesQuery).all();

    return {
      actionTypes: (actionsResult.results || []).map(r => r.action_type),
      severityLevels: (severityResult.results || []).map(r => r.severity_level),
      users: (usersResult.results || []).map(r => ({
        user_id: r.user_id,
        user_email: r.user_email,
        user_name: r.user_name
      })),
      companies: (companiesResult.results || []).map(r => ({
        company_id: r.company_id,
        company_name: r.company_name
      }))
    };
  }

  async getAuditLogs(userId = null, companyId = null, limit = 100, offset = 0) {
    let query = `
      SELECT al.*, u.email, u.first_name, u.last_name 
      FROM audit_logs al 
      LEFT JOIN users u ON al.user_id = u.id 
      WHERE 1=1
    `;
    const params = [];
    
    if (userId) {
      query += ` AND al.user_id = ?`;
      params.push(userId);
    }
    
    if (companyId) {
      query += ` AND al.company_id = ?`;
      params.push(companyId);
    }
    
    query += ` ORDER BY al.created_at DESC LIMIT ? OFFSET ?`;
    params.push(limit, offset);
    
    const result = await this.db.prepare(query).bind(...params).all();
    return result;
  }

  // ==================== PASSWORD SECURITY ====================

  // Hash a single recovery code (no salt - we need to check against multiple stored hashes)
  async hashRecoveryCode(code) {
    const encoder = new TextEncoder();
    const data = encoder.encode(code.toUpperCase());
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  // Hash multiple recovery codes
  async hashRecoveryCodes(codes) {
    const hashedCodes = await Promise.all(
      codes.map(code => this.hashRecoveryCode(code))
    );
    return hashedCodes;
  }

  // Verify a recovery code against stored hashed codes
  async verifyRecoveryCode(code, hashedCodes) {
    const hashedInput = await this.hashRecoveryCode(code);
    const index = hashedCodes.indexOf(hashedInput);
    return index;
  }

  async hashPassword(password) {
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    
    // Add salt
    const salt = crypto.randomUUID();
    const saltedHash = await crypto.subtle.digest('SHA-256', encoder.encode(hashHex + salt));
    const saltedHashArray = Array.from(new Uint8Array(saltedHash));
    const saltedHashHex = saltedHashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    
    return `${salt}:${saltedHashHex}`;
  }

  async verifyPassword(password, hashedPassword) {
    try {
      const [salt, hash] = hashedPassword.split(':');
      if (!salt || !hash) return false;
      
      const encoder = new TextEncoder();
      const data = encoder.encode(password);
      const hashBuffer = await crypto.subtle.digest('SHA-256', data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
      
      const saltedHash = await crypto.subtle.digest('SHA-256', encoder.encode(hashHex + salt));
      const saltedHashArray = Array.from(new Uint8Array(saltedHash));
      const saltedHashHex = saltedHashArray.map(b => b.toString(16).padStart(2, '0')).join('');
      
      return saltedHashHex === hash;
    } catch (error) {
      console.error('Password verification error:', error);
      return false;
    }
  }

  // ==================== UTILITY FUNCTIONS ====================

  async testConnection() {
    try {
      const result = await this.db.prepare('SELECT 1 as test').first();
      return result && result.test === 1;
    } catch (error) {
      console.error('Database connection test failed:', error);
      return false;
    }
  }

  async getTableInfo(tableName) {
    const result = await this.db.prepare(`PRAGMA table_info(${tableName})`).all();
    return result;
  }

  async getDatabaseStats() {
    const stats = {};
    
    // Get table counts
    const tables = ['users', 'companies', 'sessions', 'audit_logs', 'user_permissions'];
    for (const table of tables) {
      try {
        const result = await this.db.prepare(`SELECT COUNT(*) as count FROM ${table}`).first();
        stats[table] = result.count;
      } catch (error) {
        stats[table] = 0;
      }
    }
    
    return stats;
  }

  // ==================== DATA RETENTION ====================

  async createDataRetentionPolicy(companyId, dataType, retentionDays, autoDelete = false) {
    const result = await this.db.prepare(`
      INSERT INTO data_retention_policies (company_id, data_type, retention_days, auto_delete)
      VALUES (?, ?, ?, ?)
    `).bind(companyId, dataType, retentionDays, autoDelete ? 1 : 0).run();
    
    return result;
  }

  async getDataRetentionPolicies(companyId) {
    const result = await this.db.prepare(`
      SELECT * FROM data_retention_policies 
      WHERE company_id = ?
      ORDER BY created_at DESC
    `).bind(companyId).all();
    
    return result;
  }

  // ==================== USER PREFERENCES ====================

  async setUserPreference(userId, key, value) {
    const result = await this.db.prepare(`
      INSERT OR REPLACE INTO user_preferences (user_id, preference_key, preference_value, updated_at)
      VALUES (?, ?, ?, CURRENT_TIMESTAMP)
    `).bind(userId, key, value).run();
    
    return result;
  }

  async getUserPreference(userId, key) {
    const result = await this.db.prepare(`
      SELECT preference_value FROM user_preferences 
      WHERE user_id = ? AND preference_key = ?
    `).bind(userId, key).first();
    
    return result ? result.preference_value : null;
  }

  async getUserPreferences(userId) {
    const result = await this.db.prepare(`
      SELECT preference_key, preference_value FROM user_preferences 
      WHERE user_id = ?
    `).bind(userId).all();
    
    return result;
  }
}
