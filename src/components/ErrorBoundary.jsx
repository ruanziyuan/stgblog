import React from "react";

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("ErrorBoundary caught:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 40, textAlign: "center" }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>⚠️</div>
          <h3 style={{ marginBottom: 8 }}>页面出错了</h3>
          <p style={{ color: "#71767b", fontSize: 13, marginBottom: 16 }}>{this.state.error?.message || "未知错误"}</p>
          <button onClick={() => this.setState({ hasError: false, error: null })} style={{
            padding: "8px 20px", background: "#1d9bf0", color: "#fff",
            borderRadius: 99, border: "none", fontSize: 13, fontWeight: 700, cursor: "pointer"
          }}>重试</button>
        </div>
      );
    }
    return this.props.children;
  }
}
