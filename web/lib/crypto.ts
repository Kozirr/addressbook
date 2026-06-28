const PBKDF2_ITERATIONS = 600000;
const AES_GCM_KEY_LENGTH_BITS = 256;

function ensureSecureContext() {
  if (typeof window !== "undefined" && !window.isSecureContext) {
    throw new Error(
      "Address Book requires a secure context. Please use https:// or http://localhost."
    );
  }
}

export function bufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

export function base64ToBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

export function randomIv(): ArrayBuffer {
  const bytes = crypto.getRandomValues(new Uint8Array(12));
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
}

function randomSalt(): ArrayBuffer {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
}

export async function deriveMasterKey(
  password: string,
  salt: string
): Promise<CryptoKey> {
  ensureSecureContext();

  // The password never leaves the browser; the server only sees encrypted payloads.
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    { name: "PBKDF2" },
    false,
    ["deriveBits", "deriveKey"]
  );

  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: new TextEncoder().encode(salt),
      iterations: PBKDF2_ITERATIONS,
      hash: "SHA-256",
    },
    keyMaterial,
    { name: "AES-GCM", length: AES_GCM_KEY_LENGTH_BITS },
    true,
    ["encrypt", "decrypt"]
  );
}

export async function generateDeviceKey(): Promise<CryptoKey> {
  ensureSecureContext();
  return crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, false, [
    "encrypt",
    "decrypt",
  ]);
}

export interface WrappedMasterKey {
  wrappedKey: string;
  iv: string;
}

export async function wrapMasterKey(
  deviceKey: CryptoKey,
  masterKey: CryptoKey
): Promise<WrappedMasterKey> {
  const iv = randomIv();
  // Device wrapping keeps users logged in without storing the raw master key.
  const raw = await crypto.subtle.exportKey("raw", masterKey);
  const wrapped = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    deviceKey,
    raw
  );
  return {
    wrappedKey: bufferToBase64(wrapped),
    iv: bufferToBase64(iv),
  };
}

export async function unwrapMasterKey(
  deviceKey: CryptoKey,
  wrapped: WrappedMasterKey
): Promise<CryptoKey> {
  const iv = base64ToBuffer(wrapped.iv);
  const raw = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    deviceKey,
    base64ToBuffer(wrapped.wrappedKey)
  );
  return crypto.subtle.importKey(
    "raw",
    raw,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

export interface EncryptedPayload {
  encryptedData: string;
  iv: string;
}

export async function encryptData<T>(
  masterKey: CryptoKey,
  data: T
): Promise<EncryptedPayload> {
  const iv = randomIv();
  const encoded = new TextEncoder().encode(JSON.stringify(data));
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    masterKey,
    encoded
  );
  return {
    encryptedData: bufferToBase64(ciphertext),
    iv: bufferToBase64(iv),
  };
}

export async function decryptData<T>(
  masterKey: CryptoKey,
  payload: EncryptedPayload
): Promise<T> {
  const ciphertext = base64ToBuffer(payload.encryptedData);
  const iv = base64ToBuffer(payload.iv);
  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    masterKey,
    ciphertext
  );
  const json = new TextDecoder().decode(decrypted);
  return JSON.parse(json) as T;
}

export function generateEncryptionSalt(): string {
  const buffer = randomSalt();
  return bufferToBase64(buffer);
}
