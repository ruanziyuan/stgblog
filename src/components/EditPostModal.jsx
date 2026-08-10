import React, { useState, useCallback } from "react";

export default function EditPostModal({ post, onSave, onClose }) {
  const [content, setContent] = useState(post?.content || "");

  const handleSave = useCallback(() => {
    if (!content.trim()) return;
    onSave(post.id, content.trim());
    onClose();
  }, [post, content, onSave, onClose]);

  return (
    <div className="auth-overlay" onClick={onClose}>
      <div className="auth-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 500 }}>
        <div className="auth-top">
          <h3 style={{ fontSize: 15, fontWeight: 700 }}>编辑帖子</h3>
          <button className="auth-close" onClick={onClose}>✕</button>
        </div>
        <div className="auth-body" style={{ paddingTop: 12 }}>
          <textarea className="compose-textarea" value={content} onChange={(e) => setContent(e.target.value)} placeholder="编辑内容..." rows={5} maxLength={2000} style={{ minHeight: 120 }} />
          <div style={{ fontSize: 12, color: "var(--muted)", textAlign: "right", marginBottom: 12 }}>{content.length}/2000</div>
          <button className="auth-btn" onClick={handleSave} disabled={!content.trim()}>保存修改</button>
        </div>
      </div>
    </div>
  );
}
