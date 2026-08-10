// 端到端加密工具 - Web Crypto API (ECDH + AES-GCM)
// 密钥对在本地生成，永不离开设备

const EC_PARAMS = { name: 'ECDH', namedCurve: 'P-256' };
const AES_PARAMS = { name: 'AES-GCM', length: 256 };

// 生成 ECDH 密钥对
export async function generateKeyPair() {
  const keyPair = await crypto.subtle.generateKey(EC_PARAMS, true, ['deriveKey', 'deriveBits']);
  const pub = await crypto.subtle.exportKey('jwk', keyPair.publicKey);
  const priv = await crypto.subtle.exportKey('jwk', keyPair.privateKey);
  return { publicKey: pub, privateKey: priv };
}

// 从 JWK 导入公钥
async function importPublicKey(jwk) {
  return crypto.subtle.importKey('jwk', jwk, EC_PARAMS, true, []);
}

// 从 JWK 导入私钥
async function importPrivateKey(jwk) {
  return crypto.subtle.importKey('jwk', jwk, EC_PARAMS, false, ['deriveKey', 'deriveBits']);
}

// 派生共享 AES 密钥
async function deriveSharedKey(privateKeyJwk, publicKeyJwk) {
  try {
    const privKey = await importPrivateKey(privateKeyJwk);
    const pubKey = await importPublicKey(publicKeyJwk);
    return crypto.subtle.deriveKey(
      { name: 'ECDH', public: pubKey },
      privKey,
      AES_PARAMS,
      false,
      ['encrypt', 'decrypt']
    );
  } catch (e) {
    console.error("Failed to derive shared key:", e);
    throw new Error("密钥派生失败");
  }
}

// 加密消息
export async function encryptMessage(plaintext, privateKeyJwk, recipientPublicKeyJwk) {
  const sharedKey = await deriveSharedKey(privateKeyJwk, recipientPublicKeyJwk);
  const encoder = new TextEncoder();
  const data = encoder.encode(plaintext);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, sharedKey, data);
  return {
    ciphertext: btoa(String.fromCharCode(...new Uint8Array(encrypted))),
    iv: btoa(String.fromCharCode(...iv))
  };
}

// 解密消息
export async function decryptMessage(ciphertext, iv, privateKeyJwk, senderPublicKeyJwk) {
  const sharedKey = await deriveSharedKey(privateKeyJwk, senderPublicKeyJwk);
  const encBytes = Uint8Array.from(atob(ciphertext), c => c.charCodeAt(0));
  const ivBytes = Uint8Array.from(atob(iv), c => c.charCodeAt(0));
  const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: ivBytes }, sharedKey, encBytes);
  return new TextDecoder().decode(decrypted);
}

// 获取或创建本地密钥对
export async function getOrCreateKeyPair(username) {
  const stored = localStorage.getItem(`stgblog_keys_${username}`);
  if (stored) return JSON.parse(stored);
  const keyPair = await generateKeyPair();
  localStorage.setItem(`stgblog_keys_${username}`, JSON.stringify(keyPair));
  return keyPair;
}


