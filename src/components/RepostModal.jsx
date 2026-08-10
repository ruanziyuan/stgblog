import React, { useState, useCallback } from "react";
import { Icons } from "./Icons";

export default function RepostModal({ post, onRepost, onQuote, onClose }) {
  const [mode, setMode] = useState("repost"); // repost | quote
  const [quoteText, setQuoteText] = useState("");

  const handleRepost = useCallback(() => {
    onRepost(post);
    onClose();
  }, [post, onRepost, onClose]);

  const handleQuote = useCallback(() => {
    if (!quoteText.trim()) return;
    onQuote(post, quoteText.trim());
    onClose();
  }, [post, quoteText, onQuote, onClose]);

  return (
    <div className="auth-overlay" onClick={onClose}>
      <div className="auth-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 420 }}>
        <div className="auth-top">
          <h3 style={{ fontSize: 15, fontWeight: 700 }}>转发</h3>
          <button className="auth-close" onClick={onClose}>✕</button>
        </div>
        <div className="auth-body" style={{ paddingTop: 12 }}>
          <div className="seg-bar">
            <button className={mode === "repost" ? "seg on" : "seg"} onClick={() => setMode("repost")}>直接转发</button>
            <button className={mode === "quote" ? "seg on" : "seg"} onClick={() => setMode("quote")}>引用</button>
          </div>
          {mode === "quote" && (
            <>
              <textarea className="compose-textarea" value={quoteText} onChange={(e) => setQuoteText(e.target.value)} placeholder="添加你的评论..." rows={3} maxLength={2000} />
              <div style={{ fontSize: 12, color: "var(--muted)", textAlign: "right", marginBottom: 8 }}>{quoteText.length}/2000</div>
            </>
          )}
          {mode === "repost" ? (
            <button className="auth-btn" onClick={handleRepost}>确认转发</button>
          ) : (
            <button className="auth-btn" onClick={handleQuote} disabled={!quoteText.trim()}>发布引用</button>
          )}
        </div>
      </div>
    </div>
  );
}
