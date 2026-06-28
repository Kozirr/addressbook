import { describe, expect, it } from "vitest";
import {
  contactToFormInput,
  formInputToContactDraft,
  normalizeTags,
  tagsFromInput,
} from "@/lib/contact-utils";

describe("contact utilities", () => {
  it("normalizes tags by trimming, lowercasing, and removing duplicates", () => {
    expect(normalizeTags([" Work ", "work", "Family", ""])).toEqual([
      "work",
      "family",
    ]);
  });

  it("parses comma-separated tag input", () => {
    expect(tagsFromInput("friend, Work, friend")).toEqual(["friend", "work"]);
  });

  it("creates empty form defaults when no contact is provided", () => {
    expect(contactToFormInput()).toMatchObject({
      firstName: "",
      lastName: "",
      isFavorite: false,
      tags: [],
    });
  });

  it("converts form blanks to optional contact fields", () => {
    expect(
      formInputToContactDraft({
        firstName: " Ada ",
        lastName: " Lovelace ",
        email: "",
        phone: " 123 ",
        address: "",
        company: "",
        jobTitle: "",
        notes: "",
        isFavorite: true,
        tags: [" Math ", "math"],
      })
    ).toEqual({
      firstName: "Ada",
      lastName: "Lovelace",
      email: undefined,
      phone: "123",
      address: undefined,
      company: undefined,
      jobTitle: undefined,
      notes: undefined,
      isFavorite: true,
      tags: ["math"],
    });
  });
});
