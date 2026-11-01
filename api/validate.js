const { loadKeys, saveKeys } = require('../lib/db');

module.exports = (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-HWID');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Extract credentials from POST body or GET query
  const usernameParam = (req.method === 'POST' ? req.body?.username : req.query?.username) || '';
  const passwordParam = (req.method === 'POST' ? req.body?.password : req.query?.password) || '';
  const hwidParam = (req.method === 'POST' ? (req.body?.hwid || req.headers['x-hwid']) : req.query?.hwid) || 'UNKNOWN_HWID';

  // Support legacy 'key' fallback if somebody still uses it
  const keyParam = (req.method === 'POST' ? req.body?.key : req.query?.key) || '';

  const accounts = loadKeys();
  let acc = null;

  if (usernameParam && passwordParam) {
    const cleanUser = usernameParam.trim().toLowerCase();
    const cleanPass = passwordParam.trim();
    acc = accounts.find(a => a.username && a.username.toLowerCase() === cleanUser);

    if (!acc) {
      return res.status(200).json({
        valid: false,
        status: 'failed',
        message: '❌ Invalid Username! Hindi rehistrado ang account na ito sa Admin.'
      });
    }

    if (acc.password !== cleanPass) {
      return res.status(200).json({
        valid: false,
        status: 'failed',
        message: '❌ Maling Password! Hindi tumutugma ang password na inilagay.'
      });
    }
  } else if (keyParam) {
    const cleanKey = keyParam.trim().toUpperCase();
    acc = accounts.find(a => (a.key && a.key.toUpperCase() === cleanKey) || (a.username && a.username.toUpperCase() === cleanKey));
    if (!acc) {
      return res.status(200).json({
        valid: false,
        status: 'failed',
        message: '❌ Invalid License Key / Username! Not registered in Admin.'
      });
    }
  } else {
    return res.status(400).json({
      valid: false,
      status: 'failed',
      message: '❌ Username and Password are required!'
    });
  }

  const now = Date.now();

  // 1. CHECK REVOKED STATUS
  if (acc.status === 'revoked') {
    return res.status(200).json({
      valid: false,
      status: 'failed',
      message: '🚫 This VIP account has been revoked or banned by Admin.'
    });
  }

  // 2. CHECK ALREADY EXPIRED
  if (acc.status === 'expired' || (acc.expiresAt && now >= acc.expiresAt)) {
    acc.status = 'expired';
    saveKeys(accounts);
    return res.status(200).json({
      valid: false,
      status: 'failed',
      expired: true,
      message: '⚠️ VIP Account Expired! Di na makakapasok, need na ulit mag-renew sa Admin.',
      expiresAt: acc.expiresAt
    });
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
      return res.status(200).json({
        valid: false,
        status: 'failed',
        message: '🔒 Device Mismatch! Naka-bind ang account na ito sa ibang cellphone. Humingi ng HWID reset sa Admin.'
      });
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
    return res.status(200).json({
      valid: false,
      status: 'failed',
      expired: true,
      message: '⚠️ VIP Account Expired! Need na ng bagong account o renewal mula sa Admin.'
    });
  }

  // 6. PASS AUTHENTICATION!
  return res.status(200).json({
    valid: true,
    status: 'pass',
    username: acc.username,
    durationDays: acc.durationDays,
    durationHours: acc.durationHours,
    activatedAt: acc.activatedAt,
    expiresAt: acc.expiresAt,
    remainingSeconds: remainingSeconds,
    hwidBound: acc.hwid,
    message: `✅ AUTHENTICATED! VIP Active (${Math.ceil(remainingSeconds / 3600)}h remaining)`
  });
};
