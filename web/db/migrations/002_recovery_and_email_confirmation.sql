CREATE TYPE user_status AS ENUM ('pending_email', 'pending_recovery', 'active');

ALTER TABLE "User"
  ADD COLUMN status user_status NOT NULL DEFAULT 'active',
  ADD COLUMN "emailConfirmedAt" TIMESTAMPTZ,
  ADD COLUMN "confirmationToken" TEXT UNIQUE,
  ADD COLUMN "confirmationTokenExpiresAt" TIMESTAMPTZ,
  ADD COLUMN "recoverySalt" TEXT,
  ADD COLUMN "recoveryKeyHash" TEXT,
  ADD COLUMN "recoveryKeyIdentifier" TEXT UNIQUE,
  ADD COLUMN "wrappedMasterKeyRecovery" TEXT,
  ADD COLUMN "recoveryConfirmedAt" TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS "User_status_createdAt_idx"
  ON "User"(status, "createdAt");
