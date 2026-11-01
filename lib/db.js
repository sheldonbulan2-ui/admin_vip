const fs = require('fs');
const path = require('path');

const DEFAULT_ADMIN_KEY = process.env.ADMIN_KEY || "NINJA-ADMIN-SECRET-2026";
const DB_FILE = process.env.VERCEL ? path.join('/tmp', 'ninja_accounts.json') : path.join(__dirname, '..', 'accounts.json');

// Supabase Configuration
const SUPABASE_URL = (process.env.SUPABASE_URL || '').replace(/\/$/, '');
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY || process.env.SUPABASE_ANON_KEY || '';

let accountsStore = null;
let resellersStore = null;
let announcementStore = null;

function isSupabaseConfigured() {
  return Boolean(SUPABASE_URL && SUPABASE_KEY);
}

function getDefaultAccounts() {
  const now = Date.now();
  return [
    {
      id: "acc_demo_1",
      username: "vipuser",
      password: "vip123password",
      durationDays: 30,
      durationHours: 720,
      status: "active",
      hwid: null,
      notes: "Demo 30 Days VIP",
      createdAt: now,
      activatedAt: null,
      expiresAt: null,
      lastHeartbeat: null
    },
    {
      id: "acc_demo_2",
      username: "masteradmin",
      password: "ninja2026password",
      durationDays: 3650,
      durationHours: 87600,
      status: "active",
      hwid: null,
      notes: "Lifetime VIP Pass",
      createdAt: now,
      activatedAt: null,
      expiresAt: null,
      lastHeartbeat: null
    }
  ];
}

function getDefaultResellers() {
  const now = Date.now();
  return [
    {
      id: "res_demo_1",
      username: "reseller1",
      password: "resellerpass123",
      credits: 20,
      notes: "Partner Reseller A",
      createdAt: now
    }
  ];
}

// Convert DB snake_case to JS camelCase
function mapDbAccountToJs(row) {
  if (!row) return null;
  return {
    id: row.id,
    username: row.username,
    password: row.password,
    durationDays: row.duration_days,
    durationHours: row.duration_hours,
    status: row.status,
    hwid: row.hwid,
    notes: row.notes,
    resellerId: row.reseller_id,
    createdAt: row.created_at,
    activatedAt: row.activated_at,
    expiresAt: row.expires_at,
    lastHeartbeat: row.last_heartbeat
  };
}

// Convert JS camelCase to DB snake_case
function mapJsAccountToDb(acc) {
  return {
    id: acc.id,
    username: acc.username,
    password: acc.password,
    duration_days: acc.durationDays,
    duration_hours: acc.durationHours,
    status: acc.status,
    hwid: acc.hwid,
    notes: acc.notes,
    reseller_id: acc.resellerId || null,
    created_at: acc.createdAt,
    activated_at: acc.activatedAt,
    expires_at: acc.expiresAt,
    last_heartbeat: acc.lastHeartbeat || null
  };
}

// ========================
// ASYNC SUPABASE DATA OPS
// ========================

async function loadAccountsAsync() {
  if (isSupabaseConfigured()) {
    try {
      const resp = await fetch(`${SUPABASE_URL}/rest/v1/vip_accounts?select=*`, {
        method: 'GET',
        headers: {
          'apikey': SUPABASE_KEY,
          'Authorization': `Bearer ${SUPABASE_KEY}`,
          'Content-Type': 'application/json'
        }
      });
      if (resp.ok) {
        const rows = await resp.json();
        if (Array.isArray(rows) && rows.length > 0) {
          accountsStore = rows.map(mapDbAccountToJs);
          saveLocalCache(accountsStore);
          return accountsStore;
        }
      } else {
        console.warn("Supabase fetch returned status:", resp.status);
      }
    } catch (e) {
      console.warn("Supabase fetch failed, using local cache:", e.message);
    }
  }

  return loadLocalAccounts();
}

async function saveAccountAsync(account) {
  // Update in-memory cache
  if (!accountsStore) accountsStore = loadLocalAccounts();
  const idx = accountsStore.findIndex(a => a.id === account.id || a.username.toLowerCase() === account.username.toLowerCase());
  if (idx >= 0) {
    accountsStore[idx] = { ...accountsStore[idx], ...account };
  } else {
    accountsStore.push(account);
  }
  saveLocalCache(accountsStore);

  // Sync to Supabase
  if (isSupabaseConfigured()) {
    try {
      const dbRow = mapJsAccountToDb(account);
      await fetch(`${SUPABASE_URL}/rest/v1/vip_accounts`, {
        method: 'POST',
        headers: {
          'apikey': SUPABASE_KEY,
          'Authorization': `Bearer ${SUPABASE_KEY}`,
          'Content-Type': 'application/json',
          'Prefer': 'resolution=merge-duplicates'
        },
        body: JSON.stringify(dbRow)
      });
    } catch (e) {
      console.warn("Could not sync account to Supabase:", e.message);
    }
  }
}

