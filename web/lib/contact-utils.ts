import { Contact } from "@/types/contact";
import { ContactFormInput } from "@/lib/validations";

export type ContactDraft = Omit<Contact, "id" | "createdAt" | "updatedAt">;

export function normalizeTags(tags: string[]): string[] {
  return Array.from(
    new Set(tags.map((tag) => tag.trim().toLowerCase()).filter(Boolean))
  );
}

export function tagsFromInput(value: string): string[] {
  return normalizeTags(value.split(","));
}

export function contactToFormInput(contact?: Contact): ContactFormInput {
  return {
    firstName: contact?.firstName ?? "",
    lastName: contact?.lastName ?? "",
    email: contact?.email ?? "",
    phone: contact?.phone ?? "",
    address: contact?.address ?? "",
    company: contact?.company ?? "",
    jobTitle: contact?.jobTitle ?? "",
    notes: contact?.notes ?? "",
    isFavorite: contact?.isFavorite ?? false,
    tags: contact ? normalizeTags(contact.tags) : [],
  };
}

export function formInputToContactDraft(input: ContactFormInput): ContactDraft {
  return {
    firstName: input.firstName.trim(),
    lastName: input.lastName.trim(),
    email: input.email?.trim() || undefined,
    phone: input.phone?.trim() || undefined,
    address: input.address?.trim() || undefined,
    company: input.company?.trim() || undefined,
    jobTitle: input.jobTitle?.trim() || undefined,
    notes: input.notes?.trim() || undefined,
    isFavorite: input.isFavorite,
    tags: normalizeTags(input.tags),
  };
}
