import React, { useState, useCallback } from "react";

export default function JoinGroupModal({ onClose, onJoinGroup }) {
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleJoin = useCallback(async () => {
    if (!code.trim()) { setError("请输入邀请码"); return; }
    setLoading(true);
    setError("");
    const result = await onJoinGroup(code.trim());
    setLoading(false);
    if (result?.error) { setError(result.error); return; }
    onClose();
  }, [code, onJoinGroup, onClose]);

  return (
    <div className="auth-overlay" onClick={onClose}>
      <div className="auth-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 380 }}>
        <div className="auth-top">
          <h3 style={{ fontSize: 15, fontWeight: 700 }}>加入群组</h3>
          <button className="auth-close" onClick={onClose}>✕</button>
        </div>
        <div className="auth-body" style={{ paddingTop: 16 }}>
          <p style={{ fontSize: 13, color: "var(--dim)", marginBottom: 16 }}>输入群组邀请码加入</p>
          <input className="auth-input" type="text" value={code} onChange={(e) => setCode(e.target.value)}
            placeholder="输入邀请码..." autoFocus
            onKeyDown={(e) => { if (e.key === "Enter") handleJoin(); }} />
          {error && <div className="auth-err">{error}</div>}
          <button className="auth-btn" onClick={handleJoin} disabled={loading || !code.trim()}>
            {loading ? "加入中..." : "加入群组"}
          </button>
        </div>
      </div>
    </div>
  );
}
