import { StatusBadge } from "@/components/ui/feedback";
import { DashboardPanel, PanelRow } from "@/components/dashboard/dashboard-panel";
import { formatPesos } from "@/lib/money/centavos";
import { documentTypeLabels } from "@/lib/validation/documents";
import { dueText, expiryText, type DueMaintenanceItem, type ExpiringDocumentItem, type Panel, type UnpaidBalanceItem } from "@/lib/dashboard/ordering";

/** "Needs attention": expiring documents, due maintenance and unpaid balances, most urgent first (US3). */
export function AttentionPanels({ documents, maintenance, balances }: { documents: Panel<ExpiringDocumentItem>; maintenance: Panel<DueMaintenanceItem>; balances: Panel<UnpaidBalanceItem> }) {
  return <>
    <DashboardPanel id="panel-documents" title="Expiring documents" description="Expired first, then the soonest to expire." total={documents.total} href={documents.href} empty="No documents expire in the next 30 days.">
      {documents.items.map((doc) => <PanelRow key={doc.id} href={`/documents/${doc.id}`} title={documentTypeLabels[doc.documentType] ?? doc.documentType} detail={doc.holderLabel} aside={<StatusBadge label={expiryText(doc.daysUntil)} tone={doc.daysUntil < 0 ? "danger" : "warning"} />} />)}
    </DashboardPanel>
    <DashboardPanel id="panel-maintenance" title="Maintenance due" description="Most overdue first, by date or mileage." total={maintenance.total} href={maintenance.href} empty="No maintenance is due.">
      {maintenance.items.map((item) => <PanelRow key={item.item_id} href={`/maintenance/${item.unit_id}`} title={item.item_name} detail={`Body ${item.body_number}`} aside={<StatusBadge label={dueText(item)} tone={item.urgency > 0 ? "danger" : "warning"} />} />)}
    </DashboardPanel>
    <DashboardPanel id="panel-balances" title="Unpaid balances" description="Largest balance first." total={balances.total} href={balances.href} empty="Every driver is paid up.">
      {balances.items.map((item) => <PanelRow key={item.driverId} href={`/drivers/${item.driverId}`} title={item.driverName} detail={item.firstUnpaidServiceDate ? `${item.unpaidRemittanceCount} unpaid ${item.unpaidRemittanceCount === 1 ? "day" : "days"} since ${item.firstUnpaidServiceDate}` : undefined} aside={<span className="font-data text-data font-semibold text-danger">{formatPesos(item.outstandingCentavos)}</span>} />)}
    </DashboardPanel>
  </>;
}
