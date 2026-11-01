-- ========================================================
-- NINJA VIP CONTROL - SUPABASE DATABASE SCHEMA
-- Run this script in your Supabase SQL Editor
-- ========================================================

-- 1. Create VIP Accounts Table
CREATE TABLE IF NOT EXISTS vip_accounts (
  id TEXT PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  duration_days INT DEFAULT 30,
  duration_hours INT DEFAULT 720,
  status TEXT DEFAULT 'active',
  hwid TEXT,
  notes TEXT,
  reseller_id TEXT,
  created_at BIGINT,
  activated_at BIGINT,
  expires_at BIGINT,
  last_heartbeat BIGINT
);

-- Index for instant lookup on login
CREATE INDEX IF NOT EXISTS idx_vip_accounts_username ON vip_accounts (LOWER(username));

-- 2. Create VIP Resellers Table
CREATE TABLE IF NOT EXISTS vip_resellers (
  id TEXT PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  credits INT DEFAULT 10,
  notes TEXT,
  created_at BIGINT
);

-- 3. Create VIP Announcements Table
CREATE TABLE IF NOT EXISTS vip_announcements (
  id TEXT PRIMARY KEY DEFAULT 'global_broadcast',
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  active BOOLEAN DEFAULT true,
  created_at BIGINT
);

-- 4. Insert Initial Default VIP Accounts & Announcement
INSERT INTO vip_accounts (id, username, password, duration_days, duration_hours, status, notes, created_at)
VALUES 
  ('acc_vip_default', 'vipuser', 'vip123password', 30, 720, 'active', 'Official 30-Day VIP Pass', EXTRACT(EPOCH FROM NOW())::BIGINT * 1000),
  ('acc_master_default', 'masteradmin', 'ninja2026password', 3650, 87600, 'active', 'Lifetime VIP Access', EXTRACT(EPOCH FROM NOW())::BIGINT * 1000)
ON CONFLICT (username) DO NOTHING;

INSERT INTO vip_announcements (id, title, message, active, created_at)
VALUES ('global_broadcast', 'SYSTEM NOTICE', 'Ninja Aim Assist v2.4 Online! Anti-ban safe.', true, EXTRACT(EPOCH FROM NOW())::BIGINT * 1000)
ON CONFLICT (id) DO NOTHING;

-- 5. Enable Row Level Security (RLS) & Public Policies
ALTER TABLE vip_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE vip_resellers ENABLE ROW LEVEL SECURITY;
ALTER TABLE vip_announcements ENABLE ROW LEVEL SECURITY;

-- Allow serverless api with anon / service role keys full access
CREATE POLICY "Allow server access to vip_accounts" ON vip_accounts FOR ALL USING (true);
CREATE POLICY "Allow server access to vip_resellers" ON vip_resellers FOR ALL USING (true);
CREATE POLICY "Allow server access to vip_announcements" ON vip_announcements FOR ALL USING (true);
