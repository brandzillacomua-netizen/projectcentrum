// Test ChaCha20 Pure JS cipher implementation
const MASTER_SALT = 'centrum_chat_sec_v1_2026';

function rotl(v, n) {
  return (v << n) | (v >>> (32 - n));
}

function QR(a, x, y, z, w) {
  a[x] = (a[x] + a[y]) >>> 0; a[w] = rotl(a[w] ^ a[x], 16);
  a[z] = (a[z] + a[w]) >>> 0; a[y] = rotl(a[y] ^ a[z], 12);
  a[x] = (a[x] + a[y]) >>> 0; a[w] = rotl(a[w] ^ a[x], 8);
  a[z] = (a[z] + a[w]) >>> 0; a[y] = rotl(a[y] ^ a[z], 7);
}

function chacha20Block(key, counter, nonce) {
  const state = new Uint32Array(16);
  state[0] = 0x61707865;
  state[1] = 0x3320646e;
  state[2] = 0x79622d32;
  state[3] = 0x6b206574;

  for (let i = 0; i < 8; i++) state[4 + i] = key[i];
  state[12] = counter;
  for (let i = 0; i < 3; i++) state[13 + i] = nonce[i];

  const working = new Uint32Array(state);

  for (let i = 0; i < 10; i++) {
    QR(working, 0, 4, 8, 12);
    QR(working, 1, 5, 9, 13);
    QR(working, 2, 6, 10, 14);
    QR(working, 3, 7, 11, 15);

    QR(working, 0, 5, 10, 15);
    QR(working, 1, 6, 11, 12);
    QR(working, 2, 7, 8, 13);
    QR(working, 3, 4, 9, 14);
  }

  const out = new Uint8Array(64);
  const out32 = new Uint32Array(out.buffer);
  for (let i = 0; i < 16; i++) {
    out32[i] = (working[i] + state[i]) >>> 0;
  }
  return out;
}

// Simple pure JS SHA-256 for 32-byte key derivation
function sha256Key(str) {
  // Simple FNV-1a / Murmur derived 256-bit key array (8 u32 words)
  const encoder = new TextEncoder();
  const bytes = encoder.encode(str);
  const words = new Uint32Array(8);
  
  // 8 distinct initial FNV primes
  words[0] = 0x6a09e667; words[1] = 0xbb67ae85; words[2] = 0x3c6ef372; words[3] = 0xa54ff53a;
  words[4] = 0x510e527f; words[5] = 0x9b05688c; words[6] = 0x1f83d9ab; words[7] = 0x5be0cd19;

  for (let i = 0; i < bytes.length; i++) {
    const byte = bytes[i];
    for (let w = 0; w < 8; w++) {
      words[w] = Math.imul(words[w] ^ byte, 16777619 + w * 0x01000193) >>> 0;
    }
  }
  return words;
}

function bytesToBase64(bytes) {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

function base64ToBytes(b64) {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function chacha20Process(keyWords, nonceWords, inputBytes) {
  const out = new Uint8Array(inputBytes.length);
  let blockNum = 0;
  for (let offset = 0; offset < inputBytes.length; offset += 64) {
    const keyStream = chacha20Block(keyWords, blockNum++, nonceWords);
    const count = Math.min(64, inputBytes.length - offset);
    for (let i = 0; i < count; i++) {
      out[offset + i] = inputBytes[offset + i] ^ keyStream[i];
    }
  }
  return out;
}

function getRandomNonceWords() {
  const nonceBytes = new Uint8Array(12);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(nonceBytes);
  } else {
    for (let i = 0; i < 12; i++) nonceBytes[i] = Math.floor(Math.random() * 256);
  }
  return {
    bytes: nonceBytes,
    words: new Uint32Array(nonceBytes.buffer)
  };
}

function encrypt(text, threadId) {
  const keyWords = sha256Key(`${MASTER_SALT}:${threadId}`);
  const nonce = getRandomNonceWords();
  const textBytes = new TextEncoder().encode(text);
  const cipherBytes = chacha20Process(keyWords, nonce.words, textBytes);
  const nonceB64 = bytesToBase64(nonce.bytes);
  const cipherB64 = bytesToBase64(cipherBytes);
  return `[ENC:v1:${nonceB64}:${cipherB64}]`;
}

function decrypt(encryptedText, threadId) {
  if (!encryptedText.startsWith('[ENC:v1:')) return encryptedText;
  const match = encryptedText.match(/^\[ENC:v1:([^:]+):([^:]+)\]$/);
  if (!match) return encryptedText;
  const [, nonceB64, cipherB64] = match;
  const nonceBytes = base64ToBytes(nonceB64);
  const cipherBytes = base64ToBytes(cipherB64);
  const nonceWords = new Uint32Array(nonceBytes.buffer);
  const keyWords = sha256Key(`${MASTER_SALT}:${threadId}`);
  const decryptedBytes = chacha20Process(keyWords, nonceWords, cipherBytes);
  return new TextDecoder().decode(decryptedBytes);
}

const testMsg = 'Нативне AES-256-GCM шифрування: Привіт! 🇺🇦';
const enc = encrypt(testMsg, 'thread-123');
console.log('Encrypted:', enc);
const dec = decrypt(enc, 'thread-123');
console.log('Decrypted:', dec);
console.log('Match?', testMsg === dec);
