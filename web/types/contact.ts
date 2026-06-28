export interface Contact {
  id: string;
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  address?: string;
  company?: string;
  jobTitle?: string;
  notes?: string;
  isFavorite: boolean;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

export interface EncryptedContactRecord {
  id: string;
  encryptedData: string;
  iv: string;
  serverUpdatedAt: string;
  version: number;
}

export interface ContactFilters {
  query: string;
  tags: string[];
  companies: string[];
}

export type ContactSortField =
  | "firstName"
  | "lastName"
  | "company"
  | "createdAt"
  | "updatedAt";

export type ContactSortDirection = "asc" | "desc";

export interface ContactSort {
  field: ContactSortField;
  direction: ContactSortDirection;
}

export interface PageConfig {
  page: number;
  pageSize: 25 | 50 | 100;
}
