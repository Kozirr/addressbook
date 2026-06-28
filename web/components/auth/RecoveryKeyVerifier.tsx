"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface RecoveryKeyVerifierProps {
  recoveryKey: string[];
  onVerified: () => void;
}

function randomIndex(length: number): number {
  const values = new Uint32Array(1);
  crypto.getRandomValues(values);
  return values[0] % length;
}

export function RecoveryKeyVerifier({ recoveryKey, onVerified }: RecoveryKeyVerifierProps) {
  const [input, setInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [wordIndex] = useState(() => randomIndex(recoveryKey.length));

  const handleVerify = () => {
    const trimmed = input.trim().toLowerCase();
    if (trimmed !== recoveryKey[wordIndex]) {
      setError("Word does not match. Please check your recovery key.");
      return;
    }
    setError(null);
    onVerified();
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        To confirm you have saved your recovery key, please enter word <strong>#{wordIndex + 1}</strong>.
      </p>
      <div className="space-y-2">
        <Label htmlFor="verify-word">Word #{wordIndex + 1}</Label>
        <Input
          id="verify-word"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={`Enter word #${wordIndex + 1}`}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleVerify();
          }}
        />
        {error && <p className="text-sm text-destructive">{error}</p>}
      </div>
      <Button type="button" onClick={handleVerify} className="w-full">
        Confirm
      </Button>
    </div>
  );
}
