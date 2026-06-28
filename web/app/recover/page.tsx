"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { KeyRound, Loader2, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  deriveRecoveryMasterKey,
  unwrapMasterKeyForRecovery,
  validateRecoveryKey,
} from "@/lib/recovery";
import { deriveMasterKey, encryptData } from "@/lib/crypto";
import { Contact } from "@/types/contact";
import { decryptData } from "@/lib/crypto";
import { strongPasswordSchema } from "@/lib/validations";
import { useAuth } from "@/providers/AuthProvider";
import { useEncryption } from "@/providers/EncryptionProvider";
import { toast } from "sonner";

interface ServerContact {
  id: string;
  encryptedData: string;
  iv: string;
  serverUpdatedAt: string;
}

export default function RecoverPage() {
  const router = useRouter();
  const { refreshUser } = useAuth();
  const { rotateMasterKey } = useEncryption();
  const [email, setEmail] = useState("");
  const [resetCode, setResetCode] = useState("");
  const [recoveryKeyInput, setRecoveryKeyInput] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [step, setStep] = useState<"email" | "key" | "password">("email");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [recoveryState, setRecoveryState] = useState<{
    encryptionSalt: string;
    recoverySalt: string;
    wrappedMasterKeyRecovery: { encryptedData: string; iv: string };
    contacts: ServerContact[];
  } | null>(null);

  const parseRecoveryKey = (): string[] => {
    return recoveryKeyInput
      .trim()
      .toLowerCase()
      .split(/\s+/)
      .filter(Boolean);
  };

  const handleRequestReset = async () => {
    setIsLoading(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch("/api/auth/recover/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
        credentials: "same-origin",
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to send reset code");
      }
      setMessage("If this account exists, a reset code has been sent.");
      setStep("key");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send reset code");
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyRecovery = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const recoveryKey = parseRecoveryKey();
      if (!validateRecoveryKey(recoveryKey)) {
        throw new Error("Please enter a valid 24-word recovery key");
      }

      const res = await fetch("/api/auth/recover", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, resetCode, recoveryKey }),
        credentials: "same-origin",
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to verify reset code and recovery key");
      }

      setRecoveryState({
        encryptionSalt: data.user.encryptionSalt,
        recoverySalt: data.user.recoverySalt,
        wrappedMasterKeyRecovery: data.wrappedMasterKeyRecovery,
        contacts: data.contacts,
      });
      setStep("password");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to verify reset code and recovery key");
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetPassword = async () => {
    if (!recoveryState) return;
    const passwordResult = strongPasswordSchema.safeParse(newPassword);
    if (!passwordResult.success) {
      setError(passwordResult.error.issues[0].message);
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const recoveryKey = parseRecoveryKey();
      const recoveryMasterKey = await deriveRecoveryMasterKey(
        recoveryKey,
        recoveryState.recoverySalt
      );
      const masterKey = await unwrapMasterKeyForRecovery(
        recoveryState.wrappedMasterKeyRecovery,
        recoveryMasterKey
      );

      const newMasterKey = await deriveMasterKey(newPassword, recoveryState.encryptionSalt);
      const serverUpdatedAt = new Date().toISOString();

      const reencryptedContacts = await Promise.all(
        recoveryState.contacts.map(async (record) => {
          const contact = await decryptData<Contact>(masterKey, {
            encryptedData: record.encryptedData,
            iv: record.iv,
          });
          const encrypted = await encryptData(newMasterKey, contact);
          return {
            id: record.id,
            encryptedData: encrypted.encryptedData,
            iv: encrypted.iv,
            serverUpdatedAt,
          };
        })
      );

      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          newPassword,
          confirmNewPassword: confirmPassword,
          contacts: reencryptedContacts,
        }),
        credentials: "same-origin",
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to reset password");
      }

      await refreshUser();
      await rotateMasterKey(newMasterKey);
      toast.success("Password reset successfully");
      router.replace("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to reset password");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-dvh flex items-center justify-center p-6">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <div className="flex items-center gap-2">
            {step === "email" ? (
              <Mail className="h-5 w-5 text-muted-foreground" />
            ) : (
              <KeyRound className="h-5 w-5 text-muted-foreground" />
            )}
            <CardTitle className="text-2xl font-semibold tracking-tight">
              Reset password
            </CardTitle>
          </div>
          <CardDescription>
            {step === "email"
              ? "Enter your email address to receive a reset code."
              : step === "key"
                ? "Enter the reset code and your 24-word recovery key."
                : "Choose a new password for your account."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {step === "email" ? (
            <>
              <div className="space-y-2">
                <Label htmlFor="reset-email">Email</Label>
                <Input
                  id="reset-email"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="you@example.com"
                  autoFocus
                />
              </div>
              {error && <p className="text-sm text-destructive">{error}</p>}
              {message && <p className="text-sm text-muted-foreground">{message}</p>}
              <Button
                onClick={handleRequestReset}
                disabled={isLoading || !email.includes("@")}
                className="w-full"
              >
                {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Send reset code
              </Button>
            </>
          ) : step === "key" ? (
            <>
              <div className="space-y-2">
                <Label htmlFor="reset-code">Reset code</Label>
                <Input
                  id="reset-code"
                  inputMode="numeric"
                  maxLength={6}
                  value={resetCode}
                  onChange={(event) => setResetCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
                  placeholder="123456"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="recovery-key">Recovery key</Label>
                <Textarea
                  id="recovery-key"
                  value={recoveryKeyInput}
                  onChange={(event) => setRecoveryKeyInput(event.target.value)}
                  placeholder="word1 word2 word3 ..."
                  rows={5}
                />
              </div>
              {error && <p className="text-sm text-destructive">{error}</p>}
              {message && <p className="text-sm text-muted-foreground">{message}</p>}
              <Button
                onClick={handleVerifyRecovery}
                disabled={isLoading || resetCode.length !== 6 || parseRecoveryKey().length < 24}
                className="w-full"
              >
                {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Verify reset code
              </Button>
            </>
          ) : (
            <>
              <div className="space-y-2">
                <Label htmlFor="new-password">New password</Label>
                <Input
                  id="new-password"
                  type="password"
                  value={newPassword}
                  onChange={(event) => setNewPassword(event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm-password">Confirm new password</Label>
                <Input
                  id="confirm-password"
                  type="password"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                />
              </div>
              {error && <p className="text-sm text-destructive">{error}</p>}
              <Button
                onClick={handleResetPassword}
                disabled={isLoading}
                className="w-full"
              >
                {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Reset password
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
