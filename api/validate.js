const querystring = require('querystring');
const { loadKeys, saveKeys } = require('../lib/db');

// Helper to reliably parse body in Vercel Serverless environment
async function parseRequestBody(req) {
  // If already parsed as object
  if (req.body && typeof req.body === 'object' && !Buffer.isBuffer(req.body)) {
    return req.body;
  }

  // If body is already loaded as string or Buffer
  if (req.body) {
    const raw = Buffer.isBuffer(req.body) ? req.body.toString('utf8') : String(req.body);
    try {
      return JSON.parse(raw);
    } catch (e) {
      return querystring.parse(raw);
    }
  }

  // If body stream needs reading
  return new Promise((resolve) => {
    let data = '';
    req.on('data', chunk => {
      data += chunk;
    });
    req.on('end', () => {
      if (!data) return resolve({});
      try {
        resolve(JSON.parse(data));
      } catch (e) {
        resolve(querystring.parse(data));
      }
    });
    req.on('error', () => resolve({}));
  });
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-HWID');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const b = await parseRequestBody(req);
  const q = req.query || {};

  // Support Volley form params, standard JSON, and query fallback
  const usernameParam = (b['username-activation'] || b.username || q['username-activation'] || q.username || '').toString().trim();
  const passwordParam = (b['password-activation'] || b.password || q['password-activation'] || q.password || '').toString().trim();
  const keyParam = (b.key || q.key || '').toString().trim();
  const hwidParam = (b['user-device-id'] || b.hwid || req.headers['x-hwid'] || q.hwid || 'UNKNOWN_HWID').toString().trim();

  const accounts = loadKeys();
  let acc = null;

  function sendResponse(valid, status, message, extra = {}) {
    const payload = {
      status: status, // "enable" on pass, "failed" on reject
      valid: valid,
      message: message,
      ...extra
    };

    // Return JSON Array for Android APK Volley parser
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
    saveKeys(accounts);
    return sendResponse(false, 'failed', '⚠️ VIP Account Expired! Please renew in Admin.', { expired: true, expiresAt: acc.expiresAt });
  }

  // 3. FIRST TIME ACTIVATION
  if (!acc.activatedAt) {
    acc.activatedAt = now;
    const durationHours = acc.durationHours || (acc.durationDays ? acc.durationDays * 24 : 720);
    acc.expiresAt = now + (durationHours * 60 * 60 * 1000);
  }

  // 4. DEVICE BINDING (HWID Lock)
  if (!acc.hwid && hwidParam && hwidParam !== 'UNKNOWN_HWID') {
    acc.hwid = hwidParam;
  } else if (acc.hwid && hwidParam && hwidParam !== 'UNKNOWN_HWID' && acc.hwid !== hwidParam) {
    // If device locked to different HWID
    return sendResponse(false, 'failed', '🔒 Device Locked! This account is registered on another device. Contact Admin to reset HWID.');
  }

  acc.status = 'active';
  saveKeys(accounts);

  const remainingSeconds = Math.max(0, Math.floor((acc.expiresAt - now) / 1000));
  const remainingHours = Math.floor(remainingSeconds / 3600);

  // Return status: "enable" so OOOO000.smali passes check: equals("enable") -> TRUE!
  return sendResponse(true, 'enable', `✅ AUTHENTICATED! VIP Active (${remainingHours}h remaining)`, {
    username: acc.username,
    durationDays: acc.durationDays || 30,
    durationHours: acc.durationHours || 720,
    activatedAt: acc.activatedAt,
    expiresAt: acc.expiresAt,
    remainingSeconds: remainingSeconds,
    hwidBound: acc.hwid
  });
};
