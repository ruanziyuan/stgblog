-- ============================================
-- STGBLOG v5.0 Migration (新增)
-- 在 Supabase SQL Editor 中执行
-- ============================================

-- 1. 私信置顶表
CREATE TABLE IF NOT EXISTS dm_pins (
  id BIGSERIAL PRIMARY KEY,
  username TEXT NOT NULL,
  pinned_user TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(username, pinned_user)
);
CREATE INDEX IF NOT EXISTS idx_dm_pins_user ON dm_pins(username);

ALTER TABLE dm_pins ENABLE ROW LEVEL SECURITY;
CREATE POLICY "dm_pins_select" ON dm_pins FOR SELECT USING (true);
CREATE POLICY "dm_pins_insert" ON dm_pins FOR INSERT WITH CHECK (true);
CREATE POLICY "dm_pins_delete" ON dm_pins FOR DELETE USING (true);

-- 2. 为 dm_messages 添加复合索引 (优化列表查询)
CREATE INDEX IF NOT EXISTS idx_dm_messages_sender_created ON dm_messages(sender, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_dm_messages_receiver_created ON dm_messages(receiver, created_at DESC);
