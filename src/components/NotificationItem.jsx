import React, { memo } from "react";
import { formatTime } from "../utils";

const typeMap = {
  like: { icon: "❤️", text: "赞了你的帖子" },
  comment: { icon: "💬", text: "评论了你的帖子" },
  reply: { icon: "↩️", text: "回复了你的评论" },
  follow: { icon: "👤", text: "关注了你" },
  repost: { icon: "🔁", text: "转发了你的帖子" },
  quote: { icon: "💭", text: "引用了你的帖子" },
};

const NotificationItem = memo(function NotificationItem({ notif, onClick }) {
  const { icon, text } = typeMap[notif.type] || { icon: "🔔", text: "新通知" };
  return (
    <div className={`notif-item ${notif.read ? "" : "unread"}`} onClick={() => onClick(notif)}>
      <div className="notif-icon">{icon}</div>
      <div className="notif-body">
        <span className="notif-from">{notif.user_from}</span>
        <span className="notif-text">{text}</span>
        <span className="notif-time">{formatTime(notif.created_at)}</span>
      </div>
      {!notif.read && <div className="notif-dot" />}
    </div>
  );
});

export default NotificationItem;
