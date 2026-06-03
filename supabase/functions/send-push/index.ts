// Supabase Edge Function: send-push
// Deno runtime
// 
// Отримує { user_id, title, body, path, notifData }
// Дістає всі push підписки юзера з БД
// Надсилає web push через VAPID

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ─── VAPID Configuration ──────────────────────────────────────────────────────
const VAPID_PUBLIC_KEY = "BKuq-VKlrw9HR3MIZu307Hqd0U_LHkJxVMbgNBfC6je6OjVoU3IcDe5mdynIy95cJXtfv9viv3PnQW6DS4vbeOM";
const VAPID_PRIVATE_KEY = Deno.env.get("VAPID_PRIVATE_KEY") ?? "";
const VAPID_SUBJECT = "mailto:admin@centrum.app";

// ─── CORS Headers ─────────────────────────────────────────────────────────────
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ─── Web Push Helpers (VAPID signing) ─────────────────────────────────────────

function base64UrlToUint8Array(base64: string): Uint8Array {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(b64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

function uint8ArrayToBase64Url(arr: Uint8Array): string {
  return btoa(String.fromCharCode(...arr))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");
}

async function createVapidAuthHeader(
  endpoint: string,
  privateKeyB64: string,
  publicKeyB64: string,
  subject: string
): Promise<string> {
  const url = new URL(endpoint);
  const audience = `${url.protocol}//${url.host}`;
  const expiry = Math.floor(Date.now() / 1000) + 12 * 3600;

  const header = { typ: "JWT", alg: "ES256" };
  const payload = { aud: audience, exp: expiry, sub: subject };

  const enc = (obj: object) =>
    uint8ArrayToBase64Url(new TextEncoder().encode(JSON.stringify(obj)));

  const signingInput = `${enc(header)}.${enc(payload)}`;

  const pubBytes = base64UrlToUint8Array(publicKeyB64);
  const xBytes = pubBytes.slice(1, 33);
  const yBytes = pubBytes.slice(33, 65);
  const x = uint8ArrayToBase64Url(xBytes);
  const y = uint8ArrayToBase64Url(yBytes);

  const jwk = {
    kty: "EC",
    crv: "P-256",
    x,
    y,
    d: privateKeyB64,
  };

  const cryptoKey = await crypto.subtle.importKey(
    "jwk",
    jwk,
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"]
  );

  const signature = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    cryptoKey,
    new TextEncoder().encode(signingInput)
  );

  const sig = uint8ArrayToBase64Url(new Uint8Array(signature));
  const jwt = `${signingInput}.${sig}`;

  return `vapid t=${jwt},k=${publicKeyB64}`;
}

async function encryptWebPushPayload(
  payload: string,
  p256dh: string,
  auth: string
): Promise<{ body: Uint8Array; salt: Uint8Array; serverPublicKey: Uint8Array }> {
  const salt = crypto.getRandomValues(new Uint8Array(16));

  // Generate server ECDH key pair
  const serverKeyPair = await crypto.subtle.generateKey(
    { name: "ECDH", namedCurve: "P-256" },
    true,
    ["deriveBits"]
  );

  const serverPublicKeyRaw = new Uint8Array(
    await crypto.subtle.exportKey("raw", serverKeyPair.publicKey)
  );

  // Import client public key (p256dh)
  const clientPublicKey = await crypto.subtle.importKey(
    "raw",
    base64UrlToUint8Array(p256dh),
    { name: "ECDH", namedCurve: "P-256" },
    false,
    []
  );

  // Derive shared secret
  const sharedSecret = new Uint8Array(
    await crypto.subtle.deriveBits(
      { name: "ECDH", public: clientPublicKey },
      serverKeyPair.privateKey,
      256
    )
  );

  const authKey = base64UrlToUint8Array(auth);

  // HKDF extract & expand
  const hkdfKey = await crypto.subtle.importKey("raw", sharedSecret, "HKDF", false, ["deriveBits"]);

  const prk = new Uint8Array(
    await crypto.subtle.deriveBits(
      {
        name: "HKDF",
        hash: "SHA-256",
        salt: authKey,
        info: new TextEncoder().encode("Content-Encoding: auth\0"),
      },
      hkdfKey,
      256
    )
  );

  const prkKey = await crypto.subtle.importKey("raw", prk, "HKDF", false, ["deriveBits"]);

  // Derive content encryption key and nonce
  const keyInfo = new Uint8Array([
    ...new TextEncoder().encode("Content-Encoding: aesgcm\0"),
    0x41, // "P-256"
    ...new Uint8Array(authKey.length.toString().split("").map(Number)),
    ...authKey,
    ...new Uint8Array(serverPublicKeyRaw.length.toString().split("").map(Number)),
    ...serverPublicKeyRaw,
    ...new Uint8Array(base64UrlToUint8Array(p256dh).length.toString().split("").map(Number)),
    ...base64UrlToUint8Array(p256dh),
  ]);

  const cek = new Uint8Array(
    await crypto.subtle.deriveBits({ name: "HKDF", hash: "SHA-256", salt, info: keyInfo }, prkKey, 128)
  );

  const nonceInfo = new Uint8Array([
    ...new TextEncoder().encode("Content-Encoding: nonce\0"),
    0x41,
    ...keyInfo.slice(new TextEncoder().encode("Content-Encoding: aesgcm\0").length + 1),
  ]);

  const nonce = new Uint8Array(
    await crypto.subtle.deriveBits({ name: "HKDF", hash: "SHA-256", salt, info: nonceInfo }, prkKey, 96)
  );

  // Encrypt
  const encKey = await crypto.subtle.importKey("raw", cek, { name: "AES-GCM" }, false, ["encrypt"]);
  const payloadBytes = new TextEncoder().encode(payload);
  const padded = new Uint8Array([0, 0, ...payloadBytes]); // 2-byte padding length prefix

  const encrypted = new Uint8Array(
    await crypto.subtle.encrypt({ name: "AES-GCM", iv: nonce }, encKey, padded)
  );

  return { body: encrypted, salt, serverPublicKey: serverPublicKeyRaw };
}

// ─── Send Web Push ────────────────────────────────────────────────────────────

async function sendWebPush(
  endpoint: string,
  p256dh: string,
  auth: string,
  payload: object
): Promise<{ ok: boolean; status: number }> {
  const payloadStr = JSON.stringify(payload);

  const { body, salt, serverPublicKey } = await encryptWebPushPayload(payloadStr, p256dh, auth);

  const authHeader = await createVapidAuthHeader(
    endpoint,
    VAPID_PRIVATE_KEY,
    VAPID_PUBLIC_KEY,
    VAPID_SUBJECT
  );

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Authorization": authHeader,
      "Content-Type": "application/octet-stream",
      "Content-Encoding": "aesgcm",
      "Encryption": `salt=${uint8ArrayToBase64Url(salt)}`,
      "Crypto-Key": `dh=${uint8ArrayToBase64Url(serverPublicKey)};${authHeader.split(",k=")[1] ? `p256ecdsa=${authHeader.split(",k=")[1]}` : ""}`,
      "TTL": "86400",
    },
    body,
  });

  return { ok: response.ok, status: response.status };
}

