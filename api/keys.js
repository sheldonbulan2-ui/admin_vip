const crypto = require('crypto');
const { DEFAULT_ADMIN_KEY, loadKeys, saveKeys } = require('../lib/db');

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

module.exports = (req, res) => {
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

  const accounts = loadKeys();
  const now = Date.now();

  // Auto-check and update expired status
  accounts.forEach(a => {
    if (a.status === 'active' && a.expiresAt && now > a.expiresAt) {
      a.status = 'expired';
    }
  });
  saveKeys(accounts);

  // 1. GET: List all accounts & system metrics
  if (req.method === 'GET') {
    const total = accounts.length;
    const active = accounts.filter(a => a.status === 'active').length;
    const expired = accounts.filter(a => a.status === 'expired').length;
    const revoked = accounts.filter(a => a.status === 'revoked').length;
    const boundDevices = accounts.filter(a => a.hwid !== null).length;

    return res.status(200).json({
      success: true,
      stats: { total, active, expired, revoked, boundDevices },
      accounts: accounts.map(a => ({
        ...a,
        remainingSeconds: a.expiresAt ? Math.max(0, Math.floor((a.expiresAt - now) / 1000)) : null
      }))
    });
  }

  // 2. POST: Create VIP Account (Username, Password, Duration)
  if (req.method === 'POST') {
    const { username, password, durationDays, durationHours, notes } = req.body || {};

    if (!username || !username.trim()) {
      return res.status(400).json({ success: false, message: 'Username is required!' });
    }
    if (!password || !password.trim()) {
      return res.status(400).json({ success: false, message: 'Password is required!' });
    }

    const cleanUsername = username.trim();
    const cleanPassword = password.trim();

    // Check duplicate username
    if (accounts.some(a => a.username.toLowerCase() === cleanUsername.toLowerCase())) {
      return res.status(400).json({ success: false, message: 'Username already exists! Gumamit ng ibang username.' });
    }

    let days = parseFloat(durationDays) || 0;
    let hours = parseFloat(durationHours) || (days * 24);

    if (hours <= 0) {
      hours = 24; // Default to 24 hours / 1 day
      days = 1;
    }

    const newAccount = {
      id: 'acc_' + crypto.randomBytes(8).toString('hex'),
      username: cleanUsername,
      password: cleanPassword,
      durationDays: days,
      durationHours: hours,
      status: 'active',
      hwid: null,
      notes: notes || 'VIP Account',
      createdAt: now,
      activatedAt: null,
      expiresAt: null
    };

    accounts.unshift(newAccount);
    saveKeys(accounts);

    return res.status(201).json({
      success: true,
      message: `Successfully created VIP account: ${cleanUsername}`,
      account: newAccount
    });
  }

  // 3. PUT: Manage Account (Reset HWID, Extend, Revoke, Activate)
  if (req.method === 'PUT') {
    const { id, action, addDays } = req.body || {};
    const acc = accounts.find(a => a.id === id);

    if (!acc) {
      return res.status(404).json({ success: false, message: 'Account not found' });
    }

    if (action === 'reset_hwid') {
      acc.hwid = null;
      saveKeys(accounts);
      return res.status(200).json({ success: true, message: `HWID reset for ${acc.username}. Maaari nang gamitin sa bagong device.` });
    }

    if (action === 'revoke') {
      acc.status = 'revoked';
      saveKeys(accounts);
      return res.status(200).json({ success: true, message: `Account ${acc.username} has been REVOKED.` });
    }

    if (action === 'activate') {
      acc.status = 'active';
      saveKeys(accounts);
      return res.status(200).json({ success: true, message: `Account ${acc.username} set to ACTIVE.` });
    }

    if (action === 'extend') {
      const daysToAdd = parseFloat(addDays) || 1;
      const msToAdd = daysToAdd * 24 * 3600 * 1000;
      acc.durationDays += daysToAdd;
      acc.durationHours += daysToAdd * 24;

      if (acc.expiresAt && acc.expiresAt > now) {
        acc.expiresAt += msToAdd;
      } else {
        acc.expiresAt = now + msToAdd;
      }
      acc.status = 'active';
      saveKeys(accounts);

      return res.status(200).json({
        success: true,
        message: `Extended ${acc.username} by ${daysToAdd} days`,
        account: acc
      });
    }

    return res.status(400).json({ success: false, message: 'Invalid action' });
  }

  // 4. DELETE: Delete Account
  if (req.method === 'DELETE') {
    const id = req.query.id || req.body?.id;
    const index = accounts.findIndex(a => a.id === id);

    if (index === -1) {
      return res.status(404).json({ success: false, message: 'Account not found' });
    }

    const removed = accounts.splice(index, 1);
    saveKeys(accounts);

    return res.status(200).json({
      success: true,
      message: `Account ${removed[0].username} deleted successfully`
    });
  }

  return res.status(405).json({ message: 'Method not allowed' });
};
