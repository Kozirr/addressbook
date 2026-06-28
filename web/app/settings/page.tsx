"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, Mail, Lock, Download, Trash2, Loader2, Shield } from "lucide-react";
import { AuthGuard } from "@/components/auth/AuthGuard";
import { RecoveryKeyReset } from "@/components/auth/RecoveryKeyReset";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { useAuth } from "@/providers/AuthProvider";
import { useEncryption } from "@/providers/EncryptionProvider";
import { useContacts } from "@/providers/ContactProvider";
import { exportContactsCSV, exportContactsVCard } from "@/lib/export";
import { deriveMasterKey, encryptData } from "@/lib/crypto";
import { putContacts, clearLocalData, clearPendingChanges } from "@/lib/db";
import {
  updateEmailSchema,
  updatePasswordSchema,
  deleteAccountSchema,
  UpdateEmailInput,
  UpdatePasswordInput,
  DeleteAccountInput,
} from "@/lib/validations";
import { toast } from "sonner";

function SettingsPage() {
  const router = useRouter();
  const { user, refreshUser, logout } = useAuth();
  const { rotateMasterKey } = useEncryption();
  const { contacts, sync } = useContacts();
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  const {
    register: registerEmail,
    handleSubmit: handleSubmitEmail,
    formState: { errors: emailErrors, isSubmitting: isEmailSubmitting },
    reset: resetEmailForm,
  } = useForm<UpdateEmailInput>({
    resolver: zodResolver(updateEmailSchema),
    defaultValues: { email: user?.email || "" },
  });

  const {
    register: registerPassword,
    handleSubmit: handleSubmitPassword,
    formState: { errors: passwordErrors, isSubmitting: isPasswordSubmitting },
    reset: resetPasswordForm,
  } = useForm<UpdatePasswordInput>({
    resolver: zodResolver(updatePasswordSchema),
  });

  const {
    register: registerDelete,
    handleSubmit: handleSubmitDelete,
    formState: { errors: deleteErrors },
    reset: resetDeleteForm,
  } = useForm<DeleteAccountInput>({
    resolver: zodResolver(deleteAccountSchema),
  });

  const onUpdateEmail = async (data: UpdateEmailInput) => {
    const res = await fetch("/api/auth/email", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
      credentials: "same-origin",
    });

    const result = await res.json();
    if (!res.ok) {
      throw new Error(result.error || "Failed to update email");
    }

    await refreshUser();
    resetEmailForm({ email: result.user.email, currentPassword: "" });
  };

  const onUpdatePassword = useCallback(
    async (data: UpdatePasswordInput) => {
      if (!user) return;

      // Derive the new master key before touching the server.
      const newMasterKey = await deriveMasterKey(data.newPassword, user.encryptionSalt);

      // Re-encrypt all contacts with the new key.
      const serverUpdatedAt = new Date().toISOString();
      const reencrypted = await Promise.all(
        contacts.map(async (contact) => ({
          contact,
          encrypted: await encryptData(newMasterKey, contact),
        }))
      );

      const res = await fetch("/api/auth/password", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentPassword: data.currentPassword,
          newPassword: data.newPassword,
          confirmNewPassword: data.confirmNewPassword,
          contacts: reencrypted.map(({ contact, encrypted }) => ({
            id: contact.id,
            encryptedData: encrypted.encryptedData,
            iv: encrypted.iv,
            serverUpdatedAt,
          })),
        }),
        credentials: "same-origin",
      });

      const result = await res.json();
      if (!res.ok) {
        throw new Error(result.error || "Failed to update password");
      }

      // Rotate the local master key and persist re-encrypted contacts.
      await rotateMasterKey(newMasterKey);
      const updatedContacts = reencrypted.map((r) => r.contact);
      await putContacts(updatedContacts);
      await clearPendingChanges();
      sync();
      resetPasswordForm();
    },
    [user, contacts, rotateMasterKey, sync, resetPasswordForm]
  );

  const onDeleteAccount = async (data: DeleteAccountInput) => {
    setIsDeleting(true);
    try {
      const res = await fetch("/api/auth/account", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "same-origin",
      });

      const result = await res.json();
      if (!res.ok) {
        throw new Error(result.error || "Failed to delete account");
      }

      await clearLocalData();
      await logout();
      router.replace("/login");
    } finally {
      setIsDeleting(false);
    }
  };

  const handleExportCSV = () => {
    exportContactsCSV(contacts);
    toast.success("Contacts exported as CSV");
  };

  const handleExportVCard = () => {
    exportContactsVCard(contacts);
    toast.success("Contacts exported as vCard");
  };

  const handleAction = async (action: () => Promise<void>) => {
    try {
      await action();
      toast.success("Settings updated");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    }
  };

  return (
    <div className="min-h-full bg-background">
      <div className="border-b bg-card px-6 py-4">
        <div className="mx-auto flex max-w-2xl items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.push("/")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-xl font-semibold">Settings</h1>
        </div>
      </div>

      <main className="mx-auto max-w-2xl space-y-6 p-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5 text-muted-foreground" />
              Account
            </CardTitle>
            <CardDescription>Update your email address</CardDescription>
          </CardHeader>
          <CardContent>
            <form
              onSubmit={handleSubmitEmail((data) => handleAction(() => onUpdateEmail(data)))}
              className="space-y-4"
            >
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" {...registerEmail("email")} />
                {emailErrors.email && (
                  <p className="text-sm text-destructive">{emailErrors.email.message}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="email-current-password">Current password</Label>
                <Input
                  id="email-current-password"
                  type="password"
                  {...registerEmail("currentPassword")}
                />
                {emailErrors.currentPassword && (
                  <p className="text-sm text-destructive">
                    {emailErrors.currentPassword.message}
                  </p>
                )}
              </div>
              <Button type="submit" disabled={isEmailSubmitting}>
                {isEmailSubmitting ? "Updating..." : "Update email"}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lock className="h-5 w-5 text-muted-foreground" />
              Security
            </CardTitle>
            <CardDescription>Change your password</CardDescription>
          </CardHeader>
          <CardContent>
            <form
              onSubmit={handleSubmitPassword((data) => handleAction(() => onUpdatePassword(data)))}
              className="space-y-4"
            >
              <div className="space-y-2">
                <Label htmlFor="current-password">Current password</Label>
                <Input
                  id="current-password"
                  type="password"
                  {...registerPassword("currentPassword")}
                />
                {passwordErrors.currentPassword && (
                  <p className="text-sm text-destructive">
                    {passwordErrors.currentPassword.message}
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="new-password">New password</Label>
                <Input
                  id="new-password"
                  type="password"
                  {...registerPassword("newPassword")}
                />
                {passwordErrors.newPassword && (
                  <p className="text-sm text-destructive">{passwordErrors.newPassword.message}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm-new-password">Confirm new password</Label>
                <Input
                  id="confirm-new-password"
                  type="password"
                  {...registerPassword("confirmNewPassword")}
                />
                {passwordErrors.confirmNewPassword && (
                  <p className="text-sm text-destructive">
                    {passwordErrors.confirmNewPassword.message}
                  </p>
                )}
              </div>
              <Button type="submit" disabled={isPasswordSubmitting}>
                {isPasswordSubmitting ? "Updating..." : "Update password"}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-muted-foreground" />
              Recovery key
            </CardTitle>
            <CardDescription>Generate a new recovery key</CardDescription>
          </CardHeader>
          <CardContent>
            <RecoveryKeyReset />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Download className="h-5 w-5 text-muted-foreground" />
              Data
            </CardTitle>
            <CardDescription>Export all your contacts</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-3">
              <Button variant="outline" onClick={handleExportCSV}>
                Export as CSV
              </Button>
              <Button variant="outline" onClick={handleExportVCard}>
                Export as vCard
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="border-destructive/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <Trash2 className="h-5 w-5" />
              Danger zone
            </CardTitle>
            <CardDescription>Permanently delete your account and all data</CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="destructive" onClick={() => setShowDeleteDialog(true)}>
              Delete account
            </Button>
          </CardContent>
        </Card>
      </main>

      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent className="sm:max-w-sm" showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>Delete account?</DialogTitle>
            <DialogDescription>
              This will permanently delete your account and all your contacts. This action cannot
              be undone.
            </DialogDescription>
          </DialogHeader>
          <form
            onSubmit={handleSubmitDelete((data) => handleAction(() => onDeleteAccount(data)))}
            className="space-y-4"
          >
            <div className="space-y-2">
              <Label htmlFor="delete-password">Current password</Label>
              <Input
                id="delete-password"
                type="password"
                {...registerDelete("currentPassword")}
              />
              {deleteErrors.currentPassword && (
                <p className="text-sm text-destructive">
                  {deleteErrors.currentPassword.message}
                </p>
              )}
            </div>
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setShowDeleteDialog(false);
                  resetDeleteForm();
                }}
                disabled={isDeleting}
              >
                Cancel
              </Button>
              <Button type="submit" variant="destructive" disabled={isDeleting}>
                {isDeleting ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : null}
                Delete
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function Settings() {
  return (
    <AuthGuard>
      <SettingsPage />
    </AuthGuard>
  );
}
