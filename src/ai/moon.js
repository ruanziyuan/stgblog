/**
 * Moon - 端侧中文聊天AI
 * 推理在 Web Worker 中运行，带超时保护，UI 永远不会卡死
 */

let _id = 0;
function uid() { return ++_id; }

class Moon {
  constructor() {
    this.worker = null;
    this.history = [];
    this.maxHistory = 20;
    this.loaded = false;
    this._pending = {};
  }

  async init() {
    try {
      this.worker = new Worker(
        new URL('./moon.worker.js', import.meta.url),
        { type: 'module' }
      );
    } catch (e) {
      console.error('Moon: worker create failed', e);
      return { loaded: false, params: 0 };
    }

    return new Promise((resolve) => {
      let settled = false;

      this.worker.onmessage = (e) => {
        const { type, id, ok, text, params, error } = e.data;

        if (type === 'init' && !settled) {
          settled = true;
          this.loaded = ok;
          resolve({ loaded: ok, params: params || 0 });
        }

        if (type === 'generate' && this._pending[id]) {
          const p = this._pending[id];
          delete this._pending[id];
          if (error) p.reject(new Error(error));
          else p.resolve(text);
        }
      };

      this.worker.onerror = (err) => {
        console.error('Moon worker error:', err);
        if (!settled) { settled = true; resolve({ loaded: false, params: 0 }); }
      };

      // 超时保护：8秒没响应就放弃worker，用规则模式
      setTimeout(() => {
        if (!settled) {
          settled = true;
          console.warn('Moon: worker init timeout, using fallback');
          try { this.worker.terminate(); } catch {}
          this.worker = null;
          resolve({ loaded: false, params: 0 });
        }
      }, 8000);

      this.worker.postMessage({ type: 'init', id: uid() });
    });
  }

  _askWorker(prompt, maxLen, temperature, timeoutMs = 20000) {
    return new Promise((resolve, reject) => {
      if (!this.worker) { reject(new Error('no worker')); return; }

      const id = uid();
      let timer = null;

      this._pending[id] = {
        resolve: (text) => { clearTimeout(timer); resolve(text); },
        reject: (err) => { clearTimeout(timer); reject(err); },
      };

      // 超时：15秒没返回就用兜底
      timer = setTimeout(() => {
        if (this._pending[id]) {
          delete this._pending[id];
          console.warn('Moon: generate timeout, using fallback');
          resolve(''); // 返回空串，触发兜底
        }
      }, timeoutMs);

      this.worker.postMessage({ type: 'generate', id, data: { prompt, maxLen, temperature } });
    });
  }

  async reply(userText) {
    if (!userText?.trim()) return { text: '...' };

    const text = userText.trim();
    this.history.push({ role: 'user', text });
    if (this.history.length > this.maxHistory) this.history.shift();

    let response = '';

    if (this.loaded && this.worker) {
      try {
        const ctx = this._buildContext(text);
        response = await this._askWorker(ctx, 256, 0.7);
      } catch (e) {
        console.error('Moon inference error:', e);
      }
    }

    if (!response || response.trim().length < 2 || this._isGarbage(response)) {
      response = this._fallback(text);
    }

    this.history.push({ role: 'assistant', text: response });
    return { text: response };
  }

  async replyStream(userText, onToken, onDone) {
    let result;
    try {
      result = await this.reply(userText);
    } catch (e) {
      console.error('Moon reply error:', e);
      result = { text: this._fallback(userText) };
    }

    const text = result.text;
    await this._sleep(200 + Math.random() * 300);

    for (let i = 0; i < text.length; i++) {
      onToken?.({ char: text[i], text: text.slice(0, i + 1), done: false });
      const d = /[，。！？,.!?]/.test(text[i]) ? 40 : 12 + Math.random() * 12;
      await this._sleep(d);
    }

    onDone?.(result);
    return result;
  }

  _buildContext(text) {
    const recent = this.history.slice(-8, -1);
    if (recent.length === 0) return text;

    let ctx = '';
    for (const m of recent) {
      if (m.role === 'user') {
        ctx += `<user>${m.text}</user>`;
      } else {
        ctx += `<assistant>${m.text}</assistant>`;
      }
    }
    ctx += `<user>${text}</user><assistant>`;
    return ctx;
  }

  _isGarbage(text) {
    if (!text) return true;
    const trimmed = text.trim();
    if (trimmed.length < 2) return true;
    const chars = {};
    for (const c of trimmed) { chars[c] = (chars[c] || 0) + 1; }
    const maxCount = Math.max(...Object.values(chars));
    if (maxCount / trimmed.length > 0.4) return true;
    const bigrams = {};
    for (let i = 0; i < trimmed.length - 1; i++) {
      const bg = trimmed[i] + trimmed[i + 1];
      bigrams[bg] = (bigrams[bg] || 0) + 1;
    }
    for (const count of Object.values(bigrams)) {
      if (count >= 5) return true;
    }
    return false;
  }

  _fallback(text) {
    const greetings = ['你好呀', '嗨', '在呢'];
    const agreements = ['嗯嗯', '有道理', '确实', '是这样的'];
    const questions = ['能再详细说说吗？', '然后呢？', '怎么说？'];
    const encouragements = ['继续说吧', '我在听', '嗯嗯，我听着呢'];
    const thinking = ['让我想想...', '这个问题有意思', '嗯...'];

    if (/^(你好|嗨|hi|hello|在吗|在？)/i.test(text)) {
      return greetings[Math.floor(Math.random() * greetings.length)] + '，有什么想聊的？';
    }
    if (/\?$|？$/.test(text)) {
      return questions[Math.floor(Math.random() * questions.length)];
    }
    if (/^(嗯|哦|好吧|哈哈|笑死|6|9)/.test(text)) {
      return agreements[Math.floor(Math.random() * agreements.length)];
    }

    const pool = [...thinking, ...encouragements, ...questions];
    return pool[Math.floor(Math.random() * pool.length)];
  }

  _sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

  getPersona() { return { name: 'Moon', greeting: '你好，我是 Moon 🌙 有什么想聊的？' }; }
  getCurrentMood() { return { mood: 'calm', emoji: '🌙', label: '' }; }
  getStats() { return { conversations: this.history.filter(m => m.role === 'user').length, loaded: this.loaded, params: 28700000 }; }
  clearMemory() { this.history = []; }
  updatePersona() {}
  endSession() {}
  get memoryManager() { return { longTermMemory: {} }; }
}

export { Moon };
