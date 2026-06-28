import { describe, expect, it } from "vitest";
import Papa from "papaparse";
import { generateContactsCSV, generateContactsVCard } from "@/lib/export";
import { importFile } from "@/lib/import";
import { Contact } from "@/types/contact";

const mockContact: Contact = {
  id: "test-id",
  firstName: "Ada",
  lastName: "Lovelace",
  email: "ada@example.com",
  phone: "+1234567890",
  company: "Analytical Engines, Ltd.",
  jobTitle: "Engineer",
  address: "12 St James Square",
  notes: "Line one\nLine two, with comma",
  isFavorite: true,
  tags: ["math", "history"],
  createdAt: "2026-06-28T10:00:00.000Z",
  updatedAt: "2026-06-28T10:00:00.000Z",
};

function createFile(content: string, name: string, type: string): File {
  return new File([content], name, { type });
}

describe("export", () => {
  it("exports a CSV that can be parsed back without losing commas, notes, or tags", () => {
    const csv = generateContactsCSV([mockContact]);
    const parsed = Papa.parse<Record<string, string>>(csv, {
      header: true,
      skipEmptyLines: true,
    });

    expect(parsed.errors).toEqual([]);
    expect(parsed.data).toEqual([
      {
        "First Name": "Ada",
        "Last Name": "Lovelace",
        Email: "ada@example.com",
        Phone: "+1234567890",
        Address: "12 St James Square",
        Company: "Analytical Engines, Ltd.",
        "Job Title": "Engineer",
        Notes: "Line one\nLine two, with comma",
        Favorite: "yes",
        Tags: "math, history",
      },
    ]);
  });

  it("escapes vCard punctuation instead of producing ambiguous fields", () => {
    const vcf = generateContactsVCard([mockContact]);

    expect(vcf).toContain("BEGIN:VCARD");
    expect(vcf).toContain("N:Lovelace;Ada;;;");
    expect(vcf).toContain("ORG:Analytical Engines\\, Ltd.");
    expect(vcf).toContain("NOTE:Line one\\nLine two\\, with comma");
    expect(vcf).toContain("CATEGORIES:math,history");
    expect(vcf).toContain("END:VCARD");
  });
});

describe("import", () => {
  it("imports CSV aliases, trims overlong fields, and preserves favorite/tag intent", async () => {
    const longNote = "x".repeat(1_200);
    const csv = [
      "first_name,last_name,email,Phone,Company,Notes,Favorite,Tags",
      ` Ada , Lovelace , ada@example.com , +1234567890 , Engines , ${longNote} , TRUE , Math, history `,
    ].join("\n");
    const file = createFile(csv, "contacts.csv", "text/csv");

    const [imported] = await importFile(file);

    expect(imported).toMatchObject({
      firstName: "Ada",
      lastName: "Lovelace",
      email: "ada@example.com",
      phone: "+1234567890",
      company: "Engines",
      notes: "x".repeat(1_000),
      isFavorite: true,
      tags: ["math"],
    });
  });

  it("skips blank CSV rows and rejects files that do not contain contacts", async () => {
    const empty = createFile("First Name,Last Name\n,\n", "empty.csv", "text/csv");
    await expect(importFile(empty)).rejects.toThrow("No valid contacts found");

    const notCsv = createFile("just words", "contacts.csv", "text/csv");
    await expect(importFile(notCsv)).rejects.toThrow("valid CSV");
  });

  it("stops oversized CSV imports before accepting more than 500 contacts", async () => {
    const rows = Array.from({ length: 501 }, (_, index) => `First${index},Last${index}`);
    const file = createFile(
      ["First Name,Last Name", ...rows].join("\n"),
      "too-many.csv",
      "text/csv"
    );

    await expect(importFile(file)).rejects.toThrow("Too many contacts");
  });

  it("imports vCard name, org, title, notes, and categories", async () => {
    const vcf = [
      "BEGIN:VCARD",
      "VERSION:3.0",
      "N:Lovelace;Ada;;;",
      "FN:Ada Lovelace",
      "EMAIL:ada@example.com",
      "TEL:+1234567890",
      "ORG:Analytical Engines",
      "TITLE:Engineer",
      "NOTE:first programmer",
      "CATEGORIES:Math,History",
      "END:VCARD",
    ].join("\r\n");
    const file = createFile(vcf, "contacts.vcf", "text/vcard");

    const [imported] = await importFile(file);

    expect(imported).toMatchObject({
      firstName: "Ada",
      lastName: "Lovelace",
      email: "ada@example.com",
      phone: "+1234567890",
      company: "Analytical Engines",
      jobTitle: "Engineer",
      notes: "first programmer",
      tags: ["math", "history"],
    });
  });
});
