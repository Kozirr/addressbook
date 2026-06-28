import { openDB, DBSchema, IDBPDatabase } from "idb";
import { WrappedMasterKey } from "./crypto";
import { Contact } from "@/types/contact";

const DB_NAME = "addressbook";
const DB_VERSION = 1;

interface AddressBookDB extends DBSchema {
  deviceKey: {
    key: string;
    value: CryptoKey;
  };
  wrappedMasterKey: {
    key: string;
    value: WrappedMasterKey;
  };
  contacts: {
    key: string;
    value: Contact;
    indexes: { "by-updated": string };
  };
  pendingChanges: {
    key: string;
    value: PendingChange;
  };
  syncState: {
    key: string;
    value: SyncState;
  };
}

export interface PendingChange {
  id: string;
  type: "create" | "update" | "delete";
  contactId: string;
  encryptedData?: { encryptedData: string; iv: string };
  serverUpdatedAt?: string;
  createdAt: number;
}

export interface SyncState {
  lastSyncAt: string | null;
  cursor: string | null;
}

let dbPromise: Promise<IDBPDatabase<AddressBookDB>> | null = null;

export function getDB(): Promise<IDBPDatabase<AddressBookDB>> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("IndexedDB is only available in browser"));
  }
  if (!dbPromise) {
    dbPromise = openDB<AddressBookDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        db.createObjectStore("deviceKey");
        db.createObjectStore("wrappedMasterKey");
        const contactStore = db.createObjectStore("contacts", { keyPath: "id" });
        contactStore.createIndex("by-updated", "updatedAt");
        db.createObjectStore("pendingChanges", { keyPath: "id" });
        db.createObjectStore("syncState");
      },
    });
  }
  return dbPromise;
}

export async function clearLocalData(): Promise<void> {
  const db = await getDB();
  // Local plaintext contacts are only usable after browser-side unlock; clear them with keys.
  await db.clear("deviceKey");
  await db.clear("wrappedMasterKey");
  await db.clear("contacts");
  await db.clear("pendingChanges");
  await db.put("syncState", { lastSyncAt: null, cursor: null }, "default");
}

export async function getDeviceKey(): Promise<CryptoKey | undefined> {
  const db = await getDB();
  return db.get("deviceKey", "default");
}

export async function setDeviceKey(key: CryptoKey): Promise<void> {
  const db = await getDB();
  await db.put("deviceKey", key, "default");
}

export async function getWrappedMasterKey(): Promise<WrappedMasterKey | undefined> {
  const db = await getDB();
  return db.get("wrappedMasterKey", "default");
}

export async function setWrappedMasterKey(wrapped: WrappedMasterKey): Promise<void> {
  const db = await getDB();
  await db.put("wrappedMasterKey", wrapped, "default");
}

export async function getContacts(): Promise<Contact[]> {
  const db = await getDB();
  return db.getAll("contacts");
}

export async function getContactById(id: string): Promise<Contact | undefined> {
  const db = await getDB();
  return db.get("contacts", id);
}

export async function putContact(contact: Contact): Promise<void> {
  const db = await getDB();
  await db.put("contacts", contact);
}

export async function putContacts(contacts: Contact[]): Promise<void> {
  const db = await getDB();
  const tx = db.transaction("contacts", "readwrite");
  for (const contact of contacts) {
    tx.store.put(contact);
  }
  await tx.done;
}

export async function deleteContact(id: string): Promise<void> {
  const db = await getDB();
  await db.delete("contacts", id);
}

export async function addPendingChange(change: PendingChange): Promise<void> {
  const db = await getDB();
  await db.put("pendingChanges", change);
}

export async function getPendingChanges(): Promise<PendingChange[]> {
  const db = await getDB();
  return db.getAll("pendingChanges");
}

export async function removePendingChange(id: string): Promise<void> {
  const db = await getDB();
  await db.delete("pendingChanges", id);
}

export async function clearPendingChanges(): Promise<void> {
  const db = await getDB();
  await db.clear("pendingChanges");
}

export async function getSyncState(): Promise<SyncState> {
  const db = await getDB();
  return (
    (await db.get("syncState", "default")) ?? {
      lastSyncAt: null,
      cursor: null,
    }
  );
}

export async function setSyncState(state: SyncState): Promise<void> {
  const db = await getDB();
  await db.put("syncState", state, "default");
}
