// Brevo Analytics Integration for Multi-Tenant SaaS
// Company-specific email tracking and analytics

export class BrevoAnalytics {
  constructor(env, d1Binding, databaseInstance) {
    this.env = env;
    this.db = d1Binding; // Raw D1 binding for direct queries
    this.database = databaseInstance; // Database class instance for helper methods
    this.apiKey = env.BREVO_API_KEY;
  }

  // ==================== BREVO ACTIVITY LOGS SYNC ====================

  async fetchBrevoActivityLogs(startDate, endDate, limit = 100, offset = 0) {
    try {
      const url = new URL('https://api.brevo.com/v3/organization/activities');
      url.searchParams.set('startDate', startDate);
      url.searchParams.set('endDate', endDate);
      url.searchParams.set('limit', limit.toString());
      url.searchParams.set('offset', offset.toString());

      const response = await fetch(url.toString(), {
        method: 'GET',
        headers: {
          'accept': 'application/json',
          'api-key': this.apiKey
        }
      });

      if (!response.ok) {
        throw new Error(`Brevo API error: ${response.status} ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Failed to fetch Brevo activity logs:', error);
      throw error;
    }
  }

  async syncBrevoActivityLogs(startDate, endDate) {
    try {
      // Fetch all Brevo activity logs
      const brevoLogs = await this.fetchBrevoActivityLogs(startDate, endDate, 1000, 0);
      
      // Get all companies and their users
      const companies = await this.db.prepare(`
        SELECT c.id as company_id, c.name as company_name, u.email as user_email
        FROM companies c
        LEFT JOIN users u ON c.id = u.company_id
        WHERE u.deleted_at IS NULL
      `).all();

      // Create company email mapping
      const companyEmailMap = {};
      for (const row of companies.results || []) {
        if (!companyEmailMap[row.company_id]) {
          companyEmailMap[row.company_id] = {
            companyName: row.company_name,
            emails: []
          };
        }
        if (row.user_email) {
          companyEmailMap[row.company_id].emails.push(row.user_email);
        }
      }

      // Process and store Brevo logs
      const syncedLogs = [];
      for (const log of brevoLogs.logs || []) {
        // Find which company this email belongs to
        const userEmail = log.user_email;
        let companyId = null;
        let companyName = null;

        for (const [cid, company] of Object.entries(companyEmailMap)) {
          if (company.emails.includes(userEmail)) {
            companyId = cid;
            companyName = company.companyName;
            break;
          }
        }

        // Only store logs for our companies
        if (companyId) {
          // Store in D1 email_events table
          await this.db.prepare(`
            INSERT OR REPLACE INTO email_events (
              company_id, user_email, event_type, event_data, created_at
            ) VALUES (?, ?, ?, ?, ?)
          `).bind(
            companyId,
            userEmail,
            log.action,
            JSON.stringify({
              brevoLogId: log.id || null,
              userIp: log.user_ip,
              userAgent: log.user_agent,
              count: log.count || 1,
              companyName: companyName
            }),
            log.date
          ).run();

          syncedLogs.push({
            ...log,
            companyId,
            companyName
          });
        }
      }

      return {
        totalBrevoLogs: brevoLogs.logs?.length || 0,
        syncedLogs: syncedLogs.length,
        companies: Object.keys(companyEmailMap).length,
        period: { startDate, endDate }
      };
    } catch (error) {
      console.error('Failed to sync Brevo activity logs:', error);
      throw error;
    }
  }

  // ==================== EMAIL ANALYTICS BY COMPANY ====================

  async getCompanyEmailAnalytics(companyId, startDate, endDate) {
    try {
      // Get company users
      const companyUsers = await this.db.getCompanyUsers(companyId);
      const companyEmails = companyUsers.map(user => user.email);
      
      // Get email events from D1 (already filtered by domain)
      const emailEvents = await this.db.prepare(`
        SELECT * FROM email_events 
        WHERE company_id = ? AND created_at >= ? AND created_at <= ?
        ORDER BY created_at DESC
      `).bind(companyId, startDate, endDate).all();
      
      const events = emailEvents.results || [];

      // Process and categorize email events
      const analytics = {
        companyId,
        period: { startDate, endDate },
        totalEvents: companyLogs.length,
        emailEvents: {
          sent: 0,
          delivered: 0,
          opened: 0,
          clicked: 0,
          bounced: 0,
          failed: 0
        },
        userActivity: {},
        timeline: []
      };

      // Process each email event
      for (const event of events) {
        const userEmail = event.user_email;
        const eventType = event.event_type;
        const date = event.created_at;
        const eventData = JSON.parse(event.event_data || '{}');

        // Initialize user activity if not exists
        if (!analytics.userActivity[userEmail]) {
          analytics.userActivity[userEmail] = {
            totalEvents: 0,
            emailEvents: { sent: 0, delivered: 0, opened: 0, clicked: 0, bounced: 0, failed: 0 },
            lastActivity: date
          };
        }

        analytics.userActivity[userEmail].totalEvents++;
        analytics.userActivity[userEmail].lastActivity = date;

        // Categorize email events
        switch (eventType) {
          case 'sent':
            analytics.emailEvents.sent++;
            analytics.userActivity[userEmail].emailEvents.sent++;
            break;
          case 'delivered':
            analytics.emailEvents.delivered++;
            analytics.userActivity[userEmail].emailEvents.delivered++;
            break;
          case 'opened':
            analytics.emailEvents.opened++;
            analytics.userActivity[userEmail].emailEvents.opened++;
            break;
          case 'clicked':
            analytics.emailEvents.clicked++;
            analytics.userActivity[userEmail].emailEvents.clicked++;
            break;
          case 'bounced':
            analytics.emailEvents.bounced++;
            analytics.userActivity[userEmail].emailEvents.bounced++;
            break;
          case 'failed':
            analytics.emailEvents.failed++;
            analytics.userActivity[userEmail].emailEvents.failed++;
            break;
        }

        // Add to timeline
        analytics.timeline.push({
          date,
          userEmail,
          action: eventType,
          userIp: eventData.ipAddress || 'unknown',
          userAgent: eventData.userAgent || 'unknown'
        });
      }

      // Calculate rates
      analytics.rates = {
        deliveryRate: analytics.emailEvents.sent > 0 ? 
          (analytics.emailEvents.delivered / analytics.emailEvents.sent * 100).toFixed(2) : 0,
        openRate: analytics.emailEvents.delivered > 0 ? 
          (analytics.emailEvents.opened / analytics.emailEvents.delivered * 100).toFixed(2) : 0,
        clickRate: analytics.emailEvents.delivered > 0 ? 
          (analytics.emailEvents.clicked / analytics.emailEvents.delivered * 100).toFixed(2) : 0,
        bounceRate: analytics.emailEvents.sent > 0 ? 
          (analytics.emailEvents.bounced / analytics.emailEvents.sent * 100).toFixed(2) : 0
      };

      // Store analytics in D1 for caching
      await this.storeCompanyAnalytics(companyId, analytics);

      return analytics;
    } catch (error) {
      console.error('Failed to get company email analytics:', error);
      throw error;
    }
  }

  // ==================== D1 ANALYTICS STORAGE ====================

  async storeCompanyAnalytics(companyId, analytics) {
    try {
      await this.db.prepare(`
        INSERT OR REPLACE INTO company_analytics (
          company_id, period_start, period_end, total_events,
          emails_sent, emails_delivered, emails_opened, emails_clicked, emails_bounced, emails_failed,
          delivery_rate, open_rate, click_rate, bounce_rate,
          analytics_data, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        companyId,
        analytics.period.startDate,
        analytics.period.endDate,
        analytics.totalEvents,
        analytics.emailEvents.sent,
        analytics.emailEvents.delivered,
        analytics.emailEvents.opened,
        analytics.emailEvents.clicked,
        analytics.emailEvents.bounced,
        analytics.emailEvents.failed,
        analytics.rates.deliveryRate,
        analytics.rates.openRate,
        analytics.rates.clickRate,
        analytics.rates.bounceRate,
        JSON.stringify(analytics),
        new Date().toISOString(),
        new Date().toISOString()
      ).run();
    } catch (error) {
      console.error('Failed to store company analytics:', error);
      throw error;
    }
  }

  async getStoredCompanyAnalytics(companyId, startDate, endDate) {
    try {
      const result = await this.db.prepare(`
        SELECT * FROM company_analytics 
        WHERE company_id = ? AND period_start = ? AND period_end = ?
        ORDER BY updated_at DESC LIMIT 1
      `).bind(companyId, startDate, endDate).first();

      return result;
    } catch (error) {
      console.error('Failed to get stored company analytics:', error);
      return null;
    }
  }

  // ==================== REAL-TIME EMAIL TRACKING ====================

  async trackEmailEvent(companyId, userEmail, eventType, eventData = {}) {
    try {
      await this.db.prepare(`
        INSERT INTO email_events (
          company_id, user_email, event_type, event_data, created_at
        ) VALUES (?, ?, ?, ?, ?)
      `).bind(
        companyId,
        userEmail,
        eventType,
        JSON.stringify(eventData),
        new Date().toISOString()
      ).run();

      console.log(`Email event tracked: ${eventType} for ${userEmail} in company ${companyId}`);
    } catch (error) {
      console.error('Failed to track email event:', error);
      throw error;
    }
  }

  // ==================== COMPANY EMAIL DASHBOARD ====================

  async getCompanyEmailDashboard(companyId, days = 30) {
    try {
      const endDate = new Date().toISOString().split('T')[0];
      const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

      // Get analytics
      const analytics = await this.getCompanyEmailAnalytics(companyId, startDate, endDate);

      // Get recent email events from D1
      const recentEvents = await this.db.prepare(`
        SELECT * FROM email_events 
        WHERE company_id = ? AND created_at >= ?
        ORDER BY created_at DESC LIMIT 50
      `).bind(companyId, startDate).all();

      return {
        analytics,
        recentEvents: recentEvents.results || [],
        summary: {
          totalEmails: analytics.emailEvents.sent,
          deliveryRate: analytics.rates.deliveryRate,
          openRate: analytics.rates.openRate,
          clickRate: analytics.rates.clickRate,
          bounceRate: analytics.rates.bounceRate
        }
      };
    } catch (error) {
      console.error('Failed to get company email dashboard:', error);
      throw error;
    }
  }
}
