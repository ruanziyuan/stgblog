import React, { useState, useCallback, useEffect, useRef, useLayoutEffect } from "react";
import { Icons } from "./Icons";
import { useAuth } from "../context/AuthContext";
import { formatTime } from "../utils";

const CheckSingle = () => (
  <svg viewBox="0 0 16 11" width="14" height="10" fill="none" style={{ display: "inline-block", verticalAlign: "middle" }}>
    <path d="M1 5.5L5.5 10L14.5 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export default function GroupChatPage({ group, messages, members, sending, onSend, onBack, onUserClick, onKickMember, onDeleteGroup, onLeaveGroup, onGetMembers, onOpenSettings, onShareKey, onLoadMore }) {
  const { user } = useAuth();
  const [input, setInput] = useState("");
  const [showInfo, setShowInfo] = useState(false);
  const [keySharing, setKeySharing] = useState({});
  const messagesContainerRef = useRef(null);
  const inputBarRef = useRef(null);
  const messagesEndRef = useRef(null);

  const scrollToBottom = useCallback(() => {
    const container = messagesContainerRef.current;
    if (!container) return;
    container.scrollTop = container.scrollHeight;
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "instant" });
  }, [messages]);

  useEffect(() => {
    if (!group || !messages || messages.length === 0) return;
    let retries = 0;
    const maxRetries = 10;
    const tryScroll = () => {
      const container = messagesContainerRef.current;
      if (!container) {
        if (retries < maxRetries) {
          retries++;
          setTimeout(tryScroll, 50);
        }
        return;
      }
      if (container.scrollHeight === 0) {
        if (retries < maxRetries) {
          retries++;
          setTimeout(tryScroll, 50);
        }
        return;
      }
      container.scrollTop = container.scrollHeight;
    };
    tryScroll();
  }, [group, messages]);

  useEffect(() => {
    const updateLayout = () => {
      const vv = window.visualViewport;
      if (!vv) return;
      const h = Math.round(vv.height);
      document.documentElement.style.setProperty('--app-height', `${h}px`);
      setTimeout(() => scrollToBottom(), 150);
    };

    const onFocus = () => {
      setTimeout(updateLayout, 300);
      setTimeout(() => scrollToBottom(), 500);
    };

    const onBlur = () => {
      setTimeout(() => {
        document.documentElement.style.setProperty('--app-height', `${window.innerHeight}px`);
      }, 150);
    };

    const onScroll = () => {
      const container = messagesContainerRef.current;
      if (!container) return;
      if (container.scrollTop <= 50 && onLoadMore) {
        onLoadMore();
      }
    };

    const vv = window.visualViewport;
    if (vv) {
      vv.addEventListener("resize", updateLayout);
      vv.addEventListener("scroll", updateLayout);
    }
    window.addEventListener("resize", updateLayout);

    const container = messagesContainerRef.current;
    if (container) {
      container.addEventListener("scroll", onScroll);
    }

    updateLayout();

    const inputEl = inputBarRef.current?.querySelector('.dm-input');
    if (inputEl) {
      inputEl.addEventListener('focus', onFocus);
      inputEl.addEventListener('blur', onBlur);
    }

    return () => {
      if (vv) {
        vv.removeEventListener("resize", updateLayout);
        vv.removeEventListener("scroll", updateLayout);
      }
      window.removeEventListener("resize", updateLayout);
      if (container) {
        container.removeEventListener("scroll", onScroll);
      }
      if (inputEl) {
        inputEl.removeEventListener('focus', onFocus);
        inputEl.removeEventListener('blur', onBlur);
      }
      document.documentElement.style.removeProperty('--app-height');
    };
  }, [onLoadMore, scrollToBottom]);

  const isCreator = group?.creator === user?.username;
  const isAdmin = members?.find((m) => m.username === user?.username)?.role === "admin";
  const myRole = members?.find((m) => m.username === user?.username)?.role;

  const handleSend = useCallback(async () => {
    if (!input.trim()) return;
    const ok = await onSend(group.id, input);
    if (ok) {
      setInput("");
      setTimeout(() => scrollToBottom(), 100);
    }
  }, [input, group, onSend, scrollToBottom]);

  const handleKick = useCallback((username) => {
    if (window.confirm(`确定将 ${username} 移出群组？`)) {
      onKickMember(group.id, username);
    }
  }, [group, onKickMember]);

  const handleDelete = useCallback(() => {
    if (window.confirm("确定删除此群组？所有消息将被删除。")) {
      onDeleteGroup(group.id);
    }
  }, [group, onDeleteGroup]);

  const handleLeave = useCallback(() => {
    if (window.confirm("确定退出群组？")) {
      onLeaveGroup(group.id);
    }
  }, [group, onLeaveGroup]);

  const handleShareKey = useCallback(async (username) => {
    if (!onShareKey) return;
    setKeySharing((prev) => ({ ...prev, [username]: true }));
    const result = await onShareKey(group.id, username);
    setKeySharing((prev) => ({ ...prev, [username]: false }));
    if (result?.error) {
      alert("密钥分享失败: " + result.error);
    }
    onGetMembers(group.id);
  }, [group, onShareKey, onGetMembers]);

  const safeMessages = Array.isArray(messages) ? messages : [];

  return (
    <div className="dm-chat">
      <div className="dm-chat-top">
        <button className="dm-chat-back" onClick={onBack}><Icons.Back /></button>
        <div className="dm-avatar" style={{ width: 32, height: 32, fontSize: 13, background: "linear-gradient(135deg, #6366f1, #a855f7)", cursor: "pointer" }}
          onClick={() => { setShowInfo(!showInfo); if (!showInfo) onGetMembers(group.id); }}>
          {group.name[0]}
        </div>
        <span className="dm-chat-name" style={{ cursor: "pointer" }}
          onClick={() => { setShowInfo(!showInfo); if (!showInfo) onGetMembers(group.id); }}>
          {group.name}
        </span>
        <span className="dm-chat-lock"><Icons.Lock /> {members?.length || 0}人</span>
        {onOpenSettings && (
          <button className="group-settings-btn" onClick={onOpenSettings} title="群组设置" style={{
            marginLeft: "auto", background: "none", border: "none", cursor: "pointer",
            padding: "4px 8px", borderRadius: 8, display: "flex", alignItems: "center",
            color: "var(--dim)", transition: "all 0.15s"
          }}>
            ⚙️
          </button>
        )}
      </div>

      {showInfo && (
        <div className="group-info-panel">
          <div className="group-info-header">
            <div className="group-info-title">群组信息</div>
            <button className="auth-close" onClick={() => setShowInfo(false)}>✕</button>
          </div>
          <div className="group-info-invite">
            <span style={{ fontSize: 12, color: "var(--dim)" }}>邀请码</span>
            <div className="group-invite-code">
              <code>{group.invite_code}</code>
              <button className="group-copy-btn" onClick={() => { navigator.clipboard?.writeText(group.invite_code); }}>复制</button>
            </div>
          </div>
          <div className="group-info-members">
            <div className="group-info-subtitle">成员 ({members?.length || 0})</div>
            {(members || []).map((m) => (
              <div key={m.username} className="group-member-item">
                <div className="dm-avatar" style={{ width: 32, height: 32, fontSize: 12 }}>{m.username[0]}</div>
                <div className="dm-info">
                  <div className="dm-name" style={{ fontSize: 13 }}>
                    {m.username}
                    {m.role === "admin" && <span className="group-admin-badge">管理员</span>}
                    {m.username === group.creator && <span className="group-creator-badge">创建者</span>}
                  </div>
                </div>
                {(isAdmin || isCreator) && m.username !== user.username && !m.encrypted_key && (
                  <button className="group-kick-btn" onClick={() => handleShareKey(m.username)} disabled={keySharing[m.username]}
                    style={{ background: "var(--green)", color: "#fff", marginRight: 4 }}>
                    {keySharing[m.username] ? "..." : "🔑"}
                  </button>
                )}
                {isAdmin && m.username !== user.username && m.username !== group.creator && (
                  <button className="group-kick-btn" onClick={() => handleKick(m.username)}>移出</button>
                )}
              </div>
            ))}
          </div>
          <div className="group-info-actions">
            {!isCreator && (
              <button className="group-action-btn leave" onClick={handleLeave}>退出群组</button>
            )}
            {isCreator && (
              <button className="group-action-btn delete" onClick={handleDelete}>删除群组</button>
            )}
          </div>
        </div>
      )}

      <div className="dm-chat-messages" ref={messagesContainerRef}>
        {safeMessages.length === 0 && (
          <div className="dm-empty">
            <div className="dm-empty-icon">👥</div>
            <h3>{group.name}</h3>
            <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 8 }}>群组消息已加密保护</p>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 14px", background: "rgba(34,197,94,0.1)", borderRadius: 99, fontSize: 12, color: "var(--green)" }}>
              <Icons.Lock /> 端到端加密
            </div>
          </div>
        )}
        {safeMessages.map((msg, i) => {
          if (!msg) return null;
          const isMine = msg.sender === user?.username;
          return (
            <div key={msg.id || i} className={`dm-msg ${isMine ? "sent" : "received"}`}>
              {!isMine && (
                <div className="group-msg-sender" onClick={() => onUserClick?.(msg.sender)}>
                  {msg.sender}
                </div>
              )}
              {msg.content || ''}
              <div className="dm-msg-meta">
                <span className="dm-msg-time">{formatTime(msg.created_at)}</span>
                {(msg.decrypted || msg.encrypted) && <span className="dm-msg-lock">🔒</span>}
                {isMine && <span className="dm-tick sent"><CheckSingle /></span>}
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      <div className="dm-chat-input" ref={inputBarRef}>
        <textarea className="dm-input" value={input} onChange={(e) => setInput(e.target.value)}
          placeholder="发送群消息..." rows={1}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }} />
        <button className="dm-send-btn" onClick={handleSend} disabled={sending || !input.trim()}>
          {sending ? "..." : "↑"}
        </button>
      </div>
    </div>
  );
}
