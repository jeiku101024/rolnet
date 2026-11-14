import { requireApprovedSession } from "@/lib/auth/guards";
import type { SearchParams } from "@/lib/pagination/list-page";
import { loadSinkingFund } from "@/lib/sinking-fund/queries";
import { parseSfParams } from "@/lib/sinking-fund/url-state";
import { SinkingFundPage } from "@/components/sinking-fund/sinking-fund-page";

/**
 * Sinking fund (feature 015): participants save, borrow from their own savings at 5%, and repay; the loan
 * interest goes to a shared Interest fund the owner shares in proportion to savings (feature 016), which also closes the year. Three views (Transactions, Top
 * participants, Participants) selected by `?view=`. Any approved user can open it; owner-only actions are
 * hidden or disabled for staff and enforced again in the database functions.
 */
export default async function SinkingFundRoute({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const profile = await requireApprovedSession();
  const raw = await searchParams;
  const params = parseSfParams(raw);
  const isOwner = profile.role === "owner";
  const data = await loadSinkingFund(params, raw, isOwner);
  return <SinkingFundPage data={data} params={params} searchParams={raw} isOwner={isOwner} />;
}
