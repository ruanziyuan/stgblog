import React, { useState, useCallback } from "react";
import { useAuth } from "../context/AuthContext";

function createCaptcha() {
  const a = Math.floor(Math.random() * 10);
  const b = Math.floor(Math.random() * 10);
  return { a, b, answer: a + b };
}

export default function AuthModal({ onClose }) {
  const { login, register } = useAuth();
  const [mode, setMode] = useState("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [captchaInput, setCaptchaInput] = useState("");
  const [captcha, setCaptcha] = useState(() => createCaptcha());
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const refreshCaptcha = () => setCaptcha(createCaptcha());

  const handleLogin = useCallback(async () => {
    setError("");
    const name = username.trim(), pass = password.trim();
    if (!name || !pass) { setError("请输入用户名和密码"); return; }
    setLoading(true);
    const result = await login(name, pass);
    if (result.error) setError(result.error);
    else onClose();
    setLoading(false);
  }, [username, password, login, onClose]);

  const handleRegister = useCallback(async () => {
    setError("");
    const name = username.trim(), pass = password.trim(), confirm = confirmPassword.trim();
    if (!/^[\u4e00-\u9fa5A-Za-z0-9_]{3,20}$/.test(name)) { setError("用户名 3-20 位"); return; }
    if (pass.length < 6) { setError("密码至少 6 位"); return; }
    if (pass !== confirm) { setError("密码不一致"); return; }
    if (Number(captchaInput) !== captcha.answer) { setError("验证码错误"); refreshCaptcha(); setCaptchaInput(""); return; }
    setLoading(true);
    const result = await register(name, pass);
    if (result.error) { setError(result.error); refreshCaptcha(); }
    else { onClose(); setMode("login"); }
    setLoading(false);
  }, [username, password, confirmPassword, captchaInput, captcha, register, onClose]);

  return (
    <div className="auth-overlay" onClick={onClose}>
      <div className="auth-modal" onClick={(e) => e.stopPropagation()}>
        <div className="auth-top">
          <div />
          <button className="auth-close" onClick={onClose}>✕</button>
        </div>
        <div className="auth-body">
          <div className="auth-logo">S</div>
          <h2>{mode === "login" ? "登录 STGBLOG" : "创建账号"}</h2>
          <p>{mode === "login" ? "加密社交，安全畅聊" : "加入 STGBLOG，开始加密社交"}</p>
          <div className="seg-bar">
            <button className={mode === "login" ? "seg on" : "seg"} onClick={() => { setMode("login"); setError(""); refreshCaptcha(); }}>登录</button>
            <button className={mode === "register" ? "seg on" : "seg"} onClick={() => { setMode("register"); setError(""); refreshCaptcha(); }}>注册</button>
          </div>
          <input className="auth-input" type="text" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="用户名" autoComplete="username" />
          <input className="auth-input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="密码" autoComplete={mode === "login" ? "current-password" : "new-password"} />
          {mode === "register" && (
            <>
              <input className="auth-input" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="确认密码" autoComplete="new-password" />
              <input className="auth-input" type="text" inputMode="numeric" value={captchaInput} onChange={(e) => setCaptchaInput(e.target.value)} placeholder={`${captcha.a}+${captcha.b}=?`} />
            </>
          )}
          {error && <div className="auth-err">{error}</div>}
          <button className="auth-btn" onClick={mode === "login" ? handleLogin : handleRegister} disabled={loading}>
            {loading ? "处理中..." : mode === "login" ? "登录" : "注册"}
          </button>
          <div className="auth-switch">
            {mode === "login" ? "没有账号？" : "已有账号？"}
            <button onClick={() => { setMode(mode === "login" ? "register" : "login"); setError(""); refreshCaptcha(); }}>
              {mode === "login" ? "注册" : "登录"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
