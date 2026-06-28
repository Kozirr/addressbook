"use client";

import { Upload } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { useContacts } from "@/providers/ContactProvider";
import { importFile } from "@/lib/import";
import { toast } from "sonner";

export function ImportExportActions() {
  const { importContacts } = useContacts();

  const handleImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const imported = await importFile(file);
      await importContacts(imported);
      toast.success(`Imported ${imported.length} contacts`);
    } catch (error) {
      console.error("Import failed:", error);
      toast.error("Import failed", {
        description: error instanceof Error ? error.message : "Unknown error",
      });
    } finally {
      event.target.value = "";
    }
  };

  return (
    <label
      className={buttonVariants({
        variant: "ghost",
        size: "sm",
        className: "cursor-pointer",
      })}
    >
      <Upload className="mr-1.5 h-4 w-4" />
      Import
      <input
        type="file"
          accept=".csv,.vcf"
        className="hidden"
        onChange={handleImport}
      />
    </label>
  );
}
