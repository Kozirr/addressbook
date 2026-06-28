"use client";

import { ReactNode, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/providers/AuthProvider";
import { useEncryption } from "@/providers/EncryptionProvider";
import { Button } from "@/components/ui/button";
import { Loader2, Lock } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

export function AuthGuard({
  children,
  requireActive = true,
}: {
  children: ReactNode;
  requireActive?: boolean;
}) {
  const router = useRouter();
  const { user, isLoading: isAuthLoading } = useAuth();
  const { isReady, unlock } = useEncryption();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isUnlocking, setIsUnlocking] = useState(false);

  useEffect(() => {
    if (isAuthLoading) return;
    if (!user) {
      router.replace("/login");
      return;
    }
    if (user.status === "pending_email") {
      router.replace("/confirm-email");
      return;
    }
    if (user.status === "pending_recovery" && requireActive) {
      router.replace("/recovery-setup");
      return;
    }
    if (user.status === "active" && !requireActive) {
      router.replace("/");
    }
  }, [isAuthLoading, user, requireActive, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setIsUnlocking(true);
    setError(null);
    try {
      await unlock(password, user.encryptionSalt);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to unlock");
    } finally {
      setIsUnlocking(false);
    }
  };

  if (isAuthLoading) {
    return (
      <div className="min-h-dvh flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-dvh flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (user.status === "pending_recovery") {
    return <>{children}</>;
  }

  if (!isReady) {
    return (
      <div className="min-h-dvh flex items-center justify-center p-6">
        <Card className="w-full max-w-sm">
          <CardHeader className="space-y-1">
            <div className="flex items-center gap-2">
              <Lock className="h-5 w-5 text-muted-foreground" />
              <CardTitle className="text-2xl font-semibold tracking-tight">
                Unlock
              </CardTitle>
            </div>
            <CardDescription>
              Enter your password to decrypt your address book
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoFocus
                />
              </div>
              {error && <p className="text-sm text-destructive">{error}</p>}
              <Button type="submit" className="w-full" disabled={isUnlocking}>
                {isUnlocking ? "Unlocking..." : "Unlock"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-dvh flex flex-col">
      <main className="flex-1 overflow-hidden">{children}</main>
    </div>
  );
}
