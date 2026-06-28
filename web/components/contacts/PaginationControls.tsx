"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useContacts } from "@/providers/ContactProvider";
import { UserMenu } from "@/components/auth/UserMenu";

const pageSizes = [25, 50, 100] as const;

export function PaginationControls() {
  const { pageConfig, setPageConfig, totalPages, filteredContacts } = useContacts();

  return (
    <div className="flex items-center justify-between px-6 py-3 border-t">
      <div className="flex items-center gap-2">
        <UserMenu />
        <h1 className="text-sm font-semibold tracking-tight text-muted-foreground">Address Book</h1>
      </div>

      <div className="flex items-center gap-2">
        {filteredContacts.length === 0 ? (
          <span className="text-sm text-muted-foreground">No contacts</span>
        ) : (
          <>
            <Select
              value={String(pageConfig.pageSize)}
              onValueChange={(value) =>
                setPageConfig({ pageSize: Number(value) as 25 | 50 | 100, page: 1 })
              }
            >
              <SelectTrigger className="w-[70px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {pageSizes.map((size) => (
                  <SelectItem key={size} value={String(size)}>
                    {size}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              size="icon"
              disabled={pageConfig.page <= 1}
              onClick={() => setPageConfig({ page: pageConfig.page - 1 })}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm tabular-nums">
              Page {pageConfig.page} of {totalPages}
            </span>
            <Button
              variant="outline"
              size="icon"
              disabled={pageConfig.page >= totalPages}
              onClick={() => setPageConfig({ page: pageConfig.page + 1 })}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
