import { describe, expect, it } from "vitest";
import { z } from "zod";
import {
  loginSchema,
  registerSchema,
  contactFormSchema,
  updateEmailSchema,
  updatePasswordSchema,
  deleteAccountSchema,
  recoveryKeySchema,
  confirmEmailSchema,
  confirmRecoverySchema,
  requestPasswordResetSchema,
  recoverAccountSchema,
  contactSyncSchema,
  encryptedContactBodySchema,
  resetPasswordSchema,
  strongPasswordSchema,
} from "@/lib/validations";

function parseOrThrow<T>(schema: z.ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value);
  if (!result.success) {
    throw new Error(result.error.issues.map((issue) => issue.message).join(", "));
  }
  return result.data;
}

function expectIssue<T>(schema: z.ZodType<T>, value: unknown) {
  const result = schema.safeParse(value);
  expect(result.success).toBe(false);
  if (result.success) throw new Error("Expected validation to fail");
  return result.error.issues;
}

function expectIssues<T>(schema: z.ZodType<T>, value: unknown) {
  return expect(expectIssue(schema, value));
}

const recoveryKey = Array.from({ length: 24 }, (_, index) => `word-${index}`);
const validWrappedKey = { encryptedData: "ciphertext", iv: "iv" };

describe("validation schemas", () => {
  it("keeps login deliberately boring: valid email plus an 8+ character password", () => {
    expect(
      parseOrThrow(loginSchema, {
        email: "person@example.com",
        password: "password123",
      })
    ).toEqual({
      email: "person@example.com",
      password: "password123",
    });

    expectIssues(loginSchema, {
      email: "not-an-email",
      password: "password123",
    }).toMatchObject([{ path: ["email"], message: "Invalid email address" }]);

    expectIssues(loginSchema, {
      email: "person@example.com",
      password: "short",
    }).toMatchObject([
      { path: ["password"], message: "Password must be at least 8 characters" },
    ]);
  });

  it("spells out every strong-password rule so the UI can surface useful messages", () => {
    const weakCases = [
      ["Password1", "Password must include a symbol"],
      ["password1!", "Password must include an uppercase letter"],
      ["PASSWORD1!", "Password must include a lowercase letter"],
      ["Password!", "Password must include a digit"],
      ["P1!", "Password must be at least 8 characters"],
    ];

    expect(strongPasswordSchema.safeParse("Password1!").success).toBe(true);

    for (const [password, message] of weakCases) {
      expect(expectIssue(strongPasswordSchema, password)).toEqual(
        expect.arrayContaining([expect.objectContaining({ message })])
      );
    }
  });

  it("puts register password mismatch errors on confirmPassword", () => {
    expect(
      parseOrThrow(registerSchema, {
        email: "new@example.com",
        password: "Password1!",
        confirmPassword: "Password1!",
      })
    ).toMatchObject({ email: "new@example.com" });

    expectIssues(registerSchema, {
      email: "new@example.com",
      password: "Password1!",
      confirmPassword: "Password2!",
    }).toMatchObject([
      { path: ["confirmPassword"], message: "Passwords do not match" },
    ]);
  });

  it("accepts sparse contact forms but still requires names and a valid optional email", () => {
    expect(
      parseOrThrow(contactFormSchema, {
        firstName: "Ada",
        lastName: "Lovelace",
        email: "",
        isFavorite: false,
        tags: ["math"],
      })
    ).toMatchObject({
      firstName: "Ada",
      lastName: "Lovelace",
      email: "",
      tags: ["math"],
    });

    expectIssues(contactFormSchema, {
      firstName: "",
      lastName: "",
      email: "ada-at-example",
      isFavorite: false,
      tags: [],
    }).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ path: ["firstName"], message: "First name is required" }),
        expect.objectContaining({ path: ["lastName"], message: "Last name is required" }),
        expect.objectContaining({ path: ["email"], message: "Invalid email" }),
      ])
    );
  });

  it("separates account update checks from strong-password checks", () => {
    expect(
      parseOrThrow(updateEmailSchema, {
        email: "new@example.com",
        currentPassword: "password123",
      })
    ).toEqual({ email: "new@example.com", currentPassword: "password123" });

    expectIssues(updateEmailSchema, {
      email: "not-an-email",
      currentPassword: "password123",
    }).toMatchObject([{ path: ["email"], message: "Invalid email address" }]);

    expectIssues(deleteAccountSchema, {
      currentPassword: "short",
    }).toMatchObject([
      { path: ["currentPassword"], message: "Password must be at least 8 characters" },
    ]);
  });

  it("requires new passwords to be strong and confirmed", () => {
    expect(
      parseOrThrow(updatePasswordSchema, {
        currentPassword: "oldpassword",
        newPassword: "Newpassword1!",
        confirmNewPassword: "Newpassword1!",
      })
    ).toMatchObject({ newPassword: "Newpassword1!" });

    expectIssues(updatePasswordSchema, {
      currentPassword: "oldpassword",
      newPassword: "Newpassword1!",
      confirmNewPassword: "different",
    }).toMatchObject([
      { path: ["confirmNewPassword"], message: "Passwords do not match" },
    ]);
  });

  it("keeps recovery keys at exactly 24 non-empty words", () => {
    expect(parseOrThrow(recoveryKeySchema, { recoveryKey })).toEqual({ recoveryKey });

    expectIssues(recoveryKeySchema, {
      recoveryKey: recoveryKey.slice(0, 23),
    }).toMatchObject([
      { path: ["recoveryKey"], message: "Recovery key must be 24 words" },
    ]);

    expectIssues(recoveryKeySchema, {
      recoveryKey: [...recoveryKey.slice(0, 23), ""],
    }).toMatchObject([{ path: ["recoveryKey", 23] }]);
  });

  it("validates six-digit codes everywhere they are reused", () => {
    expect(parseOrThrow(confirmEmailSchema, { code: "123456" })).toEqual({
      code: "123456",
    });

    expectIssues(confirmEmailSchema, { code: "12345a" }).toMatchObject([
      { path: ["code"], message: "Code must be 6 digits" },
    ]);

    expect(parseOrThrow(requestPasswordResetSchema, { email: "reset@example.com" })).toEqual({
      email: "reset@example.com",
    });

    expect(
      parseOrThrow(recoverAccountSchema, {
        email: "reset@example.com",
        resetCode: "654321",
        recoveryKey,
      })
    ).toMatchObject({ resetCode: "654321" });
  });

  it("validates the recovery setup payload without inspecting encrypted key material", () => {
    expect(
      parseOrThrow(confirmRecoverySchema, {
        email: "person@example.com",
        password: "password123",
        recoveryKeyHash: "hash",
        recoveryKeyIdentifier: "identifier",
        wrappedMasterKeyRecovery: validWrappedKey,
      })
    ).toMatchObject({
      email: "person@example.com",
      wrappedMasterKeyRecovery: validWrappedKey,
    });

    expectIssues(confirmRecoverySchema, {
      email: "bad",
      password: "password123",
      recoveryKeyHash: "hash",
      recoveryKeyIdentifier: "identifier",
      wrappedMasterKeyRecovery: { encryptedData: "ciphertext" },
    }).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ path: ["email"], message: "Invalid email address" }),
        expect.objectContaining({ path: ["wrappedMasterKeyRecovery", "iv"] }),
      ])
    );
  });

  it("validates encrypted contact writes and rejects malformed timestamps", () => {
    expect(
      parseOrThrow(encryptedContactBodySchema, {
        id: "00000000-0000-4000-8000-000000000000",
        encryptedData: "ciphertext",
        iv: "iv",
        serverUpdatedAt: "2026-06-28T10:00:00.000Z",
      })
    ).toMatchObject({ id: "00000000-0000-4000-8000-000000000000" });

    expectIssues(encryptedContactBodySchema, {
      id: "not-a-uuid",
      encryptedData: "ciphertext",
      iv: "iv",
      serverUpdatedAt: "Sunday",
    }).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ path: ["id"], message: "Invalid contact id" }),
        expect.objectContaining({ path: ["serverUpdatedAt"] }),
      ])
    );
  });

  it("allows only complete create/update sync changes and lean deletes", () => {
    const validSync = parseOrThrow(contactSyncSchema, {
      changes: [
        {
          id: "00000000-0000-4000-8000-000000000000",
          type: "delete",
        },
        {
          id: "00000000-0000-4000-8000-000000000001",
          type: "update",
          encryptedData: "ciphertext",
          iv: "iv",
        },
      ],
    });

    expect(validSync.changes).toHaveLength(2);

    expectIssues(contactSyncSchema, {
      changes: [
        {
          id: "00000000-0000-4000-8000-000000000000",
          type: "update",
        },
      ],
    }).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ path: ["changes", 0, "encryptedData"] }),
        expect.objectContaining({ path: ["changes", 0, "iv"] }),
      ])
    );
  });

  it("preserves encrypted contacts during password reset and reports mismatch on confirmation", () => {
    expect(
      parseOrThrow(resetPasswordSchema, {
        newPassword: "Newpassword1!",
        confirmNewPassword: "Newpassword1!",
        contacts: [
          {
            id: "local-id",
            encryptedData: "ciphertext",
            iv: "iv",
            serverUpdatedAt: "2026-06-28T10:00:00.000Z",
          },
        ],
      })
    ).toMatchObject({ contacts: [{ id: "local-id" }] });

    expectIssues(resetPasswordSchema, {
      newPassword: "Newpassword1!",
      confirmNewPassword: "different",
      contacts: [],
    }).toMatchObject([
      { path: ["confirmNewPassword"], message: "Passwords do not match" },
    ]);
  });
});
