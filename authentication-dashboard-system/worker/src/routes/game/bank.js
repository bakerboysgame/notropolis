/**
 * Bank Transfer API Routes
 * Handles cash transfers between companies owned by the same user
 */

// Max transfer amount per destination location type
const MAX_TRANSFER_BY_LOCATION = {
  town: 50000,
  city: 500000,
  capital: 1000000,
};

// Daily transfer limits
const DAILY_SEND_LIMIT = 3;
const DAILY_RECEIVE_LIMIT = 3;

/**
 * GET /api/game/bank/status?company_id=X
 * Get transfer status for a company (daily limits used)
 */
export async function getBankStatus(request, env, company) {
  const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

  // Get sends today from this company
  const sendsToday = await env.DB.prepare(`
    SELECT COUNT(*) as count
    FROM bank_transfers
    WHERE from_company_id = ?
      AND date(created_at) = date(?)
  `).bind(company.id, today).first();

  // Get receives today to this company
  const receivesToday = await env.DB.prepare(`
    SELECT COUNT(*) as count
    FROM bank_transfers
    WHERE to_company_id = ?
      AND date(created_at) = date(?)
  `).bind(company.id, today).first();

  // Get user's other companies for transfer options
  const otherCompanies = await env.DB.prepare(`
    SELECT id, name, cash, offshore, location_type, current_map_id, is_in_prison
    FROM game_companies
    WHERE user_id = (SELECT user_id FROM game_companies WHERE id = ?)
      AND id != ?
    ORDER BY name
  `).bind(company.id, company.id).all();

  // For each other company, get their transfer limits
  const companiesWithLimits = await Promise.all(
    otherCompanies.results.map(async (c) => {
      const cSends = await env.DB.prepare(`
        SELECT COUNT(*) as count
        FROM bank_transfers
        WHERE from_company_id = ?
          AND date(created_at) = date(?)
      `).bind(c.id, today).first();

      const cReceives = await env.DB.prepare(`
        SELECT COUNT(*) as count
        FROM bank_transfers
        WHERE to_company_id = ?
          AND date(created_at) = date(?)
      `).bind(c.id, today).first();

      return {
        ...c,
        sends_today: cSends?.count || 0,
        sends_remaining: DAILY_SEND_LIMIT - (cSends?.count || 0),
        receives_today: cReceives?.count || 0,
        receives_remaining: DAILY_RECEIVE_LIMIT - (cReceives?.count || 0),
        max_receive_amount: MAX_TRANSFER_BY_LOCATION[c.location_type] || MAX_TRANSFER_BY_LOCATION.town,
      };
    })
  );

  return {
    success: true,
    company: {
      id: company.id,
      name: company.name,
      cash: company.cash,
      offshore: company.offshore,
      location_type: company.location_type,
      is_in_prison: company.is_in_prison,
    },
    limits: {
      sends_today: sendsToday?.count || 0,
      sends_remaining: DAILY_SEND_LIMIT - (sendsToday?.count || 0),
      receives_today: receivesToday?.count || 0,
      receives_remaining: DAILY_RECEIVE_LIMIT - (receivesToday?.count || 0),
      max_send_amount: company.cash, // Can send up to all cash
    },
    other_companies: companiesWithLimits,
  };
}

/**
 * POST /api/game/bank/transfer
 * Transfer cash from one company to another (both must be owned by same user)
 */
