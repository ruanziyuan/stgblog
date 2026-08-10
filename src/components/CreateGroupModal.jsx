import React, { useState, useCallback } from "react";

export default function CreateGroupModal({ onClose, onCreateGroup }) {
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [created, setCreated] = useState(null); // { group }

  const handleCreate = useCallback(async () => {
    if (!name.trim()) { setError("请输入群组名称"); return; }
    setLoading(true);
    setError("");
    const result = await onCreateGroup(name.trim());
    setLoading(false);
    if (result?.error) { setError(result.error); return; }
    setCreated(result.group);
  }, [name, onCreateGroup]);

  return (
    <div className="auth-overlay" onClick={onClose}>
      <div className="auth-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 380 }}>
        <div className="auth-top">
          <h3 style={{ fontSize: 15, fontWeight: 700 }}>{created ? "群组创建成功" : "创建群组"}</h3>
          <button className="auth-close" onClick={onClose}>✕</button>
        </div>
        <div className="auth-body" style={{ paddingTop: 16 }}>
          {created ? (
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 48, marginBottom: 16 }}>🎉</div>
              <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>{created.name}</div>
              <p style={{ fontSize: 13, color: "var(--dim)", marginBottom: 16 }}>分享以下邀请码邀请好友加入：</p>
              <div className="group-invite-code" style={{ justifyContent: "center", marginBottom: 16 }}>
                <code style={{ fontSize: 18, letterSpacing: 2 }}>{created.invite_code}</code>
                <button className="group-copy-btn" onClick={() => { navigator.clipboard?.writeText(created.invite_code); }}>复制</button>
              </div>
              <button className="auth-btn" onClick={onClose}>完成</button>
            </div>
          ) : (
            <>
              <p style={{ fontSize: 13, color: "var(--dim)", marginBottom: 16 }}>输入群组名称，创建后分享邀请码给好友</p>
              <input className="auth-input" type="text" value={name} onChange={(e) => setName(e.target.value)}
                placeholder="群组名称..." autoFocus maxLength={30}
                onKeyDown={(e) => { if (e.key === "Enter") handleCreate(); }} />
              {error && <div className="auth-err">{error}</div>}
              <button className="auth-btn" onClick={handleCreate} disabled={loading || !name.trim()}>
                {loading ? "创建中..." : "创建群组"}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
