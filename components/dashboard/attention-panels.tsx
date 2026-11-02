import { StatusBadge } from "@/components/ui/feedback";
import { DashboardPanel, PanelRow } from "@/components/dashboard/dashboard-panel";
import { formatPesos } from "@/lib/money/centavos";
import { documentTypeLabels } from "@/lib/validation/documents";
import { expiryText, type ExpiringDocumentItem, type Panel, type UnpaidBalanceItem } from "@/lib/dashboard/ordering";

/** "Needs attention": expiring documents and unpaid balances, most urgent first (US3; maintenance retired in feature 011). */
export function AttentionPanels({ documents, balances }: { documents: Panel<ExpiringDocumentItem>; balances: Panel<UnpaidBalanceItem> }) {
  return <>
    <DashboardPanel id="panel-documents" title="Expiring documents" description="Expired first, then the soonest to expire." total={documents.total} href={documents.href} empty="No documents expire in the next 7 days.">
      {documents.items.map((doc) => <PanelRow key={doc.id} href={`/documents/${doc.id}`} title={documentTypeLabels[doc.documentType] ?? doc.documentType} detail={doc.holderLabel} aside={<StatusBadge label={expiryText(doc.daysUntil)} tone={doc.daysUntil < 0 ? "danger" : "warning"} />} />)}
    </DashboardPanel>
    <DashboardPanel id="panel-balances" title="Unpaid balances" description="Largest balance first." total={balances.total} href={balances.href} empty="Every driver is paid up.">
      {balances.items.map((item) => <PanelRow key={item.driverId} href={`/drivers/${item.driverId}`} title={item.driverName} detail={item.firstUnpaidServiceDate ? `${item.unpaidRemittanceCount} unpaid ${item.unpaidRemittanceCount === 1 ? "day" : "days"} since ${item.firstUnpaidServiceDate}` : undefined} aside={<span className="font-data text-data font-semibold text-danger">{formatPesos(item.outstandingCentavos)}</span>} />)}
    </DashboardPanel>
  </>;
}
