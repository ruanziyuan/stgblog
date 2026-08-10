-- ============================================
-- Keep-Alive 表：防止 Supabase 免费项目被自动暂停
-- 在 Supabase SQL Editor 中执行
-- ============================================

CREATE TABLE IF NOT EXISTS keepalive (
  id BIGSERIAL PRIMARY KEY,
  source TEXT DEFAULT 'github-actions',
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 允许 anon 插入（仅限此表）
ALTER TABLE keepalive ENABLE ROW LEVEL SECURITY;

CREATE POLICY "allow_anon_insert_keepalive" ON keepalive
  FOR INSERT TO anon
  WITH CHECK (true);

CREATE POLICY "allow_anon_select_keepalive" ON keepalive
  FOR SELECT TO anon
  USING (true);

CREATE POLICY "allow_anon_delete_keepalive" ON keepalive
  FOR DELETE TO anon
  USING (true);

-- 索引便于清理
CREATE INDEX IF NOT EXISTS idx_keepalive_created ON keepalive(created_at);

COMMENT ON TABLE keepalive IS '每日保活写入，防止 Supabase 免费项目因不活跃被暂停';
