import React, { useMemo, useCallback, useRef, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { getHotPosts, getRecommendPosts, getLikedSet, getBlockedSet, getMutedSet, getViewedSet } from "../utils";
import PostCard from "./PostCard";
import ComposeBar from "./ComposeBar";

export default function HomeFeed({
  posts, postsLoading, hasMore, loadMorePosts, tab, setTab, searchKey,
  composeText, setComposeText, onPublish, publishing, composeRef,
  onSelectPost, onLike, onShare, onRepost, onBookmark, onHashtag,
}) {
  const { user, followingSet } = useAuth();
  const sentinelRef = useRef(null);

  const displayedPosts = useMemo(() => {
    const kw = searchKey.trim().toLowerCase();
    const blocked = getBlockedSet();
    const muted = getMutedSet();
    let f = posts.filter((p) => {
      if (blocked.has(p.author)) return false;
      if (muted.has(p.author)) return false;
      if (kw && ![p.title, p.content, p.author, p.category].join(" ").toLowerCase().includes(kw)) return false;
      return true;
    });
    if (tab === "我的") { if (!user) return []; f = f.filter((p) => p.author === user.username); }
    if (tab === "关注") {
      if (!user) return [];
      f = f.filter((p) => followingSet.has(p.author) || p.author === user.username);
      return [...f].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    }
    if (tab === "热门") return getHotPosts(f);
    if (tab === "推荐") return getRecommendPosts(f, { followingSet, likedPosts: getLikedSet(), viewedPosts: getViewedSet() });
    if (tab === "书签") {
      const bm = new Set(JSON.parse(localStorage.getItem("bookmarkedPosts") || "[]"));
      return f.filter((p) => bm.has(p.id));
    }
    return [...f].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  }, [posts, searchKey, tab, user, followingSet]);

  // Infinite scroll: observe sentinel at bottom
  useEffect(() => {
    if (!sentinelRef.current) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !postsLoading) {
          loadMorePosts();
        }
      },
      { rootMargin: "200px" }
    );
    observer.observe(sentinelRef.current);
    return () => observer.disconnect();
  }, [hasMore, postsLoading, loadMorePosts]);

  return (
    <>
      <div className="feed-header">
        <div className="feed-tabs">
          {["最新", "热门", "推荐", "关注", "书签", "我的"].map((t) => (
            <button key={t} className={`feed-tab ${tab === t ? "on" : ""}`} onClick={() => setTab(t)}>{t}</button>
          ))}
        </div>
      </div>
      <div className="feed">
        <ComposeBar value={composeText} onChange={setComposeText} onPublish={onPublish} publishing={publishing} composeRef={composeRef} />
        {postsLoading && <div className="loader" />}
        {!postsLoading && displayedPosts.length === 0 && (
          <div className="empty-state">
            <div className="icon">{tab === "书签" ? "🔖" : "📝"}</div>
            <h3>{tab === "书签" ? "暂无书签" : "暂无内容"}</h3>
            <p>{tab === "书签" ? "收藏帖子后会出现在这里" : tab === "关注" ? "关注一些用户后，他们的帖子会出现在这里" : user ? "成为第一个发帖的人" : "登录后发帖互动"}</p>
          </div>
        )}
        {displayedPosts.map((post) => (
          <PostCard key={post.id} post={post} onSelect={onSelectPost} onLike={onLike} onShare={onShare} onRepost={onRepost} onBookmark={onBookmark} onHashtag={onHashtag} />
        ))}
        {/* Infinite scroll sentinel */}
        <div ref={sentinelRef} style={{ height: 1 }} />
        {hasMore && !postsLoading && displayedPosts.length > 0 && (
          <div style={{ textAlign: "center", padding: 16, color: "var(--muted)", fontSize: 13 }}>加载更多...</div>
        )}
      </div>
    </>
  );
}
