import React, { memo } from "react";
import { formatTimeShort } from "../utils";

const CommentNode = memo(function CommentNode({ node, user, onDelete, replyTarget, setReplyTarget, replyText, setReplyText, submitting, onSubmitReply, onUserClick }) {
  return (
    <div className="comment">
      <div className="comment-avatar" style={{ cursor: "pointer" }} onClick={() => onUserClick?.(node.author)}>{node.author[0]}</div>
      <div className="comment-body">
        <div className="comment-head">
          <b style={{ cursor: "pointer" }} onClick={() => onUserClick?.(node.author)}>{node.author}</b>
          <span className="handle">@{node.author}</span>
          <span className="time">{formatTimeShort(node.created_at)}</span>
          {user && node.author === user.username && (
            <button className="comment-action comment-del" onClick={() => onDelete(node)}>删除</button>
          )}
        </div>
        <p className="comment-text">{node.content}</p>
        <div className="comment-actions">
          {user && (
            <button className="comment-action" onClick={() => setReplyTarget(replyTarget === node.id ? null : node.id)}>
              {replyTarget === node.id ? "取消" : "回复"}
            </button>
          )}
        </div>
        {replyTarget === node.id && (
          <div className="reply-box">
            <input className="reply-input" value={replyText} onChange={(e) => setReplyText(e.target.value)} placeholder={`回复 @${node.author}...`} />
            <button className="reply-send" onClick={() => onSubmitReply(node.id)} disabled={submitting || !replyText.trim()}>
              {submitting ? "..." : "回复"}
            </button>
          </div>
        )}
        {node.children?.length > 0 && (
          <div className="comment-children">
            {node.children.map((child) => (
              <CommentNode key={child.id} node={child} user={user} onDelete={onDelete}
                replyTarget={replyTarget} setReplyTarget={setReplyTarget}
                replyText={replyText} setReplyText={setReplyText}
                submitting={submitting} onSubmitReply={onSubmitReply} onUserClick={onUserClick} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
});

export default CommentNode;
