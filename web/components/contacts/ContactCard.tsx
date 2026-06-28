"use client";

import { useState, useEffect, useCallback } from "react";
import { Star, Download, Pencil, Trash2 } from "lucide-react";
import { Contact } from "@/types/contact";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { useContacts } from "@/providers/ContactProvider";
import { exportContactsCSV, exportContactsVCard } from "@/lib/export";
import { toast } from "sonner";

interface ContactCardProps {
  contact: Contact;
  onOpen: (id: string) => void;
}

interface ContextMenuState {
  x: number;
  y: number;
  visible: boolean;
}

export function ContactCard({ contact, onOpen }: ContactCardProps) {
  const { toggleFavorite, deleteContact } = useContacts();
  const [menu, setMenu] = useState<ContextMenuState>({ x: 0, y: 0, visible: false });
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const closeMenu = useCallback(() => {
    setMenu((prev) => ({ ...prev, visible: false }));
  }, []);

  useEffect(() => {
    if (!menu.visible) return;
    const handler = () => closeMenu();
    document.addEventListener("click", handler);
    document.addEventListener("contextmenu", handler);
    return () => {
      document.removeEventListener("click", handler);
      document.removeEventListener("contextmenu", handler);
    };
  }, [menu.visible, closeMenu]);

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    setMenu({ x: e.clientX, y: e.clientY, visible: true });
  };

  const handleFavorite = (e: React.MouseEvent) => {
    e.stopPropagation();
    toggleFavorite(contact.id);
    closeMenu();
  };

  const handleExportCSV = (e: React.MouseEvent) => {
    e.stopPropagation();
    exportContactsCSV([contact]);
    closeMenu();
  };

  const handleExportVCard = (e: React.MouseEvent) => {
    e.stopPropagation();
    exportContactsVCard([contact]);
    closeMenu();
  };

  const handleEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    onOpen(contact.id);
    closeMenu();
  };

  const handleDeleteClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowDeleteConfirm(true);
    closeMenu();
  };

  const handleConfirmDelete = async () => {
    await deleteContact(contact.id);
    toast.success("Contact deleted");
    setShowDeleteConfirm(false);
  };

  return (
    <>
      <div
        className="group flex cursor-pointer items-center justify-between rounded-xl border bg-card p-4 transition-colors hover:bg-accent/50"
        onClick={() => onOpen(contact.id)}
        onContextMenu={handleContextMenu}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onOpen(contact.id);
          }
        }}
      >
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
            {contact.firstName[0]}
            {contact.lastName[0]}
          </div>
          <div className="min-w-0">
            <h3 className="truncate font-medium">
              {contact.firstName} {contact.lastName}
            </h3>
            {contact.company && (
              <p className="truncate text-sm text-muted-foreground">
                {contact.company}
              </p>
            )}
          </div>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="shrink-0"
          onClick={(e) => {
            e.stopPropagation();
            toggleFavorite(contact.id);
          }}
        >
          <Star
            className={cn(
              "h-5 w-5 transition-colors",
              contact.isFavorite
                ? "fill-amber-400 text-amber-400"
                : "text-muted-foreground"
            )}
          />
        </Button>
      </div>

      {menu.visible && (
        <div
          className="fixed z-50 min-w-40 overflow-hidden rounded-lg border bg-popover p-1 shadow-md"
          style={{ left: menu.x, top: menu.y }}
        >
          <button
            className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent"
            onClick={handleFavorite}
          >
            <Star
              className={cn(
                "h-4 w-4",
                contact.isFavorite && "fill-amber-400 text-amber-400"
              )}
            />
            {contact.isFavorite ? "Unfavorite" : "Favorite"}
          </button>

          <div className="my-1 border-t" />

          <button
            className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent"
            onClick={handleExportCSV}
          >
            <Download className="h-4 w-4" />
            Export as CSV
          </button>
          <button
            className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent"
            onClick={handleExportVCard}
          >
            <Download className="h-4 w-4" />
            Export as vCard
          </button>

          <div className="my-1 border-t" />

          <button
            className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent"
            onClick={handleEdit}
          >
            <Pencil className="h-4 w-4" />
            Edit
          </button>
          <button
            className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm text-destructive hover:bg-destructive/10"
            onClick={handleDeleteClick}
          >
            <Trash2 className="h-4 w-4" />
            Delete
          </button>
        </div>
      )}

      <Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <DialogContent className="sm:max-w-sm" showCloseButton={false}>
          <div className="space-y-4">
            <div className="text-center">
              <Trash2 className="mx-auto h-8 w-8 text-destructive" />
              <h3 className="mt-2 text-lg font-semibold">Delete contact?</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                This will permanently delete {contact.firstName} {contact.lastName}.
              </p>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowDeleteConfirm(false)}>Cancel</Button>
              <Button variant="destructive" onClick={handleConfirmDelete}>Delete</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
