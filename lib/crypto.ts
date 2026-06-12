/**
 * WebCrypto AES-GCM encryption for the OpenRouter API key. The key never
 * leaves the browser: ciphertext + a random device secret both live in
 * localStorage (encrypted-at-rest, decrypted only in memory at call time).
 */

const SECRET_KEY = "lifeverse:deviceSecret";
const CIPHER_KEY = "lifeverse:orKey";

function toB64(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
}

function fromB64(s: string): Uint8Array<ArrayBuffer> {
  const bin = atob(s);
  const out = new Uint8Array(new ArrayBuffer(bin.length));
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function deviceKey(): Promise<CryptoKey> {
  let raw = window.localStorage.getItem(SECRET_KEY);
  if (!raw) {
    const bytes = crypto.getRandomValues(new Uint8Array(32));
    raw = toB64(bytes);
    window.localStorage.setItem(SECRET_KEY, raw);
  }
  return crypto.subtle.importKey("raw", fromB64(raw), "AES-GCM", false, [
    "encrypt",
    "decrypt",
  ]);
}

export async function storeApiKey(plaintext: string): Promise<void> {
  const key = await deviceKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    new TextEncoder().encode(plaintext)
  );
  window.localStorage.setItem(CIPHER_KEY, `${toB64(iv)}.${toB64(ct)}`);
}

export async function loadApiKey(): Promise<string | null> {
  const stored = window.localStorage.getItem(CIPHER_KEY);
  if (!stored) return null;
  const [ivB64, ctB64] = stored.split(".");
  if (!ivB64 || !ctB64) return null;
  try {
    const key = await deviceKey();
    const pt = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: fromB64(ivB64) },
      key,
      fromB64(ctB64)
    );
    return new TextDecoder().decode(pt);
  } catch {
    return null; // tampered/corrupt — treat as absent
  }
}

export function clearApiKey(): void {
  window.localStorage.removeItem(CIPHER_KEY);
}

export function hasApiKey(): boolean {
  return typeof window !== "undefined" && window.localStorage.getItem(CIPHER_KEY) !== null;
}
