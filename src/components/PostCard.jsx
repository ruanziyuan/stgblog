import React, { memo, useCallback, useState } from "react";
import { Icons } from "./Icons";
import { hasLiked, hasBookmarked, formatTimeShort, formatCount, parseContent, getBlockedSet, getMutedSet } from "../utils";
import { useAuth } from "../context/AuthContext";

function RenderContent({ content, onHashtag, onMention }) {
  const parts = parseContent(content);
  return (
    <div className="post-content">
      {parts.map((p, i) => {
        if (p.type === "hashtag") return <span key={i} className="hashtag" onClick={(e) => { e.stopPropagation(); onHashtag?.(p.value); }}>{p.value}</span>;
        if (p.type === "mention") return <span key={i} className="mention" onClick={(e) => { e.stopPropagation(); onMention?.(p.value.slice(1)); }}>{p.value}</span>;
        if (p.type === "newline") return <br key={i} />;
        return <span key={i}>{p.value}</span>;
      })}
    </div>
  );
}

const PostCard = memo(function PostCard({ post, onSelect, onLike, onShare, onRepost, onBookmark, onHashtag }) {
  const { user, followingSet, follow } = useAuth();
  const [showMenu, setShowMenu] = useState(false);
  const bookmarked = hasBookmarked(post.id);
  const liked = hasLiked(post.id);

  const isRepost = !!post.repost_of;
  const displayPost = isRepost ? (post.repost_data || post) : post;
  const repostAuthor = isRepost ? post.author : null;

  const handleAuthorClick = useCallback((e) => {
    e.stopPropagation();
    onSelect(displayPost, "profile");
  }, [displayPost, onSelect]);

  const handleMention = useCallback((username) => {
    onSelect({ author: username }, "profile");
  }, [onSelect]);

  return (
    <article className="post" onClick={() => onSelect(displayPost)}>
      {isRepost && (
        <div className="repost-indicator">
          <Icons.RT /> <span>{repostAuthor} 转发了</span>
        </div>
      )}
      <div className="post-avatar" style={{ cursor: "pointer" }} onClick={handleAuthorClick}>{displayPost.author[0]}</div>
      <div className="post-body">
        <div className="post-head">
          <span className="post-author" onClick={handleAuthorClick} style={{ cursor: "pointer" }}>{displayPost.author}</span>
          <span className="post-handle">@{displayPost.author}</span>
          <span className="post-dot">·</span>
          <span className="post-time">{formatTimeShort(displayPost.created_at)}</span>
          {displayPost.pinned && <span className="post-pin-icon"><Icons.Pin /></span>}
          {displayPost.edited && <span className="post-edited-tag">已编辑</span>}
          {user && displayPost.author !== user.username && !followingSet.has(displayPost.author) && (
            <button className="follow-inline-btn" onClick={(e) => { e.stopPropagation(); follow(displayPost.author); }}>+ 关注</button>
          )}
          <div className="post-menu-wrap" style={{ marginLeft: "auto" }}>
            <button className="post-action more-btn" onClick={(e) => { e.stopPropagation(); setShowMenu(!showMenu); }}>
              <Icons.MoreHorizontal />
            </button>
            {showMenu && (
              <div className="post-menu" onClick={(e) => e.stopPropagation()}>
                {user && displayPost.author !== user.username && (
                  <>
                    <button onClick={() => { onRepost?.(displayPost); setShowMenu(false); }}>
                      <Icons.RT /> 转发
                    </button>
                    <button onClick={() => { onBookmark?.(displayPost); setShowMenu(false); }}>
                      {bookmarked ? <Icons.BookmarkFill /> : <Icons.Bookmark />} {bookmarked ? "取消书签" : "加入书签"}
                    </button>
                    <div className="menu-divider" />
                  </>
                )}
                <button onClick={(e) => { e.stopPropagation(); setShowMenu(false); }}>
                  <Icons.Share /> 分享链接
                </button>
              </div>
            )}
          </div>
        </div>
        <RenderContent content={displayPost.content} onHashtag={onHashtag} onMention={handleMention} />
        {displayPost.quote_of && displayPost.quote_data && (
          <div className="quote-card" onClick={(e) => { e.stopPropagation(); onSelect(displayPost.quote_data); }}>
            <div className="quote-head">
              <span className="post-author">{displayPost.quote_data.author}</span>
              <span className="post-handle">@{displayPost.quote_data.author}</span>
            </div>
            <div className="quote-content">{displayPost.quote_data.content?.slice(0, 140)}{displayPost.quote_data.content?.length > 140 ? "..." : ""}</div>
          </div>
        )}
        <div className="post-actions">
          <button className="post-action" onClick={(e) => { e.stopPropagation(); onSelect(displayPost); }} title="评论">
            <span className="pa-icon">💬</span>
            <span className="pa-count">{formatCount(displayPost.comment_count || 0)}</span>
          </button>
          <button className={`post-action retweet ${isRepost ? "reposted" : ""}`} onClick={(e) => { e.stopPropagation(); onRepost?.(displayPost); }} title="转发">
            <span className="pa-icon"><Icons.RT /></span>
            <span className="pa-count">{formatCount(displayPost.reposts || 0)}</span>
          </button>
          <button className={`post-action ${liked ? "liked" : ""}`} onClick={(e) => { e.stopPropagation(); onLike(displayPost); }} title="喜欢">
            <span className="pa-icon">{liked ? <Icons.HeartFill /> : <Icons.Heart />}</span>
            <span className="pa-count">{formatCount(displayPost.likes || 0)}</span>
          </button>
          <button className="post-action views-action" title="浏览">
            <span className="pa-icon"><Icons.Views /></span>
            <span className="pa-count">{formatCount(displayPost.views || 0)}</span>
          </button>
          <div className="post-actions-right">
            <button className={`post-action bookmark-action ${bookmarked ? "bookmarked" : ""}`} onClick={(e) => { e.stopPropagation(); onBookmark?.(displayPost); }} title="书签">
              <span className="pa-icon">{bookmarked ? <Icons.BookmarkFill /> : <Icons.Bookmark />}</span>
            </button>
            <button className="post-action share-action" onClick={(e) => { e.stopPropagation(); onShare(displayPost); }} title="分享">
              <span className="pa-icon"><Icons.Share /></span>
            </button>
          </div>
        </div>
      </div>
    </article>
  );
});

export default PostCard;
