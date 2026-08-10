// 生成匿名内部ID
export function generateHash() {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let result = "STG-";
  for (let i = 0; i < 10; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// ─── 热门排序（带时间衰减）───
export function getHotPosts(posts) {
  const now = Date.now();
  return [...posts].sort((a, b) => {
    const ageA = (now - new Date(a.created_at).getTime()) / 3600000;
    const ageB = (now - new Date(b.created_at).getTime()) / 3600000;
    const scoreA = ((a.likes || 0) * 5 + (a.views || 0) * 0.2 + (a.comment_count || 0) * 3 + (a.pinned ? 1000 : 0))
      / Math.pow(ageA + 2, 1.5);
    const scoreB = ((b.likes || 0) * 5 + (b.views || 0) * 0.2 + (b.comment_count || 0) * 3 + (b.pinned ? 1000 : 0))
      / Math.pow(ageB + 2, 1.5);
    return scoreB - scoreA;
  });
}

// ─── X (Twitter) 风格智能推荐算法 ───
export function getRecommendPosts(posts, { followingSet = new Set(), likedPosts = new Set(), viewedPosts = new Set() } = {}) {
  const now = Date.now();
  
  const authorStats = {};
  posts.forEach((post) => {
    if (!authorStats[post.author]) {
      authorStats[post.author] = { posts: 0, totalLikes: 0, totalComments: 0, avgEngagement: 0 };
    }
    authorStats[post.author].posts++;
    authorStats[post.author].totalLikes += post.likes || 0;
    authorStats[post.author].totalComments += post.comment_count || 0;
  });
  
  Object.keys(authorStats).forEach((author) => {
    const stats = authorStats[author];
    stats.avgEngagement = stats.posts > 0 
      ? (stats.totalLikes * 2 + stats.totalComments * 5) / stats.posts 
      : 0;
    stats.authorScore = Math.min(10, 1 + Math.log1p(stats.avgEngagement) * 0.5);
  });

  const scored = posts.map((post) => {
    const createdAt = new Date(post.created_at).getTime();
    const ageHours = (now - createdAt) / 3600000;
    
    const timeFactor = ageHours < 1 ? 1.0 :
                       ageHours < 6 ? 0.9 :
                       ageHours < 24 ? 0.7 :
                       ageHours < 48 ? 0.5 :
                       ageHours < 72 ? 0.3 : 0.15;

    const likes = post.likes || 0;
    const views = post.views || 0;
    const comments = post.comment_count || 0;
    const reposts = post.reposts || 0;
    
    const engagementScore = Math.log1p(likes * 3 + comments * 5 + reposts * 4 + views * 0.1);
    
    const len = post.content?.length || 0;
    const qualityBonus = len > 50 && len < 800 ? 1.4 : 
                         len >= 800 ? 1.1 : 
                         len > 0 ? 1.0 : 0.8;
    
    const followBonus = followingSet.has(post.author) ? 3.0 : 1.0;
    
    const authorScore = authorStats[post.author]?.authorScore || 1.0;
    
    const recencyBoost = ageHours < 0.5 ? 2.0 : 
                         ageHours < 2 ? 1.5 : 1.0;
    
    const hasMedia = post.image_url || post.video_url ? 1.2 : 1.0;
    
    const pinBonus = post.pinned ? 1000 : 0;
    
    const topicDiversityBonus = 1.0;
    
    const score = (
      engagementScore * 
      qualityBonus * 
      followBonus * 
      authorScore * 
      recencyBoost * 
      hasMedia * 
      topicDiversityBonus + 
      pinBonus
    ) * timeFactor;

    return { ...post, _score: score, _age: ageHours, _isFollowed: followingSet.has(post.author) };
  });

  scored.sort((a, b) => b._score - a._score);

  const result = [];
  const authorLastIdx = {};
  const categoryLastIdx = {};
  const followedCount = { included: 0, total: scored.filter(p => p._isFollowed).length };

  for (const post of scored) {
    const lastAuthorIdx = authorLastIdx[post.author] ?? -1;
    if (lastAuthorIdx >= 0 && result.length - lastAuthorIdx < 4 && result.length > 6) continue;

    const category = post.category || "uncategorized";
    const lastCatIdx = categoryLastIdx[category] ?? -1;
    if (lastCatIdx >= 0 && result.length - lastCatIdx < 3 && result.length > 4) continue;

    if (post._isFollowed && followedCount.included >= 3 && followedCount.total > 3) {
      const unfollowedRatio = result.filter(p => !p._isFollowed).length / Math.max(result.length, 1);
      if (unfollowedRatio < 0.3) continue;
    }

    if (post._age > 72 && result.length > 20) continue;

    result.push(post);
    authorLastIdx[post.author] = result.length - 1;
    categoryLastIdx[category] = result.length - 1;
    if (post._isFollowed) followedCount.included++;

    if (result.length >= 100) break;
  }

  return result;
}

// ─── 点赞 ───
export function hasLiked(postId) {
  try { return (JSON.parse(localStorage.getItem("likedPosts")) || []).includes(postId); } catch { return false; }
}
export function saveLiked(postId) {
  try {
    const arr = JSON.parse(localStorage.getItem("likedPosts")) || [];
    if (!arr.includes(postId)) { arr.push(postId); localStorage.setItem("likedPosts", JSON.stringify(arr)); }
  } catch {}
}
export function getLikedSet() {
  try { return new Set(JSON.parse(localStorage.getItem("likedPosts")) || []); } catch { return new Set(); }
}

// ─── 浏览计数 ───
export function hasViewed(postId) {
  try {
    const v = JSON.parse(localStorage.getItem("viewedPosts")) || {};
    return v[postId] && Date.now() - v[postId] < 30 * 60 * 1000;
  } catch { return false; }
}
export function saveViewed(postId) {
  try {
    const v = JSON.parse(localStorage.getItem("viewedPosts")) || {};
    v[postId] = Date.now();
    const entries = Object.entries(v).sort((a, b) => b[1] - a[1]).slice(0, 100);
    localStorage.setItem("viewedPosts", JSON.stringify(Object.fromEntries(entries)));
  } catch {}
}
export function getViewedSet() {
  try { return new Set(Object.keys(JSON.parse(localStorage.getItem("viewedPosts")) || {})); } catch { return new Set(); }
}

// ─── 书签 ───
export function hasBookmarked(postId) {
  try { return (JSON.parse(localStorage.getItem("bookmarkedPosts")) || []).includes(postId); } catch { return false; }
}
export function toggleBookmark(postId) {
  try {
    const arr = JSON.parse(localStorage.getItem("bookmarkedPosts")) || [];
    const idx = arr.indexOf(postId);
    if (idx >= 0) arr.splice(idx, 1); else arr.push(postId);
    localStorage.setItem("bookmarkedPosts", JSON.stringify(arr));
    return idx < 0; // returns true if now bookmarked
  } catch { return false; }
}
export function getBookmarkedSet() {
  try { return new Set(JSON.parse(localStorage.getItem("bookmarkedPosts")) || []); } catch { return new Set(); }
}

// ─── 屏蔽/静音 ───
export function getBlockedSet() {
  try { return new Set(JSON.parse(localStorage.getItem("blockedUsers")) || []); } catch { return new Set(); }
}
export function toggleBlock(username) {
  try {
    const arr = JSON.parse(localStorage.getItem("blockedUsers")) || [];
    const idx = arr.indexOf(username);
    if (idx >= 0) arr.splice(idx, 1); else arr.push(username);
    localStorage.setItem("blockedUsers", JSON.stringify(arr));
    return idx < 0;
  } catch { return false; }
}
export function getMutedSet() {
  try { return new Set(JSON.parse(localStorage.getItem("mutedUsers")) || []); } catch { return new Set(); }
}
export function toggleMute(username) {
  try {
    const arr = JSON.parse(localStorage.getItem("mutedUsers")) || [];
    const idx = arr.indexOf(username);
    if (idx >= 0) arr.splice(idx, 1); else arr.push(username);
    localStorage.setItem("mutedUsers", JSON.stringify(arr));
    return idx < 0;
  } catch { return false; }
}

// ─── 主题 ───
export function getTheme() {
  return localStorage.getItem("stgblog_theme") || "dark";
}
export function setTheme(theme) {
  localStorage.setItem("stgblog_theme", theme);
  document.documentElement.setAttribute("data-theme", theme);
}

// ─── 内容解析：#hashtag @mention 可点击 ───
export function parseContent(text) {
  if (!text) return [];
  const regex = /(#\w+)|(@\w+)|(\n)/g;
  const parts = [];
  let lastIndex = 0;
  let match;
  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push({ type: "text", value: text.slice(lastIndex, match.index) });
    }
    if (match[1]) parts.push({ type: "hashtag", value: match[1] });
    else if (match[2]) parts.push({ type: "mention", value: match[2] });
    else if (match[3]) parts.push({ type: "newline" });
    lastIndex = regex.lastIndex;
  }
  if (lastIndex < text.length) parts.push({ type: "text", value: text.slice(lastIndex) });
  return parts;
}

// ─── 格式化时间（精确到秒，Telegram 风格）───
export function formatTime(value) {
  if (!value) return "";
  try {
    const d = new Date(value);
    const now = new Date();
    const diff = now - d;
    const isToday = d.toDateString() === now.toDateString();
    const pad = (n) => String(n).padStart(2, "0");
    const time = `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;

    if (isToday) return time;
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    if (d.toDateString() === yesterday.toDateString()) return `昨天 ${time}`;
    if (diff < 604800000) {
      const days = ["日", "一", "二", "三", "四", "五", "六"];
      return `周${days[d.getDay()]} ${time}`;
    }
    return `${d.getFullYear()}/${pad(d.getMonth() + 1)}/${pad(d.getDate())} ${time}`;
  } catch { return String(value); }
}

// ─── 格式化时间（简短，用于帖子列表）───
export function formatTimeShort(value) {
  if (!value) return "";
  try {
    const d = new Date(value);
    const diff = Date.now() - d.getTime();
    if (diff < 60000) return "刚刚";
    if (diff < 3600000) return `${Math.floor(diff / 60000)}分钟`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}小时`;
    if (diff < 604800000) return `${Math.floor(diff / 86400000)}天`;
    const pad = (n) => String(n).padStart(2, "0");
    return `${d.getMonth() + 1}/${pad(d.getDate())}`;
  } catch { return String(value); }
}

// ─── 格式化数字 ───
export function formatCount(n) {
  if (!n) return "0";
  if (n >= 10000) return (n / 10000).toFixed(1) + "万";
  if (n >= 1000) return (n / 1000).toFixed(1) + "k";
  return String(n);
}

// ─── 构建评论树 ───
export function buildTree(comments) {
  const map = {};
  const roots = [];
  comments.forEach((c) => { map[c.id] = { ...c, children: [] }; });
  comments.forEach((c) => {
    if (c.parent_id && map[c.parent_id]) {
      map[c.parent_id].children.push(map[c.id]);
    } else {
      roots.push(map[c.id]);
    }
  });
  return roots;
}
