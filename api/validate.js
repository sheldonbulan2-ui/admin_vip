const { loadKeys, saveKeys } = require('../lib/db');

module.exports = (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-HWID');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Support both POST (standard APK) and GET (quick test)
  const keyParam = (req.method === 'POST' ? req.body?.key : req.query?.key) || '';
  const hwidParam = (req.method === 'POST' ? (req.body?.hwid || req.headers['x-hwid']) : req.query?.hwid) || 'UNKNOWN_HWID';

  if (!keyParam || typeof keyParam !== 'string') {
    return res.status(400).json({
      valid: false,
      status: 'failed',
      message: '❌ License key is required'
    });
  }

  const cleanKey = keyParam.trim().toUpperCase();
  const keys = loadKeys();
  const keyItem = keys.find(k => k.key.toUpperCase() === cleanKey);

  // 1. REJECT RANDOM / UNREGISTERED KEYS IMMEDIATELY
  if (!keyItem) {
    return res.status(200).json({
      valid: false,
      status: 'failed',
      message: '❌ Invalid License Key! Key was not issued by Admin.'
    });
  }

  const now = Date.now();

  // 2. CHECK REVOKED STATUS
  if (keyItem.status === 'revoked') {
    return res.status(200).json({
      valid: false,
      status: 'failed',
      message: '🚫 This license key has been revoked or banned by Admin.'
    });
  }

  // 3. CHECK ALREADY EXPIRED
  if (keyItem.status === 'expired' || (keyItem.expiresAt && now >= keyItem.expiresAt)) {
    keyItem.status = 'expired';
    saveKeys(keys);
    return res.status(200).json({
      valid: false,
      status: 'failed',
      expired: true,
      message: '⚠️ License Expired! Di na makakapasok, need na ulit ng new key mula sa Admin.',
      expiresAt: keyItem.expiresAt
    });
  }

  // 4. FIRST ACTIVATION (Bind HWID and compute exact expiration from admin duration)
  if (!keyItem.activatedAt) {
    keyItem.activatedAt = now;
    const durationMs = (keyItem.durationHours || 24) * 3600 * 1000;
    keyItem.expiresAt = now + durationMs;
    keyItem.hwid = hwidParam;
    keyItem.status = 'active';
    saveKeys(keys);
  } else {
    // 5. HWID DEVICE LOCK CHECK (Single device security)
    if (keyItem.hwid && hwidParam !== 'UNKNOWN_HWID' && keyItem.hwid !== hwidParam) {
      return res.status(200).json({
        valid: false,
        status: 'failed',
        message: '🔒 Device Mismatch! Naka-bind na ang key na ito sa ibang cellphone. Humingi ng HWID reset sa Admin.'
      });
    }

    // Bind HWID if it was previously reset
    if (!keyItem.hwid && hwidParam !== 'UNKNOWN_HWID') {
      keyItem.hwid = hwidParam;
      saveKeys(keys);
    }
  }

  // 6. CALCULATE REMAINING TIME
  const remainingSeconds = Math.max(0, Math.floor((keyItem.expiresAt - now) / 1000));
  if (remainingSeconds <= 0) {
    keyItem.status = 'expired';
    saveKeys(keys);
    return res.status(200).json({
      valid: false,
      status: 'failed',
      expired: true,
      message: '⚠️ License Expired! Need na ng bagong key mula sa Admin.'
    });
  }

  // 7. PASS AUTHENTICATION!
  return res.status(200).json({
    valid: true,
    status: 'pass',
    key: keyItem.key,
    durationDays: keyItem.durationDays,
    durationHours: keyItem.durationHours,
    activatedAt: keyItem.activatedAt,
    expiresAt: keyItem.expiresAt,
    remainingSeconds: remainingSeconds,
    hwid: keyItem.hwid,
    notes: keyItem.notes,
    message: '✅ Key Verified & Authenticated! Enjoy VIP Aim Assist.'
  });
};
