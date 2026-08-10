-- ============================================
-- STGBLOG v8 安全迁移：密码 bcrypt 哈希
-- 在 Supabase SQL Editor 中执行此脚本
-- ============================================

-- 1. 启用 pgcrypto 扩展（用于 bcrypt）
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 2. 添加哈希字段
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash TEXT;

-- 3. 把现有明文密码转为 bcrypt 哈希
--    （仅处理还没有 password_hash 的行）
UPDATE users
SET password_hash = crypt(password, gen_salt('bf'))
WHERE password_hash IS NULL AND password IS NOT NULL;

-- 4. 创建安全登录函数
CREATE OR REPLACE FUNCTION secure_login(p_username TEXT, p_password TEXT)
RETURNS TABLE(username TEXT, hash_id TEXT, pubkey TEXT, bio TEXT) AS $$
BEGIN
  RETURN QUERY
  SELECT u.username, u.hash_id, u.pubkey, u.bio
  FROM users u
  WHERE u.username = p_username
    AND u.password_hash = crypt(p_password, u.password_hash);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. 创建安全注册函数
CREATE OR REPLACE FUNCTION secure_register(
  p_username TEXT,
  p_password TEXT,
  p_hash_id TEXT,
  p_pubkey TEXT
)
RETURNS TABLE(username TEXT, hash_id TEXT, bio TEXT) AS $$
BEGIN
  -- 检查用户名是否已存在
  IF EXISTS (SELECT 1 FROM users WHERE username = p_username) THEN
    RAISE EXCEPTION '用户名已存在';
  END IF;

  RETURN QUERY
  INSERT INTO users (username, password_hash, hash_id, pubkey, bio)
  VALUES (
    p_username,
    crypt(p_password, gen_salt('bf')),
    p_hash_id,
    p_pubkey,
    ''
  )
  RETURNING users.username, users.hash_id, users.bio;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. （可选）验证：查看迁移结果
-- SELECT username, password IS NOT NULL AS has_plain, password_hash IS NOT NULL AS has_hash FROM users;

-- 7. （可选，建议在确认一切正常后执行）删除明文密码列
-- ALTER TABLE users DROP COLUMN IF EXISTS password;
