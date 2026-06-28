import Papa from "papaparse";
import { Contact } from "@/types/contact";

function downloadFile(content: string, filename: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function generateContactsCSV(contacts: Contact[]): string {
  const rows = contacts.map((c) => ({
    "First Name": c.firstName,
    "Last Name": c.lastName,
    Email: c.email || "",
    Phone: c.phone || "",
    Address: c.address || "",
    Company: c.company || "",
    "Job Title": c.jobTitle || "",
    Notes: c.notes || "",
    Favorite: c.isFavorite ? "yes" : "no",
    Tags: c.tags.join(", "),
  }));

  return Papa.unparse(rows);
}

function exportFilename(contacts: Contact[], ext: string): string {
  if (contacts.length === 1) {
    const name = `${contacts[0].firstName}_${contacts[0].lastName}`
      .replace(/\s+/g, "_")
      .replace(/[^a-zA-Z0-9_-]/g, "")
      || "contact";
    return `${name}.${ext}`;
  }
  const date = new Date().toISOString().slice(0, 10);
  return `contacts-${date}.${ext}`;
}

export function exportContactsCSV(contacts: Contact[]) {
  downloadFile(generateContactsCSV(contacts), exportFilename(contacts, "csv"), "text/csv");
}

function escapeVCard(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\n/g, "\\n");
}

function contactToVCard(contact: Contact): string {
  const lines: string[] = [
    "BEGIN:VCARD",
    "VERSION:3.0",
    `N:${escapeVCard(contact.lastName)};${escapeVCard(contact.firstName)};;;`,
    `FN:${escapeVCard(contact.firstName)} ${escapeVCard(contact.lastName)}`,
  ];

  if (contact.email) {
    lines.push(`EMAIL:${escapeVCard(contact.email)}`);
  }
  if (contact.phone) {
    lines.push(`TEL:${escapeVCard(contact.phone)}`);
  }
  if (contact.address) {
    lines.push(`ADR:;;${escapeVCard(contact.address)};;;;`);
  }
  if (contact.company) {
    lines.push(`ORG:${escapeVCard(contact.company)}`);
  }
  if (contact.jobTitle) {
    lines.push(`TITLE:${escapeVCard(contact.jobTitle)}`);
  }
  if (contact.notes) {
    lines.push(`NOTE:${escapeVCard(contact.notes)}`);
  }
  if (contact.tags.length > 0) {
    lines.push(`CATEGORIES:${contact.tags.map(escapeVCard).join(",")}`);
  }

  lines.push("END:VCARD");
  return lines.join("\r\n");
}

export function generateContactsVCard(contacts: Contact[]): string {
  return contacts.map(contactToVCard).join("\r\n\r\n");
}

export function exportContactsVCard(contacts: Contact[]) {
  downloadFile(generateContactsVCard(contacts), exportFilename(contacts, "vcf"), "text/vcard");
}
