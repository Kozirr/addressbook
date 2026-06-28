"use client";

import { ReactNode } from "react";
import { ThemeProvider } from "next-themes";
import { AuthProvider } from "./AuthProvider";
import { EncryptionProvider } from "./EncryptionProvider";
import { ContactProvider } from "./ContactProvider";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <AuthProvider>
        <EncryptionProvider>
          <ContactProvider>{children}</ContactProvider>
        </EncryptionProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
