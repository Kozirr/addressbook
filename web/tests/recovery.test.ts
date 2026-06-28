import { describe, it, expect } from "vitest";
import {
  generateRecoveryKey,
  validateRecoveryKey,
  deriveRecoveryMasterKey,
  wrapMasterKeyForRecovery,
  unwrapMasterKeyForRecovery,
  hashRecoveryKey,
  verifyRecoveryKey,
  getRecoveryKeyIdentifier,
  RECOVERY_WORD_COUNT,
} from "@/lib/recovery";
import { deriveMasterKey } from "@/lib/crypto";

describe("recovery key crypto", () => {
  it("generates a valid 24-word recovery key", () => {
    const key = generateRecoveryKey();
    expect(key).toHaveLength(RECOVERY_WORD_COUNT);
    expect(validateRecoveryKey(key)).toBe(true);
  });

  it("validates recovery key length and words", () => {
    expect(validateRecoveryKey(["short"])).toBe(false);
    expect(validateRecoveryKey(Array(24).fill("notaword"))).toBe(false);
  });

  it("wraps and unwraps a master key", async () => {
    const recoveryKey = generateRecoveryKey();
    const recoverySalt = "test-salt";
    const password = "password123";
    const encryptionSalt = "encryption-salt";

    const masterKey = await deriveMasterKey(password, encryptionSalt);
    const recoveryMasterKey = await deriveRecoveryMasterKey(recoveryKey, recoverySalt);
    const wrapped = await wrapMasterKeyForRecovery(masterKey, recoveryMasterKey);
    const unwrapped = await unwrapMasterKeyForRecovery(wrapped, recoveryMasterKey);

    // Verify the unwrapped key works by encrypting and decrypting data.
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encoder = new TextEncoder();
    const plaintext = encoder.encode(JSON.stringify({ hello: "world" }));
    const encrypted = await crypto.subtle.encrypt(
      { name: "AES-GCM", iv },
      unwrapped,
      plaintext
    );
    const decrypted = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv },
      unwrapped,
      encrypted
    );
    expect(new TextDecoder().decode(decrypted)).toBe(JSON.stringify({ hello: "world" }));
  });

  it("hashes and verifies recovery keys", async () => {
    const recoveryKey = generateRecoveryKey();
    const hash = await hashRecoveryKey(recoveryKey);
    expect(await verifyRecoveryKey(recoveryKey, hash)).toBe(true);
    expect(await verifyRecoveryKey(generateRecoveryKey(), hash)).toBe(false);
  });

  it("generates deterministic identifiers", async () => {
    const recoveryKey = generateRecoveryKey();
    const id1 = await getRecoveryKeyIdentifier(recoveryKey);
    const id2 = await getRecoveryKeyIdentifier(recoveryKey);
    expect(id1).toBe(id2);
    expect(id1).not.toBe(await getRecoveryKeyIdentifier(generateRecoveryKey()));
  });
});
