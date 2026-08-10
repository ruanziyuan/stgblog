/**
 * Moon Web Worker - 在后台线程做模型推理，不卡UI
 */
import { NeuralModel } from './neuralModel';

const model = new NeuralModel();
let ready = false;

self.onmessage = async function(e) {
  const { type, data, id } = e.data;

  if (type === 'init') {
    try {
      await model.loadConfig();
      await model.loadVocab();
      await model.loadParams();
      ready = model.isLoaded;
      self.postMessage({ type: 'init', id, ok: ready, params: model.getParamCount() });
    } catch (err) {
      self.postMessage({ type: 'init', id, ok: false, error: err.message });
    }
  }

  if (type === 'generate') {
    if (!ready) {
      self.postMessage({ type: 'generate', id, text: '', error: 'model not loaded' });
      return;
    }
    try {
      const text = model.generate(data.prompt, data.maxLen || 120, data.temperature || 0.7);
      self.postMessage({ type: 'generate', id, text });
    } catch (err) {
      self.postMessage({ type: 'generate', id, text: '', error: err.message });
    }
  }
};
