-- ============================================
-- STGBLOG v6.0 Migration - 群聊管理功能增强
-- 在 Supabase SQL Editor 中执行此脚本
-- ============================================

-- 1. group_chats 添加 updated_at 字段（用于修改群名等操作的时间记录）
ALTER TABLE group_chats ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- 2. 添加 group_chats 的 UPDATE 策略（允许管理员修改群名）
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'group_chats_update' AND tablename = 'group_chats'
  ) THEN
    CREATE POLICY "group_chats_update" ON group_chats FOR UPDATE USING (true);
  END IF;
END $$;

-- 3. 添加 group_members 的 UPDATE 策略（允许管理员修改成员角色）
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'group_members_update' AND tablename = 'group_members'
  ) THEN
    CREATE POLICY "group_members_update" ON group_members FOR UPDATE USING (true);
  END IF;
END $$;

-- 4. 确保 group_messages 也有 UPDATE 策略（用于编辑消息等）
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'group_messages_update' AND tablename = 'group_messages'
  ) THEN
    CREATE POLICY "group_messages_update" ON group_messages FOR UPDATE USING (true);
  END IF;
END $$;
