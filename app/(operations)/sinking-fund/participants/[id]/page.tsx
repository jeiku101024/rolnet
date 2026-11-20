import { notFound } from "next/navigation";
import { requireApprovedSession } from "@/lib/auth/guards";
import type { SearchParams } from "@/lib/pagination/list-page";
import { loadParticipantPage } from "@/lib/sinking-fund/queries";
import { isUuid, parseSfParams } from "@/lib/sinking-fund/url-state";
import { ParticipantPage } from "@/components/sinking-fund/participant-page";

/**
 * One participant's own page (feature 021). Replaces the pop-up: the same card details and buttons, then a History table
 * with the main list's search, sort, and ten-row paging. Any approved user can open it; owner-only actions stay disabled
 * or hidden for staff and are enforced again in the database functions.
 */
export default async function ParticipantRoute({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<SearchParams> }) {
  const profile = await requireApprovedSession();
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const raw = await searchParams;
  const isOwner = profile.role === "owner";
  const data = await loadParticipantPage(id, raw, isOwner);
  if (!data) notFound();
  return <ParticipantPage data={data} searchParams={raw} isOwner={isOwner} params={parseSfParams({})} />;
}
