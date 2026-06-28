"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { RecoveryKeyDisplay } from "./RecoveryKeyDisplay";
import { RecoveryKeyVerifier } from "./RecoveryKeyVerifier";
import { useAuth } from "@/providers/AuthProvider";
import { useEncryption } from "@/providers/EncryptionProvider";
import {
  generateRecoveryKey,
  deriveRecoveryMasterKey,
  wrapMasterKeyForRecovery,
  hashRecoveryKey,
  getRecoveryKeyIdentifier,
  validateRecoveryKey,
} from "@/lib/recovery";
import { deriveMasterKey } from "@/lib/crypto";
import { toast } from "sonner";

interface SetupState {
  id: string;
  email: string;
  encryptionSalt: string;
  recoverySalt: string;
}

export function RecoverySetup() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, refreshUser } = useAuth();
  const { unlock } = useEncryption();
  const [setupState, setSetupState] = useState<SetupState | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [password, setPassword] = useState("");
  const [isSettingUp, setIsSettingUp] = useState(false);
  const [recoveryKey, setRecoveryKey] = useState<string[] | null>(null);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [showVerifyDialog, setShowVerifyDialog] = useState(false);
  const [canVerifyRecoveryKey, setCanVerifyRecoveryKey] = useState(false);
  const [verified, setVerified] = useState(false);
  const [pendingRecovery, setPendingRecovery] = useState<{
    password: string;
    recoveryKeyHash: string;
    recoveryKeyIdentifier: string;
    wrappedMasterKeyRecovery: { encryptedData: string; iv: string };
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const isAuthenticated = !!user && user.status === "pending_recovery";
  const isActive = !!user && user.status === "active";
  const emailFromQuery = searchParams.get("email");

  useEffect(() => {
    if (isActive) {
      router.replace("/");
      return;
    }
    if (isAuthenticated) {
      setSetupState({
        id: user.id,
        email: user.email,
        encryptionSalt: user.encryptionSalt,
        recoverySalt: "", // Will be fetched below
      });
      fetchRecoverySalt(user.email);
    } else if (emailFromQuery) {
      fetchSetupState(emailFromQuery);
    } else {
      setIsLoading(false);
      setError("Invalid recovery setup link.");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isActive, isAuthenticated, emailFromQuery]);

  const fetchSetupState = async (email: string) => {
    try {
      const res = await fetch(`/api/auth/setup-state?email=${encodeURIComponent(email)}`);
      if (!res.ok) throw new Error("Failed to load setup state");
      const data = await res.json();
      setSetupState(data.user);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load setup state");
    } finally {
      setIsLoading(false);
    }
  };

  const fetchRecoverySalt = async (email: string) => {
    try {
      const res = await fetch(`/api/auth/setup-state?email=${encodeURIComponent(email)}`);
      if (!res.ok) throw new Error("Failed to load recovery salt");
      const data = await res.json();
      setSetupState((prev) => (prev ? { ...prev, recoverySalt: data.user.recoverySalt } : null));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load recovery salt");
    } finally {
      setIsLoading(false);
    }
  };

  const handleStartSetup = async () => {
    if (!setupState) return;
    setIsSettingUp(true);
    setError(null);
    try {
      const trimmedPassword = password.trim();
      if (trimmedPassword.length < 8) {
        throw new Error("Password must be at least 8 characters");
      }

      // Verify password by deriving master key.
      await deriveMasterKey(trimmedPassword, setupState.encryptionSalt);

      // Generate recovery key.
      const newRecoveryKey = generateRecoveryKey();
      if (!validateRecoveryKey(newRecoveryKey)) {
        throw new Error("Generated recovery key is invalid");
      }

      // Derive keys.
      const masterKey = await deriveMasterKey(trimmedPassword, setupState.encryptionSalt);
      const recoveryMasterKey = await deriveRecoveryMasterKey(
        newRecoveryKey,
        setupState.recoverySalt
      );
      const wrappedMasterKeyRecovery = await wrapMasterKeyForRecovery(
        masterKey,
        recoveryMasterKey
      );

      const recoveryKeyHash = await hashRecoveryKey(newRecoveryKey);
      const recoveryKeyIdentifier = await getRecoveryKeyIdentifier(newRecoveryKey);

      setRecoveryKey(newRecoveryKey);
      setShowSaveDialog(true);
      setShowVerifyDialog(false);
      setCanVerifyRecoveryKey(false);
      setVerified(false);
      setPendingRecovery({
        password: trimmedPassword,
        recoveryKeyHash,
        recoveryKeyIdentifier,
        wrappedMasterKeyRecovery,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate recovery key");
    } finally {
      setIsSettingUp(false);
    }
  };

  const handleVerified = async () => {
    if (!pendingRecovery || !setupState) return;

    try {
      if (isAuthenticated) {
        const res = await fetch("/api/auth/complete-recovery", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            recoveryKeyHash: pendingRecovery.recoveryKeyHash,
            recoveryKeyIdentifier: pendingRecovery.recoveryKeyIdentifier,
            wrappedMasterKeyRecovery: pendingRecovery.wrappedMasterKeyRecovery,
          }),
          credentials: "same-origin",
        });
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || "Failed to complete setup");
        }
        // Unlock encryption and redirect.
        await refreshUser();
        await unlock(pendingRecovery.password, setupState.encryptionSalt);
        toast.success("Recovery key saved");
        router.replace("/");
      } else {
        const res = await fetch("/api/auth/confirm-recovery", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: setupState.email,
            password: pendingRecovery.password,
            recoveryKeyHash: pendingRecovery.recoveryKeyHash,
            recoveryKeyIdentifier: pendingRecovery.recoveryKeyIdentifier,
            wrappedMasterKeyRecovery: pendingRecovery.wrappedMasterKeyRecovery,
          }),
          credentials: "same-origin",
        });
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || "Failed to complete setup");
        }
        const data = await res.json();
        await refreshUser();
        await unlock(pendingRecovery.password, data.user.encryptionSalt);
        toast.success("Account created");
        router.replace("/");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save recovery key");
    }
  };

  const handleRecoveryKeySaved = () => {
    setShowSaveDialog(false);
    setCanVerifyRecoveryKey(true);
    setShowVerifyDialog(true);
  };

  if (isLoading) {
    return (
      <div className="min-h-dvh flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-dvh flex items-center justify-center p-6">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-destructive">Setup error</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">{error}</p>
            <Button className="mt-4 w-full" onClick={() => router.push("/login")}>
              Go to login
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-dvh flex items-center justify-center p-6">
      <Card className="w-full max-w-2xl">
        <CardHeader className="space-y-1">
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-muted-foreground" />
            <CardTitle className="text-2xl font-semibold tracking-tight">
              Save your recovery key
            </CardTitle>
          </div>
          <CardDescription>
            This 24-word recovery key is the only way to reset your password if you forget it.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {!recoveryKey ? (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="setup-password">
                  {isAuthenticated ? "Enter your password" : "Enter the password you chose"}
                </Label>
                <Input
                  id="setup-password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Password"
                />
              </div>
              {error && <p className="text-sm text-destructive">{error}</p>}
              <Button
                onClick={handleStartSetup}
                disabled={isSettingUp || password.trim().length < 8}
                className="w-full"
              >
                {isSettingUp ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : null}
                Generate recovery key
              </Button>
            </div>
          ) : !canVerifyRecoveryKey ? (
            <p className="text-sm text-muted-foreground">
              Save your recovery key, then confirm it in the dialog to continue.
            </p>
          ) : !verified ? (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Confirm you saved your recovery key to finish account setup.
              </p>
              <Button type="button" className="w-full" onClick={() => setShowVerifyDialog(true)}>
                Confirm recovery key
              </Button>
            </div>
          ) : (
            <div className="space-y-4 text-center">
              <p className="text-sm text-muted-foreground">
                Verifying your recovery key and finishing account setup...
              </p>
              <Button onClick={handleVerified} className="w-full">
                Complete setup
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
      <Dialog
        open={showSaveDialog}
        onOpenChange={(open) => {
          if (open) {
            setShowSaveDialog(true);
          }
        }}
      >
        <DialogContent className="sm:max-w-2xl" showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>Your recovery key</DialogTitle>
            <DialogDescription>
              Save this 24-word recovery key in a secure place. It will not be shown again.
            </DialogDescription>
          </DialogHeader>
          {recoveryKey && <RecoveryKeyDisplay recoveryKey={recoveryKey} />}
          <Button type="button" className="w-full" onClick={handleRecoveryKeySaved}>
            I saved my recovery key
          </Button>
        </DialogContent>
      </Dialog>
      <Dialog open={showVerifyDialog} onOpenChange={setShowVerifyDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm recovery key</DialogTitle>
            <DialogDescription>
              Enter the requested word to confirm you saved your recovery key.
            </DialogDescription>
          </DialogHeader>
          {recoveryKey && (
            <RecoveryKeyVerifier
              recoveryKey={recoveryKey}
              onVerified={() => {
                setVerified(true);
                setShowVerifyDialog(false);
              }}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
