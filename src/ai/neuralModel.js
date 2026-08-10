/**
 * NeuralModel - Loads and runs the MiniGPT Chinese chat model.
 * Supports split weight files with INT8 quantization.
 */
class NeuralModel {
  constructor() {
    this.vocab = {};
    this.idxToChar = [];
    this.vocabSize = 0;
    this.embedDim = 384;
    this.numHeads = 8;
    this.numLayers = 12;
    this.hiddenDim = 1536;
    this.maxSeqLen = 256;
    this.embedding = null;
    this.layers = [];
    this.finalNorm = null;
    this.outputW = null;
    this.config = null;
    this.isLoaded = false;
  }

  getBasePath() {
    // GitHub Pages
    const base = import.meta.env.BASE_URL || '/stgblog/';
    return base.endsWith('/') ? base.slice(0, -1) : base;
  }

  async loadVocab(vocabPath = null) {
    try {
      const base = this.getBasePath();
      const response = await fetch(vocabPath || `${base}/ai_data/vocab.json`);
      if (!response.ok) return false;
      this.vocab = await response.json();
      this.idxToChar = Object.keys(this.vocab).sort((a, b) => this.vocab[a] - this.vocab[b]);
      this.vocabSize = Object.keys(this.vocab).length;
      return true;
    } catch {
      return false;
    }
  }

  async loadConfig(configPath = null) {
    try {
      const base = this.getBasePath();
      const response = await fetch(configPath || `${base}/ai_data/model_config.json`);
      if (!response.ok) return false;
      this.config = await response.json();
      this.embedDim = this.config.dim || 384;
      this.numHeads = this.config.numHeads || 8;
      this.numLayers = this.config.numLayers || 12;
      this.hiddenDim = this.config.hiddenDim || 1536;
      this.maxSeqLen = this.config.maxLen || 256;
      return true;
    } catch {
      return false;
    }
  }

  async loadParams() {
    try {
      const isSplit = this.config && this.config.splitFiles;
      
      if (isSplit) {
        return await this.loadSplitParams();
      } else {
        return await this.loadSingleParams();
      }
    } catch (e) {
      console.error('Failed to load model params:', e);
      return false;
    }
  }

  async loadSplitParams() {
    const base = this.getBasePath();
    
    // Load embedding
    const embResp = await fetch(`${base}/ai_data/embedding.json`);
    if (!embResp.ok) return false;
    this.embedding = await embResp.json();

    // Load each layer
    this.layers = [];
    for (let i = 0; i < this.numLayers; i++) {
      const resp = await fetch(`${base}/ai_data/layer_${i}.json`);
      if (!resp.ok) return false;
      this.layers.push(await resp.json());
      console.log(`  Loaded layer ${i}/${this.numLayers}`);
    }

    // Load final layer norm and output projection
    const finalResp = await fetch(`${base}/ai_data/final.json`);
    if (!finalResp.ok) return false;
    const finalData = await finalResp.json();
    this.finalNorm = finalData.lnF;
    this.outputW = finalData.output.W;

    this.isLoaded = true;
    return true;
  }

  async loadSingleParams() {
    const base = this.getBasePath();
    const resp = await fetch(`${base}/ai_data/model_weights.json`);
    if (!resp.ok) return false;
    const params = await resp.json();
    
    this.embedding = params.embedding;
    this.layers = params.attnLayers.map((attn, i) => ({
      attn: { Wq: attn.Wq, Wk: attn.Wk, Wv: attn.Wv, Wo: attn.Wo, lnW: attn.lnW },
      ff: params.ffLayers[i],
    }));
    this.finalNorm = params.lnF;
    this.outputW = params.outputLayer.W;
    
    this.isLoaded = true;
    return true;
  }

  charToIdx(char) {
    return this.vocab[char] !== undefined ? this.vocab[char] : this.vocab['<unk>'];
  }

  idxToToken(idx) {
    return this.idxToChar[idx] || '';
  }

  encode(text) {
    const result = [1, 5]; // <bos> <user>
    for (const char of text.slice(0, this.maxSeqLen - 10)) {
      const idx = this.charToIdx(char);
      if (idx !== undefined) result.push(idx);
      else result.push(3); // <unk>
    }
    result.push(4); // <sep>
    result.push(6); // <assistant>
    return result;
  }

  decode(indices) {
    const specialIds = new Set([0, 1, 2, 3, 4, 5, 6]);
    return indices
      .filter(idx => !specialIds.has(idx))
      .map(idx => this.idxToToken(idx))
      .join('');
  }

  dequantize(qData) {
    const { data, shape, scale, zero_point } = qData;
    const result = new Float32Array(data.length);
    for (let i = 0; i < data.length; i++) {
      result[i] = (data[i] - zero_point) * scale;
    }
    return { data: result, shape };
  }

  getWeight(layerData) {
    if (!layerData) return null;
    if (layerData.scale !== undefined) {
      return this.dequantize(layerData);
    } else if (layerData.dtype === 'float16') {
      return { data: new Float32Array(layerData.data), shape: layerData.shape };
    }
    return layerData;
  }

