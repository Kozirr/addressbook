"use client";

import { Contact } from "@/types/contact";
import { ContactCard } from "./ContactCard";

interface LetterGroupProps {
  letter: string;
  contacts: Contact[];
  onOpen: (id: string) => void;
}

export function LetterGroup({ letter, contacts, onOpen }: LetterGroupProps) {
  return (
    <div className="space-y-2">
      <div className="sticky top-0 z-10 bg-background/95 py-2 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {letter}
        </h2>
      </div>
      <div className="space-y-2">
        {contacts.map((contact) => (
          <ContactCard key={contact.id} contact={contact} onOpen={onOpen} />
        ))}
      </div>
    </div>
  );
}
