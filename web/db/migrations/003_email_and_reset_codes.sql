ALTER TABLE "User"
  ADD COLUMN "emailConfirmationCodeHash" TEXT,
  ADD COLUMN "emailConfirmationCodeExpiresAt" TIMESTAMPTZ,
  ADD COLUMN "passwordResetCodeHash" TEXT,
  ADD COLUMN "passwordResetCodeExpiresAt" TIMESTAMPTZ;