  matmul(A, B, M, K, N) {
    const result = new Float32Array(M * N);
    for (let i = 0; i < M; i++) {
      for (let j = 0; j < N; j++) {
        let sum = 0;
        for (let k = 0; k < K; k++) {
          sum += A[i * K + k] * B[k * N + j];
        }
        result[i * N + j] = sum;
      }
    }
    return result;
  }

  rmsnorm(x, weight, eps = 1e-6) {
    let sumSq = 0;
    for (let i = 0; i < x.length; i++) {
      sumSq += x[i] * x[i];
    }
    const rms = Math.sqrt(sumSq / x.length + eps);
    const result = new Float32Array(x.length);
    for (let i = 0; i < x.length; i++) {
      result[i] = (x[i] / rms) * weight[i];
    }
    return result;
  }

  silu(x) {
    return x / (1 + Math.exp(-x));
  }

  softmax(x) {
    const max = Math.max(...x);
    const exp = new Float32Array(x.length);
    let sum = 0;
    for (let i = 0; i < x.length; i++) {
      exp[i] = Math.exp(x[i] - max);
      sum += exp[i];
    }
    for (let i = 0; i < x.length; i++) {
      exp[i] /= sum;
    }
    return exp;
  }

  forward(inputIds) {
    if (!this.isLoaded) return null;

    const seqLen = inputIds.length;
    const dim = this.embedDim;
    const numHeads = this.numHeads;
    const headDim = dim / numHeads;

    // Get embedding weights
    const embWeight = this.getWeight(this.embedding);
    const embData = embWeight.data;

    // Token embedding + sinusoidal positional encoding
    let hidden = new Float32Array(seqLen * dim);
    for (let t = 0; t < seqLen; t++) {
      const tokenIdx = inputIds[t];
      const embOffset = tokenIdx * dim;
      for (let d = 0; d < dim; d++) {
        let val = embOffset + d < embData.length ? embData[embOffset + d] : 0;
        // Sinusoidal positional encoding
        const angle = t / Math.pow(10000, (2 * Math.floor(d / 2)) / dim);
        val += (d % 2 === 0) ? Math.sin(angle) : Math.cos(angle);
        hidden[t * dim + d] = val;
      }
    }

    // Transformer layers
    for (let layer = 0; layer < this.numLayers; layer++) {
      const layerData = this.layers[layer];
      const attn = layerData.attn;
      const ff = layerData.ff;

      // === Self-Attention ===
      const residual = new Float32Array(hidden);
      
      // RMSNorm
      const lnW1 = new Float32Array(attn.lnW);
      const normed = new Float32Array(seqLen * dim);
      for (let t = 0; t < seqLen; t++) {
        const slice = hidden.slice(t * dim, (t + 1) * dim);
        normed.set(this.rmsnorm(slice, lnW1), t * dim);
      }

      // Q, K, V projections
      const Wq = this.getWeight(attn.Wq);
      const Wk = this.getWeight(attn.Wk);
      const Wv = this.getWeight(attn.Wv);
      const Wo = this.getWeight(attn.Wo);

      const Q = this.matmul(normed, Wq.data, seqLen, dim, dim);
      const K = this.matmul(normed, Wk.data, seqLen, dim, dim);
      const V = this.matmul(normed, Wv.data, seqLen, dim, dim);

      // Multi-head attention
      const attnOutput = new Float32Array(seqLen * dim);
      for (let h = 0; h < numHeads; h++) {
        const hOffset = h * headDim;

        // Attention scores with causal mask
        const scores = new Float32Array(seqLen * seqLen);
        for (let i = 0; i < seqLen; i++) {
          for (let j = 0; j <= i; j++) {
            let dot = 0;
            for (let d = 0; d < headDim; d++) {
              dot += Q[i * dim + hOffset + d] * K[j * dim + hOffset + d];
            }
            scores[i * seqLen + j] = dot / Math.sqrt(headDim);
          }
          for (let j = i + 1; j < seqLen; j++) {
            scores[i * seqLen + j] = -Infinity;
          }
        }

        // Softmax
        for (let i = 0; i < seqLen; i++) {
          const row = scores.slice(i * seqLen, (i + 1) * seqLen);
          const probs = this.softmax(row);
          for (let j = 0; j < seqLen; j++) {
            scores[i * seqLen + j] = probs[j];
          }
        }

        // Weighted sum
        for (let i = 0; i < seqLen; i++) {
          for (let d = 0; d < headDim; d++) {
            let sum = 0;
            for (let j = 0; j < seqLen; j++) {
              sum += scores[i * seqLen + j] * V[j * dim + hOffset + d];
            }
            attnOutput[i * dim + hOffset + d] = sum;
          }
        }
      }

      // Output projection + residual
      const attnProjected = this.matmul(attnOutput, Wo.data, seqLen, dim, dim);
      for (let i = 0; i < seqLen * dim; i++) {
        hidden[i] = residual[i] + attnProjected[i];
      }

      // === Feed-Forward (SwiGLU) ===
      const residual2 = new Float32Array(hidden);
      
      const lnW2 = new Float32Array(ff.lnW);
      const normed2 = new Float32Array(seqLen * dim);
      for (let t = 0; t < seqLen; t++) {
        const slice = hidden.slice(t * dim, (t + 1) * dim);
        normed2.set(this.rmsnorm(slice, lnW2), t * dim);
      }

      const W1 = this.getWeight(ff.W1);
      const W2 = this.getWeight(ff.W2);
      const W3 = this.getWeight(ff.W3);

      const gate1 = this.matmul(normed2, W1.data, seqLen, dim, this.hiddenDim);
      const gate3 = this.matmul(normed2, W3.data, seqLen, dim, this.hiddenDim);
      
      // SiLU(gate1) * gate3
      const activated = new Float32Array(seqLen * this.hiddenDim);
      for (let i = 0; i < seqLen * this.hiddenDim; i++) {
        activated[i] = this.silu(gate1[i]) * gate3[i];
      }

      const ffOutput = this.matmul(activated, W2.data, seqLen, this.hiddenDim, dim);
      for (let i = 0; i < seqLen * dim; i++) {
        hidden[i] = residual2[i] + ffOutput[i];
      }
    }

    // Final RMSNorm
    const lnFW = new Float32Array(this.finalNorm.W);
    const finalHidden = new Float32Array(seqLen * dim);
    for (let t = 0; t < seqLen; t++) {
      const slice = hidden.slice(t * dim, (t + 1) * dim);
      finalHidden.set(this.rmsnorm(slice, lnFW), t * dim);
    }

    // Output logits
    const outW = this.getWeight(this.outputW);
    const logits = this.matmul(finalHidden, outW.data, seqLen, dim, this.vocabSize);
    return logits;
  }