// ─── Main Handler ─────────────────────────────────────────────────────────────

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { user_id, title, body, path, notifData } = await req.json();

    if (!user_id || !title) {
      return new Response(JSON.stringify({ error: "user_id and title are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Supabase client з service role
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Отримуємо всі підписки цього юзера
    const { data: subscriptions, error } = await supabase
      .from("push_subscriptions")
      .select("endpoint, p256dh, auth")
      .eq("user_id", user_id);

    if (error) throw error;
    if (!subscriptions || subscriptions.length === 0) {
      return new Response(JSON.stringify({ sent: 0, message: "No subscriptions found" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const payload = { title, body, path: path || "/", tag: String(Date.now()), notifData };
    const results = [];
    const toDelete = [];

    for (const sub of subscriptions) {
      const result = await sendWebPush(sub.endpoint, sub.p256dh, sub.auth, payload);
      results.push(result);

      // 410 Gone або 404 = підписка недійсна, видаляємо
      if (result.status === 410 || result.status === 404) {
        toDelete.push(sub.endpoint);
      }
    }

    // Видаляємо протерміновані підписки
    if (toDelete.length > 0) {
      await supabase.from("push_subscriptions").delete().in("endpoint", toDelete);
    }

    const sent = results.filter((r) => r.ok).length;
    return new Response(JSON.stringify({ sent, total: subscriptions.length, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err) {
    console.error("send-push error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
