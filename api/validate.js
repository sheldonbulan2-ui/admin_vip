const { loadKeys, saveKeys } = require('../lib/db');

module.exports = (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-HWID');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Support both JSON body and URL-encoded form parameters
  const b = req.body || {};
  const q = req.query || {};

  const usernameParam = b['username-activation'] || b.username || q['username-activation'] || q.username || '';
  const passwordParam = b['password-activation'] || b.password || q['password-activation'] || q.password || '';
  const keyParam = b.key || q.key || '';
  const hwidParam = b.hwid || req.headers['x-hwid'] || q.hwid || 'UNKNOWN_HWID';

  const accounts = loadKeys();
  let acc = null;

  function sendResponse(valid, status, message, extra = {}) {
    const payload = {
      status: status, // "enable" on pass, "failed" on reject
      valid: valid,
      message: message,
      ...extra
    };

    // If request comes from APK (or wants Array format), return array [ payload ]
    // Also include properties directly so JSON object parsers work seamlessly
    return res.status(200).json([ payload ]);
  }

  if (usernameParam && passwordParam) {
    const cleanUser = String(usernameParam).trim().toLowerCase();
    const cleanPass = String(passwordParam).trim();
    acc = accounts.find(a => a.username && a.username.toLowerCase() === cleanUser);

    if (!acc) {
      return sendResponse(false, 'failed', '❌ Invalid Username! Hindi rehistrado ang account sa Admin.');
    }

    if (acc.password !== cleanPass) {
      return sendResponse(false, 'failed', '❌ Maling Password! Hindi tumutugma ang password.');
    }
  } else if (keyParam) {
    const cleanKey = String(keyParam).trim().toUpperCase();
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
    return sendResponse(false, 'failed', '🚫 Ang VIP account na ito ay revoked ng Admin.');
  }

  // 2. CHECK ALREADY EXPIRED
  if (acc.status === 'expired' || (acc.expiresAt && now >= acc.expiresAt)) {
    acc.status = 'expired';
    saveKeys(accounts);
    return sendResponse(false, 'failed', '⚠️ Expired na ang VIP account! Mag-renew sa Admin.', { expired: true, expiresAt: acc.expiresAt });
  }

  // 3. FIRST ACTIVATION (Bind HWID and compute exact expiration from duration)
  if (!acc.activatedAt) {
    acc.activatedAt = now;
    const durationMs = (acc.durationHours || (acc.durationDays ? acc.durationDays * 24 : 24)) * 3600 * 1000;
    acc.expiresAt = now + durationMs;
    acc.hwid = hwidParam;
    acc.status = 'active';
    saveKeys(accounts);
  } else {
    // 4. HWID DEVICE LOCK CHECK (Single phone security)
    if (acc.hwid && hwidParam !== 'UNKNOWN_HWID' && acc.hwid !== hwidParam) {
      return sendResponse(false, 'failed', '🔒 Device Mismatch! Naka-bind ang account na ito sa ibang cellphone. Humingi ng HWID reset sa Admin.');
    }

    if (!acc.hwid && hwidParam !== 'UNKNOWN_HWID') {
      acc.hwid = hwidParam;
      saveKeys(accounts);
    }
  }

  // 5. CALCULATE REMAINING TIME
  const remainingSeconds = Math.max(0, Math.floor((acc.expiresAt - now) / 1000));
  if (remainingSeconds <= 0) {
    acc.status = 'expired';
    saveKeys(accounts);
    return sendResponse(false, 'failed', '⚠️ VIP Account Expired! Need ng bagong account o renewal.', { expired: true });
  }

  // 6. PASS AUTHENTICATION! (status: "enable" unlocks the APK)
  return sendResponse(true, 'enable', `✅ AUTHENTICATED! VIP Active (${Math.ceil(remainingSeconds / 3600)}h remaining)`, {
    username: acc.username,
    durationDays: acc.durationDays,
    durationHours: acc.durationHours,
    activatedAt: acc.activatedAt,
    expiresAt: acc.expiresAt,
    remainingSeconds: remainingSeconds,
    hwidBound: acc.hwid
  });
};
