const { 
  DEFAULT_ADMIN_KEY, 
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
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // GET: Publicly accessible by APKs and Reseller portal
  if (req.method === 'GET') {
    const ann = await loadAnnouncementAsync();
    return res.status(200).json({
      success: true,
      announcement: ann
    });
  }

  // POST: Admin only to update announcement
  if (req.method === 'POST') {
    if (!verifyAdminAuth(req)) {
      return res.status(401).json({ success: false, message: 'Unauthorized: Admin required' });
    }

    const { title, message, active } = req.body || {};
    const updated = await saveAnnouncementAsync({
      title: (title || 'SYSTEM NOTICE').trim(),
      message: (message || '').trim(),
      active: active !== undefined ? Boolean(active) : true,
      createdAt: Date.now()
    });

    return res.status(200).json({
      success: true,
      message: 'Announcement updated successfully!',
      announcement: updated
    });
  }

  return res.status(405).json({ success: false, message: 'Method not allowed' });
};
