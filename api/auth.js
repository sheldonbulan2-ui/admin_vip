const { DEFAULT_ADMIN_KEY } = require('../lib/db');

module.exports = (req, res) => {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method Not Allowed' });
  }

  const { adminKey } = req.body || {};

  if (!adminKey || typeof adminKey !== 'string') {
    return res.status(400).json({ success: false, message: 'Admin Key is required' });
  }

  // Strictly check admin key (no random keys allowed!)
  const expectedKey = (process.env.ADMIN_KEY || DEFAULT_ADMIN_KEY).trim();
  if (adminKey.trim() !== expectedKey) {
    return res.status(401).json({
      success: false,
      message: '❌ Invalid Admin Key! Only authenticated administrators are allowed.'
    });
  }

  // Generate session token
  const token = Buffer.from(`admin:${adminKey.trim()}:${Date.now()}`).toString('base64');

  return res.status(200).json({
    success: true,
    message: 'Authentication successful. Welcome Admin!',
    token: token
  });
};
