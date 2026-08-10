import React, { useState, useEffect, useCallback } from "react";
import { supabase } from "../supabase";
import { useAuth } from "../context/AuthContext";
import { Icons } from "./Icons";

export default function FollowersPage({ username, type, onBack, onUserClick }) {
  const { user, followingSet, follow, unfollow } = useAuth();
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!username) return;
    (async () => {
      setLoading(true);
      const col = type === "followers" ? "follower" : "following";
      const eqCol = type === "followers" ? "following" : "follower";
      const { data } = await supabase.from("follows").select(col).eq(eqCol, username).limit(200);
      if (data) {
        const usernames = data.map((r) => r[col]);
        // Fetch user info
        if (usernames.length > 0) {
          const { data: users } = await supabase.from("users").select("username, bio").in("username", usernames);
          setList(users || []);
        } else {
          setList([]);
        }
      }
      setLoading(false);
    })();
  }, [username, type]);

  return (
    <div className="followers-page">
      <div className="detail-top">
        <button className="detail-back" onClick={onBack}><Icons.Back /></button>
        <span className="detail-top-title">{type === "followers" ? "粉丝" : "关注"}</span>
      </div>
      {loading && <div className="loader" style={{ margin: "40px auto" }} />}
      {!loading && list.length === 0 && (
        <div className="empty-state">
          <div className="icon">{type === "followers" ? "👤" : "👥"}</div>
          <h3>{type === "followers" ? "暂无粉丝" : "暂无关注"}</h3>
        </div>
      )}
      {list.map((u) => (
        <div key={u.username} className="follower-item" onClick={() => onUserClick(u.username)}>
          <div className="post-avatar" style={{ width: 40, height: 40, fontSize: 16 }}>{u.username[0]}</div>
          <div className="follower-info">
            <div className="follower-name">{u.username}</div>
            <div className="follower-bio">{u.bio || "STGBLOG 用户"}</div>
          </div>
          {user && u.username !== user.username && (
            followingSet.has(u.username) ? (
              <button className="follow-btn following" onClick={(e) => { e.stopPropagation(); unfollow(u.username); }}>已关注</button>
            ) : (
              <button className="follow-btn" onClick={(e) => { e.stopPropagation(); follow(u.username); }}>关注</button>
            )
          )}
        </div>
      ))}
    </div>
  );
}
