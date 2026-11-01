"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { MoreHorizontal } from "lucide-react";
import { restoreUnit } from "@/app/actions/units";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLinkItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useToast } from "@/components/ui/toast";
import { ArchiveUnitDialog } from "@/components/units/archive-unit-dialog";
import { clientErrorMessage } from "@/components/forms/use-action-form";

/**
 * A units row's 3-dot menu (feature 010, FR-007): More info and Archive, or More info and Restore on
 * an archived row. Base UI positions it so it flips upward near the bottom of the screen.
 */
export function UnitRowMenu({ unit }: { unit: { id: string; name: string; updatedAt: string; archived: boolean } }) {
  const router = useRouter();
  const toast = useToast();
  const [archiving, setArchiving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function restore() {
    setError(null);
    try {
      const result = await restoreUnit({ id: unit.id, expectedUpdatedAt: unit.updatedAt });
      if (!result.ok) { setError(result.message); return; }
      toast("Unit restored");
      router.refresh();
    } catch (reason) {
      setError(clientErrorMessage(reason));
    }
  }

  return <>
    <DropdownMenu>
      <DropdownMenuTrigger className="touch-target inline-flex w-11 items-center justify-center rounded-md text-ink hover:bg-brand-soft" aria-label="Unit options"><MoreHorizontal aria-hidden="true" size={18} /></DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuLinkItem render={<Link href={`/units/${unit.id}`} />}>More info</DropdownMenuLinkItem>
        {unit.archived
          ? <DropdownMenuItem onClick={restore}>Restore</DropdownMenuItem>
          : <DropdownMenuItem onClick={() => setArchiving(true)}>Archive</DropdownMenuItem>}
      </DropdownMenuContent>
    </DropdownMenu>
    {error ? <p role="alert" className="text-body-sm text-danger">{error}</p> : null}
    {archiving && !unit.archived ? <ArchiveUnitDialog unit={unit} open onOpenChange={setArchiving} /> : null}
  </>;
}
