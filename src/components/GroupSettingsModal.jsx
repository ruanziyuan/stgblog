import React, { useState, useCallback, useEffect } from "react";
import { useAuth } from "../context/AuthContext";

export default function GroupSettingsModal({ group, members, onClose, onUpdateName, onSetRole, onKickMember, onTransferOwnership, onDeleteGroup, onLeaveGroup, onGetMembers }) {
  const { user } = useAuth();
  const [tab, setTab] = useState("members"); // members | settings
  const [editName, setEditName] = useState(group?.name || "");
  const [nameLoading, setNameLoading] = useState(false);
  const [nameError, setNameError] = useState("");
  const [nameSuccess, setNameSuccess] = useState(false);
  const [actionLoading, setActionLoading] = useState(null);

  const isCreator = group?.creator === user?.username;
  const myRole = members?.find((m) => m.username === user?.username)?.role;
  const isAdmin = myRole === "admin";

  useEffect(() => {
    if (group?.name) setEditName(group.name);
  }, [group?.name]);

  const handleSaveName = useCallback(async () => {
    if (!editName.trim() || editName === group.name) return;
    setNameLoading(true);
    setNameError("");
    setNameSuccess(false);
    const result = await onUpdateName(group.id, editName.trim());
    setNameLoading(false);
    if (result?.error) { setNameError(result.error); return; }
    setNameSuccess(true);
    setTimeout(() => setNameSuccess(false), 2000);
  }, [editName, group, onUpdateName]);

  const handleSetRole = useCallback(async (username, role) => {
    setActionLoading(username);
    const result = await onSetRole(group.id, username, role);
    setActionLoading(null);
    if (result?.error) alert(result.error);
  }, [group, onSetRole]);

  const handleKick = useCallback((username) => {
    if (window.confirm(`确定将 ${username} 移出群组？`)) {
      onKickMember(group.id, username);
    }
  }, [group, onKickMember]);

  const handleTransfer = useCallback((username) => {
    if (window.confirm(`确定将群组转让给 ${username}？转让后你将失去创建者权限。`)) {
      onTransferOwnership(group.id, username);
    }
  }, [group, onTransferOwnership]);

  const handleDelete = useCallback(() => {
    if (window.confirm("确定删除此群组？所有消息和成员数据将被永久删除。")) {
      onDeleteGroup(group.id);
      onClose();
    }
  }, [group, onDeleteGroup, onClose]);

  const handleLeave = useCallback(() => {
    if (window.confirm("确定退出群组？")) {
      onLeaveGroup(group.id);
      onClose();
    }
  }, [group, onLeaveGroup, onClose]);

  const safeMembers = Array.isArray(members) ? members : [];
  const admins = safeMembers.filter((m) => m.role === "admin");
  const regularMembers = safeMembers.filter((m) => m.role !== "admin");

  return (
    <div className="auth-overlay" onClick={onClose}>
      <div className="group-settings-modal" onClick={(e) => e.stopPropagation()}>
        <div className="auth-top">
          <h3 style={{ fontSize: 15, fontWeight: 700 }}>群组设置</h3>
          <button className="auth-close" onClick={onClose}>✕</button>
        </div>

        {/* Tabs */}
        <div className="group-settings-tabs">
          <button className={`group-settings-tab ${tab === "members" ? "on" : ""}`} onClick={() => setTab("members")}>
            成员管理
          </button>
          <button className={`group-settings-tab ${tab === "settings" ? "on" : ""}`} onClick={() => setTab("settings")}>
            群组信息
          </button>
        </div>

        <div className="group-settings-body">
          {tab === "members" && (
            <div>
              {/* Admins */}
              <div className="group-settings-section">
                <div className="group-settings-section-title">管理员 ({admins.length})</div>
                {admins.map((m) => (
                  <div key={m.username} className="group-settings-member">
                    <div className="dm-avatar" style={{ width: 36, height: 36, fontSize: 14, background: "linear-gradient(135deg, #6366f1, #a855f7)" }}>
                      {m.username[0]}
                    </div>
                    <div className="group-settings-member-info">
                      <div className="group-settings-member-name">
                        {m.username}
                        {m.username === group.creator && <span className="group-creator-badge">创建者</span>}
                        {m.username === user.username && <span style={{ fontSize: 11, color: "var(--dim)", marginLeft: 6 }}>(我)</span>}
                      </div>
                      <div className="group-settings-member-role">管理员</div>
                    </div>
                    <div className="group-settings-member-actions">
                      {isCreator && m.username !== group.creator && m.username !== user.username && (
                        <>
                          <button className="group-settings-action-btn" disabled={actionLoading === m.username}
                            onClick={() => handleSetRole(m.username, "member")}>
                            {actionLoading === m.username ? "..." : "降为成员"}
                          </button>
                          <button className="group-settings-action-btn danger" disabled={actionLoading === m.username}
                            onClick={() => handleKick(m.username)}>
                            移出
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Regular members */}
              <div className="group-settings-section">
                <div className="group-settings-section-title">成员 ({regularMembers.length})</div>
                {regularMembers.map((m) => (
                  <div key={m.username} className="group-settings-member">
                    <div className="dm-avatar" style={{ width: 36, height: 36, fontSize: 14 }}>
                      {m.username[0]}
                    </div>
                    <div className="group-settings-member-info">
                      <div className="group-settings-member-name">
                        {m.username}
                        {m.username === user.username && <span style={{ fontSize: 11, color: "var(--dim)", marginLeft: 6 }}>(我)</span>}
                      </div>
                      <div className="group-settings-member-role">成员</div>
                    </div>
                    <div className="group-settings-member-actions">
                      {isAdmin && m.username !== user.username && (
                        <>
                          <button className="group-settings-action-btn" disabled={actionLoading === m.username}
                            onClick={() => handleSetRole(m.username, "admin")}>
                            {actionLoading === m.username ? "..." : "设为管理员"}
                          </button>
                          {isCreator && (
                            <button className="group-settings-action-btn" disabled={actionLoading === m.username}
                              onClick={() => handleTransfer(m.username)}>
                              转让群主
                            </button>
                          )}
                          <button className="group-settings-action-btn danger" disabled={actionLoading === m.username}
                            onClick={() => handleKick(m.username)}>
                            移出
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {tab === "settings" && (
            <div>
              {/* Group name */}
              {isAdmin ? (
                <div className="group-settings-section">
                  <div className="group-settings-section-title">群组名称</div>
                  <div className="group-settings-name-edit">
                    <input className="auth-input" type="text" value={editName} onChange={(e) => setEditName(e.target.value)}
                      placeholder="群组名称..." maxLength={30}
                      onKeyDown={(e) => { if (e.key === "Enter") handleSaveName(); }} />
                    <button className="group-settings-save-btn" onClick={handleSaveName}
                      disabled={nameLoading || !editName.trim() || editName === group.name}>
                      {nameLoading ? "保存中..." : "保存"}
                    </button>
                  </div>
                  {nameError && <div className="auth-err" style={{ marginTop: 8 }}>{nameError}</div>}
                  {nameSuccess && <div style={{ fontSize: 12, color: "var(--green)", marginTop: 8 }}>✓ 修改成功</div>}
                </div>
              ) : (
                <div className="group-settings-section">
                  <div className="group-settings-section-title">群组名称</div>
                  <div style={{ padding: "8px 0", fontSize: 14 }}>{group.name}</div>
                </div>
              )}

              {/* Invite code */}
              <div className="group-settings-section">
                <div className="group-settings-section-title">邀请码</div>
                <div className="group-invite-code">
                  <code style={{ fontSize: 14, letterSpacing: 1 }}>{group.invite_code}</code>
                  <button className="group-copy-btn" onClick={() => { navigator.clipboard?.writeText(group.invite_code); }}>复制</button>
                </div>
              </div>

              {/* Group info */}
              <div className="group-settings-section">
                <div className="group-settings-section-title">群组信息</div>
                <div style={{ fontSize: 13, color: "var(--dim)", lineHeight: 1.8 }}>
                  <div>创建者：{group.creator}</div>
                  <div>创建时间：{new Date(group.created_at).toLocaleString("zh-CN")}</div>
                  <div>成员数：{safeMembers.length} 人</div>
                  <div>加密方式：ECDH + AES-256-GCM</div>
                </div>
              </div>

              {/* Danger zone */}
              <div className="group-settings-section">
                <div className="group-settings-section-title" style={{ color: "var(--red)" }}>危险操作</div>
                <div style={{ display: "flex", gap: 8, flexDirection: "column" }}>
                  {!isCreator && (
                    <button className="group-action-btn leave" onClick={handleLeave}>退出群组</button>
                  )}
                  {isCreator && (
                    <button className="group-action-btn delete" onClick={handleDelete}>删除群组</button>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
