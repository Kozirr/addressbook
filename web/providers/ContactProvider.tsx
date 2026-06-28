"use client";

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
  useSyncExternalStore,
  ReactNode,
} from "react";
import { v4 as uuidv4 } from "uuid";
import { toast } from "sonner";
import {
  Contact,
  ContactFilters,
  ContactSort,
  PageConfig,
  EncryptedContactRecord,
} from "@/types/contact";
import { useEncryption } from "./EncryptionProvider";
import { normalizeTags } from "@/lib/contact-utils";
import {
  getContacts,
  putContact,
  putContacts,
  deleteContact as deleteLocalContact,
  getPendingChanges,
  addPendingChange,
  removePendingChange,
  getSyncState,
  setSyncState,
  PendingChange,
} from "@/lib/db";

type ContactDraft = Omit<Contact, "id" | "createdAt" | "updatedAt">;

interface ContactContextValue {
  contacts: Contact[];
  filteredContacts: Contact[];
  paginatedContacts: Contact[];
  totalPages: number;
  allTags: string[];
  allCompanies: string[];
  isLoading: boolean;
  isSyncing: boolean;
  isOnline: boolean;
  filters: ContactFilters;
  sort: ContactSort;
  pageConfig: PageConfig;
  setFilters: (filters: Partial<ContactFilters>) => void;
  setSort: (sort: ContactSort) => void;
  setPageConfig: (config: Partial<PageConfig>) => void;
  addContact: (contact: ContactDraft) => Promise<Contact>;
  updateContact: (id: string, updates: Partial<Contact>) => Promise<Contact>;
  deleteContact: (id: string) => Promise<void>;
  toggleFavorite: (id: string) => Promise<void>;
  sync: () => Promise<void>;
  importContacts: (contacts: ContactDraft[]) => Promise<void>;
}

const ContactContext = createContext<ContactContextValue | undefined>(undefined);

function sortContacts(contacts: Contact[], sort: ContactSort): Contact[] {
  const sorted = [...contacts];
  sorted.sort((a, b) => {
    // Favorites always appear first
    if (a.isFavorite !== b.isFavorite) {
      return a.isFavorite ? -1 : 1;
    }

    let comparison = 0;
    switch (sort.field) {
      case "firstName":
        comparison = a.firstName.localeCompare(b.firstName);
        break;
      case "lastName":
        comparison = a.lastName.localeCompare(b.lastName);
        break;
      case "company":
        comparison = (a.company || "").localeCompare(b.company || "");
        break;
      case "createdAt":
        comparison =
          new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        break;
      case "updatedAt":
        comparison =
          new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime();
        break;
    }
    return sort.direction === "asc" ? comparison : -comparison;
  });
  return sorted;
}

function createLocalContact(data: ContactDraft, now = new Date().toISOString()): Contact {
  return {
    ...data,
    id: uuidv4(),
    tags: normalizeTags(data.tags),
    createdAt: now,
    updatedAt: now,
  };
}

function applyContactEdits(existing: Contact, updates: Partial<Contact>): Contact {
  return {
    ...existing,
    ...updates,
    id: existing.id,
    tags: updates.tags ? normalizeTags(updates.tags) : existing.tags,
    updatedAt: new Date().toISOString(),
  };
}

function chooseLatestContactRevision(remote: Contact, local?: Contact): Contact {
  if (!local) return remote;

  const remoteTime = new Date(remote.updatedAt).getTime();
  const localTime = new Date(local.updatedAt).getTime();
  return remoteTime >= localTime ? remote : local;
}

function mergeEncryptedServerContacts(remoteContacts: Contact[], localContacts: Contact[]) {
  const localById = new Map(localContacts.map((contact) => [contact.id, contact]));
  const seenRemoteIds = new Set<string>();

  const merged = remoteContacts.map((remote) => {
    seenRemoteIds.add(remote.id);
    return chooseLatestContactRevision(remote, localById.get(remote.id));
  });

  for (const local of localContacts) {
    if (!seenRemoteIds.has(local.id)) merged.push(local);
  }

  return merged;
}

