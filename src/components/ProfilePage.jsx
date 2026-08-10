import React, { useState, useMemo, useCallback } from "react";
import { supabase } from "../supabase";
import { useAuth } from "../context/AuthContext";
import { Icons } from "./Icons";
import PostCard from "./PostCard";

export default function ProfilePage({ posts, onAuthOpen, onSelectPost, onLike, onShare, onRepost, onBookmark, onFollowersPage }) {
  const { user, followingSet, logout, updateBio, dmPrivacy, dmKey, updateDmPrivacy } = useAuth();
  const [editOpen, setEditOpen] = useState(false);
  const [editBio, setEditBio] = useState("");
  const [profileTab, setProfileTab] = useState("posts");

  // Password change state
  const [pwModalOpen, setPwModalOpen] = useState(false);
  const [oldPw, setOldPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [pwError, setPwError] = useState("");
  const [pwSuccess, setPwSuccess] = useState("");
  const [pwLoading, setPwLoading] = useState(false);

  // DM privacy state
  const [dmKeyCopied, setDmKeyCopied] = useState(false);

  const userPosts = useMemo(() => {
    if (!user) return [];
    if (profileTab === "likes") {
      const liked = new Set(JSON.parse(localStorage.getItem("likedPosts") || "[]"));
      return posts.filter((p) => liked.has(p.id));
    }
    return posts.filter((p) => p.author === user.username);
  }, [posts, user, profileTab]);

  const pinnedPost = useMemo(() => userPosts.find((p) => p.pinned), [userPosts]);

  const handleSaveBio = useCallback(async () => {
    await updateBio(editBio.trim());
    setEditOpen(false);
  }, [editBio, updateBio]);

  const handleChangePassword = useCallback(async () => {
    setPwError("");
    setPwSuccess("");
    if (!oldPw) { setPwError("请输入旧密码"); return; }
    if (!newPw || newPw.length < 6) { setPwError("新密码至少6位"); return; }
    if (newPw !== confirmPw) { setPwError("两次输入的新密码不一致"); return; }
    setPwLoading(true);
    // Verify old password
    const { data, error } = await supabase.from("users")
      .select("username")
      .eq("username", user.username)
      .eq("password", oldPw)
      .maybeSingle();
    if (error || !data) {
      setPwError("旧密码错误");
      setPwLoading(false);
      return;
    }
    // Update password
    const { error: updateErr } = await supabase.from("users")
      .update({ password: newPw })
      .eq("username", user.username)
      .eq("password", oldPw);
    if (updateErr) {
      setPwError("修改失败，请重试");
    } else {
      setPwSuccess("密码修改成功");
      setOldPw(""); setNewPw(""); setConfirmPw("");
      setTimeout(() => { setPwModalOpen(false); setPwSuccess(""); }, 1500);
    }
    setPwLoading(false);
  }, [user, oldPw, newPw, confirmPw]);

  const handleCopyDmKey = useCallback(() => {
    if (dmKey) {
      navigator.clipboard?.writeText(dmKey);
      setDmKeyCopied(true);
      setTimeout(() => setDmKeyCopied(false), 2000);
    }
  }, [dmKey]);

  if (!user) return (
    <div className="empty-state" style={{ paddingTop: 80 }}>
      <div className="icon">👤</div>
      <h3>未登录</h3>
      <p>登录后查看个人主页</p>
      <button className="compose-submit" style={{ marginTop: 16 }} onClick={onAuthOpen}>登录</button>
    </div>
  );

  return (
    <>
      <div className="profile-header">
        <div className="profile-banner" />
        <div className="profile-info">
          <div className="profile-avatar">{user.username[0]}</div>
          <div className="profile-name">{user.username} <Icons.Verified /></div>
          <div className="profile-handle">@{user.username}</div>
          <div className="profile-bio">{user.bio || "STGBLOG 用户 · 加密社交"}</div>
          <div className="profile-stats">
            <span style={{ cursor: "pointer" }} onClick={() => onFollowersPage?.("following")}><b>{followingSet.size}</b> 关注</span>
            <span style={{ cursor: "pointer" }} onClick={() => onFollowersPage?.("followers")}><b>{posts.filter((p) => p.author === user.username).length}</b> 帖子</span>
          </div>
          <div className="profile-actions">
            <button className="profile-edit" onClick={() => { setEditBio(user.bio || ""); setEditOpen(true); }}>编辑资料</button>
            <button className="profile-edit" onClick={() => setPwModalOpen(true)}>修改密码</button>
            <button className="profile-edit" onClick={logout} style={{ color: "var(--red)", borderColor: "rgba(244,33,46,0.3)" }}>退出</button>
          </div>
        </div>
      </div>

      {/* DM Privacy Settings */}
      <div className="profile-section">
        <div className="profile-section-title">私信设置</div>
        <div className="dm-privacy-toggle">
          <button className={`dm-privacy-btn ${dmPrivacy === "open" ? "on" : ""}`} onClick={() => updateDmPrivacy("open")}>
            任何人可以私信我
          </button>
          <button className={`dm-privacy-btn ${dmPrivacy === "key_required" ? "on" : ""}`} onClick={() => updateDmPrivacy("key_required")}>
            需要密钥才能私信我
          </button>
        </div>
        {dmPrivacy === "key_required" && dmKey && (
          <div className="dm-key-display">
            <span style={{ fontSize: 12, color: "var(--dim)" }}>你的私信密钥：</span>
            <div className="group-invite-code" style={{ marginTop: 4 }}>
              <code>{dmKey}</code>
              <button className="group-copy-btn" onClick={handleCopyDmKey}>{dmKeyCopied ? "已复制" : "复制"}</button>
            </div>
            <p style={{ fontSize: 11, color: "var(--muted)", marginTop: 4 }}>分享此密钥给你信任的人，他们才能给你发私信</p>
          </div>
        )}
      </div>

      <div className="profile-tabs">
        <button className={`profile-tab ${profileTab === "posts" ? "on" : ""}`} onClick={() => setProfileTab("posts")}>帖子</button>
        <button className={`profile-tab ${profileTab === "likes" ? "on" : ""}`} onClick={() => setProfileTab("likes")}>喜欢</button>
      </div>
      <div className="feed">
        {pinnedPost && profileTab === "posts" && (
          <PostCard key={`pinned-${pinnedPost.id}`} post={pinnedPost} onSelect={onSelectPost} onLike={onLike} onShare={onShare} onRepost={onRepost} onBookmark={onBookmark} />
        )}
        {userPosts.length === 0 ? (
          <div className="empty-state"><div className="icon">📝</div><h3>暂无帖子</h3><p>发布你的第一条动态</p></div>
        ) : userPosts.filter((p) => !p.pinned || profileTab !== "posts").map((post) => (
          <PostCard key={post.id} post={post} onSelect={onSelectPost} onLike={onLike} onShare={onShare} onRepost={onRepost} onBookmark={onBookmark} />
        ))}
      </div>

      {/* Edit Bio Modal */}
      {editOpen && (
        <div className="auth-overlay" onClick={() => setEditOpen(false)}>
          <div className="auth-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 420 }}>
            <div className="auth-top">
              <h3 style={{ fontSize: 15, fontWeight: 700 }}>编辑资料</h3>
              <button className="auth-close" onClick={() => setEditOpen(false)}>✕</button>
            </div>
            <div className="auth-body" style={{ paddingTop: 16 }}>
              <label style={{ fontSize: 13, color: "var(--dim)", marginBottom: 6, display: "block" }}>个人简介</label>
              <textarea className="auth-input" value={editBio} onChange={(e) => setEditBio(e.target.value)} placeholder="介绍一下自己..." rows={3} style={{ resize: "vertical", minHeight: 80 }} maxLength={200} />
              <div style={{ fontSize: 12, color: "var(--muted)", textAlign: "right", marginBottom: 12 }}>{editBio.length}/200</div>
              <button className="auth-btn" onClick={handleSaveBio}>保存</button>
            </div>
          </div>
        </div>
      )}

      {/* Change Password Modal */}
      {pwModalOpen && (
        <div className="auth-overlay" onClick={() => { setPwModalOpen(false); setPwError(""); setPwSuccess(""); }}>
          <div className="auth-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 380 }}>
            <div className="auth-top">
              <h3 style={{ fontSize: 15, fontWeight: 700 }}>修改密码</h3>
              <button className="auth-close" onClick={() => { setPwModalOpen(false); setPwError(""); setPwSuccess(""); }}>✕</button>
            </div>
            <div className="auth-body" style={{ paddingTop: 16 }}>
              <input className="auth-input" type="password" value={oldPw} onChange={(e) => setOldPw(e.target.value)} placeholder="旧密码" autoFocus />
              <input className="auth-input" type="password" value={newPw} onChange={(e) => setNewPw(e.target.value)} placeholder="新密码" />
              <input className="auth-input" type="password" value={confirmPw} onChange={(e) => setConfirmPw(e.target.value)} placeholder="确认新密码"
                onKeyDown={(e) => { if (e.key === "Enter") handleChangePassword(); }} />
              {pwError && <div className="auth-err">{pwError}</div>}
              {pwSuccess && <div style={{ padding: "10px 14px", background: "rgba(0,186,124,0.08)", border: "1px solid rgba(0,186,124,0.2)", borderRadius: 8, color: "var(--green)", fontSize: 12, marginBottom: 8 }}>{pwSuccess}</div>}
              <button className="auth-btn" onClick={handleChangePassword} disabled={pwLoading}>{pwLoading ? "修改中..." : "修改密码"}</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
