// Analytics Handler Functions for Multi-Tenant SaaS
// Company-specific email analytics and Brevo integration

// ==================== ANALYTICS HANDLERS ====================

export async function handleEmailDashboard(request, analyticsService, authService) {
  try {
    // Authenticate user
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Authorization required' }), { status: 401 });
    }
    
    const token = authHeader.split(' ')[1];
    const { user } = await authService.getUserFromToken(token);
    if (!user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
    }

    const url = new URL(request.url);
    const days = parseInt(url.searchParams.get('days')) || 30;

    const dashboard = await analyticsService.getCompanyEmailDashboard(user.company_id, days);

    return new Response(JSON.stringify({
      success: true,
      data: dashboard
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

export async function handleCompanyEmailAnalytics(request, analyticsService, authService) {
  try {
    // Authenticate user
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Authorization required' }), { status: 401 });
    }
    
    const token = authHeader.split(' ')[1];
    const { user } = await authService.getUserFromToken(token);
    if (!user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
    }

    const url = new URL(request.url);
    const startDate = url.searchParams.get('startDate') || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const endDate = url.searchParams.get('endDate') || new Date().toISOString().split('T')[0];

    const analytics = await analyticsService.getCompanyEmailAnalytics(user.company_id, startDate, endDate);

    return new Response(JSON.stringify({
      success: true,
      data: analytics
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

export async function handleEmailEvents(request, analyticsService, authService) {
  try {
    // Authenticate user
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Authorization required' }), { status: 401 });
    }
    
    const token = authHeader.split(' ')[1];
    const { user } = await authService.getUserFromToken(token);
    if (!user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
    }

    const url = new URL(request.url);
    const limit = parseInt(url.searchParams.get('limit')) || 50;
    const offset = parseInt(url.searchParams.get('offset')) || 0;

    // Get recent email events for the company
    const events = await analyticsService.db.prepare(`
      SELECT * FROM email_events 
      WHERE company_id = ? 
      ORDER BY created_at DESC 
      LIMIT ? OFFSET ?
    `).bind(user.company_id, limit, offset).all();

    return new Response(JSON.stringify({
      success: true,
      data: {
        events: events.results || [],
        pagination: {
          limit,
          offset,
          total: events.results?.length || 0
        }
      }
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

export async function handleBrevoActivityLogs(request, analyticsService, authService) {
  try {
    // Authenticate user
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Authorization required' }), { status: 401 });
    }
    
    const token = authHeader.split(' ')[1];
    const { user } = await authService.getUserFromToken(token);
    if (!user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
    }

    const url = new URL(request.url);
    const startDate = url.searchParams.get('startDate') || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const endDate = url.searchParams.get('endDate') || new Date().toISOString().split('T')[0];
    const limit = parseInt(url.searchParams.get('limit')) || 100;
    const offset = parseInt(url.searchParams.get('offset')) || 0;

    // Get company-specific email logs from D1
    const logs = await analyticsService.db.prepare(`
      SELECT ee.*, c.name as company_name
      FROM email_events ee
      LEFT JOIN companies c ON ee.company_id = c.id
      WHERE ee.company_id = ? AND ee.created_at >= ? AND ee.created_at <= ?
      ORDER BY ee.created_at DESC
      LIMIT ? OFFSET ?
    `).bind(user.company_id, startDate, endDate, limit, offset).all();

    return new Response(JSON.stringify({
      success: true,
      data: {
        logs: logs.results || [],
        pagination: {
          limit,
          offset,
          total: logs.results?.length || 0
        },
        company: {
          id: user.company_id,
          name: user.company_name || 'Unknown Company'
        }
      }
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

export async function handleSyncBrevoLogs(request, analyticsService, authService) {
  try {
    // Authenticate user (admin only)
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Authorization required' }), { status: 401 });
    }
    
    const token = authHeader.split(' ')[1];
    const { user } = await authService.getUserFromToken(token);
    if (!user || (user.role !== 'admin' && user.role !== 'master_admin')) {
      return new Response(JSON.stringify({ error: 'Unauthorized - Admin access required' }), { status: 403 });
    }

    const url = new URL(request.url);
    const startDate = url.searchParams.get('startDate') || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const endDate = url.searchParams.get('endDate') || new Date().toISOString().split('T')[0];

    const syncResult = await analyticsService.syncBrevoActivityLogs(startDate, endDate);

    return new Response(JSON.stringify({
      success: true,
      data: {
        message: 'Brevo activity logs synced successfully',
        syncResult
      }
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
