"use client";

import { Suspense } from "react";
import { RecoverySetup } from "@/components/auth/RecoverySetup";

export default function RecoverySetupRoute() {
  return (
    <Suspense
      fallback={
        <div className="min-h-dvh flex items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-muted-foreground border-t-transparent" />
        </div>
      }
    >
      <RecoverySetup />
    </Suspense>
  );
}
