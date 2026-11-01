const { loadAccountsAsync, saveAccountAsync } = require('../lib/db');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-HWID');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const q = req.query || {};
  const b = req.body || {};

  const username = (b.username || q.username || '').toString().trim().toLowerCase();
  const hwid = (b.hwid || q.hwid || req.headers['x-hwid'] || '').toString().trim();

  if (!username) {
    return res.status(400).json({ valid: false, kick: true, message: 'Missing username' });
  }

  const accounts = await loadAccountsAsync();
  const acc = accounts.find(a => a.username && a.username.toLowerCase() === username);

  if (!acc) {
    return res.status(200).json({ valid: false, kick: true, message: 'Account not found. Access revoked.' });
  }

  const now = Date.now();

  // Check Revoked
  if (acc.status === 'revoked') {
    return res.status(200).json({ valid: false, kick: true, message: 'VIP Account was revoked by Admin!' });
  }

  // Check Expired
  if (acc.status === 'expired' || (acc.expiresAt && now >= acc.expiresAt)) {
    acc.status = 'expired';
    await saveAccountAsync(acc);
    return res.status(200).json({ valid: false, kick: true, message: 'VIP Duration has expired!' });
  }

  // Check HWID Mismatch
  if (acc.hwid && hwid && hwid !== 'UNKNOWN_HWID' && acc.hwid !== hwid) {
    return res.status(200).json({ valid: false, kick: true, message: 'HWID mismatch detected! Device locked.' });
  }

  // Update heartbeat
  acc.lastHeartbeat = now;
  await saveAccountAsync(acc);

  const remainingSeconds = Math.max(0, Math.floor((acc.expiresAt - now) / 1000));

  return res.status(200).json({
    valid: true,
    kick: false,
    remainingSeconds: remainingSeconds,
    status: 'active'
  });
};