export function ContactProvider({ children }: { children: ReactNode }) {
  const { isReady, encrypt, decrypt } = useEncryption();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const isOnline = useSyncExternalStore(
    (callback) => {
      window.addEventListener("online", callback);
      window.addEventListener("offline", callback);
      return () => {
        window.removeEventListener("online", callback);
        window.removeEventListener("offline", callback);
      };
    },
    () => navigator.onLine,
    () => true
  );
  const [filters, setFiltersState] = useState<ContactFilters>({
    query: "",
    tags: [],
    companies: [],
  });
  const [sort, setSortState] = useState<ContactSort>({
    field: "firstName",
    direction: "asc",
  });
  const [pageConfig, setPageConfigState] = useState<PageConfig>({
    page: 1,
    pageSize: 25,
  });

  useEffect(() => {
    if (!isReady) {
      setContacts([]);
      setIsLoading(false);
      return;
    }

    let cancelled = false;
    setIsLoading(true);
    getContacts()
      .then((loaded) => {
        if (!cancelled) setContacts(loaded);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [isReady]);

  const setFilters = useCallback((partial: Partial<ContactFilters>) => {
    setFiltersState((prev) => ({ ...prev, ...partial }));
    setPageConfigState((prev) => ({ ...prev, page: 1 }));
  }, []);

  const setSort = useCallback((sort: ContactSort) => {
    setSortState(sort);
  }, []);

  const setPageConfig = useCallback((partial: Partial<PageConfig>) => {
    setPageConfigState((prev) => ({ ...prev, ...partial }));
  }, []);

  const filteredContacts = useMemo(() => {
    let result = contacts;

    if (filters.query.trim()) {
      const query = filters.query.toLowerCase();
      result = result.filter(
        (c) =>
          c.firstName.toLowerCase().includes(query) ||
          c.lastName.toLowerCase().includes(query) ||
          (c.email && c.email.toLowerCase().includes(query)) ||
          (c.phone && c.phone.toLowerCase().includes(query)) ||
          (c.company && c.company.toLowerCase().includes(query)) ||
          c.tags.some((t) => t.toLowerCase().includes(query))
      );
    }

    if (filters.tags.length > 0) {
      const tagSet = new Set(normalizeTags(filters.tags));
      result = result.filter((c) =>
        c.tags.some((t) => tagSet.has(t.trim().toLowerCase()))
      );
    }

    if (filters.companies.length > 0) {
      result = result.filter((c) =>
        filters.companies.includes(c.company || "")
      );
    }

    return sortContacts(result, sort);
  }, [contacts, filters, sort]);

  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(filteredContacts.length / pageConfig.pageSize)),
    [filteredContacts.length, pageConfig.pageSize]
  );

  const paginatedContacts = useMemo(() => {
    const start = (pageConfig.page - 1) * pageConfig.pageSize;
    return filteredContacts.slice(start, start + pageConfig.pageSize);
  }, [filteredContacts, pageConfig]);

  const syncRef = useRef<(() => Promise<void>) | null>(null);

  const queueContactSync = useCallback(
    async (change: Omit<PendingChange, "createdAt">) => {
      await addPendingChange({ ...change, createdAt: Date.now() });
      if (isOnline) {
        syncRef.current?.();
      }
    },
    [isOnline]
  );

  const addContact = useCallback(
    async (
      data: ContactDraft
    ): Promise<Contact> => {
      const now = new Date().toISOString();
      const contact = createLocalContact(data, now);

      await putContact(contact);
      setContacts((prev) => sortContacts([...prev, contact], sort));

      const encrypted = await encrypt(contact);
      await queueContactSync({
        id: uuidv4(),
        type: "create",
        contactId: contact.id,
        encryptedData: encrypted,
        serverUpdatedAt: now,
      });

      return contact;
    },
    [encrypt, queueContactSync, sort]
  );

  const updateContact = useCallback(
    async (id: string, updates: Partial<Contact>): Promise<Contact> => {
      const existing = contacts.find((c) => c.id === id);
      if (!existing) throw new Error("Contact not found");

      const editedContact = applyContactEdits(existing, updates);

      await putContact(editedContact);
      setContacts((prev) =>
        sortContacts(
          prev.map((c) => (c.id === id ? editedContact : c)),
          sort
        )
      );

      const encrypted = await encrypt(editedContact);
      await queueContactSync({
        id: uuidv4(),
        type: "update",
        contactId: id,
        encryptedData: encrypted,
        serverUpdatedAt: editedContact.updatedAt,
      });

      return editedContact;
    },
    [contacts, encrypt, queueContactSync, sort]
  );

  const deleteContact = useCallback(
    async (id: string): Promise<void> => {
      await deleteLocalContact(id);
      setContacts((prev) => prev.filter((c) => c.id !== id));
      await queueContactSync({
        id: uuidv4(),
        type: "delete",
        contactId: id,
      });
    },
    [queueContactSync]
  );

  const toggleFavorite = useCallback(
    async (id: string): Promise<void> => {
      const existing = contacts.find((c) => c.id === id);
      if (!existing) return;
      await updateContact(id, { isFavorite: !existing.isFavorite });
    },
    [contacts, updateContact]
  );

  const importContacts = useCallback(
    async (
      imported: ContactDraft[]
    ): Promise<void> => {
      const now = new Date().toISOString();
      const newContacts = imported.map((data) => createLocalContact(data, now));

      await putContacts(newContacts);
      setContacts((prev) => sortContacts([...prev, ...newContacts], sort));

      for (const contact of newContacts) {
        const encrypted = await encrypt(contact);
        await queueContactSync({
          id: uuidv4(),
          type: "create",
          contactId: contact.id,
          encryptedData: encrypted,
          serverUpdatedAt: now,
        });
      }
    },
    [encrypt, queueContactSync, sort]
  );

  const sync = useCallback(async (): Promise<void> => {
    if (!isReady || !navigator.onLine) return;
    setIsSyncing(true);

    try {
      // Pull opaque server records first so local conflict checks use the newest ciphertext.
      const syncState = await getSyncState();
      const pullRes = await fetch(
        `/api/contacts?limit=100&cursor=${syncState.cursor || ""}`,
        { credentials: "same-origin" }
      );
      if (!pullRes.ok) throw new Error("Failed to pull encrypted contacts");
      const { contacts: serverContacts } = (await pullRes.json()) as {
        contacts: EncryptedContactRecord[];
      };

      if (serverContacts.length > 0) {
        const decrypted = await Promise.all(
          serverContacts.map((record) =>
            decrypt<Contact>({
              encryptedData: record.encryptedData,
              iv: record.iv,
            })
          )
        );

        const merged = mergeEncryptedServerContacts(decrypted, await getContacts());

        await putContacts(merged);
        setContacts(sortContacts(merged, sort));

        const last = serverContacts[serverContacts.length - 1];
        await setSyncState({
          lastSyncAt: last.serverUpdatedAt,
          cursor: last.id,
        });
      }

      // Pending writes stay local until the encrypted payload reaches the server.
      const pending = await getPendingChanges();
      if (pending.length > 0) {
        const changes = pending.map((p) => ({
          id: p.contactId,
          type: p.type,
          encryptedData: p.encryptedData?.encryptedData,
          iv: p.encryptedData?.iv,
          serverUpdatedAt: p.serverUpdatedAt,
        }));

        const pushRes = await fetch("/api/contacts/sync", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ changes }),
          credentials: "same-origin",
        });

        if (pushRes.ok) {
          const { results } = (await pushRes.json()) as {
            results: Array<{ id: string; status: string }>;
          };
          for (let i = 0; i < pending.length; i++) {
            if (results[i]?.status === "ok") {
              await removePendingChange(pending[i].id);
            }
          }
        }
      }
    } catch (error) {
      console.error("Sync error:", error);
      toast.error("Sync failed", {
        description: error instanceof Error ? error.message : "Could not sync contacts",
      });
    } finally {
      setIsSyncing(false);
    }
  }, [isReady, decrypt, sort]);

  useEffect(() => {
    syncRef.current = sync;
  }, [sync]);

  useEffect(() => {
    if (!isReady || !isOnline) return;
    sync();
  }, [isReady, isOnline, sync]);

  const allTags = useMemo(() => {
    const tagSet = new Set<string>();
    contacts.forEach((c) => c.tags.forEach((t) => tagSet.add(t)));
    return Array.from(tagSet).sort();
  }, [contacts]);

  const allCompanies = useMemo(() => {
    const companySet = new Set<string>();
    contacts.forEach((c) => {
      if (c.company) companySet.add(c.company);
    });
    return Array.from(companySet).sort();
  }, [contacts]);

  const value: ContactContextValue = {
    contacts,
    filteredContacts,
    paginatedContacts,
    totalPages,
    allTags,
    allCompanies,
    isLoading,
    isSyncing,
    isOnline,
    filters,
    sort,
    pageConfig,
    setFilters,
    setSort,
    setPageConfig,
    addContact,
    updateContact,
    deleteContact,
    toggleFavorite,
    sync,
    importContacts,
  };

  return (
    <ContactContext.Provider value={value}>
      {children}
    </ContactContext.Provider>
  );
}

export function useContacts() {
  const ctx = useContext(ContactContext);
  if (!ctx) throw new Error("useContacts must be used within ContactProvider");
  return ctx;
}
