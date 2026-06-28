"use client";

import { useContacts } from "@/providers/ContactProvider";
import { LetterGroup } from "./LetterGroup";
import { Skeleton } from "@/components/ui/skeleton";

interface ContactListProps {
  onOpen: (id: string) => void;
}

export function ContactList({ onOpen }: ContactListProps) {
  const { paginatedContacts, isLoading } = useContacts();

  if (isLoading) {
    return (
      <div className="space-y-4 p-6">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-24 w-full rounded-xl" />
        ))}
      </div>
    );
  }

  if (paginatedContacts.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center p-6 text-muted-foreground">
        No contacts found
      </div>
    );
  }

  const favorites = paginatedContacts.filter((c) => c.isFavorite);
  const nonFavorites = paginatedContacts.filter((c) => !c.isFavorite);

  const groups = nonFavorites.reduce((acc, contact) => {
    const letter = contact.firstName[0]?.toUpperCase() || "#";
    if (!acc[letter]) acc[letter] = [];
    acc[letter].push(contact);
    return acc;
  }, {} as Record<string, typeof paginatedContacts>);

  const sortedLetters = Object.keys(groups).sort();

  return (
    <div className="space-y-6 p-6">
      {favorites.length > 0 && (
        <LetterGroup letter="Favorites" contacts={favorites} onOpen={onOpen} />
      )}
      {sortedLetters.map((letter) => (
        <LetterGroup key={letter} letter={letter} contacts={groups[letter]} onOpen={onOpen} />
      ))}
    </div>
  );
}
