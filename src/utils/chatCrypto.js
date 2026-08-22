// ─── CHAT END-TO-END / CLIENT-SIDE ENCRYPTION (AES-256-GCM) ───────────────────
// Uses native Web Crypto API (crypto.subtle) built into modern browsers.

const MASTER_SALT = 'centrum_chat_sec_v1_2026'
const keyCache = new Map()
const textEncoder = new TextEncoder()
const textDecoder = new TextDecoder()

// Helper: Convert ArrayBuffer / Uint8Array to Base64
const bytesToBase64 = (bytes) => {
  let binary = ''
  const len = bytes.byteLength
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return btoa(binary)
}

// Helper: Convert Base64 to Uint8Array
const base64ToBytes = (base64) => {
  const binary = atob(base64)
  const len = binary.length
  const bytes = new Uint8Array(len)
  for (let i = 0; i < len; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes
}

// Derive or get cached CryptoKey for a specific thread
const getThreadKey = async (threadId) => {
  const cacheKey = String(threadId || 'global')
  if (keyCache.has(cacheKey)) {
    return keyCache.get(cacheKey)
  }

  try {
    const rawSeed = `${MASTER_SALT}:${cacheKey}`
    const seedBytes = textEncoder.encode(rawSeed)
    const hashBuffer = await crypto.subtle.digest('SHA-256', seedBytes)
    const key = await crypto.subtle.importKey(
      'raw',
      hashBuffer,
      { name: 'AES-GCM' },
      false,
      ['encrypt', 'decrypt']
    )
    keyCache.set(cacheKey, key)
    return key
  } catch (err) {
    console.error('Error deriving chat encryption key:', err)
    return null
  }
}

/**
 * Encrypts a message string for a given thread.
 * Returns string formatted as: [ENC:v1:<iv_b64>:<cipher_b64>]
 */
export const encryptChatMessage = async (text, threadId) => {
  if (!text || typeof text !== 'string' || !text.trim()) return text
  // Already encrypted check
  if (text.startsWith('[ENC:v1:')) return text

  try {
    const key = await getThreadKey(threadId)
    if (!key) return text

    const iv = crypto.getRandomValues(new Uint8Array(12)) // 12-byte IV for AES-GCM
    const encoded = textEncoder.encode(text)

    const encryptedBuffer = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      key,
      encoded
    )

    const ivB64 = bytesToBase64(iv)
    const cipherB64 = bytesToBase64(new Uint8Array(encryptedBuffer))

    return `[ENC:v1:${ivB64}:${cipherB64}]`
  } catch (err) {
    console.error('Encryption failed:', err)
    return text
  }
}

/**
 * Decrypts an encrypted message string for a given thread.
 * If text is not encrypted ([ENC:v1:...), returns original text as-is.
 */
export const decryptChatMessage = async (text, threadId) => {
  if (!text || typeof text !== 'string') return text
  if (!text.startsWith('[ENC:v1:')) return text

  try {
    const match = text.match(/^\[ENC:v1:([^:]+):([^:]+)\]$/)
    if (!match) return text

    const [, ivB64, cipherB64] = match
    const iv = base64ToBytes(ivB64)
    const cipherBytes = base64ToBytes(cipherB64)

    const key = await getThreadKey(threadId)
    if (!key) return '🔒 [Зашифроване повідомлення]'

    const decryptedBuffer = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      key,
      cipherBytes
    )

    return textDecoder.decode(decryptedBuffer)
  } catch (err) {
    console.warn('Decryption failed for message:', err)
    return '🔒 [Зашифроване повідомлення]'
  }
}

/**
 * Helper to process an array of message objects, decrypting their `body` fields.
 */
export const decryptMessageList = async (messages = [], threadId) => {
  if (!Array.isArray(messages) || messages.length === 0) return messages
  return Promise.all(
    messages.map(async (msg) => {
      if (!msg) return msg
      if (msg.body && typeof msg.body === 'string' && msg.body.startsWith('[ENC:v1:')) {
        const decryptedBody = await decryptChatMessage(msg.body, msg.thread_id || threadId)
        return { ...msg, body: decryptedBody }
      }
      return msg
    })
  )
}
