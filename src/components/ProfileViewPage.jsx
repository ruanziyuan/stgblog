import React, { useState, useEffect, useCallback } from "react";
import { supabase } from "../supabase";
import { useAuth } from "../context/AuthContext";
import { Icons } from "./Icons";
import PostCard from "./PostCard";

export default function ProfileViewPage({ viewingProfile, posts: allPosts, onBack, onSelectPost, onLike, onShare, onRepost, onBookmark, onOpenDm }) {
  const { user, followingSet, follow, unfollow } = useAuth();
  const [profileData, setProfileData] = useState(null);

  useEffect(() => {
    if (!viewingProfile) return;
    (async () => {
      const { data: userData } = await supabase.from("users").select("username, bio, created_at").eq("username", viewingProfile).maybeSingle();
      const { count: postCount } = await supabase.from("posts").select("*", { count: "exact", head: true }).eq("author", viewingProfile);
      const { count: followers } = await supabase.from("follows").select("*", { count: "exact", head: true }).eq("following", viewingProfile);
      const { count: following } = await supabase.from("follows").select("*", { count: "exact", head: true }).eq("follower", viewingProfile);
      setProfileData({
        user: userData || { username: viewingProfile },
        postCount: postCount || 0,
        followers: followers || 0,
        following: following || 0,
        isFollowing: followingSet.has(viewingProfile),
      });
    })();
  }, [viewingProfile, followingSet]);

  const handleFollowToggle = useCallback(async () => {
    if (!profileData) return;
    if (profileData.isFollowing) {
      await unfollow(viewingProfile);
      setProfileData((d) => d ? { ...d, isFollowing: false, followers: d.followers - 1 } : d);
    } else {
      await follow(viewingProfile);
      setProfileData((d) => d ? { ...d, isFollowing: true, followers: d.followers + 1 } : d);
    }
  }, [profileData, viewingProfile, follow, unfollow]);

  const userPosts = allPosts?.filter((p) => p.author === viewingProfile) || [];

  if (!profileData) return <div className="loader" style={{ margin: "80px auto" }} />;

  const { user: profileUser, postCount, followers, following, isFollowing } = profileData;

  return (
    <>
      <div className="detail-top">
        <button className="detail-back" onClick={onBack}><Icons.Back /></button>
        <span className="detail-top-title">{viewingProfile}</span>
      </div>
      <div className="profile-header">
        <div className="profile-banner" />
        <div className="profile-info">
          <div className="profile-avatar">{viewingProfile[0]}</div>
          <div className="profile-name">{viewingProfile}</div>
          <div className="profile-handle">@{viewingProfile}</div>
          <div className="profile-bio">{profileUser.bio || "STGBLOG 用户"}</div>
          <div className="profile-stats">
            <span><b>{postCount}</b> 帖子</span>
            <span><b>{following}</b> 关注</span>
            <span><b>{followers}</b> 粉丝</span>
          </div>
          <div className="profile-actions">
            {user && viewingProfile !== user.username && (
              <button className={`follow-btn ${isFollowing ? "following" : ""}`} onClick={handleFollowToggle}>
                {isFollowing ? "已关注" : "关注"}
              </button>
            )}
            {user && viewingProfile !== user.username && (
              <button className="profile-edit" onClick={() => onOpenDm(viewingProfile)}>💬 私信</button>
            )}
          </div>
        </div>
      </div>
      <div className="feed">
        {userPosts.length === 0 ? (
          <div className="empty-state"><div className="icon">📝</div><h3>暂无帖子</h3></div>
        ) : userPosts.map((post) => (
          <PostCard key={post.id} post={post} onSelect={onSelectPost} onLike={onLike} onShare={onShare} onRepost={onRepost} onBookmark={onBookmark} />
        ))}
      </div>
    </>
  );
}
