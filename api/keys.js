const crypto = require('crypto');
const { 
  DEFAULT_ADMIN_KEY, 
  loadAccountsAsync, 
  saveAccountAsync, 
  deleteAccountAsync,
  loadResellersAsync,
  saveResellerAsync,
  loadAnnouncementAsync,
  saveAnnouncementAsync,
  isSupabaseConfigured 
} = require('../lib/db');

function verifyAdminAuth(req) {
  const authHeader = req.headers['authorization'] || '';
  const expectedKey = (process.env.ADMIN_KEY || DEFAULT_ADMIN_KEY).trim();

  if (authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    try {
      const decoded = Buffer.from(token, 'base64').toString('utf8');
      if (decoded.includes(expectedKey)) return true;
    } catch (e) {}
    if (token === expectedKey) return true;
  }
  return false;
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Enforce Admin Security
  if (!verifyAdminAuth(req)) {
    return res.status(401).json({
      success: false,
      message: 'Unauthorized: Valid Admin Authorization required'
    });
  }

  const accounts = await loadAccountsAsync();
  const resellers = await loadResellersAsync();
  const announcement = await loadAnnouncementAsync();
  const now = Date.now();

  // Auto-check and update expired status
  for (const a of accounts) {
    if (a.status === 'active' && a.expiresAt && now > a.expiresAt) {
      a.status = 'expired';
      await saveAccountAsync(a);
    }
  }

  // 1. GET: List all accounts, resellers & system metrics
  if (req.method === 'GET') {
    const total = accounts.length;
    const active = accounts.filter(a => a.status === 'active').length;
    const expired = accounts.filter(a => a.status === 'expired').length;
    const revoked = accounts.filter(a => a.status === 'revoked').length;
    const boundDevices = accounts.filter(a => a.hwid !== null).length;

    return res.status(200).json({
      success: true,
      isSupabase: isSupabaseConfigured(),
      stats: { total, active, expired, revoked, boundDevices, resellersCount: resellers.length },
      announcement: announcement,
      resellers: resellers,
      accounts: accounts.map(a => ({
        ...a,
        remainingSeconds: a.expiresAt ? Math.max(0, Math.floor((a.expiresAt - now) / 1000)) : null
      }))
    });
  }

  // Parse body
  const body = req.body || {};
  const action = body.action || '';

  // 2. RESELLER ACTIONS
  if (action === 'create_reseller') {
    const { username, password, credits, notes } = body;
    if (!username || !password) {
      return res.status(400).json({ success: false, message: 'Reseller username and password required' });
    }
    const cleanUser = username.trim().toLowerCase();
    if (resellers.some(r => r.username.toLowerCase() === cleanUser)) {
      return res.status(400).json({ success: false, message: 'Reseller username already exists!' });
    }
    const newReseller = {
      id: 'res_' + crypto.randomBytes(4).toString('hex'),
      username: cleanUser,
      password: password.trim(),
      credits: parseInt(credits) || 10,
      notes: (notes || 'Official Reseller').trim(),
      createdAt: now
    };
    await saveResellerAsync(newReseller);
    return res.status(200).json({ success: true, message: `Reseller ${cleanUser} created with ${newReseller.credits} credits!`, reseller: newReseller });
  }

  if (action === 'add_reseller_credits') {
    const { resellerId, credits } = body;
    const target = resellers.find(r => r.id === resellerId);
    if (!target) return res.status(404).json({ success: false, message: 'Reseller not found' });
    target.credits = (target.credits || 0) + (parseInt(credits) || 10);
    await saveResellerAsync(target);
    return res.status(200).json({ success: true, message: `Added credits! New balance: ${target.credits}`, reseller: target });
  }

  // ANNOUNCEMENT / BROADCAST ACTION
  if (action === 'update_announcement') {
    const { title, message, active } = body;
    const updated = await saveAnnouncementAsync({
      title: (title || 'SYSTEM NOTICE').trim(),
      message: (message || '').trim(),
      active: active !== undefined ? Boolean(active) : true,
      createdAt: now
    });
    return res.status(200).json({ success: true, message: 'Global broadcast announcement published to all APKs!', announcement: updated });
  }

  // 3. ACCOUNT ACTIONS: CREATE VIP ACCOUNT
  if (action === 'create_account' || (!action && req.method === 'POST')) {
    const { username, password, durationDays, durationHours, notes, resellerId } = body;

    if (!username || !password) {
      return res.status(400).json({ success: false, message: 'Username and Password are required' });
    }

    const cleanUsername = username.trim().toLowerCase();
    const cleanPassword = password.trim();

    if (accounts.some(a => a.username && a.username.toLowerCase() === cleanUsername)) {
      return res.status(400).json({ success: false, message: `Username "${cleanUsername}" is already taken!` });
    }

    const dDays = parseInt(durationDays) || 30;
    const dHours = parseInt(durationHours) || (dDays * 24);

    const newAccount = {
      id: 'acc_' + crypto.randomBytes(6).toString('hex'),
      username: cleanUsername,
      password: cleanPassword,
      durationDays: dDays,
      durationHours: dHours,
      status: 'active',
      hwid: null,
      notes: (notes || 'Created via Admin Panel').trim(),
      resellerId: resellerId || null,
      createdAt: now,
      activatedAt: null,
      expiresAt: null,
      lastHeartbeat: null
    };

    await saveAccountAsync(newAccount);
    return res.status(201).json({
      success: true,
      message: `VIP Account "${cleanUsername}" created successfully!`,
      account: newAccount
    });
  }

  // 4. RESET HWID (DEVICE UNLOCK)
  if (action === 'reset_hwid') {
    const { accountId } = body;
    const acc = accounts.find(a => a.id === accountId);
    if (!acc) return res.status(404).json({ success: false, message: 'Account not found' });

    acc.hwid = null;
    await saveAccountAsync(acc);
    return res.status(200).json({ success: true, message: `HWID reset for "${acc.username}". It can now bind to a new device!` });
  }

  // 5. EXTEND DURATION
  if (action === 'extend_duration') {
    const { accountId, addDays, addHours } = body;
    const acc = accounts.find(a => a.id === accountId);
    if (!acc) return res.status(404).json({ success: false, message: 'Account not found' });

    const hoursToAdd = (parseInt(addHours) || 0) + ((parseInt(addDays) || 0) * 24);
    if (hoursToAdd <= 0) return res.status(400).json({ success: false, message: 'Specify positive days or hours to extend' });

    if (acc.expiresAt && acc.expiresAt > now) {
      acc.expiresAt += (hoursToAdd * 3600 * 1000);
    } else {
      acc.activatedAt = now;
      acc.expiresAt = now + (hoursToAdd * 3600 * 1000);
    }

    acc.status = 'active';
    acc.durationHours = (acc.durationHours || 0) + hoursToAdd;
    acc.durationDays = Math.ceil(acc.durationHours / 24);

    await saveAccountAsync(acc);
    return res.status(200).json({ success: true, message: `Extended account "${acc.username}" by ${hoursToAdd} hours!` });
  }

  // 6. TOGGLE BAN / REVOKE
  if (action === 'toggle_revoke') {
    const { accountId } = body;
    const acc = accounts.find(a => a.id === accountId);
    if (!acc) return res.status(404).json({ success: false, message: 'Account not found' });

    acc.status = (acc.status === 'revoked') ? 'active' : 'revoked';
    await saveAccountAsync(acc);
    return res.status(200).json({ success: true, message: `Account "${acc.username}" status updated to: ${acc.status}` });
  }

  // 7. DELETE ACCOUNT
  if (action === 'delete_account' || req.method === 'DELETE') {
    const accountId = body.accountId || req.query.id;
    if (!accountId) return res.status(400).json({ success: false, message: 'Account ID required' });

    await deleteAccountAsync(accountId);
    return res.status(200).json({ success: true, message: 'VIP account deleted permanently!' });
  }

  return res.status(400).json({ success: false, message: 'Invalid action or request method' });
};
