import { describe, expect, it } from "vitest";
import {
  base64ToBuffer,
  bufferToBase64,
  deriveMasterKey,
  generateDeviceKey,
  wrapMasterKey,
  unwrapMasterKey,
  encryptData,
  decryptData,
  generateEncryptionSalt,
  randomIv,
} from "@/lib/crypto";

async function rawKey(key: CryptoKey) {
  return Array.from(new Uint8Array(await crypto.subtle.exportKey("raw", key)));
}

describe("crypto", () => {
  it("derives stable AES keys from the same password and salt", async () => {
    const salt = generateEncryptionSalt();
    const key1 = await deriveMasterKey("password123", salt);
    const key2 = await deriveMasterKey("password123", salt);
    const different = await deriveMasterKey("password123", generateEncryptionSalt());

    expect(await rawKey(key1)).toEqual(await rawKey(key2));
    expect(await rawKey(key1)).not.toEqual(await rawKey(different));
  });

  it("round-trips arbitrary bytes through base64 helpers", () => {
    const bytes = Uint8Array.from([0, 1, 2, 253, 254, 255]);
    const encoded = bufferToBase64(bytes.buffer);

    expect(Array.from(new Uint8Array(base64ToBuffer(encoded)))).toEqual(Array.from(bytes));
  });

  it("generates 96-bit IVs that are not reused in normal operation", () => {
    const iv1 = randomIv();
    const iv2 = randomIv();

    expect(iv1.byteLength).toBe(12);
    expect(iv2.byteLength).toBe(12);
    expect(bufferToBase64(iv1)).not.toBe(bufferToBase64(iv2));
  });

  it("encrypts JSON data and refuses to decrypt it with the wrong key", async () => {
    const key = await deriveMasterKey("password123", generateEncryptionSalt());
    const wrongKey = await deriveMasterKey("password123", generateEncryptionSalt());
    const data = {
      message: "hello world",
      nested: { answer: 42, enabled: true },
    };

    const encrypted = await encryptData(key, data);

    expect(encrypted.encryptedData).not.toContain("hello world");
    expect(encrypted.iv).toBeTruthy();
    await expect(decryptData(wrongKey, encrypted)).rejects.toThrow();
    await expect(decryptData<typeof data>(key, encrypted)).resolves.toEqual(data);
  });

  it("wraps a master key for local device storage and rejects a different device key", async () => {
    const masterKey = await deriveMasterKey("password123", generateEncryptionSalt());
    const deviceKey = await generateDeviceKey();
    const otherDeviceKey = await generateDeviceKey();

    const wrapped = await wrapMasterKey(deviceKey, masterKey);

    await expect(unwrapMasterKey(otherDeviceKey, wrapped)).rejects.toThrow();

    const unwrapped = await unwrapMasterKey(deviceKey, wrapped);
    const payload = await encryptData(unwrapped, { test: true });

    await expect(decryptData(masterKey, payload)).resolves.toEqual({ test: true });
  });

  it("generates base64 salts with enough entropy to feed PBKDF2", () => {
    const salts = new Set(
      Array.from({ length: 16 }, () => generateEncryptionSalt())
    );

    expect(salts.size).toBe(16);
    for (const salt of salts) {
      expect(base64ToBuffer(salt).byteLength).toBe(16);
    }
  });
});
