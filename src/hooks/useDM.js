import { useState, useCallback, useEffect, useRef } from "react";
import { supabase } from "../supabase";
import { encryptMessage, decryptMessage } from "../crypto";

// localStorage helpers for DM conversation cache
const CACHE_KEY = (username) => `stgblog_dm_conversations_${username}`;

function loadCachedConversations(username) {
  try {
    return JSON.parse(localStorage.getItem(CACHE_KEY(username))) || [];
  } catch { return []; }
}

function saveCachedConversations(username, list) {
  try {
    localStorage.setItem(CACHE_KEY(username), JSON.stringify(list));
  } catch {}
}

const DM_PAGE_SIZE = 50;

export function useDM(user, keyPair) {
  const [dmList, setDmList] = useState([]);
  const [dmTarget, setDmTarget] = useState(null);
  const [dmMessages, setDmMessages] = useState([]);
  const [dmSending, setDmSending] = useState(false);
  const [dmUnreadCount, setDmUnreadCount] = useState(0);
  const [dmHasMore, setDmHasMore] = useState(true);
  const [dmLoadingMore, setDmLoadingMore] = useState(false);
  const dmListRef = useRef(dmList);
  dmListRef.current = dmList;
  const dmMessagesRef = useRef(dmMessages);
  dmMessagesRef.current = dmMessages;

  // Load from cache instantly, then refresh from DB
  const loadDmList = useCallback(async () => {
    if (!user) return;

    // 1. Show cached data instantly
    const cached = loadCachedConversations(user.username);
    if (cached.length > 0) setDmList(cached);

    // 2. Fetch fresh data from DB
    const { data, error } = await supabase.from("dm_messages").select("*")
      .or(`sender.eq.${user.username},receiver.eq.${user.username}`)
      .order("created_at", { ascending: false });
    if (error || !data) return;

    // Build conversation map from messages
    const conversations = {};
    data.forEach((msg) => {
      const other = msg.sender === user.username ? msg.receiver : msg.sender;
      if (!conversations[other] || new Date(msg.created_at) > new Date(conversations[other].created_at)) {
        conversations[other] = msg;
      }
    });

    // 3. Merge with locally persisted conversations (e.g. from NewDmModal)
    let persisted = [];
    try { persisted = JSON.parse(localStorage.getItem(`stgblog_dm_opened_${user.username}`)) || []; } catch {}
    persisted.forEach((u) => {
      if (!conversations[u]) conversations[u] = null; // placeholder for conversations without messages
    });

    // 4. Fetch pin states
    let pinnedSet = new Set();
    try {
      const { data: pins } = await supabase.from("dm_pins").select("pinned_user").eq("username", user.username);
      if (pins) pinnedSet = new Set(pins.map((p) => p.pinned_user));
    } catch {}

    // 5. Build sorted list: pinned first, then by last message time
    const list = Object.entries(conversations)
      .map(([other, last]) => ({ other, last, pinned: pinnedSet.has(other) }))
      .sort((a, b) => {
        if (a.pinned && !b.pinned) return -1;
        if (!a.pinned && b.pinned) return 1;
        const ta = a.last?.created_at || "1970-01-01";
        const tb = b.last?.created_at || "1970-01-01";
        return new Date(tb) - new Date(ta);
      });

    setDmList(list);
    saveCachedConversations(user.username, list);
  }, [user]);

  // Poll unread DM count
  const checkUnread = useCallback(async () => {
    if (!user) return;
    try {
      const { count, error } = await supabase.from("dm_messages")
        .select("*", { count: "exact", head: true })
        .eq("receiver", user.username)
        .eq("read", false);
      if (!error) setDmUnreadCount(count || 0);
    } catch {}
  }, [user]);

  useEffect(() => {
    if (!user) { setDmUnreadCount(0); return; }
    checkUnread();
    const interval = setInterval(checkUnread, 15000);
    return () => clearInterval(interval);
  }, [user, checkUnread]);

  const decryptMessages = useCallback(async (data, otherUser) => {
    if (!keyPair?.privateKey) {
      return data.map((msg) => ({ ...msg, decrypted: false }));
    }

    let otherUserPubKeyStr = null;
    const { data: otherUserData } = await supabase.from("users").select("pubkey").eq("username", otherUser).maybeSingle();
    if (otherUserData?.pubkey) otherUserPubKeyStr = otherUserData.pubkey;

    const decrypted = await Promise.all(data.map(async (msg) => {
      if (msg.encrypted && msg.ciphertext && msg.iv) {
        try {
          const isMine = msg.sender === user.username;
          let peerPubKeyStr = isMine ? msg.receiver_pubkey : msg.sender_pubkey;
          if (!peerPubKeyStr) peerPubKeyStr = otherUserPubKeyStr;
          if (!peerPubKeyStr) {
            const peerName = isMine ? otherUser : msg.sender;
            const { data: peerData } = await supabase.from("users").select("pubkey").eq("username", peerName).maybeSingle();
            if (peerData?.pubkey) peerPubKeyStr = peerData.pubkey;
          }
          if (!peerPubKeyStr) return { ...msg, content: "[加密消息 · 无法解密]", decrypted: false };
          const peerPubKey = JSON.parse(peerPubKeyStr);
          const plain = await decryptMessage(msg.ciphertext, msg.iv, keyPair.privateKey, peerPubKey);
          return { ...msg, content: plain, decrypted: true };
        } catch (e) {
          console.warn("Decrypt failed for msg", msg.id, e);
          return { ...msg, content: "[加密消息 · 无法解密]", decrypted: false };
        }
      }
      return { ...msg, decrypted: false };
    }));
    return decrypted;
  }, [user, keyPair]);

  const loadDmMessages = useCallback(async (otherUser) => {
    if (!user || !otherUser) return;
    setDmHasMore(true);
    setDmMessages([]);

    const { data, error } = await supabase.from("dm_messages").select("*")
      .or(`and(sender.eq.${user.username},receiver.eq.${otherUser}),and(sender.eq.${otherUser},receiver.eq.${user.username})`)
      .order("created_at", { ascending: false })
      .limit(DM_PAGE_SIZE);
    if (error || !data) { setDmMessages([]); setDmHasMore(false); return; }

    setDmHasMore(data.length >= DM_PAGE_SIZE);

    const reversed = [...data].reverse();
    const decrypted = await decryptMessages(reversed, otherUser);
    setDmMessages(decrypted);

    try {
      await supabase.from("dm_messages").update({ read: true })
        .eq("sender", otherUser).eq("receiver", user.username).eq("read", false);
      checkUnread();
    } catch {}
  }, [user, decryptMessages, checkUnread]);

  const loadMoreDmMessages = useCallback(async () => {
    if (!user || !dmTarget || dmLoadingMore || !dmHasMore) return;
    setDmLoadingMore(true);

    const currentMessages = dmMessagesRef.current;
    const oldestMsg = currentMessages[0];
    const { data, error } = await supabase.from("dm_messages").select("*")
      .or(`and(sender.eq.${user.username},receiver.eq.${dmTarget}),and(sender.eq.${dmTarget},receiver.eq.${user.username})`)
      .order("created_at", { ascending: false })
      .limit(DM_PAGE_SIZE)
      .lt("created_at", oldestMsg?.created_at || new Date().toISOString());

    setDmLoadingMore(false);

    if (error || !data || data.length === 0) {
      setDmHasMore(false);
      return;
    }

    setDmHasMore(data.length >= DM_PAGE_SIZE);

    const reversed = [...data].reverse();
    const decrypted = await decryptMessages(reversed, dmTarget);
    setDmMessages((prev) => [...decrypted, ...prev]);
  }, [user, dmTarget, dmLoadingMore, dmHasMore, decryptMessages]);

  const sendDm = useCallback(async (content) => {
    if (!user || !dmTarget || !content.trim()) return false;
    setDmSending(true);

    const { data: recipient } = await supabase.from("users").select("pubkey").eq("username", dmTarget).maybeSingle();
    let msgData;
    let usedEncryption = false;

    if (recipient?.pubkey && keyPair?.privateKey) {
      try {
        const recipientPubKey = JSON.parse(recipient.pubkey);
        const { ciphertext, iv } = await encryptMessage(content, keyPair.privateKey, recipientPubKey);
        msgData = {
          sender: user.username, receiver: dmTarget,
          content: "[加密消息]", ciphertext, iv, encrypted: true,
          sender_pubkey: JSON.stringify(keyPair.publicKey),
          receiver_pubkey: recipient.pubkey,
        };
        usedEncryption = true;
      } catch (e) {
        console.warn("Encryption failed, sending plain:", e);
        msgData = { sender: user.username, receiver: dmTarget, content, encrypted: false };
      }
    } else {
      msgData = { sender: user.username, receiver: dmTarget, content, encrypted: false };
    }

    const { data, error } = await supabase.from("dm_messages").insert([msgData]).select("*").single();
    if (!error && data) {
      if (usedEncryption) {
        setDmMessages((prev) => [...prev, { ...data, content, decrypted: true, encrypted: true }]);
      } else {
        setDmMessages((prev) => [...prev, { ...data, content, decrypted: false, encrypted: false }]);
      }
      loadDmList();
    }
    setDmSending(false);
    return !error;
  }, [user, dmTarget, keyPair, loadDmList]);

  const markAsRead = useCallback(async (otherUser) => {
    if (!user || !otherUser) return;
    try {
      await supabase.from("dm_messages").update({ read: true })
        .eq("sender", otherUser).eq("receiver", user.username).eq("read", false);
      checkUnread();
    } catch {}
  }, [user, checkUnread]);

  // Persist opened conversation locally (so it shows even without messages)
  const persistConversation = useCallback((otherUser) => {
    if (!user || !otherUser) return;
    const key = `stgblog_dm_opened_${user.username}`;
    try {
      const list = JSON.parse(localStorage.getItem(key)) || [];
      if (!list.includes(otherUser)) {
        list.push(otherUser);
        localStorage.setItem(key, JSON.stringify(list));
      }
    } catch {}
  }, [user]);

  const openDm = useCallback(async (otherUser) => {
    setDmTarget(otherUser);
    persistConversation(otherUser);
    // Also add to local list immediately
    setDmList((prev) => {
      if (prev.some((c) => c.other === otherUser)) return prev;
      const newList = [{ other: otherUser, last: null, pinned: false }, ...prev];
      saveCachedConversations(user.username, newList);
      return newList;
    });
    await loadDmMessages(otherUser);
  }, [loadDmMessages, persistConversation, user]);

  const closeDm = useCallback(() => {
    setDmTarget(null);
    setDmMessages([]);
    loadDmList();
    checkUnread();
  }, [loadDmList, checkUnread]);

  // Pin / Unpin conversation
  const togglePin = useCallback(async (otherUser) => {
    if (!user) return;
    const isPinned = dmListRef.current.find((c) => c.other === otherUser)?.pinned;
    if (isPinned) {
      await supabase.from("dm_pins").delete()
        .eq("username", user.username).eq("pinned_user", otherUser);
    } else {
      await supabase.from("dm_pins").insert([{ username: user.username, pinned_user: otherUser }]);
    }
    // Update local state immediately
    setDmList((prev) => {
      const updated = prev.map((c) => c.other === otherUser ? { ...c, pinned: !isPinned } : c)
        .sort((a, b) => {
          if (a.pinned && !b.pinned) return -1;
          if (!a.pinned && b.pinned) return 1;
          const ta = a.last?.created_at || "1970-01-01";
          const tb = b.last?.created_at || "1970-01-01";
          return new Date(tb) - new Date(ta);
        });
      saveCachedConversations(user.username, updated);
      return updated;
    });
  }, [user]);

  // Delete conversation (hide from list)
  const deleteConversation = useCallback(async (otherUser) => {
    if (!user) return;
    // Remove from local persistence
    const key = `stgblog_dm_opened_${user.username}`;
    try {
      const list = JSON.parse(localStorage.getItem(key)) || [];
      localStorage.setItem(key, JSON.stringify(list.filter((u) => u !== otherUser)));
    } catch {}
    // Remove pin if exists
    await supabase.from("dm_pins").delete()
      .eq("username", user.username).eq("pinned_user", otherUser);
    // Update local state
    setDmList((prev) => {
      const updated = prev.filter((c) => c.other !== otherUser);
      saveCachedConversations(user.username, updated);
      return updated;
    });
  }, [user]);

  return {
    dmList, dmTarget, dmMessages, dmSending, dmUnreadCount,
    dmHasMore, dmLoadingMore,
    loadDmList, loadDmMessages, loadMoreDmMessages, sendDm, openDm, closeDm, markAsRead,
    setDmTarget, togglePin, deleteConversation,
  };
}
