"use client";

import { useState, useEffect, useRef } from "react";
import { Plus } from "lucide-react";
import { AuthGuard } from "@/components/auth/AuthGuard";
import { SearchBar } from "@/components/contacts/SearchBar";
import { ContactList } from "@/components/contacts/ContactList";
import { PaginationControls } from "@/components/contacts/PaginationControls";
import { ImportExportActions } from "@/components/contacts/ImportExportActions";
import { Button, buttonVariants } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";
import { ContactForm } from "@/components/contacts/ContactForm";
import { ContactDialog } from "@/components/contacts/ContactDialog";
import { useContacts } from "@/providers/ContactProvider";
import { ContactFormInput } from "@/lib/validations";
import { formInputToContactDraft } from "@/lib/contact-utils";
import { toast } from "sonner";
import { WifiOff, RefreshCw, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

function Dashboard() {
  const { isOnline, isSyncing, sync, sort, setSort, addContact, contacts } = useContacts();
  const [showCreate, setShowCreate] = useState(false);
  const [selectedContactId, setSelectedContactId] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [isSpinning, setIsSpinning] = useState(false);
  const spinTimer = useRef<ReturnType<typeof setTimeout>>(null);

  const handleSync = () => {
    sync();
    setIsSpinning(true);
  };

  useEffect(() => {
    if (isSyncing) {
      setIsSpinning(true);
    } else if (isSpinning) {
      spinTimer.current = setTimeout(() => setIsSpinning(false), 600);
    }
    return () => {
      if (spinTimer.current) clearTimeout(spinTimer.current);
    };
  }, [isSyncing, isSpinning]);

  const handleSortName = () => {
    if (sort.field === "firstName") {
      setSort({ field: "firstName", direction: sort.direction === "asc" ? "desc" : "asc" });
    } else {
      setSort({ field: "firstName", direction: "asc" });
    }
  };

  const handleSortDate = () => {
    if (sort.field === "updatedAt") {
      setSort({ field: "updatedAt", direction: sort.direction === "asc" ? "desc" : "asc" });
    } else {
      setSort({ field: "updatedAt", direction: "desc" });
    }
  };

  const handleCreate = async (data: ContactFormInput) => {
    setIsCreating(true);
    try {
      await addContact(formInputToContactDraft(data));
      toast.success("Contact created");
      setShowCreate(false);
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="flex h-screen flex-col">
      <div className="border-b bg-card px-6 py-2">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 flex-1">
            <div className="flex-1 max-w-md">
              <SearchBar />
            </div>
          </div>
          <div className="flex items-center gap-2">
            {!isOnline && (
              <WifiOff className="h-4 w-4 text-muted-foreground" />
            )}
            <DropdownMenu>
              <DropdownMenuTrigger className={buttonVariants({ variant: "ghost", size: "icon" })}>
                <ArrowUpDown className="h-4 w-4" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={handleSortName}>
                  Name
                  {sort.field === "firstName" && (
                    sort.direction === "asc" ? (
                      <ArrowUp className="ml-auto h-4 w-4 text-muted-foreground" />
                    ) : (
                      <ArrowDown className="ml-auto h-4 w-4 text-muted-foreground" />
                    )
                  )}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleSortDate}>
                  Modified
                  {sort.field === "updatedAt" && (
                    sort.direction === "asc" ? (
                      <ArrowUp className="ml-auto h-4 w-4 text-muted-foreground" />
                    ) : (
                      <ArrowDown className="ml-auto h-4 w-4 text-muted-foreground" />
                    )
                  )}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleSync}
              disabled={!isOnline}
              title={isSyncing ? "Syncing..." : "Sync now"}
            >
              <RefreshCw
                className="h-4 w-4"
                style={isSpinning ? { animation: "spin 1s linear infinite", transformOrigin: "center center" } : undefined}
              />
            </Button>
            <ImportExportActions />
            <Button
              size="sm"
              onClick={() => setShowCreate(true)}
            >
              <Plus className="mr-1.5 h-4 w-4" />
              New contact
            </Button>
          </div>
        </div>
      </div>

      <Separator />

      <div className="flex-1 overflow-y-auto">
        <ContactList onOpen={setSelectedContactId} />
      </div>

      <PaginationControls />

      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="sm:max-w-lg">
          <ContactForm
            onSubmit={handleCreate}
            onCancel={() => setShowCreate(false)}
            isSubmitting={isCreating}
          />
        </DialogContent>
      </Dialog>

      {selectedContactId && (
        <ContactDialog
          key={selectedContactId}
          contact={contacts.find((c) => c.id === selectedContactId)!}
          open={true}
          onOpenChange={(open) => {
            if (!open) setSelectedContactId(null);
          }}
        />
      )}
    </div>
  );
}

export default function HomePage() {
  return (
    <AuthGuard>
      <Dashboard />
    </AuthGuard>
  );
}
