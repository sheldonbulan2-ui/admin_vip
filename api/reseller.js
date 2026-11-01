const crypto = require('crypto');
const { 
  loadAccountsAsync, 
  saveAccountAsync, 
  loadResellersAsync, 
  saveResellerAsync,
  isSupabaseConfigured 
} = require('../lib/db');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Reseller-Token');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const body = req.body || {};
  const action = body.action || req.query.action || '';
  const resellers = await loadResellersAsync();
  const accounts = await loadAccountsAsync();
  const now = Date.now();

  // 1. RESELLER LOGIN
  if (action === 'login') {
    const { username, password } = body;
    if (!username || !password) {
      return res.status(400).json({ success: false, message: 'Username and password required' });
    }

    const cleanUser = username.trim().toLowerCase();
    const cleanPass = password.trim();

    const reseller = resellers.find(r => r.username.toLowerCase() === cleanUser && r.password === cleanPass);
    if (!reseller) {
      return res.status(401).json({ success: false, message: '❌ Invalid Reseller credentials!' });
    }

    // Generate session token (Base64 encoding reseller:id:timestamp)
    const token = Buffer.from(`${reseller.id}:${reseller.username}:${now}`).toString('base64');

    return res.status(200).json({
      success: true,
      message: `Welcome back, Agent ${reseller.username}!`,
      token: token,
      reseller: {
        id: reseller.id,
        username: reseller.username,
        credits: reseller.credits || 0,
        notes: reseller.notes
      }
    });
  }

  // Helper: Verify Reseller Token from header or body
  function getAuthenticatedReseller() {
    const authHeader = req.headers['authorization'] || '';
    const customHeader = req.headers['x-reseller-token'] || '';
    let tokenStr = body.token || req.query.token || customHeader;

    if (!tokenStr && authHeader.startsWith('Bearer ')) {
      tokenStr = authHeader.substring(7);
    }

    if (!tokenStr) return null;

    try {
      const decoded = Buffer.from(tokenStr, 'base64').toString('utf8');
      const [resellerId, username] = decoded.split(':');
      return resellers.find(r => r.id === resellerId && r.username.toLowerCase() === username.toLowerCase());
    } catch (e) {
      return null;
    }
  }

  const currentReseller = getAuthenticatedReseller();
  if (!currentReseller) {
    return res.status(401).json({ success: false, message: 'Unauthorized: Valid Reseller login required' });
  }

  // 2. GET RESELLER PROFILE & CUSTOMER ACCOUNTS
  if (action === 'get_dashboard' || req.method === 'GET') {
    const myAccounts = accounts.filter(a => a.resellerId === currentReseller.id);
    return res.status(200).json({
      success: true,
      reseller: {
        id: currentReseller.id,
        username: currentReseller.username,
        credits: currentReseller.credits || 0,
        notes: currentReseller.notes
      },
      stats: {
        totalGenerated: myAccounts.length,
        active: myAccounts.filter(a => a.status === 'active').length,
        expired: myAccounts.filter(a => a.status === 'expired').length
      },
      accounts: myAccounts.map(a => ({
        ...a,
        remainingSeconds: a.expiresAt ? Math.max(0, Math.floor((a.expiresAt - now) / 1000)) : null
      }))
    });
  }

  // 3. GENERATE VIP ACCOUNT FOR CUSTOMER (Deducts 1 Credit)
  if (action === 'create_customer_vip') {
    if ((currentReseller.credits || 0) < 1) {
      return res.status(403).json({
        success: false,
        message: '❌ Insufficient credits! Contact the Main Admin to reload credits.'
      });
    }

    const { username, password, durationDays, durationHours, customerName } = body;

    // Auto-generate credentials if empty
    const finalUser = (username || ('vip_' + crypto.randomBytes(3).toString('hex'))).trim().toLowerCase();
    const finalPass = (password || ('pass' + Math.floor(1000 + Math.random() * 9000))).trim();

    if (accounts.some(a => a.username.toLowerCase() === finalUser)) {
      return res.status(400).json({ success: false, message: `Username "${finalUser}" is already taken!` });
    }

    const dDays = parseInt(durationDays) || 30;
    const dHours = parseInt(durationHours) || (dDays * 24);

    const newVip = {
      id: 'acc_' + crypto.randomBytes(6).toString('hex'),
      username: finalUser,
      password: finalPass,
      durationDays: dDays,
      durationHours: dHours,
      status: 'active',
      hwid: null,
      notes: (customerName ? `Buyer: ${customerName}` : 'Sold by Reseller ' + currentReseller.username),
      resellerId: currentReseller.id,
      createdAt: now,
      activatedAt: null,
      expiresAt: null,
      lastHeartbeat: null
    };

    // Deduct 1 credit
    currentReseller.credits -= 1;
    await saveResellerAsync(currentReseller);
    await saveAccountAsync(newVip);

    return res.status(201).json({
      success: true,
      message: `✅ Created VIP for ${finalUser}! 1 credit deducted. Remaining credits: ${currentReseller.credits}`,
      account: newVip,
      remainingCredits: currentReseller.credits,
      clientShareText: `🎱 *NINJA VIP AIM ASSIST ACCESS*\n👤 *Username:* ${newVip.username}\n🔑 *Password:* ${newVip.password}\n⏳ *Duration:* ${dDays} Days\n📥 *Download APK:* https://adminvip-nine.vercel.app/Ninja-crack.apk\n⚠️ *Device Lock:* First phone login binds permanently.`
    });
  }

  // 4. RESET CUSTOMER HWID (DEVICE UNLOCK)
  if (action === 'reset_customer_hwid') {
    const { accountId } = body;
    const target = accounts.find(a => a.id === accountId && a.resellerId === currentReseller.id);
    if (!target) {
      return res.status(404).json({ success: false, message: 'Account not found under your agency' });
    }

    target.hwid = null;
    await saveAccountAsync(target);
    return res.status(200).json({ success: true, message: `HWID reset for ${target.username}. Customer can now bind a new device!` });
  }

  return res.status(400).json({ success: false, message: 'Unknown reseller action' });
};
