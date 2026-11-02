const querystring = require('querystring');
const { loadAccountsAsync, saveAccountAsync, loadAnnouncementAsync, isSupabaseConfigured } = require('../lib/db');

async function parseBody(req) {
  let raw = '';
  if (req.body) {
    if (typeof req.body === 'object' && !Buffer.isBuffer(req.body) && Object.keys(req.body).length > 0) {
      return req.body;
    }
    raw = Buffer.isBuffer(req.body) ? req.body.toString('utf8') : String(req.body);
  }

  if (!raw && !req.readableEnded) {
    raw = await new Promise((resolve) => {
      let buf = '';
      req.on('data', chunk => { buf += chunk; });
      req.on('end', () => resolve(buf));
      req.on('error', () => resolve(''));
      setTimeout(() => resolve(''), 500);
    });
  }

  if (!raw) return {};

  try {
    return JSON.parse(raw);
  } catch (e) {
    return querystring.parse(raw);
  }
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-HWID');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const b = await parseBody(req);
  const q = req.query || {};

  // Support Volley query params + form body + JSON
  const usernameParam = (b['username-activation'] || b.username || q['username-activation'] || q.username || '').toString().trim();
  const passwordParam = (b['password-activation'] || b.password || q['password-activation'] || q.password || '').toString().trim();
  const keyParam = (b.key || q.key || '').toString().trim();
  const hwidParam = (b['user-device-id'] || b.hwid || req.headers['x-hwid'] || q.hwid || q['user-device-id'] || 'UNKNOWN_HWID').toString().trim();

  // Load from Supabase (or cached fallback)
  const accounts = await loadAccountsAsync();
  const annObj = await loadAnnouncementAsync();
  let acc = null;

  function sendResponse(valid, status, message, extra = {}) {
    let announcementText = "";
    if (annObj && annObj.active && annObj.message) {
      announcementText = `[${annObj.title}] ${annObj.message}`;
    }

    const payload = {
      status: status, // "enable" on pass, "failed" on reject
      valid: valid,
      message: message,
      announcement: announcementText,
      announcement_title: annObj ? annObj.title : '',
      announcement_message: annObj ? annObj.message : '',
      database: isSupabaseConfigured() ? 'supabase' : 'local-cache',
      ...extra
    };
    return res.status(200).json([ payload ]);
  }

  if (usernameParam && passwordParam) {
    const cleanUser = usernameParam.toLowerCase();
    acc = accounts.find(a => a.username && a.username.toLowerCase() === cleanUser);

    if (!acc) {
      return sendResponse(false, 'failed', '❌ Invalid Username! Account is not registered in Admin.');
    }

    if (acc.password !== passwordParam) {
      return sendResponse(false, 'failed', '❌ Invalid Password! Password does not match.');
    }
  } else if (keyParam) {
    const cleanKey = keyParam.toUpperCase();
    acc = accounts.find(a => (a.key && a.key.toUpperCase() === cleanKey) || (a.username && a.username.toUpperCase() === cleanKey));
    if (!acc) {
      return sendResponse(false, 'failed', '❌ Invalid License Key / Username! Not registered.');
    }
  } else {
    return sendResponse(false, 'failed', '❌ Username and Password are required!');
  }

  const now = Date.now();

  // 1. CHECK REVOKED STATUS
  if (acc.status === 'revoked') {
    return sendResponse(false, 'failed', '🚫 VIP Account has been revoked by Admin.');
  }

  // 2. CHECK ALREADY EXPIRED
  if (acc.status === 'expired' || (acc.expiresAt && now >= acc.expiresAt)) {
    acc.status = 'expired';
    await saveAccountAsync(acc);
    return sendResponse(false, 'failed', '⚠️ VIP Account Expired! Please renew in Admin.', { expired: true, expiresAt: acc.expiresAt });
  }

  // 3. FIRST TIME ACTIVATION
  if (!acc.activatedAt) {
    acc.activatedAt = now;
    const durationHours = acc.durationHours || (acc.durationDays ? acc.durationDays * 24 : 720);
    acc.expiresAt = now + (durationHours * 60 * 60 * 1000);
  }

  // 4. STRICT HARDWARE ID (HWID) LOCK
  if ((!acc.hwid || acc.hwid === 'UNKNOWN_HWID') && hwidParam && hwidParam !== 'UNKNOWN_HWID') {
    // Auto-bind device on first login
    acc.hwid = hwidParam;
  } else if (acc.hwid && acc.hwid !== 'UNKNOWN_HWID' && hwidParam && hwidParam !== 'UNKNOWN_HWID' && acc.hwid !== hwidParam) {
    // Reject multiple devices sharing account
    return sendResponse(false, 'failed', '🔒 Device Locked! Bawal mag-share ng account sa ibang device. Ipa-reset ang HWID sa Admin.', {
      locked: true,
      registeredHwid: acc.hwid.substring(0, 8) + '...'
    });
  }

  acc.status = 'active';
  acc.lastHeartbeat = now;
  await saveAccountAsync(acc);

  const remainingSeconds = Math.max(0, Math.floor((acc.expiresAt - now) / 1000));
  const remainingHours = Math.floor(remainingSeconds / 3600);
  const remainingDays = Math.floor(remainingHours / 24);

  let durationText = '';
  if (remainingDays > 0) {
    durationText = `${remainingDays}d ${remainingHours % 24}h`;
  } else {
    durationText = `${remainingHours}h`;
  }

  return sendResponse(true, 'enable', `✅ AUTHENTICATED! VIP Active (${durationText} remaining)`, {
    username: acc.username,
    durationDays: acc.durationDays || 30,
    durationHours: acc.durationHours || 720,
    remainingDays: remainingDays,
    remainingHours: remainingHours,
    remainingSeconds: remainingSeconds,
    activatedAt: acc.activatedAt,
    expiresAt: acc.expiresAt,
    hwidBound: acc.hwid
  });
};
