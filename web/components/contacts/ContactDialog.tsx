"use client";

import { useState, useEffect } from "react";
import { Mail, Phone, MapPin, Building2, Briefcase, Star, Pencil, Tag, Trash2, X } from "lucide-react";
import { Contact } from "@/types/contact";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useContacts } from "@/providers/ContactProvider";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { ContactForm } from "@/components/contacts/ContactForm";
import { formInputToContactDraft } from "@/lib/contact-utils";
import { ContactFormInput } from "@/lib/validations";

interface ContactDialogProps {
  contact: Contact;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ContactDialog({ contact, open, onOpenChange }: ContactDialogProps) {
  const { toggleFavorite, updateContact, deleteContact } = useContacts();
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [localFavorite, setLocalFavorite] = useState(contact.isFavorite);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  useEffect(() => {
    if (open) {
      setIsEditing(false);
      setLocalFavorite(contact.isFavorite);
      setShowDeleteConfirm(false);
    }
  }, [contact.id, contact.isFavorite, open]);

  const handleToggleFavorite = (e: React.MouseEvent) => {
    e.stopPropagation();
    setLocalFavorite((prev) => !prev);
    toggleFavorite(contact.id);
  };

  const handleSave = async (input: ContactFormInput) => {
    setIsSaving(true);
    try {
      await updateContact(contact.id, formInputToContactDraft(input));
      toast.success("Contact updated");
      setIsEditing(false);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    await deleteContact(contact.id);
    toast.success("Contact deleted");
    onOpenChange(false);
  };

  const header = (
    <DialogHeader>
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-primary/10 text-lg font-semibold text-primary">
            {contact.firstName[0]}
            {contact.lastName[0]}
          </div>
          <div>
            <DialogTitle className="text-xl">
              {contact.firstName} {contact.lastName}
            </DialogTitle>
            {(contact.jobTitle || contact.company) && (
              <p className="text-sm text-muted-foreground">
                {contact.jobTitle}{contact.jobTitle && contact.company ? " at " : ""}{contact.company}
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" onClick={handleToggleFavorite}>
            <Star className={cn("h-5 w-5", localFavorite ? "fill-amber-400 text-amber-400" : "text-muted-foreground")} />
          </Button>
          {!isEditing && (
            <>
              <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); setIsEditing(true); }}>
                <Pencil className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); setShowDeleteConfirm(true); }}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </>
          )}
          <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); onOpenChange(false); }}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </DialogHeader>
  );

  const normalBody = (
    <div className="space-y-4">
      {contact.email && (
        <div className="flex items-center gap-3">
          <Mail className="h-4 w-4 text-muted-foreground" />
          <a href={`mailto:${contact.email}`} className="text-primary hover:underline">{contact.email}</a>
        </div>
      )}
      {contact.phone && (
        <div className="flex items-center gap-3">
          <Phone className="h-4 w-4 text-muted-foreground" />
          <span>{contact.phone}</span>
        </div>
      )}
      {contact.address && (
        <div className="flex items-start gap-3">
          <MapPin className="mt-0.5 h-4 w-4 text-muted-foreground" />
          <span className="whitespace-pre-line">{contact.address}</span>
        </div>
      )}
      {(contact.company || contact.jobTitle) && <Separator />}
      {contact.company && (
        <div className="flex items-center gap-3">
          <Building2 className="h-4 w-4 text-muted-foreground" />
          <span>{contact.company}</span>
        </div>
      )}
      {contact.jobTitle && (
        <div className="flex items-center gap-3">
          <Briefcase className="h-4 w-4 text-muted-foreground" />
          <span>{contact.jobTitle}</span>
        </div>
      )}
      {contact.tags.length > 0 && (
        <>
          <Separator />
          <div className="flex items-start gap-3">
            <Tag className="mt-0.5 h-4 w-4 text-muted-foreground" />
            <div className="flex flex-wrap gap-2">
              {contact.tags.map((tag) => (<Badge key={tag} variant="secondary">{tag}</Badge>))}
            </div>
          </div>
        </>
      )}
      {contact.notes && (
        <>
          <Separator />
          <div>
            <h3 className="mb-2 text-sm font-medium text-muted-foreground">Notes</h3>
            <p className="whitespace-pre-line text-sm text-muted-foreground">{contact.notes}</p>
          </div>
        </>
      )}
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {showDeleteConfirm ? (
        <DialogContent key="confirm" className="sm:max-w-sm" showCloseButton={false}>
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
              <Button variant="destructive" onClick={handleDelete}>Delete</Button>
            </div>
          </div>
        </DialogContent>
      ) : (
        <DialogContent key="normal" className="sm:max-w-lg max-h-[85vh] overflow-y-auto" showCloseButton={false}>
          {isEditing ? (
            <ContactForm
              contact={contact}
              onSubmit={handleSave}
              onCancel={() => setIsEditing(false)}
              isSubmitting={isSaving}
            />
          ) : (
            <>
              {header}
              {normalBody}
            </>
          )}
        </DialogContent>
      )}
    </Dialog>
  );
}
