-- ============================================
-- STGBLOG v4.0 Migration
-- 在 Supabase SQL Editor 中执行此脚本
-- ============================================

-- 1. posts 表新增字段
ALTER TABLE posts ADD COLUMN IF NOT EXISTS reposts INTEGER DEFAULT 0;
ALTER TABLE posts ADD COLUMN IF NOT EXISTS repost_of BIGINT;
ALTER TABLE posts ADD COLUMN IF NOT EXISTS quote_of BIGINT;
ALTER TABLE posts ADD COLUMN IF NOT EXISTS edited BOOLEAN DEFAULT FALSE;
CREATE INDEX IF NOT EXISTS idx_posts_repost_of ON posts(repost_of);
CREATE INDEX IF NOT EXISTS idx_posts_quote_of ON posts(quote_of);

-- 2. dm_messages 表加密字段 + 已读
ALTER TABLE dm_messages ADD COLUMN IF NOT EXISTS encrypted BOOLEAN DEFAULT FALSE;
ALTER TABLE dm_messages ADD COLUMN IF NOT EXISTS ciphertext TEXT;
ALTER TABLE dm_messages ADD COLUMN IF NOT EXISTS iv TEXT;
ALTER TABLE dm_messages ADD COLUMN IF NOT EXISTS sender_pubkey TEXT;
ALTER TABLE dm_messages ADD COLUMN IF NOT EXISTS receiver_pubkey TEXT;
ALTER TABLE dm_messages ADD COLUMN IF NOT EXISTS read BOOLEAN DEFAULT FALSE;
CREATE INDEX IF NOT EXISTS idx_dm_messages_read ON dm_messages(receiver, read);

-- 3. 用户表扩展
ALTER TABLE users ADD COLUMN IF NOT EXISTS bio TEXT DEFAULT '';
ALTER TABLE users ADD COLUMN IF NOT EXISTS pubkey TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS dm_privacy TEXT DEFAULT 'open';
ALTER TABLE users ADD COLUMN IF NOT EXISTS dm_key TEXT;

-- 4. 关注关系表
CREATE TABLE IF NOT EXISTS follows (
  id BIGSERIAL PRIMARY KEY,
  follower TEXT NOT NULL,
  following TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(follower, following)
);
CREATE INDEX IF NOT EXISTS idx_follows_follower ON follows(follower);
CREATE INDEX IF NOT EXISTS idx_follows_following ON follows(following);

-- 5. 通知表
CREATE TABLE IF NOT EXISTS notifications (
  id BIGSERIAL PRIMARY KEY,
  user_to TEXT NOT NULL,
  user_from TEXT NOT NULL,
  type TEXT NOT NULL,
  post_id BIGINT,
  comment_id BIGINT,
  read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_notifications_user_to ON notifications(user_to);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(user_to, read);
CREATE INDEX IF NOT EXISTS idx_notifications_created ON notifications(created_at DESC);

-- 6. 群聊表
CREATE TABLE IF NOT EXISTS group_chats (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  creator TEXT NOT NULL,
  invite_code TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS group_members (
  id BIGSERIAL PRIMARY KEY,
  group_id BIGINT REFERENCES group_chats(id) ON DELETE CASCADE,
  username TEXT NOT NULL,
  role TEXT DEFAULT 'member',
  encrypted_key TEXT,
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(group_id, username)
);
CREATE INDEX IF NOT EXISTS idx_group_members_group ON group_members(group_id);
CREATE INDEX IF NOT EXISTS idx_group_members_user ON group_members(username);

CREATE TABLE IF NOT EXISTS group_messages (
  id BIGSERIAL PRIMARY KEY,
  group_id BIGINT REFERENCES group_chats(id) ON DELETE CASCADE,
  sender TEXT NOT NULL,
  content TEXT,
  encrypted BOOLEAN DEFAULT FALSE,
  ciphertext TEXT,
  iv TEXT,
  sender_pubkey TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_group_messages_group ON group_messages(group_id, created_at);

-- 7. RLS 策略
ALTER TABLE follows ENABLE ROW LEVEL SECURITY;
CREATE POLICY "follows_select" ON follows FOR SELECT USING (true);
CREATE POLICY "follows_insert" ON follows FOR INSERT WITH CHECK (true);
CREATE POLICY "follows_delete" ON follows FOR DELETE USING (true);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "notif_select" ON notifications FOR SELECT USING (true);
CREATE POLICY "notif_insert" ON notifications FOR INSERT WITH CHECK (true);
CREATE POLICY "notif_update" ON notifications FOR UPDATE USING (true);
CREATE POLICY "notif_delete" ON notifications FOR DELETE USING (true);

ALTER TABLE group_chats ENABLE ROW LEVEL SECURITY;
CREATE POLICY "group_chats_select" ON group_chats FOR SELECT USING (true);
CREATE POLICY "group_chats_insert" ON group_chats FOR INSERT WITH CHECK (true);
CREATE POLICY "group_chats_delete" ON group_chats FOR DELETE USING (true);

ALTER TABLE group_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "group_members_select" ON group_members FOR SELECT USING (true);
CREATE POLICY "group_members_insert" ON group_members FOR INSERT WITH CHECK (true);
CREATE POLICY "group_members_delete" ON group_members FOR DELETE USING (true);

ALTER TABLE group_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "group_messages_select" ON group_messages FOR SELECT USING (true);
CREATE POLICY "group_messages_insert" ON group_messages FOR INSERT WITH CHECK (true);
