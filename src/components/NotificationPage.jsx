import React from "react";
import { Icons } from "./Icons";
import NotificationItem from "./NotificationItem";
import { useAuth } from "../context/AuthContext";

export default function NotificationPage({ notifications, onNotifClick, onBack }) {
  const { user } = useAuth();

  return (
    <div className="notif-page">
      <div className="detail-top">
        {onBack && <button className="detail-back" onClick={onBack}><Icons.Back /></button>}
        <span className="detail-top-title">通知</span>
      </div>
      {!user ? (
        <div className="empty-state"><div className="icon">🔔</div><h3>登录后查看通知</h3></div>
      ) : notifications.length === 0 ? (
        <div className="empty-state"><div className="icon">🔔</div><h3>暂无通知</h3><p>当有人互动时会出现在这里</p></div>
      ) : (
        notifications.map((n) => <NotificationItem key={n.id} notif={n} onClick={onNotifClick} />)
      )}
    </div>
  );
}
