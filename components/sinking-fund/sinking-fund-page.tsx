"use client";

import type { ReactNode } from "react";
import { Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { pageContext } from "@/lib/navigation/page-context";
import type { SearchParams } from "@/lib/pagination/list-page";
import type { SfPageData } from "@/lib/sinking-fund/queries";
import type { SfPageParams } from "@/lib/sinking-fund/url-state";
import { ViewToggle } from "@/components/sinking-fund/view-toggle";
import { SinkingFundShell, useSfActions } from "@/components/sinking-fund/sinking-fund-shell";
import { TransactionsView } from "@/components/sinking-fund/transactions-view";
import { TopView } from "@/components/sinking-fund/top-view";
import { ParticipantsView } from "@/components/sinking-fund/participants-view";

function SettingsButton() {
  const { isOwner, openSettings } = useSfActions();
  return isOwner ? <Button type="button" variant="outline" onClick={openSettings}><Settings aria-hidden="true" size={16} />Fund settings</Button> : null;
}

/** The client shell of /sinking-fund: header, view toggle, and the active view. Dialogs live in SinkingFundShell. */
export function SinkingFundPage({ data, params, searchParams, isOwner }: { data: SfPageData; params: SfPageParams; searchParams: SearchParams; isOwner: boolean }) {
  return <SinkingFundShell data={data} params={params} searchParams={searchParams} isOwner={isOwner}>
    <section className="workspace">
      <PageHeader eyebrow={pageContext.sinkingFund.eyebrow} title={pageContext.sinkingFund.title} action={<SettingsButton />} />
      <div className="mt-8 grid gap-6">
        <ViewToggle view={params.view} searchParams={searchParams} />
        {params.view === "transactions" ? <TransactionsView /> : params.view === "top" ? <TopView /> : <ParticipantsView />}
      </div>
    </section>
  </SinkingFundShell>;
}

export function OwnerOnlyNote({ children }: { children: ReactNode }) {
  return <span title="Owner only">{children}</span>;
}
