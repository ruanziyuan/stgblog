import React, { useState, useEffect, useRef, useCallback } from "react";
import { Moon } from "../ai/moon";

const moon = new Moon();

export default function AIChatPage({ onBack }) {
  const [messages, setMessages] = useState([
    { role: "assistant", content: "你好，我是 Moon 🌙 有什么想聊的？" }
  ]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [loading, setLoading] = useState(true);
  const containerRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    moon.init().then(s => setLoading(false)).catch(() => setLoading(false));
  }, []);

  const scrollBottom = useCallback(() => {
    const c = containerRef.current;
    if (c) c.scrollTop = c.scrollHeight;
  }, []);

  useEffect(() => { scrollBottom(); }, [messages, scrollBottom]);
  useEffect(() => { setTimeout(() => inputRef.current?.focus(), 200); }, []);

  const handleSend = useCallback(async () => {
    if (!input.trim() || isTyping || loading) return;
    const text = input.trim();
    setInput("");
    setMessages(prev => [...prev, { role: "user", content: text }]);
    setIsTyping(true);

    try {
      await moon.replyStream(
        text,
        (t) => {
          setMessages(prev => {
            const last = prev[prev.length - 1];
            if (last?.role === "assistant" && !last.final) {
              return [...prev.slice(0, -1), { role: "assistant", content: t.text }];
            }
            return [...prev, { role: "assistant", content: t.text }];
          });
        },
        (r) => {
          setMessages(prev => {
            const last = prev[prev.length - 1];
            if (last?.role === "assistant") {
              return [...prev.slice(0, -1), { role: "assistant", content: r.text, final: true }];
            }
            return prev;
          });
        }
      );
    } catch (e) {
      console.error('send error:', e);
      setMessages(prev => [...prev, { role: "assistant", content: "出错了，请重试。", final: true }]);
    } finally {
      // 关键：无论如何都要重置 isTyping
      setIsTyping(false);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [input, isTyping, loading]);

  const handleKey = useCallback((e) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
  }, [handleSend]);

  const handleClear = useCallback(() => {
    if (window.confirm("清空对话？")) {
      moon.clearMemory();
      setMessages([{ role: "assistant", content: "你好，我是 Moon 🌙 有什么想聊的？" }]);
    }
  }, []);

  return (
    <div className="moon-wrap">
      {/* Header */}
      <div className="moon-header">
        <button className="moon-back" onClick={onBack}>←</button>
        <div className="moon-header-center">
          <span className="moon-title">Moon</span>
          <span className="moon-status">
            {loading ? "加载中..." : "在线"}
          </span>
        </div>
        <button className="moon-clear" onClick={handleClear} title="清空对话">🗑</button>
      </div>

      {/* Messages */}
      <div className="moon-messages" ref={containerRef}>
        {loading && (
          <div className="moon-loading">
            <div className="moon-loading-icon">🌙</div>
            <div className="moon-loading-text">模型加载中...</div>
            <div className="moon-loading-bar"><div className="moon-loading-fill" /></div>
          </div>
        )}
        {messages.map((msg, i) => (
          <div key={i} className={`moon-msg ${msg.role}`}>
            {msg.content}
          </div>
        ))}
        {isTyping && (
          <div className="moon-msg assistant">
            <span className="moon-dots"><span/><span/><span/></span>
          </div>
        )}
      </div>

      {/* Input */}
      <div className="moon-input-area">
        <textarea
          ref={inputRef}
          className="moon-input"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKey}
          placeholder="输入消息..."
          rows={1}
          disabled={isTyping || loading}
        />
        <button className="moon-send" onClick={handleSend} disabled={isTyping || !input.trim() || loading}>
          ↑
        </button>
      </div>

      <style>{`
        .moon-wrap {
          display: flex; flex-direction: column;
          width: 100%; height: 100%;
          min-height: calc(100vh - var(--nav-h));
          background: var(--bg);
        }
        .moon-header {
          display: flex; align-items: center;
          padding: 12px 16px; gap: 12px;
          border-bottom: 1px solid var(--border);
          flex-shrink: 0;
        }
        .moon-back {
          width: 36px; height: 36px; border-radius: 50%;
          display: flex; align-items: center; justify-content: center;
          font-size: 18px; color: var(--text);
          background: transparent; border: none; cursor: pointer;
        }
        .moon-back:hover { background: var(--hover); }
        .moon-header-center { flex: 1; }
        .moon-title { font-size: 16px; font-weight: 600; }
        .moon-status {
          display: block; font-size: 11px; color: var(--text-muted);
          margin-top: 1px;
        }
        .moon-clear {
          width: 36px; height: 36px; border-radius: 50%;
          display: flex; align-items: center; justify-content: center;
          font-size: 14px; background: transparent; border: none; cursor: pointer;
        }
        .moon-clear:hover { background: var(--hover); }

        .moon-messages {
          flex: 1; overflow-y: auto; padding: 16px;
          display: flex; flex-direction: column; gap: 10px;
        }
        .moon-msg {
          max-width: 80%; padding: 10px 14px;
          border-radius: 16px; font-size: 14px; line-height: 1.6;
          word-break: break-word;
        }
        .moon-msg.user {
          align-self: flex-end;
          background: var(--accent); color: #fff;
          border-bottom-right-radius: 4px;
        }
        .moon-msg.assistant {
          align-self: flex-start;
          background: var(--bg3); color: var(--text);
          border-bottom-left-radius: 4px;
        }

        .moon-dots { display: flex; gap: 4px; padding: 4px 0; }
        .moon-dots span {
          width: 6px; height: 6px; border-radius: 50%;
          background: var(--text-muted);
          animation: dot-blink 1.4s ease-in-out infinite;
        }
        .moon-dots span:nth-child(2) { animation-delay: 0.2s; }
        .moon-dots span:nth-child(3) { animation-delay: 0.4s; }
        @keyframes dot-blink {
          0%, 60%, 100% { opacity: 0.3; }
          30% { opacity: 1; }
        }

        .moon-input-area {
          display: flex; align-items: flex-end; gap: 8px;
          padding: 12px 16px; border-top: 1px solid var(--border);
          flex-shrink: 0;
        }
        .moon-input {
          flex: 1; resize: none; border: 1px solid var(--border);
          border-radius: 20px; padding: 10px 16px;
          background: var(--bg3); color: var(--text);
          font-size: 14px; line-height: 1.4;
          outline: none; min-height: 40px; max-height: 120px;
        }
        .moon-input:focus { border-color: var(--accent); }
        .moon-input::placeholder { color: var(--text-muted); }
        .moon-send {
          width: 40px; height: 40px; border-radius: 50%;
          background: var(--accent); color: #fff;
          display: flex; align-items: center; justify-content: center;
          font-size: 16px; font-weight: 600;
          border: none; cursor: pointer; flex-shrink: 0;
        }
        .moon-send:hover { background: var(--accent-hover); }
        .moon-send:disabled { opacity: 0.35; cursor: default; }

        .moon-loading {
          display: flex; flex-direction: column; align-items: center;
          justify-content: center; flex: 1; min-height: 200px; gap: 12px;
        }
        .moon-loading-icon {
          font-size: 40px;
          animation: pulse 2s ease-in-out infinite;
        }
        @keyframes pulse {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.15); opacity: 0.6; }
        }
        .moon-loading-text { font-size: 14px; color: var(--text-muted); }
        .moon-loading-bar {
          width: 160px; height: 4px; background: var(--bg5);
          border-radius: 2px; overflow: hidden;
        }
        .moon-loading-fill {
          height: 100%; width: 30%;
          background: var(--gemini-gradient); border-radius: 2px;
          animation: slide 2s ease-in-out infinite;
        }
        @keyframes slide {
          0% { width: 0%; margin-left: 0%; }
          50% { width: 60%; margin-left: 20%; }
          100% { width: 0%; margin-left: 100%; }
        }

        /* 移动端适配 */
        @media (max-width: 600px) {
          .moon-wrap {
            min-height: calc(100vh - var(--nav-h));
            min-height: calc(100dvh - var(--nav-h));
          }
          .moon-msg { max-width: 88%; font-size: 15px; }
          .moon-input-area {
            padding: 8px 12px;
            padding-bottom: max(8px, env(safe-area-inset-bottom));
          }
          .moon-input {
            font-size: 16px; /* 防止iOS缩放 */
            padding: 10px 14px;
          }
          .moon-send {
            width: 44px; height: 44px; /* 更大的触摸目标 */
          }
          .moon-header {
            padding: 10px 12px;
          }
          .moon-back, .moon-clear {
            width: 44px; height: 44px; /* 更大的触摸目标 */
          }
          .moon-loading-card {
            padding: 30px 20px;
          }
          .moon-loading-brain {
            font-size: 36px;
          }
        }

        /* 底部安全区 */
        @supports (padding-bottom: env(safe-area-inset-bottom)) {
          .moon-input-area {
            padding-bottom: max(8px, env(safe-area-inset-bottom));
          }
        }
      `}</style>
    </div>
  );
}
