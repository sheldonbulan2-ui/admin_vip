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

  const keys = loadKeys();
  const now = Date.now();

  // Auto-check and update expired status
  keys.forEach(k => {
    if (k.status === 'active' && k.expiresAt && now > k.expiresAt) {
      k.status = 'expired';
    }
  });
  saveKeys(keys);

  // 1. GET: List all keys & system metrics
  if (req.method === 'GET') {
    const total = keys.length;
    const active = keys.filter(k => k.status === 'active').length;
    const expired = keys.filter(k => k.status === 'expired').length;
    const revoked = keys.filter(k => k.status === 'revoked').length;
    const boundDevices = keys.filter(k => k.hwid !== null).length;

    return res.status(200).json({
      success: true,
      stats: { total, active, expired, revoked, boundDevices },
      keys: keys.map(k => ({
        ...k,
        remainingSeconds: k.expiresAt ? Math.max(0, Math.floor((k.expiresAt - now) / 1000)) : null
      }))
    });
  }

  // 2. POST: Generate new license key
  if (req.method === 'POST') {
    const { customKey, durationDays, durationHours, notes, count = 1 } = req.body || {};

    let days = parseFloat(durationDays) || 0;
    let hours = parseFloat(durationHours) || (days * 24);

    if (hours <= 0) {
      hours = 24; // Default to 24 hours / 1 day
      days = 1;
    }

    const createdKeys = [];
    const numToCreate = Math.min(Math.max(1, parseInt(count) || 1), 50);

    for (let i = 0; i < numToCreate; i++) {
      let finalKey = "";
      if (customKey && numToCreate === 1) {
        finalKey = customKey.trim().toUpperCase();
        if (keys.some(k => k.key === finalKey)) {
          return res.status(400).json({ success: false, message: 'License key already exists!' });
        }
      } else {
        const randomPart = crypto.randomBytes(6).toString('hex').toUpperCase();
        finalKey = `NINJA-${randomPart.substring(0, 4)}-${randomPart.substring(4, 8)}-${randomPart.substring(8, 12)}`;
      }

      const newKeyObj = {
        id: 'key_' + crypto.randomBytes(8).toString('hex'),
        key: finalKey,
        durationDays: days,
        durationHours: hours,
        status: 'active',
        hwid: null,
        notes: notes || 'VIP License',
        createdAt: now,
        activatedAt: null,
        expiresAt: null // Will be set on first validation in APK
      };

      keys.unshift(newKeyObj);
      createdKeys.push(newKeyObj);
    }

    saveKeys(keys);
    return res.status(201).json({
      success: true,
      message: `Successfully generated ${createdKeys.length} license key(s)`,
      keys: createdKeys
    });
  }

  // 3. PUT: Update key (Reset HWID, Extend Time, Change Status)
  if (req.method === 'PUT') {
    const { id, action, extendHours, newStatus, newNotes } = req.body || {};
    const keyItem = keys.find(k => k.id === id || k.key === id);

    if (!keyItem) {
      return res.status(404).json({ success: false, message: 'License key not found' });
    }

    if (action === 'reset_hwid') {
      keyItem.hwid = null;
    } else if (action === 'extend_time') {
      const extraHours = parseFloat(extendHours) || 24;
      const extraMs = extraHours * 3600 * 1000;
      keyItem.durationHours += extraHours;
      keyItem.durationDays = parseFloat((keyItem.durationHours / 24).toFixed(1));

      if (keyItem.expiresAt) {
        keyItem.expiresAt += extraMs;
        if (keyItem.expiresAt > now && keyItem.status === 'expired') {
          keyItem.status = 'active';
        }
      }
    } else if (action === 'set_status') {
      if (['active', 'expired', 'revoked'].includes(newStatus)) {
        keyItem.status = newStatus;
      }
    } else if (action === 'update_notes') {
      keyItem.notes = newNotes || keyItem.notes;
    }

    saveKeys(keys);
    return res.status(200).json({
      success: true,
      message: 'Key updated successfully',
      key: keyItem
    });
  }

  // 4. DELETE: Remove key
  if (req.method === 'DELETE') {
    const { id } = req.body || req.query || {};
    const index = keys.findIndex(k => k.id === id || k.key === id);

    if (index === -1) {
      return res.status(404).json({ success: false, message: 'Key not found' });
    }

    keys.splice(index, 1);
    saveKeys(keys);
    return res.status(200).json({ success: true, message: 'Key deleted successfully' });
  }

  return res.status(405).json({ success: false, message: 'Method Not Allowed' });
};