async function deleteAccountAsync(accountId) {
  if (!accountsStore) accountsStore = loadLocalAccounts();
  accountsStore = accountsStore.filter(a => a.id !== accountId);
  saveLocalCache(accountsStore);

  if (isSupabaseConfigured()) {
    try {
      await fetch(`${SUPABASE_URL}/rest/v1/vip_accounts?id=eq.${encodeURIComponent(accountId)}`, {
        method: 'DELETE',
        headers: {
          'apikey': SUPABASE_KEY,
          'Authorization': `Bearer ${SUPABASE_KEY}`
        }
      });
    } catch (e) {}
  }
}

function getDefaultAnnouncement() {
  return {
    id: "global_broadcast",
    title: "SYSTEM NOTICE",
    message: "Ninja Aim Assist v2.4 Online! Anti-ban safe.",
    active: true,
    createdAt: Date.now()
  };
}

// Resellers Async Ops
async function loadResellersAsync() {
  if (isSupabaseConfigured()) {
    try {
      const resp = await fetch(`${SUPABASE_URL}/rest/v1/vip_resellers?select=*`, {
        method: 'GET',
        headers: {
          'apikey': SUPABASE_KEY,
          'Authorization': `Bearer ${SUPABASE_KEY}`,
          'Content-Type': 'application/json'
        }
      });
      if (resp.ok) {
        const rows = await resp.json();
        if (Array.isArray(rows)) {
          resellersStore = rows;
          return resellersStore;
        }
      }
    } catch (e) {}
  }

  if (!resellersStore) resellersStore = getDefaultResellers();
  return resellersStore;
}

async function saveResellerAsync(reseller) {
  if (!resellersStore) resellersStore = getDefaultResellers();
  const idx = resellersStore.findIndex(r => r.id === reseller.id || r.username.toLowerCase() === reseller.username.toLowerCase());
  if (idx >= 0) {
    resellersStore[idx] = { ...resellersStore[idx], ...reseller };
  } else {
    resellersStore.push(reseller);
  }

  if (isSupabaseConfigured()) {
    try {
      await fetch(`${SUPABASE_URL}/rest/v1/vip_resellers`, {
        method: 'POST',
        headers: {
          'apikey': SUPABASE_KEY,
          'Authorization': `Bearer ${SUPABASE_KEY}`,
          'Content-Type': 'application/json',
          'Prefer': 'resolution=merge-duplicates'
        },
        body: JSON.stringify(reseller)
      });
    } catch (e) {}
  }
}

// Announcement Async Ops
async function loadAnnouncementAsync() {
  if (isSupabaseConfigured()) {
    try {
      const resp = await fetch(`${SUPABASE_URL}/rest/v1/vip_announcements?id=eq.global_broadcast&select=*`, {
        method: 'GET',
        headers: {
          'apikey': SUPABASE_KEY,
          'Authorization': `Bearer ${SUPABASE_KEY}`,
          'Content-Type': 'application/json'
        }
      });
      if (resp.ok) {
        const rows = await resp.json();
        if (Array.isArray(rows) && rows.length > 0) {
          announcementStore = {
            id: rows[0].id,
            title: rows[0].title,
            message: rows[0].message,
            active: rows[0].active,
            createdAt: rows[0].created_at
          };
          return announcementStore;
        }
      }
    } catch (e) {}
  }

  if (!announcementStore) announcementStore = getDefaultAnnouncement();
  return announcementStore;
}

async function saveAnnouncementAsync(ann) {
  announcementStore = {
    ...getDefaultAnnouncement(),
    ...ann,
    id: "global_broadcast"
  };

  if (isSupabaseConfigured()) {
    try {
      await fetch(`${SUPABASE_URL}/rest/v1/vip_announcements`, {
        method: 'POST',
        headers: {
          'apikey': SUPABASE_KEY,
          'Authorization': `Bearer ${SUPABASE_KEY}`,
          'Content-Type': 'application/json',
          'Prefer': 'resolution=merge-duplicates'
        },
        body: JSON.stringify({
          id: 'global_broadcast',
          title: announcementStore.title,
          message: announcementStore.message,
          active: Boolean(announcementStore.active),
          created_at: announcementStore.createdAt || Date.now()
        })
      });
    } catch (e) {}
  }
  return announcementStore;
}

// ========================
// SYNC LOCAL FILE FALLBACK
// ========================

function loadLocalAccounts() {
  if (accountsStore) return accountsStore;
  try {
    if (fs.existsSync(DB_FILE)) {
      const data = fs.readFileSync(DB_FILE, 'utf8');
      accountsStore = JSON.parse(data);
      return accountsStore;
    }
  } catch (err) {}
  accountsStore = getDefaultAccounts();
  saveLocalCache(accountsStore);
  return accountsStore;
}

function saveLocalCache(accounts) {
  accountsStore = accounts;
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(accounts, null, 2), 'utf8');
  } catch (err) {}
}

module.exports = {
  DEFAULT_ADMIN_KEY,
  isSupabaseConfigured,
  loadKeys: loadLocalAccounts,
  saveKeys: saveLocalCache,
  loadAccountsAsync,
  saveAccountAsync,
  deleteAccountAsync,
  loadResellersAsync,
  saveResellerAsync,
  loadAnnouncementAsync,
  saveAnnouncementAsync
};
