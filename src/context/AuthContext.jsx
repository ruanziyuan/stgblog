import React, { createContext, useContext, useState, useCallback, useEffect } from "react";
import { supabase } from "../supabase";
import { generateHash } from "../utils";
import { getOrCreateKeyPair } from "../crypto";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem("stgblog_user")) || null; } catch { return null; }
  });
  const [keyPair, setKeyPair] = useState(null);
  const [followingSet, setFollowingSet] = useState(new Set());
  const [dmPrivacy, setDmPrivacy] = useState("open");
  const [dmKey, setDmKey] = useState(null);

  // Load key pair when user changes
  useEffect(() => {
    if (!user) { setKeyPair(null); setFollowingSet(new Set()); return; }
    (async () => {
      try {
        const kp = await getOrCreateKeyPair(user.username);
        setKeyPair(kp);
      } catch (e) { console.warn("Key pair error:", e); }
    })();
  }, [user]);

  // Load follow data
  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase.from("follows").select("following").eq("follower", user.username);
      if (data) setFollowingSet(new Set(data.map((r) => r.following)));
    })();
  }, [user]);

  const login = useCallback(async (name, pass) => {
    // 使用安全 RPC 函数，密码在服务端用 bcrypt 验证
    const { data, error } = await supabase.rpc("secure_login", {
      p_username: name,
      p_password: pass,
    });
    if (error || !data || data.length === 0) return { error: "用户名或密码错误" };
    const userData = data[0];
    // Sync local key pair with database on login
    try {
      const kp = await getOrCreateKeyPair(name);
      const localPubKeyStr = JSON.stringify(kp.publicKey);
      const { data: existing } = await supabase.from("users").select("pubkey").eq("username", name).maybeSingle();
      if (existing && existing.pubkey !== localPubKeyStr) {
        await supabase.from("users").update({ pubkey: localPubKeyStr }).eq("username", name);
      }
    } catch (e) { console.warn("Key sync on login failed:", e); }
    const u = { username: userData.username, hash_id: userData.hash_id, bio: userData.bio || "" };
    localStorage.setItem("stgblog_user", JSON.stringify(u));
    setUser(u);
    return { ok: true };
  }, []);

  const register = useCallback(async (name, pass) => {
    const hashId = generateHash();
    const kp = await getOrCreateKeyPair(name);
    // 使用安全 RPC 函数，密码在服务端用 bcrypt 哈希后存储
    const { data, error } = await supabase.rpc("secure_register", {
      p_username: name,
      p_password: pass,
      p_hash_id: hashId,
      p_pubkey: JSON.stringify(kp.publicKey),
    });
    if (error) return { error: error.message || "注册失败" };
    const userData = data[0];
    const u = { username: userData.username, hash_id: userData.hash_id, bio: userData.bio || "" };
    localStorage.setItem("stgblog_user", JSON.stringify(u));
    setUser(u);
    return { ok: true };
  }, []);

  const logout = useCallback(() => {
    setUser(null);
    localStorage.removeItem("stgblog_user");
  }, []);

  const updateBio = useCallback(async (bio) => {
    if (!user) return;
    await supabase.from("users").update({ bio }).eq("username", user.username);
    const u = { ...user, bio };
    localStorage.setItem("stgblog_user", JSON.stringify(u));
    setUser(u);
  }, [user]);

  const follow = useCallback(async (targetUser) => {
    if (!user || targetUser === user.username) return;
    setFollowingSet((prev) => new Set([...prev, targetUser]));
    try {
      await supabase.rpc("follow_user", { p_follower: user.username, p_following: targetUser });
    } catch {
      await supabase.from("follows").insert([{ follower: user.username, following: targetUser }]);
    }
    try {
      await supabase.rpc("send_notification", {
        p_user_to: targetUser, p_user_from: user.username, p_type: "follow",
      });
    } catch {
      await supabase.from("notifications").insert([{
        user_to: targetUser, user_from: user.username, type: "follow",
      }]);
    }
  }, [user]);

  const unfollow = useCallback(async (targetUser) => {
    if (!user || targetUser === user.username) return;
    setFollowingSet((prev) => { const s = new Set(prev); s.delete(targetUser); return s; });
    await supabase.from("follows").delete().eq("follower", user.username).eq("following", targetUser);
  }, [user]);

  // Load DM privacy settings
  useEffect(() => {
    if (!user) { setDmPrivacy("open"); setDmKey(null); return; }
    (async () => {
      const { data } = await supabase.from("users")
        .select("dm_privacy, dm_key")
        .eq("username", user.username)
        .maybeSingle();
      if (data) {
        setDmPrivacy(data.dm_privacy || "open");
        setDmKey(data.dm_key || null);
      }
    })();
  }, [user]);

  const updateDmPrivacy = useCallback(async (privacy) => {
    if (!user) return;
    let key = dmKey;
    if (privacy === "key_required" && !key) {
      // Auto-generate DM key
      key = "DMK-" + Math.random().toString(36).slice(2, 12).toUpperCase();
      await supabase.from("users").update({ dm_privacy: privacy, dm_key: key }).eq("username", user.username);
      setDmKey(key);
    } else {
      await supabase.from("users").update({ dm_privacy: privacy }).eq("username", user.username);
    }
    setDmPrivacy(privacy);
  }, [user, dmKey]);

  const getDmKey = useCallback(() => dmKey, [dmKey]);

  return (
    <AuthContext.Provider value={{
      user, keyPair, followingSet, dmPrivacy, dmKey,
      login, register, logout, updateBio, follow, unfollow,
      updateDmPrivacy, getDmKey,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
