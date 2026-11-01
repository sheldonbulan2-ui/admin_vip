const fs = require('fs');
const path = require('path');

// Default Master Admin Secret Key (Can be overridden by Vercel Environment Variable ADMIN_KEY)
const DEFAULT_ADMIN_KEY = process.env.ADMIN_KEY || "NINJA-ADMIN-SECRET-2026";

// Path for persistence (supports Vercel serverless /tmp writable directory or local)
const DB_FILE = process.env.VERCEL ? path.join('/tmp', 'ninja_keys.json') : path.join(__dirname, '..', 'keys.json');

// In-memory cache to ensure speed across serverless invocations
let keysStore = null;

function getDefaultKeys() {
  const now = Date.now();
  return [
    {
      id: "key_demo_1",
      key: "NINJA-VIP-DEMO-30D",
      durationDays: 30,
      durationHours: 720,
      status: "active", // active, expired, revoked
      hwid: null,
      notes: "Demo 30 Days Key",
      createdAt: now,
      activatedAt: null,
      expiresAt: null
    },
    {
      id: "key_demo_2",
      key: "NINJA-LIFETIME-PASS",
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
  if (keysStore) return keysStore;
  try {
    if (fs.existsSync(DB_FILE)) {
      const data = fs.readFileSync(DB_FILE, 'utf8');
      keysStore = JSON.parse(data);
      return keysStore;
    }
  } catch (err) {
    console.warn("Could not read keys file, using defaults:", err.message);
  }
  keysStore = getDefaultKeys();
  saveKeys(keysStore);
  return keysStore;
}

function saveKeys(keys) {
  keysStore = keys;
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(keys, null, 2), 'utf8');
  } catch (err) {
    console.warn("Could not write keys file:", err.message);
  }
}

module.exports = {
  DEFAULT_ADMIN_KEY,
  loadKeys,
  saveKeys
};
