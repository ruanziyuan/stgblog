import React, { useState } from "react";
import { Icons } from "./Icons";
import { formatTimeShort } from "../utils";

export default function GroupListPage({ groups, onOpenGroup, onCreateGroup, onJoinGroup }) {
  return (
    <div className="dm-list">
      <div className="dm-header">
        <h3>群组</h3>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="dm-new-btn" onClick={onJoinGroup} title="加入群组">🔗</button>
          <button className="dm-new-btn" onClick={onCreateGroup} title="创建群组">✏️</button>
        </div>
      </div>
      {groups.length === 0 ? (
        <div className="empty-state">
          <div className="icon">👥</div>
          <h3>暂无群组</h3>
          <p>创建或加入一个群组开始聊天</p>
        </div>
      ) : groups.map((group) => (
        <div key={group.id} className="dm-item" onClick={() => onOpenGroup(group)}>
          <div className="dm-avatar" style={{ background: "linear-gradient(135deg, #6366f1, #a855f7)" }}>
            {group.name[0]}
          </div>
          <div className="dm-info">
            <div className="dm-name">{group.name}</div>
            <div className="dm-preview">{group.lastMsgPreview || "暂无消息"}</div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
            <div className="dm-time">{formatTimeShort(group.lastMsg?.created_at || group.created_at)}</div>
            <div className="group-member-count">{group.memberCount}人</div>
          </div>
        </div>
      ))}
    </div>
  );
}