export async function transferCash(request, env, company) {
  const { from_company_id, to_company_id, amount } = await request.json();

  // Validate amount
  if (!amount || typeof amount !== 'number' || amount <= 0) {
    throw new Error('Invalid transfer amount');
  }

  // Must be a whole number
  if (!Number.isInteger(amount)) {
    throw new Error('Transfer amount must be a whole number');
  }

  // Verify the from_company_id matches the authenticated company
  if (from_company_id !== company.id) {
    throw new Error('Company mismatch');
  }

  // Get the destination company
  const toCompany = await env.DB.prepare(`
    SELECT * FROM game_companies WHERE id = ?
  `).bind(to_company_id).first();

  if (!toCompany) {
    throw new Error('Destination company not found');
  }

  // Verify same user owns both companies
  if (toCompany.user_id !== company.user_id) {
    throw new Error('You can only transfer between your own companies');
  }

  // Cannot transfer to self
  if (from_company_id === to_company_id) {
    throw new Error('Cannot transfer to the same company');
  }

  // Check if sender is in prison (cannot send from prison)
  if (company.is_in_prison) {
    throw new Error('Cannot send transfers while in prison. Pay your fine first.');
  }

  // Check sufficient funds
  if (company.cash < amount) {
    throw new Error(`Insufficient funds. You have $${company.cash.toLocaleString()} but tried to send $${amount.toLocaleString()}`);
  }

  // Check max transfer amount by destination location type
  const maxAmount = MAX_TRANSFER_BY_LOCATION[toCompany.location_type] || MAX_TRANSFER_BY_LOCATION.town;
  if (amount > maxAmount) {
    throw new Error(`Maximum transfer to a ${toCompany.location_type || 'town'} is $${maxAmount.toLocaleString()}`);
  }

  // Check daily sending limit
  const today = new Date().toISOString().split('T')[0];
  const sendsToday = await env.DB.prepare(`
    SELECT COUNT(*) as count
    FROM bank_transfers
    WHERE from_company_id = ?
      AND date(created_at) = date(?)
  `).bind(from_company_id, today).first();

  if ((sendsToday?.count || 0) >= DAILY_SEND_LIMIT) {
    throw new Error(`Daily sending limit reached (${DAILY_SEND_LIMIT} transfers per day)`);
  }

  // Check daily receiving limit for destination
  const receivesToday = await env.DB.prepare(`
    SELECT COUNT(*) as count
    FROM bank_transfers
    WHERE to_company_id = ?
      AND date(created_at) = date(?)
  `).bind(to_company_id, today).first();

  if ((receivesToday?.count || 0) >= DAILY_RECEIVE_LIMIT) {
    throw new Error(`${toCompany.name} has reached its daily receiving limit (${DAILY_RECEIVE_LIMIT} transfers per day)`);
  }

  // Execute transfer - DO NOT reset ticks_since_action (bank transfers are not strategic actions)
  const statements = [];

  // Deduct from sender
  statements.push(
    env.DB.prepare(`
      UPDATE game_companies
      SET cash = cash - ?
      WHERE id = ?
    `).bind(amount, from_company_id)
  );

  // Add to receiver
  statements.push(
    env.DB.prepare(`
      UPDATE game_companies
      SET cash = cash + ?
      WHERE id = ?
    `).bind(amount, to_company_id)
  );

  // Log transfer
  statements.push(
    env.DB.prepare(`
      INSERT INTO bank_transfers (
        from_company_id, to_company_id, amount,
        from_location_type, to_location_type
      )
      VALUES (?, ?, ?, ?, ?)
    `).bind(
      from_company_id,
      to_company_id,
      amount,
      company.location_type || null,
      toCompany.location_type || null
    )
  );

  // Log transaction for sender
  statements.push(
    env.DB.prepare(`
      INSERT INTO game_transactions (
        id, company_id, map_id, action_type, amount
      )
      VALUES (?, ?, NULL, 'bank_transfer_out', ?)
    `).bind(crypto.randomUUID(), from_company_id, -amount)
  );

  // Log transaction for receiver
  statements.push(
    env.DB.prepare(`
      INSERT INTO game_transactions (
        id, company_id, map_id, action_type, amount
      )
      VALUES (?, ?, NULL, 'bank_transfer_in', ?)
    `).bind(crypto.randomUUID(), to_company_id, amount)
  );

  await env.DB.batch(statements);

  // Get updated balances
  const updatedFrom = await env.DB.prepare(
    'SELECT cash FROM game_companies WHERE id = ?'
  ).bind(from_company_id).first();

  const updatedTo = await env.DB.prepare(
    'SELECT cash FROM game_companies WHERE id = ?'
  ).bind(to_company_id).first();

  return {
    success: true,
    amount,
    from_company: {
      id: from_company_id,
      name: company.name,
      new_balance: updatedFrom?.cash || 0,
    },
    to_company: {
      id: to_company_id,
      name: toCompany.name,
      new_balance: updatedTo?.cash || 0,
    },
  };
}

/**
 * GET /api/game/bank/history?company_id=X&limit=50
 * Get transfer history for a company
 */
export async function getTransferHistory(request, env, company) {
  const url = new URL(request.url);
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '50', 10), 100);

  // Get all user's company IDs to show transfers between them
  const userCompanies = await env.DB.prepare(`
    SELECT id, name FROM game_companies
    WHERE user_id = (SELECT user_id FROM game_companies WHERE id = ?)
  `).bind(company.id).all();

  const companyIds = userCompanies.results.map(c => c.id);
  const companyNames = Object.fromEntries(
    userCompanies.results.map(c => [c.id, c.name])
  );

  // Get transfers where this user's companies are involved
  const transfers = await env.DB.prepare(`
    SELECT *
    FROM bank_transfers
    WHERE from_company_id IN (${companyIds.map(() => '?').join(',')})
       OR to_company_id IN (${companyIds.map(() => '?').join(',')})
    ORDER BY created_at DESC
    LIMIT ?
  `).bind(...companyIds, ...companyIds, limit).all();

  // Enrich with company names
  const enrichedTransfers = transfers.results.map(t => ({
    ...t,
    from_company_name: companyNames[t.from_company_id] || 'Unknown',
    to_company_name: companyNames[t.to_company_id] || 'Unknown',
  }));

  return {
    success: true,
    transfers: enrichedTransfers,
    companies: userCompanies.results,
  };
}