  generate(text, maxLen = 100, temperature = 0.7) {
    if (!this.isLoaded) return '';

    let inputIds = this.encode(text);
    const result = [];

    for (let i = 0; i < maxLen; i++) {
      const currentIds = inputIds.slice(-this.maxSeqLen);
      const logits = this.forward(currentIds);
      if (!logits) break;

      const seqLen = currentIds.length;
      const vocabSize = this.vocabSize;
      const lastLogits = new Float32Array(vocabSize);
      for (let j = 0; j < vocabSize; j++) {
        lastLogits[j] = logits[(seqLen - 1) * vocabSize + j];
      }

      let nextIdx;
      if (temperature > 0) {
        const adjusted = new Float32Array(vocabSize);
        for (let j = 0; j < vocabSize; j++) {
          adjusted[j] = lastLogits[j] / temperature;
        }
        const probs = this.softmax(adjusted);
        
        // Top-k (k=50)
        const k = 50;
        const indexed = [];
        for (let j = 0; j < vocabSize; j++) {
          indexed.push({ idx: j, prob: probs[j] });
        }
        indexed.sort((a, b) => b.prob - a.prob);
        const topK = indexed.slice(0, k);
        
        let topSum = 0;
        for (const item of topK) topSum += item.prob;
        
        const rand = Math.random() * topSum;
        let cumSum = 0;
        nextIdx = topK[0].idx;
        for (const item of topK) {
          cumSum += item.prob;
          if (cumSum >= rand) {
            nextIdx = item.idx;
            break;
          }
        }
      } else {
        let maxVal = -Infinity;
        nextIdx = 0;
        for (let j = 0; j < vocabSize; j++) {
          if (lastLogits[j] > maxVal) {
            maxVal = lastLogits[j];
            nextIdx = j;
          }
        }
      }

      // Stop at special tokens
      if (nextIdx === 4 || nextIdx === 2 || nextIdx === 0) break;

      if (nextIdx > 6) {
        const token = this.idxToToken(nextIdx);
        if (token) result.push(token);
      }
      
      inputIds.push(nextIdx);
    }

    return this._cleanOutput(result.join(''));
  }

  _cleanOutput(text) {
    if (!text) return text;

    const severeRepeat = /(.)\1{3,}/g;
    const match = severeRepeat.exec(text);
    if (match && match.index > 5) {
      text = text.slice(0, match.index + 1);
    }

    const sentEnd = Math.max(text.lastIndexOf('。'), text.lastIndexOf('！'), text.lastIndexOf('？'));
    if (sentEnd > 0 && sentEnd < text.length - 1) {
      const after = text.slice(sentEnd + 1).trim();
      if (after.length > 8) {
        text = text.slice(0, sentEnd + 1);
      }
    }

    text = text.replace(/[，。！？,!?]{3,}$/, '');
    if (text.length > 3 && !text.endsWith('。') && !text.endsWith('！') && !text.endsWith('？')) {
      text += '。';
    }

    return text.trim();
  }

  getParamCount() {
    return 28700000; // ~28.7M
  }
}

export { NeuralModel };
