"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Menu, Settings, Sun, Moon, LogOut } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useTheme } from "next-themes";
import { useAuth } from "@/providers/AuthProvider";
import { useEncryption } from "@/providers/EncryptionProvider";

export function UserMenu() {
  const router = useRouter();
  const { logout } = useAuth();
  const { lock } = useEncryption();
  const { resolvedTheme, theme, setTheme } = useTheme();
  const [showSignOutConfirm, setShowSignOutConfirm] = useState(false);
  const currentTheme = resolvedTheme ?? theme;

  const handleSignOut = async () => {
    await logout();
    await lock();
    router.replace("/login");
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger className={buttonVariants({ variant: "ghost", size: "icon-lg" })}>
          <Menu className="h-5 w-5" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuItem onClick={() => router.push("/settings")}>
            <Settings className="mr-2 h-4 w-4" />
            Settings
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setTheme(currentTheme === "dark" ? "light" : "dark")}>
            {currentTheme === "dark" ? (
              <Sun className="mr-2 h-4 w-4" />
            ) : (
              <Moon className="mr-2 h-4 w-4" />
            )}
            {currentTheme === "dark" ? "Light mode" : "Dark mode"}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setShowSignOutConfirm(true)}>
            <LogOut className="mr-2 h-4 w-4" />
            Sign out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={showSignOutConfirm} onOpenChange={setShowSignOutConfirm}>
        <DialogContent className="sm:max-w-sm" showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>Sign out?</DialogTitle>
            <DialogDescription>
              You will need your password to unlock your address book again.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setShowSignOutConfirm(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                setShowSignOutConfirm(false);
                handleSignOut();
              }}
            >
              Sign out
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
