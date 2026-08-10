import React, { useState, useCallback } from "react";
import { supabase } from "../supabase";
import { useAuth } from "../context/AuthContext";

export default function NewDmModal({ onClose, onStartDm }) {
  const { user } = useAuth();
  const [targetUser, setTargetUser] = useState("");
  const [error, setError] = useState("");
  const [needKey, setNeedKey] = useState(false);
  const [targetDmKey, setTargetDmKey] = useState("");
  const [dmKeyInput, setDmKeyInput] = useState("");
  const [keyError, setKeyError] = useState("");
  const [targetPrivacy, setTargetPrivacy] = useState(null);

  const handleStart = useCallback(async () => {
    setError("");
    setKeyError("");
    const target = targetUser.trim();
    if (!target) { setError("请输入用户名"); return; }
    if (target === user.username) { setError("不能给自己发消息"); return; }
    // First: check if user exists (only query username to avoid column-missing errors)
    const { data: exists } = await supabase.from("users").select("username").eq("username", target).maybeSingle();
    if (!exists) { setError("用户不存在"); return; }

    // Second: try to fetch DM privacy settings (columns may not exist yet)
    try {
      const { data: privacy } = await supabase.from("users").select("dm_privacy, dm_key").eq("username", target).maybeSingle();
      if (privacy?.dm_privacy === "key_required") {
        setNeedKey(true);
        setTargetDmKey(privacy.dm_key || "");
        setTargetPrivacy("key_required");
        return;
      }
    } catch { /* dm_privacy/dm_key columns may not exist */ }

    onStartDm(target);
  }, [targetUser, user, onStartDm]);

  const handleVerifyKey = useCallback(() => {
    setKeyError("");
    if (!dmKeyInput.trim()) { setKeyError("请输入私信密钥"); return; }
    if (dmKeyInput.trim() !== targetDmKey) { setKeyError("密钥不正确"); return; }
    onStartDm(targetUser.trim());
  }, [dmKeyInput, targetDmKey, targetUser, onStartDm]);

  return (
    <div className="auth-overlay" onClick={onClose}>
      <div className="auth-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 380 }}>
        <div className="auth-top">
          <h3 style={{ fontSize: 15, fontWeight: 700 }}>{needKey ? "需要私信密钥" : "新建私信"}</h3>
          <button className="auth-close" onClick={onClose}>✕</button>
        </div>
        <div className="auth-body" style={{ paddingTop: 16 }}>
          {needKey ? (
            <>
              <p style={{ fontSize: 13, color: "var(--dim)", marginBottom: 16 }}>
                {targetUser} 设置了私信密钥保护，请输入对方的密钥才能开始对话
              </p>
              <input className="auth-input" type="text" value={dmKeyInput} onChange={(e) => setDmKeyInput(e.target.value)}
                placeholder="输入私信密钥..." autoFocus
                onKeyDown={(e) => { if (e.key === "Enter") handleVerifyKey(); }} />
              {keyError && <div className="auth-err">{keyError}</div>}
              <button className="auth-btn" onClick={handleVerifyKey} disabled={!dmKeyInput.trim()}>验证并开始对话</button>
              <button className="auth-switch" style={{ marginTop: 12, textAlign: "center", width: "100%" }} onClick={() => { setNeedKey(false); setDmKeyInput(""); setKeyError(""); }}>
                <button>返回</button>
              </button>
            </>
          ) : (
            <>
              <p style={{ fontSize: 13, color: "var(--dim)", marginBottom: 16 }}>输入对方用户名，开始端到端加密对话</p>
              <input className="auth-input" type="text" value={targetUser} onChange={(e) => setTargetUser(e.target.value)} placeholder="输入用户名..." autoFocus
                onKeyDown={(e) => { if (e.key === "Enter") handleStart(); }} />
              {error && <div className="auth-err">{error}</div>}
              <button className="auth-btn" onClick={handleStart} disabled={!targetUser.trim()}>开始对话</button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
