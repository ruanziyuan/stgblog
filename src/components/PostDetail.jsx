import React, { useState, useEffect, useMemo, useCallback } from "react";
import { supabase } from "../supabase";
import { useAuth } from "../context/AuthContext";
import { Icons } from "./Icons";
import CommentNode from "./CommentNode";
import { hasLiked, hasBookmarked, formatTime, formatTimeShort, formatCount, buildTree, parseContent } from "../utils";

function RenderContent({ content }) {
  const parts = parseContent(content);
  return (
    <>
      {parts.map((p, i) => {
        if (p.type === "hashtag") return <span key={i} className="hashtag">{p.value}</span>;
        if (p.type === "mention") return <span key={i} className="mention">{p.value}</span>;
        if (p.type === "newline") return <br key={i} />;
        return <span key={i}>{p.value}</span>;
      })}
    </>
  );
}

export default function PostDetail({ post, onClose, onLike, onShare, onRepost, onBookmark, onUserClick, onDeletePost, onEditPost }) {
  const { user, followingSet, follow, unfollow } = useAuth();
  const [comments, setComments] = useState([]);
  const [commentText, setCommentText] = useState("");
  const [commentLoading, setCommentLoading] = useState(false);
  const [replyTarget, setReplyTarget] = useState(null);
  const [replyText, setReplyText] = useState("");
  const [replySubmitting, setReplySubmitting] = useState(false);
  const [showMenu, setShowMenu] = useState(false);

  useEffect(() => {
    if (!post) return;
    (async () => {
      const { data } = await supabase.from("comments").select("*").eq("post_id", post.id).order("created_at", { ascending: true });
      if (data) setComments(data);
    })();
  }, [post]);

  const commentTree = useMemo(() => buildTree(comments), [comments]);

  const handleComment = useCallback(async () => {
    if (!user || !post) return;
    const text = commentText.trim();
    if (!text || text.length > 500) return;
    setCommentLoading(true);
    const { data, error } = await supabase.from("comments").insert([{
      post_id: post.id, author: user.username, content: text, parent_id: null,
    }]).select("*").single();
    if (!error) {
      setComments((prev) => [...prev, data]);
      setCommentText("");
      if (post.author !== user.username) {
        try {
          await supabase.rpc("send_notification", {
            p_user_to: post.author, p_user_from: user.username,
            p_type: "comment", p_post_id: post.id, p_comment_id: data.id,
          });
        } catch {
          await supabase.from("notifications").insert([{
            user_to: post.author, user_from: user.username,
            type: "comment", post_id: post.id, comment_id: data.id,
          }]);
        }
      }
    }
    setCommentLoading(false);
  }, [user, post, commentText]);

  const handleReply = useCallback(async (parentId) => {
    if (!user || !post) return;
    const text = replyText.trim();
    if (!text || text.length > 500) return;
    setReplySubmitting(true);
    const { data, error } = await supabase.from("comments").insert([{
      post_id: post.id, author: user.username, content: text, parent_id: parentId,
    }]).select("*").single();
    if (!error) {
      setComments((prev) => [...prev, data]);
      setReplyText(""); setReplyTarget(null);
      const parentComment = comments.find((c) => c.id === parentId);
      if (parentComment && parentComment.author !== user.username) {
        try {
          await supabase.rpc("send_notification", {
            p_user_to: parentComment.author, p_user_from: user.username,
            p_type: "reply", p_post_id: post.id, p_comment_id: data.id,
          });
        } catch {
          await supabase.from("notifications").insert([{
            user_to: parentComment.author, user_from: user.username,
            type: "reply", post_id: post.id, comment_id: data.id,
          }]);
        }
      }
    }
    setReplySubmitting(false);
  }, [user, post, replyText, comments]);

  const handleDeleteComment = useCallback(async (comment) => {
    if (!user || comment.author !== user.username) return;
    await supabase.from("comments").delete().eq("id", comment.id);
    const toDelete = new Set();
    const collect = (id) => { toDelete.add(id); comments.filter((c) => c.parent_id === id).forEach((c) => collect(c.id)); };
    collect(comment.id);
    setComments((prev) => prev.filter((c) => !toDelete.has(c.id)));
  }, [user, comments]);

  if (!post) return null;
  const liked = hasLiked(post.id);
  const bookmarked = hasBookmarked(post.id);

  return (
    <div className="detail">
      <div className="detail-top">
        <button className="detail-back" onClick={onClose}><Icons.Back /></button>
        <span className="detail-top-title">帖子</span>
      </div>
      <div className="detail-author">
        <div className="detail-avatar" style={{ cursor: "pointer" }} onClick={() => onUserClick(post.author)}>{post.author[0]}</div>
        <div>
          <div className="detail-name" style={{ cursor: "pointer" }} onClick={() => onUserClick(post.author)}>{post.author}</div>
          <div className="detail-handle">@{post.author}</div>
        </div>
        {user && post.author !== user.username && (
          followingSet.has(post.author) ? (
            <button className="follow-btn following" onClick={() => unfollow(post.author)}>已关注</button>
          ) : (
            <button className="follow-btn" onClick={() => follow(post.author)}>关注</button>
          )
        )}
        <div className="post-menu-wrap" style={{ marginLeft: "auto" }}>
          <button className="detail-action" onClick={() => setShowMenu(!showMenu)}><Icons.MoreHorizontal /></button>
          {showMenu && (
            <div className="post-menu" onClick={(e) => e.stopPropagation()}>
              {user && post.author === user.username && (
                <>
                  <button onClick={() => { onEditPost?.(post); setShowMenu(false); }}><Icons.Edit /> 编辑</button>
                  <button onClick={() => { onDeletePost(post); setShowMenu(false); }} style={{ color: "var(--red)" }}>🗑 删除</button>
                  <div className="menu-divider" />
                </>
              )}
              <button onClick={() => { onRepost?.(post); setShowMenu(false); }}><Icons.RT /> 转发</button>
              <button onClick={() => { onBookmark?.(post); setShowMenu(false); }}>
                {bookmarked ? <Icons.BookmarkFill /> : <Icons.Bookmark />} {bookmarked ? "取消书签" : "加入书签"}
              </button>
              <button onClick={() => { onShare(post); setShowMenu(false); }}><Icons.Share /> 分享</button>
            </div>
          )}
        </div>
      </div>
      <div className="detail-body"><RenderContent content={post.content} /></div>
      {post.quote_of && post.quote_data && (
        <div className="quote-card detail-quote" onClick={() => onUserClick(post.quote_data.author)}>
          <div className="quote-head">
            <span className="post-author">{post.quote_data.author}</span>
            <span className="post-handle">@{post.quote_data.author}</span>
          </div>
          <div className="quote-content">{post.quote_data.content?.slice(0, 200)}</div>
        </div>
      )}
      <div className="detail-time-bar">
        <span>{new Intl.DateTimeFormat("zh-CN", { dateStyle: "full", timeStyle: "short" }).format(new Date(post.created_at))}</span>
        {post.edited && <span style={{ color: "var(--dim)", fontSize: 12 }}>· 已编辑</span>}
      </div>
      <div className="detail-stats">
        <span><b>{formatCount(post.views || 0)}</b> 浏览</span>
        <span><b>{formatCount(post.reposts || 0)}</b> 转发</span>
        <span><b>{formatCount(post.likes || 0)}</b> 赞</span>
        <span><b>{comments.length}</b> 评论</span>
      </div>
      <div className="detail-actions">
        <button className="detail-action">💬 <span className="pa-count">{comments.length}</span></button>
        <button className="detail-action retweet" onClick={() => onRepost?.(post)}><Icons.RT /> <span className="pa-count">{post.reposts || 0}</span></button>
        <button className={`detail-action ${liked ? "liked" : ""}`} onClick={() => onLike(post)}>
          {liked ? <Icons.HeartFill /> : <Icons.Heart />} <span className="pa-count">{post.likes || 0}</span>
        </button>
        <button className="detail-action views-action"><Icons.Views /> <span className="pa-count">{post.views || 0}</span></button>
        <div style={{marginLeft:"auto",display:"flex",gap:4}}>
          <button className={`detail-action bookmark-action ${bookmarked ? "bookmarked" : ""}`} onClick={() => onBookmark?.(post)}>
            {bookmarked ? <Icons.BookmarkFill /> : <Icons.Bookmark />}
          </button>
          <button className="detail-action" onClick={() => onShare(post)}><Icons.Share /></button>
        </div>
      </div>
      <div className="cmt-section">
        {user && (
          <div className="cmt-input-area">
            <div className="comment-avatar">{user.username[0]}</div>
            <textarea className="cmt-textarea" value={commentText} onChange={(e) => setCommentText(e.target.value)} placeholder="发表评论..." rows={1} maxLength={500} />
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 11, color: commentText.length > 450 ? "var(--red)" : "var(--muted)" }}>{commentText.length}/500</span>
              <button className="cmt-send" onClick={handleComment} disabled={commentLoading || !commentText.trim()}>
                {commentLoading ? "..." : "回复"}
              </button>
            </div>
          </div>
        )}
        {commentTree.map((node) => (
          <CommentNode key={node.id} node={node} user={user} onDelete={handleDeleteComment}
            replyTarget={replyTarget} setReplyTarget={setReplyTarget}
            replyText={replyText} setReplyText={setReplyText}
            submitting={replySubmitting} onSubmitReply={handleReply} onUserClick={onUserClick} />
        ))}
        {!user && <p style={{ textAlign: "center", padding: 20, color: "var(--muted)", fontSize: 13 }}>登录后评论</p>}
      </div>
    </div>
  );
}
