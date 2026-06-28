import Papa from "papaparse";
import VCard from "vcf";
import { Contact } from "@/types/contact";

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
const MAX_CONTACTS = 500;
const MAX_FIELD_LENGTH = 1000;

type ContactInput = Omit<Contact, "id" | "createdAt" | "updatedAt">;

function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsText(file);
  });
}

function sanitize(value: string | undefined): string | undefined {
  if (!value) return undefined;
  return value.trim().slice(0, MAX_FIELD_LENGTH) || undefined;
}

function normalizeYesNo(value: string | undefined): boolean {
  if (!value) return false;
  return ["yes", "true", "1"].includes(value.trim().toLowerCase());
}

function parseTags(value: string | undefined): string[] {
  if (!value) return [];
  return value
    .split(",")
    .map((t) => t.trim().toLowerCase())
    .filter(Boolean)
    .slice(0, 50);
}

function rowToContact(row: Record<string, string>): ContactInput {
  const firstName = row["First Name"] || row["first_name"] || row["firstName"] || "";
  const lastName = row["Last Name"] || row["last_name"] || row["lastName"] || "";

  return {
    firstName: sanitize(firstName) || "",
    lastName: sanitize(lastName) || "",
    email: sanitize(row["Email"] || row["email"]),
    phone: sanitize(row["Phone"] || row["phone"]),
    address: sanitize(row["Address"] || row["address"]),
    company: sanitize(row["Company"] || row["company"]),
    jobTitle: sanitize(row["Job Title"] || row["job_title"] || row["jobTitle"]),
    notes: sanitize(row["Notes"] || row["notes"]),
    isFavorite: normalizeYesNo(row["Favorite"] || row["favorite"]),
    tags: parseTags(row["Tags"] || row["tags"]),
  };
}

async function importCSV(file: File): Promise<ContactInput[]> {
  const text = await readFileAsText(file);

  // Validate it looks like CSV
  if (!text.includes(",") && !text.includes(";")) {
    throw new Error("File does not appear to be a valid CSV");
  }

  const result = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: true,
    preview: MAX_CONTACTS + 1,
  });

  if (result.errors.length > 0 && result.data.length === 0) {
    throw new Error("Failed to parse CSV: " + result.errors[0].message);
  }

  const contacts = result.data.map(rowToContact).filter((c) => c.firstName || c.lastName);

  if (contacts.length === 0) {
    throw new Error("No valid contacts found in file");
  }

  if (contacts.length > MAX_CONTACTS) {
    throw new Error(`Too many contacts. Maximum is ${MAX_CONTACTS}.`);
  }

  return contacts;
}

function vcardValue(value: unknown): string | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value === "string") return sanitize(value);
  if (Array.isArray(value)) return sanitize(value.join(", "));
  return sanitize(String(value));
}

async function importVCard(file: File): Promise<ContactInput[]> {
  const text = await readFileAsText(file);

  if (!text.includes("BEGIN:VCARD")) {
    throw new Error("File does not appear to be a valid vCard");
  }

  const cards = VCard.parse(text);
  const inputs: ContactInput[] = [];

  for (const card of cards) {
    const n = card.get("n");
    let firstName = "";
    let lastName = "";

    if (n) {
      const value = n.valueOf();
      if (typeof value === "string") {
        const parts = value.split(";");
        lastName = parts[0] || "";
        firstName = parts[1] || "";
      }
    }

    const fn = card.get("fn");
    if (!firstName && !lastName && fn) {
      const full = vcardValue(fn.valueOf()) || "";
      const parts = full.split(" ");
      firstName = parts[0] || "";
      lastName = parts.slice(1).join(" ") || "";
    }

    if (!firstName && !lastName) continue;
    if (inputs.length >= MAX_CONTACTS) break;

    const email = card.get("email");
    const tel = card.get("tel");
    const adr = card.get("adr");
    const org = card.get("org");
    const title = card.get("title");
    const note = card.get("note");
    const categories = card.get("categories");

    inputs.push({
      firstName: sanitize(firstName) || "",
      lastName: sanitize(lastName) || "",
      email: email ? vcardValue(email.valueOf()) : undefined,
      phone: tel ? vcardValue(tel.valueOf()) : undefined,
      address: adr ? vcardValue(adr.valueOf()) : undefined,
      company: org ? vcardValue(org.valueOf()) : undefined,
      jobTitle: title ? vcardValue(title.valueOf()) : undefined,
      notes: note ? vcardValue(note.valueOf()) : undefined,
      isFavorite: false,
      tags: categories ? parseTags(vcardValue(categories.valueOf())) : [],
    });
  }

  if (inputs.length === 0) {
    throw new Error("No valid contacts found in file");
  }

  return inputs;
}

export async function importFile(file: File): Promise<ContactInput[]> {
  // Size check
  if (file.size > MAX_FILE_SIZE) {
    throw new Error(`File too large. Maximum size is ${MAX_FILE_SIZE / 1024 / 1024} MB.`);
  }

  // Extension check
  const name = file.name.toLowerCase();
  if (name.endsWith(".csv")) {
    return importCSV(file);
  }
  if (name.endsWith(".vcf")) {
    return importVCard(file);
  }

  throw new Error("Unsupported file format. Please upload a CSV or vCard (.vcf) file.");
}
