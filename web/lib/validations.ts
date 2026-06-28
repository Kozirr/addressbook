import { z } from "zod";

const PASSWORD_TOO_SHORT = "Password must be at least 8 characters";
const INVALID_EMAIL = "Invalid email address";
const PASSWORDS_DO_NOT_MATCH = "Passwords do not match";

const requiredName = (field: "First name" | "Last name") =>
  z.string().min(1, `${field} is required`);

const passwordField = z.string().min(8, PASSWORD_TOO_SHORT);
const emailField = z.string().email(INVALID_EMAIL);

export const strongPasswordSchema = z
  .string()
  .min(8, PASSWORD_TOO_SHORT)
  .regex(/[a-z]/, "Password must include a lowercase letter")
  .regex(/[A-Z]/, "Password must include an uppercase letter")
  .regex(/[0-9]/, "Password must include a digit")
  .regex(/[^A-Za-z0-9]/, "Password must include a symbol");

export const loginSchema = z.object({
  email: emailField,
  password: passwordField,
});

export const registerSchema = z
  .object({
    email: emailField,
    password: strongPasswordSchema,
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: PASSWORDS_DO_NOT_MATCH,
    path: ["confirmPassword"],
  });

export const contactFormSchema = z.object({
  firstName: requiredName("First name"),
  lastName: requiredName("Last name"),
  email: z.string().email("Invalid email").optional().or(z.literal("")),
  phone: z.string().optional(),
  address: z.string().optional(),
  company: z.string().optional(),
  jobTitle: z.string().optional(),
  notes: z.string().optional(),
  isFavorite: z.boolean(),
  tags: z.array(z.string()),
});

export const updateEmailSchema = z.object({
  email: emailField,
  currentPassword: passwordField,
});

export const updatePasswordSchema = z
  .object({
    currentPassword: passwordField,
    newPassword: strongPasswordSchema,
    confirmNewPassword: z.string(),
  })
  .refine((data) => data.newPassword === data.confirmNewPassword, {
    message: PASSWORDS_DO_NOT_MATCH,
    path: ["confirmNewPassword"],
  });

export const deleteAccountSchema = z.object({
  currentPassword: passwordField,
});

export const recoveryKeySchema = z.object({
  recoveryKey: z.array(z.string().min(1)).length(24, "Recovery key must be 24 words"),
});

export const authCodeSchema = z
  .string()
  .regex(/^\d{6}$/, "Code must be 6 digits");

export const confirmEmailSchema = z.object({
  code: authCodeSchema,
});

const encryptedPayloadSchema = z.object({
  encryptedData: z.string(),
  iv: z.string(),
});

export const encryptedContactBodySchema = encryptedPayloadSchema.extend({
  id: z.string().uuid("Invalid contact id"),
  serverUpdatedAt: z.string().datetime().optional(),
});

export const encryptedContactUpdateSchema = encryptedPayloadSchema.extend({
  serverUpdatedAt: z.string().datetime().optional(),
});

export const contactSyncSchema = z.object({
  changes: z.array(
    z.discriminatedUnion("type", [
      z.object({
        id: z.string().uuid("Invalid contact id"),
        type: z.literal("delete"),
      }),
      z.object({
        id: z.string().uuid("Invalid contact id"),
        type: z.enum(["create", "update"]),
        encryptedData: z.string(),
        iv: z.string(),
        serverUpdatedAt: z.string().datetime().optional(),
      }),
    ])
  ),
});

export const confirmRecoverySchema = z.object({
  email: emailField,
  password: passwordField,
  recoveryKeyHash: z.string(),
  recoveryKeyIdentifier: z.string(),
  wrappedMasterKeyRecovery: encryptedPayloadSchema,
});

export const completeRecoverySchema = z.object({
  recoveryKeyHash: z.string(),
  recoveryKeyIdentifier: z.string(),
  wrappedMasterKeyRecovery: encryptedPayloadSchema,
});

export const requestPasswordResetSchema = z.object({
  email: emailField,
});

export const recoverAccountSchema = recoveryKeySchema.extend({
  email: emailField,
  resetCode: authCodeSchema,
});

const resetContactPayload = z.object({
  id: z.string(),
  encryptedData: z.string(),
  iv: z.string(),
  serverUpdatedAt: z.string(),
});

export const resetPasswordSchema = z
  .object({
    newPassword: strongPasswordSchema,
    confirmNewPassword: z.string(),
    contacts: z.array(resetContactPayload),
  })
  .refine((data) => data.newPassword === data.confirmNewPassword, {
    message: PASSWORDS_DO_NOT_MATCH,
    path: ["confirmNewPassword"],
  });

export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
export type ContactFormInput = z.infer<typeof contactFormSchema>;
export type UpdateEmailInput = z.infer<typeof updateEmailSchema>;
export type UpdatePasswordInput = z.infer<typeof updatePasswordSchema>;
export type DeleteAccountInput = z.infer<typeof deleteAccountSchema>;
export type RecoveryKeyInput = z.infer<typeof recoveryKeySchema>;
export type ConfirmEmailInput = z.infer<typeof confirmEmailSchema>;
export type ConfirmRecoveryInput = z.infer<typeof confirmRecoverySchema>;
export type CompleteRecoveryInput = z.infer<typeof completeRecoverySchema>;
export type RequestPasswordResetInput = z.infer<typeof requestPasswordResetSchema>;
export type RecoverAccountInput = z.infer<typeof recoverAccountSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
export type EncryptedContactInput = z.infer<typeof encryptedContactBodySchema>;
export type EncryptedContactUpdateInput = z.infer<typeof encryptedContactUpdateSchema>;
export type ContactSyncInput = z.infer<typeof contactSyncSchema>;
