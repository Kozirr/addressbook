"use client";

import { ReactNode } from "react";
import { AlertTriangle } from "lucide-react";

export default function AuthLayout({ children }: { children: ReactNode }) {
  const isSecure =
    typeof window === "undefined" || window.isSecureContext;

  return (
    <div className="min-h-dvh flex flex-col items-center justify-center p-6 gap-4">
      {!isSecure && (
        <div className="flex items-start gap-3 rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive max-w-sm">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <p className="font-medium">Secure context required</p>
            <p className="text-destructive/80">
              Please open this app using <code>http://localhost:3000</code> or https://
              so encryption can work in your browser.
            </p>
          </div>
        </div>
      )}
      {children}
    </div>
  );
}
