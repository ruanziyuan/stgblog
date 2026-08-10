import React, { useMemo, useState, useCallback, useRef } from "react";
import { useAuth } from "../context/AuthContext";
import { formatTimeShort } from "../utils";

// Telegram-style checkmark SVGs
const CheckSingle = () => (
  <svg viewBox="0 0 16 11" width="14" height="10" fill="none" style={{ display: "inline-block", verticalAlign: "middle" }}>
    <path d="M1 5.5L5.5 10L14.5 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
const CheckDouble = () => (
  <svg viewBox="0 0 21 11" width="18" height="10" fill="none" style={{ display: "inline-block", verticalAlign: "middle" }}>
    <path d="M1 5.5L5.5 10L14.5 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M6 5.5L10.5 10L19.5 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export default function DmListPage({ dmList, onOpenDm, onNewDm, onTogglePin, onDeleteConversation }) {
  const { user } = useAuth();
  const [error, setError] = useState(null);
  const [contextMenu, setContextMenu] = useState(null); // { x, y, other }
  const longPressTimer = useRef(null);

  const listWithUnread = useMemo(() => {
    try {
      if (!user || !Array.isArray(dmList)) return dmList || [];
      return dmList.map((item) => {
        if (!item || !item.last) return { other: item?.other || '?', last: item?.last || null, isUnread: false, pinned: item?.pinned || false };
        return {
          other: item.other,
          last: item.last,
          isUnread: item.last.receiver === user.username && !item.last.read,
          pinned: item.pinned || false,
        };
      });
    } catch (e) {
      console.error("DmListPage error:", e);
      setError(e.message);
      return [];
    }
  }, [dmList, user]);

  // Long press handling for context menu
  const handlePointerDown = useCallback((e, other) => {
    const rect = e.currentTarget.getBoundingClientRect();
    longPressTimer.current = setTimeout(() => {
      setContextMenu({
        x: Math.min(e.clientX || rect.left + 60, window.innerWidth - 160),
        y: Math.min(e.clientY || rect.bottom, window.innerHeight - 120),
        other,
      });
    }, 500);
  }, []);

  const handlePointerUp = useCallback(() => {
    if (longPressTimer.current) { clearTimeout(longPressTimer.current); longPressTimer.current = null; }
  }, []);

  // Close context menu on outside click
  const closeContextMenu = useCallback(() => setContextMenu(null), []);

  if (error) {
    return (
      <div className="dm-list">
        <div className="dm-header"><h3>私信</h3></div>
        <div className="empty-state"><div className="icon">⚠️</div><h3>加载出错</h3><p>{error}</p></div>
      </div>
    );
  }

  return (
    <div className="dm-list" onClick={closeContextMenu}>
      <div className="dm-header">
        <h3>私信</h3>
        <button className="dm-new-btn" onClick={onNewDm}>✏️</button>
      </div>
      {!user ? (
        <div className="empty-state"><div className="icon">🔒</div><h3>登录后查看私信</h3><p>端到端加密保护你的隐私</p></div>
      ) : listWithUnread.length === 0 ? (
        <div className="empty-state"><div className="icon">💬</div><h3>暂无私信</h3><p>点击右上角 ✏️ 开始对话</p></div>
      ) : listWithUnread.map(({ other, last, isUnread, pinned }) => (
        <div
          key={other}
          className={`dm-item ${isUnread ? "dm-unread-item" : ""} ${pinned ? "dm-pinned-item" : ""}`}
          onClick={() => onOpenDm(other)}
          onPointerDown={(e) => handlePointerDown(e, other)}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerUp}
          onContextMenu={(e) => {
            e.preventDefault();
            setContextMenu({ x: e.clientX, y: e.clientY, other });
          }}
        >
          <div className="dm-avatar">{other?.[0] || '?'}</div>
          <div className="dm-info">
            <div className="dm-name">
              {other}
              {pinned && <span className="dm-pin-icon">📌</span>}
            </div>
            <div className="dm-preview" style={isUnread ? { fontWeight: 600, color: "var(--text)" } : {}}>
              {!last ? "新对话" : last.encrypted ? "🔒 加密消息" : (last.content || "暂无消息")}
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
            <div className="dm-time">{last ? formatTimeShort(last.created_at) : ""}</div>
            {last?.sender === user.username && (
              <span className={`dm-tick ${last?.read ? "read" : "sent"}`}>
                {last?.read ? <CheckDouble /> : <CheckSingle />}
              </span>
            )}
            {isUnread && <div className="dm-unread-dot" />}
          </div>
        </div>
      ))}

      {/* Context Menu (long press / right click) */}
      {contextMenu && (
        <div className="dm-context-menu" style={{ left: contextMenu.x, top: contextMenu.y }} onClick={(e) => e.stopPropagation()}>
          <button onClick={() => { onTogglePin?.(contextMenu.other); setContextMenu(null); }}>
            {listWithUnread.find((c) => c.other === contextMenu.other)?.pinned ? "📌 取消置顶" : "📌 置顶对话"}
          </button>
          <div className="menu-divider" />
          <button className="dm-context-delete" onClick={() => { onDeleteConversation?.(contextMenu.other); setContextMenu(null); }}>
            🗑️ 删除对话
          </button>
        </div>
      )}
    </div>
  );
}
