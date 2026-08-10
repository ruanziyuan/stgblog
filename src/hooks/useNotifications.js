import { useState, useCallback, useEffect, useRef } from "react";
import { supabase } from "../supabase";

export function useNotifications(username) {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);

  const load = useCallback(async () => {
    if (!username) return;
    const { data } = await supabase.from("notifications").select("*")
      .eq("user_to", username).order("created_at", { ascending: false }).limit(50);
    if (data) {
      setNotifications(data);
      setUnreadCount(data.filter((n) => !n.read).length);
    }
  }, [username]);

  // Poll every 30s
  useEffect(() => {
    if (!username) return;
    load();
    const interval = setInterval(load, 30000);
    return () => clearInterval(interval);
  }, [username, load]);

  const markAllRead = useCallback(async () => {
    if (!username) return;
    setUnreadCount(0);
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    await supabase.from("notifications").update({ read: true }).eq("user_to", username).eq("read", false);
  }, [username]);

  const markOneRead = useCallback(async (id) => {
    await supabase.from("notifications").update({ read: true }).eq("id", id);
    setNotifications((prev) => prev.map((n) => n.id === id ? { ...n, read: true } : n));
    setUnreadCount((c) => Math.max(0, c - 1));
  }, []);

  return { notifications, unreadCount, markAllRead, markOneRead, reload: load };
}
