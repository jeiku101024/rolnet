import { StatusBadge } from "@/components/ui/feedback";
import { DashboardPanel, PanelRow } from "@/components/dashboard/dashboard-panel";
import { repairText, type ExtradorItem, type InRepairUnitItem, type Panel } from "@/lib/dashboard/ordering";

/** Active backup drivers (extradors) and the unit each one drives today (US4, FR-019). */
export function ExtradorsPanel({ panel }: { panel: Panel<ExtradorItem> }) {
  return <DashboardPanel id="panel-extradors" title="Extradors today" description="Active backup drivers, assigned first." total={panel.total} href={panel.href} empty="No active extradors.">
    {panel.items.map((item) => <PanelRow key={item.driverId} href={`/drivers/${item.driverId}`} title={item.fullName} detail={<span className="font-data">{item.phone}</span>} aside={item.currentUnit ? <StatusBadge label={`Body ${item.currentUnit.bodyNumber} today`} tone="success" /> : <StatusBadge label="Not assigned" tone="muted" />} />)}
  </DashboardPanel>;
}

/** Units whose status is "In repair", longest in repair first (US4, FR-020). */
export function InRepairPanel({ panel }: { panel: Panel<InRepairUnitItem> }) {
  return <DashboardPanel id="panel-in-repair" title="Units in repair" description="Off the road, longest first." total={panel.total} href={panel.href} empty="No units are in repair.">
    {panel.items.map((item) => <PanelRow key={item.unitId} href={`/units/${item.unitId}`} title={`Body ${item.bodyNumber}`} detail={<span className="font-data">{item.plateNumber}</span>} aside={<StatusBadge label={repairText(item)} tone="warning" />} />)}
  </DashboardPanel>;
}
