"use client";

import { useState } from "react";
import { Copy, Check, Download } from "lucide-react";
import { Button } from "@/components/ui/button";

interface RecoveryKeyDisplayProps {
  recoveryKey: string[];
}

export function RecoveryKeyDisplay({ recoveryKey }: RecoveryKeyDisplayProps) {
  const [copied, setCopied] = useState(false);
  const mnemonic = recoveryKey.join(" ");

  const handleCopy = async () => {
    await navigator.clipboard.writeText(mnemonic);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const blob = new Blob([mnemonic], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "addressbook-recovery-key.txt";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      <div className="rounded-lg border bg-muted/30 p-4">
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6">
          {recoveryKey.map((word, index) => (
            <div
              key={index}
              className="flex items-center gap-1.5 rounded-md border bg-background px-2 py-1.5 text-sm"
            >
              <span className="text-xs text-muted-foreground">{index + 1}.</span>
              <span className="font-medium">{word}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="flex gap-2">
        <Button type="button" variant="outline" onClick={handleCopy} className="flex-1">
          {copied ? (
            <Check className="mr-2 h-4 w-4 text-green-500" />
          ) : (
            <Copy className="mr-2 h-4 w-4" />
          )}
          {copied ? "Copied" : "Copy"}
        </Button>
        <Button type="button" variant="outline" onClick={handleDownload} className="flex-1">
          <Download className="mr-2 h-4 w-4" />
          Download
        </Button>
      </div>
      <p className="text-sm text-destructive">
        Save this recovery key in a secure place. It will not be shown again.
      </p>
    </div>
  );
}
