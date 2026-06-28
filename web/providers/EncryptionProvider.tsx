"use client";

import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  ReactNode,
} from "react";
import {
  deriveMasterKey,
  generateDeviceKey,
  wrapMasterKey,
  unwrapMasterKey,
  EncryptedPayload,
  decryptData,
  encryptData,
} from "@/lib/crypto";
import {
  getDeviceKey,
  setDeviceKey,
  getWrappedMasterKey,
  setWrappedMasterKey,
  clearLocalData,
} from "@/lib/db";

interface EncryptionContextValue {
  masterKey: CryptoKey | null;
  isReady: boolean;
  isUnlocking: boolean;
  error: string | null;
  unlock: (password: string, salt: string) => Promise<void>;
  lock: () => Promise<void>;
  rotateMasterKey: (newMasterKey: CryptoKey) => Promise<void>;
  encrypt: <T>(data: T) => Promise<EncryptedPayload>;
  decrypt: <T>(payload: EncryptedPayload) => Promise<T>;
}

const EncryptionContext = createContext<EncryptionContextValue | undefined>(
  undefined
);

export function EncryptionProvider({ children }: { children: ReactNode }) {
  const [masterKey, setMasterKey] = useState<CryptoKey | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [isUnlocking, setIsUnlocking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function tryAutoUnlock() {
      try {
        const deviceKey = await getDeviceKey();
        const wrapped = await getWrappedMasterKey();
        if (!deviceKey || !wrapped) return;
        const key = await unwrapMasterKey(deviceKey, wrapped);
        if (!cancelled) {
          setMasterKey(key);
          setIsReady(true);
        }
      } catch (err) {
        console.error("Auto-unlock failed:", err);
      }
    }
    tryAutoUnlock();
    return () => {
      cancelled = true;
    };
  }, []);

  const unlock = useCallback(async (password: string, salt: string) => {
    setIsUnlocking(true);
    setError(null);
    try {
      const key = await deriveMasterKey(password, salt);

      let deviceKey = await getDeviceKey();
      if (!deviceKey) {
        deviceKey = await generateDeviceKey();
        await setDeviceKey(deviceKey);
      }

      const wrapped = await wrapMasterKey(deviceKey, key);
      await setWrappedMasterKey(wrapped);

      setMasterKey(key);
      setIsReady(true);
    } catch (err) {
      console.error("Unlock error:", err);
      setError("Failed to unlock encryption key");
      throw err;
    } finally {
      setIsUnlocking(false);
    }
  }, []);

  const lock = useCallback(async () => {
    setMasterKey(null);
    setIsReady(false);
    await clearLocalData();
  }, []);

  const rotateMasterKey = useCallback(async (newMasterKey: CryptoKey) => {
    let deviceKey = await getDeviceKey();
    if (!deviceKey) {
      deviceKey = await generateDeviceKey();
      await setDeviceKey(deviceKey);
    }
    const wrapped = await wrapMasterKey(deviceKey, newMasterKey);
    await setWrappedMasterKey(wrapped);
    setMasterKey(newMasterKey);
    setIsReady(true);
  }, []);

  const encrypt = useCallback(
    async <T,>(data: T): Promise<EncryptedPayload> => {
      if (!masterKey) throw new Error("Master key not available");
      // API routes only receive this opaque payload; contact fields stay in the browser.
      return encryptData(masterKey, data);
    },
    [masterKey]
  );

  const decrypt = useCallback(
    async <T,>(payload: EncryptedPayload): Promise<T> => {
      if (!masterKey) throw new Error("Master key not available");
      return decryptData<T>(masterKey, payload);
    },
    [masterKey]
  );

  return (
    <EncryptionContext.Provider
      value={{
        masterKey,
        isReady,
        isUnlocking,
        error,
        unlock,
        lock,
        rotateMasterKey,
        encrypt,
        decrypt,
      }}
    >
      {children}
    </EncryptionContext.Provider>
  );
}

export function useEncryption() {
  const ctx = useContext(EncryptionContext);
  if (!ctx)
    throw new Error("useEncryption must be used within EncryptionProvider");
  return ctx;
}
