import React, { useMemo } from "react";
import { Icons } from "./Icons";
import PostCard from "./PostCard";

export default function SearchPage({ searchKey, setSearchKey, posts, onSelectPost, onLike, onShare, onRepost, onBookmark, onBack }) {
  const results = useMemo(() => {
    if (!searchKey.trim()) return [];
    const kw = searchKey.trim().toLowerCase();
    // Support #hashtag search
    if (kw.startsWith("#")) {
      return posts.filter((p) => p.content?.toLowerCase().includes(kw));
    }
    // Support @mention search - find user's posts
    if (kw.startsWith("@")) {
      const name = kw.slice(1);
      return posts.filter((p) => p.author.toLowerCase().includes(name));
    }
    return posts.filter((p) => [p.title, p.content, p.author, p.category].join(" ").toLowerCase().includes(kw));
  }, [posts, searchKey]);

  const trending = useMemo(() => {
    // Extract hashtags from posts
    const tagCount = {};
    const regex = /#\w+/g;
    posts.forEach((p) => {
      const matches = p.content?.match(regex);
      if (matches) matches.forEach((tag) => { tagCount[tag] = (tagCount[tag] || 0) + 1; });
    });
    return Object.entries(tagCount).sort((a, b) => b[1] - a[1]).slice(0, 10);
  }, [posts]);

  return (
    <>
      <div className="search-bar">
        {onBack && <button className="detail-back" onClick={onBack}><Icons.Back /></button>}
        <span className="search-icon"><Icons.Search /></span>
        <input type="text" placeholder="搜索帖子、用户或 #话题..." value={searchKey} onChange={(e) => setSearchKey(e.target.value)} autoFocus />
      </div>
      <div className="feed">
        {searchKey.trim() && results.length === 0 && (
          <div className="empty-state"><div className="icon">🔍</div><h3>无结果</h3><p>换个关键词试试</p></div>
        )}
        {searchKey.trim() ? results.map((post) => (
          <PostCard key={post.id} post={post} onSelect={onSelectPost} onLike={onLike} onShare={onShare} onRepost={onRepost} onBookmark={onBookmark} />
        )) : (
          <>
            {trending.length > 0 && (
              <div className="trending-section">
                <h3 className="trending-title">热门话题</h3>
                {trending.map(([tag, count]) => (
                  <div key={tag} className="trending-item" onClick={() => setSearchKey(tag)}>
                    <span className="trending-tag">{tag}</span>
                    <span className="trending-count">{count} 条帖子</span>
                  </div>
                ))}
              </div>
            )}
            {trending.length === 0 && (
              <div className="empty-state"><div className="icon">🔍</div><h3>搜索</h3><p>搜索帖子、用户或 #话题</p></div>
            )}
          </>
        )}
      </div>
    </>
  );
}
