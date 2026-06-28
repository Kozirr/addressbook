"use client";

import { useState } from "react";
import { Shield, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { RecoveryKeyDisplay } from "./RecoveryKeyDisplay";
import { RecoveryKeyVerifier } from "./RecoveryKeyVerifier";
import { useEncryption } from "@/providers/EncryptionProvider";
import {
  generateRecoveryKey,
  deriveRecoveryMasterKey,
  wrapMasterKeyForRecovery,
  hashRecoveryKey,
  getRecoveryKeyIdentifier,
  validateRecoveryKey,
} from "@/lib/recovery";
import { toast } from "sonner";

export function RecoveryKeyReset() {
  const { masterKey } = useEncryption();
  const [acknowledged, setAcknowledged] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [showDialog, setShowDialog] = useState(false);
  const [recoveryKey, setRecoveryKey] = useState<string[] | null>(null);
  const [verified, setVerified] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleGenerate = async () => {
    if (!masterKey) return;
    setIsGenerating(true);
    setError(null);
    try {
      const newRecoveryKey = generateRecoveryKey();
      if (!validateRecoveryKey(newRecoveryKey)) {
        throw new Error("Generated recovery key is invalid");
      }
      setRecoveryKey(newRecoveryKey);
      setShowDialog(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate recovery key");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleVerified = async () => {
    if (!masterKey || !recoveryKey) return;
    setIsSubmitting(true);
    setError(null);
    try {
      // In settings we don't know the user's recovery salt, so we fetch it from the server.
      const meRes = await fetch("/api/auth/me", { credentials: "same-origin" });
      if (!meRes.ok) throw new Error("Failed to fetch user state");
      const meData = await meRes.json();
      const recoverySalt = meData.user.recoverySalt;
      if (!recoverySalt) throw new Error("Recovery salt not found");

      const recoveryMasterKey = await deriveRecoveryMasterKey(recoveryKey, recoverySalt);
      const wrappedMasterKeyRecovery = await wrapMasterKeyForRecovery(masterKey, recoveryMasterKey);
      const recoveryKeyHash = await hashRecoveryKey(recoveryKey);
      const recoveryKeyIdentifier = await getRecoveryKeyIdentifier(recoveryKey);

      const res = await fetch("/api/auth/recovery", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recoveryKeyHash,
          recoveryKeyIdentifier,
          wrappedMasterKeyRecovery,
        }),
        credentials: "same-origin",
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to reset recovery key");
      }

      toast.success("Recovery key reset successfully");
      setShowDialog(false);
      setRecoveryKey(null);
      setVerified(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to reset recovery key");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-2">
        <Checkbox
          id="recovery-ack"
          checked={acknowledged}
          onCheckedChange={(checked) => setAcknowledged(checked === true)}
        />
        <Label htmlFor="recovery-ack" className="text-sm font-normal leading-relaxed">
          I understand that if I lose this recovery key, I will not be able to reset my password.
          My contacts cannot be recovered without it.
        </Label>
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <Button
        onClick={handleGenerate}
        disabled={!acknowledged || isGenerating}
        variant="outline"
      >
        {isGenerating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Shield className="mr-2 h-4 w-4" />}
        Reset recovery key
      </Button>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="sm:max-w-2xl" showCloseButton={false}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Your new recovery key
            </DialogTitle>
            <DialogDescription>
              Save this 24-word recovery key in a secure place. It will not be shown again.
            </DialogDescription>
          </DialogHeader>
          {recoveryKey && (
            <div className="space-y-6">
              {!verified ? (
                <>
                  <RecoveryKeyDisplay recoveryKey={recoveryKey} />
                  <RecoveryKeyVerifier
                    recoveryKey={recoveryKey}
                    onVerified={() => setVerified(true)}
                  />
                </>
              ) : (
                <div className="space-y-4 text-center">
                  <p className="text-sm text-muted-foreground">
                    Saving your new recovery key...
                  </p>
                  <Button onClick={handleVerified} disabled={isSubmitting} className="w-full">
                    {isSubmitting ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : null}
                    Complete reset
                  </Button>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
