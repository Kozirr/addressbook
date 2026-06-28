"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import { useRouter } from "next/navigation";
import { MailCheck, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useAuth } from "@/providers/AuthProvider";

export default function ConfirmEmailPage() {
  const router = useRouter();
  const { user, refreshUser } = useAuth();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isResending, setIsResending] = useState(false);

  const handleConfirm = async (event: FormEvent) => {
    event.preventDefault();
    setIsSubmitting(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch("/api/auth/confirm-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
        credentials: "same-origin",
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to confirm email");
      }
      await refreshUser();
      router.replace(data.redirectTo ?? "/recovery-setup");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to confirm email");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResend = async () => {
    setIsResending(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch("/api/auth/confirm-email/resend", {
        method: "POST",
        credentials: "same-origin",
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to resend code");
      }
      setMessage("A new code has been sent.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to resend code");
    } finally {
      setIsResending(false);
    }
  };

  return (
    <div className="w-full max-w-sm">
      <Card className="w-full">
        <CardHeader className="space-y-1">
          <div className="flex items-center gap-2">
            <MailCheck className="h-5 w-5 text-muted-foreground" />
            <CardTitle className="text-2xl font-semibold tracking-tight">
              Confirm email
            </CardTitle>
          </div>
          <CardDescription>
            Enter the 6-digit code sent to {user?.email ?? "your email address"}.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleConfirm} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="confirmation-code">Code</Label>
              <Input
                id="confirmation-code"
                inputMode="numeric"
                maxLength={6}
                value={code}
                onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
                placeholder="123456"
                autoFocus
              />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            {message && <p className="text-sm text-muted-foreground">{message}</p>}
            <Button
              type="submit"
              className="w-full"
              disabled={isSubmitting || code.length !== 6}
            >
              {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Confirm email
            </Button>
            <Button
              type="button"
              variant="outline"
              className="w-full"
              disabled={isResending}
              onClick={handleResend}
            >
              {isResending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Resend code
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
