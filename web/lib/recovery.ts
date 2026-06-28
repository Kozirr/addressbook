import { generateMnemonic, validateMnemonic } from "@scure/bip39";
import { wordlist } from "@scure/bip39/wordlists/english.js";
import bcrypt from "bcryptjs";
import { deriveMasterKey, EncryptedPayload, bufferToBase64, base64ToBuffer, randomIv } from "./crypto";

export const RECOVERY_WORD_COUNT = 24;

export type WrappedMasterKeyForRecovery = EncryptedPayload;

function ensureSecureContext() {
  if (typeof window !== "undefined" && !window.isSecureContext) {
    throw new Error(
      "Address Book requires a secure context. Please use https:// or http://localhost."
    );
  }
}

function recoveryKeyToString(recoveryKey: string[]): string {
  return recoveryKey.join(" ").trim().toLowerCase();
}

export function generateRecoveryKey(): string[] {
  ensureSecureContext();
  const mnemonic = generateMnemonic(wordlist, 256);
  return mnemonic.split(" ");
}

export function validateRecoveryKey(recoveryKey: string[]): boolean {
  if (recoveryKey.length !== RECOVERY_WORD_COUNT) return false;
  const mnemonic = recoveryKeyToString(recoveryKey);
  return validateMnemonic(mnemonic, wordlist);
}

export async function deriveRecoveryMasterKey(
  recoveryKey: string[],
  recoverySalt: string
): Promise<CryptoKey> {
  const mnemonic = recoveryKeyToString(recoveryKey);
  return deriveMasterKey(mnemonic, recoverySalt);
}

export async function wrapMasterKeyForRecovery(
  masterKey: CryptoKey,
  recoveryMasterKey: CryptoKey
): Promise<WrappedMasterKeyForRecovery> {
  // Recovery stores a wrapped master key, not the password-derived key or plaintext contacts.
  const raw = await crypto.subtle.exportKey("raw", masterKey);
  const iv = randomIv();
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    recoveryMasterKey,
    raw
  );
  return {
    encryptedData: bufferToBase64(ciphertext),
    iv: bufferToBase64(iv),
  };
}

export async function unwrapMasterKeyForRecovery(
  wrapped: WrappedMasterKeyForRecovery,
  recoveryMasterKey: CryptoKey
): Promise<CryptoKey> {
  const iv = base64ToBuffer(wrapped.iv);
  const ciphertext = base64ToBuffer(wrapped.encryptedData);
  const raw = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    recoveryMasterKey,
    ciphertext
  );
  return crypto.subtle.importKey(
    "raw",
    raw,
    { name: "AES-GCM", length: 256 },
    true,
    ["encrypt", "decrypt"]
  );
}

export async function hashRecoveryKey(recoveryKey: string[]): Promise<string> {
  const mnemonic = recoveryKeyToString(recoveryKey);
  return bcrypt.hash(mnemonic, 12);
}

export async function verifyRecoveryKey(
  recoveryKey: string[],
  hash: string
): Promise<boolean> {
  const mnemonic = recoveryKeyToString(recoveryKey);
  return bcrypt.compare(mnemonic, hash);
}

export async function getRecoveryKeyIdentifier(recoveryKey: string[]): Promise<string> {
  const mnemonic = recoveryKeyToString(recoveryKey);
  const encoder = new TextEncoder();
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(mnemonic));
  const bytes = new Uint8Array(digest);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}
