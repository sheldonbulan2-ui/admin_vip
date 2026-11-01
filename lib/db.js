const fs = require('fs');
const path = require('path');

// Default Master Admin Secret Key (Can be overridden by Vercel Environment Variable ADMIN_KEY)
const DEFAULT_ADMIN_KEY = process.env.ADMIN_KEY || "NINJA-ADMIN-SECRET-2026";

// Path for persistence (supports Vercel serverless /tmp writable directory or local)
const DB_FILE = process.env.VERCEL ? path.join('/tmp', 'ninja_accounts.json') : path.join(__dirname, '..', 'accounts.json');

// In-memory cache to ensure speed across serverless invocations
let accountsStore = null;

function getDefaultAccounts() {
  const now = Date.now();
  return [
    {
      id: "acc_demo_1",
      username: "vipuser",
      password: "vip123password",
      durationDays: 30,
      durationHours: 720,
      status: "active", // active, expired, revoked
      hwid: null,
      notes: "Demo 30 Days VIP",
      createdAt: now,
      activatedAt: null,
      expiresAt: null
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
      expiresAt: null
    }
  ];
}

function loadKeys() {
  if (accountsStore) return accountsStore;
  try {
    if (fs.existsSync(DB_FILE)) {
      const data = fs.readFileSync(DB_FILE, 'utf8');
      accountsStore = JSON.parse(data);
      return accountsStore;
    }
  } catch (err) {
    console.warn("Could not read accounts file, using defaults:", err.message);
  }
  accountsStore = getDefaultAccounts();
  saveKeys(accountsStore);
  return accountsStore;
}

function saveKeys(accounts) {
  accountsStore = accounts;
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(accounts, null, 2), 'utf8');
  } catch (err) {
    console.warn("Could not write accounts file:", err.message);
  }
}

module.exports = {
  DEFAULT_ADMIN_KEY,
  loadKeys,
  saveKeys
};
