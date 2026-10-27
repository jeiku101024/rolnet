import { CircleCheck, CircleX, LoaderCircle, Plus, TriangleAlert } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const rows = [
  { body: "TR-014", driver: "Marlon Dela Cruz", amount: "₱1,800.00", expiry: "18 Jun 2026", state: "ok" },
  { body: "TR-021", driver: "Jessa Mae Santos", amount: "₱1,650.00", expiry: "04 Jun 2026", state: "warning" },
  { body: "TR-033", driver: "Rogelio Ramos", amount: "₱1,800.00", expiry: "21 May 2026", state: "danger" },
];

function StatusBadge({ state }: { state: "ok" | "warning" | "danger" }) {
  const status = {
    ok: { label: "Compliant", icon: CircleCheck, className: "bg-ok-soft text-ok" },
    warning: { label: "Expiring soon", icon: TriangleAlert, className: "bg-warn-soft text-warn" },
    danger: { label: "Expired", icon: CircleX, className: "bg-danger-soft text-danger" },
  }[state];
  const Icon = status.icon;
  return <span className={`status-badge ${status.className}`}><Icon aria-hidden="true" size={14} strokeWidth={2} />{status.label}</span>;
}

export default function Home() {
  return (
    <div className="layout-shell space-y-6 py-6">
      <Card className="grid gap-8 px-6 md:grid-cols-2 md:items-end">
        <div className="max-w-2xl">
          <p className="text-label font-semibold text-brand-dark">Design specimen / operations ledger</p>
          <h1 className="mt-3 text-display font-semibold leading-display text-ink">A clear record of the fleet, from first trip to final peso.</h1>
          <p className="mt-4 max-w-xl text-body text-muted">ROLNET keeps tricycle units, drivers, expenses, maintenance, and permits in one calm working register.</p>
        </div>
        <div className="border-l-2 border-brand pl-4 text-body-sm text-muted md:mb-1">
          <p className="font-data text-data text-brand-dark">03 / 24 / 2026</p>
          <p className="mt-1">Three records need attention before today’s dispatch.</p>
        </div>
      </Card>

      <Card className="px-6">
        <div className="grid gap-8 lg:grid-cols-2">
          <div>
            <h2 className="text-section-title font-semibold text-ink">Type scale</h2>
            <div className="mt-4 space-y-3">
              <p className="text-display font-semibold leading-display">Fleet register</p>
              <p className="text-page-title font-semibold">Unit details</p>
              <p className="text-section-title font-semibold">Recent expenses</p>
              <p className="text-body">A readable sentence for daily work.</p>
              <p className="text-body-sm text-muted">Supporting text and helper copy.</p>
              <p className="font-data text-data">TR-014 / ₱1,800.00 / 18 Jun 2026</p>
            </div>
          </div>
          <div>
            <h2 className="text-section-title font-semibold text-ink">Palette and contrast</h2>
            <div className="mt-4 grid grid-cols-2 gap-px border border-rule bg-rule sm:grid-cols-3">
              <div className="bg-brand p-3 text-ink"><p className="text-body-sm font-semibold">Brand</p><p className="mt-1 font-data text-label">#FFC72C / 11.08:1</p></div>
              <div className="bg-brand-dark p-3 text-surface"><p className="text-body-sm font-semibold">Brand dark</p><p className="mt-1 font-data text-label">#1B2A41 / 14.44:1</p></div>
              <div className="bg-ink p-3 text-surface"><p className="text-body-sm font-semibold">Ink</p><p className="mt-1 font-data text-label">#0F1B2D / 17.28:1</p></div>
              <div className="bg-ok-soft p-3 text-ok"><p className="text-body-sm font-semibold">OK</p><p className="mt-1 font-data text-label">#246B4A / 5.62:1</p></div>
              <div className="bg-warn-soft p-3 text-warn"><p className="text-body-sm font-semibold">Warning</p><p className="mt-1 font-data text-label">#8A5100 / 5.77:1</p></div>
              <div className="bg-danger-soft p-3 text-danger"><p className="text-body-sm font-semibold">Expired</p><p className="mt-1 font-data text-label">#A33F3B / 5.38:1</p></div>
            </div>
          </div>
        </div>
      </Card>

      <Card className="px-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div><h2 className="text-section-title font-semibold text-ink">Controls and statuses</h2><p className="mt-1 text-body-sm text-muted">The accent carries action; statuses carry meaning.</p></div>
          <div className="flex flex-wrap items-center gap-2"><StatusBadge state="ok" /><StatusBadge state="warning" /><StatusBadge state="danger" /></div>
        </div>
        <div className="mt-6 grid gap-6 md:grid-cols-2">
          <div className="flex flex-wrap items-center gap-3">
            <Button type="button"><Plus aria-hidden="true" size={16} />Add expense</Button>
            <Button variant="outline" type="button">Secondary</Button>
            <Button variant="destructive" type="button">Delete record</Button>
            <Button type="button" disabled>Disabled</Button>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="outline" type="button" aria-label="Focused button example">Focus example</Button>
            <span className="text-body-sm text-muted">Use Tab to inspect focus.</span>
          </div>
        </div>
        <form className="mt-8 grid gap-4 border-t border-rule pt-6 md:grid-cols-2">
          <label className="text-body-sm font-semibold text-ink">Unit<Input className="mt-2 min-h-11" name="unit" defaultValue="TR-014" /></label>
          <label className="text-body-sm font-semibold text-ink">Category<select className="touch-target mt-2 block w-full rounded-md border border-rule bg-surface px-3 text-body" name="category" defaultValue="fuel"><option value="fuel">Fuel</option><option value="repair">Repair</option><option value="permit">Permit</option></select></label>
          <label className="text-body-sm font-semibold text-ink">Amount<Input className="font-data mt-2 min-h-11" name="amount" inputMode="decimal" defaultValue="1800.00" /></label>
          <label className="text-body-sm font-semibold text-ink">Date<Input className="font-data mt-2 min-h-11" name="date" type="date" defaultValue="2026-03-24" /></label>
          <label className="text-body-sm font-semibold text-ink md:col-span-2">Note<Input className="mt-2 min-h-11" name="note" placeholder="e.g. morning fuel run" /></label>
        </form>
      </Card>

      <Card className="px-6">
        <div className="flex flex-wrap items-end justify-between gap-4"><div><h2 className="text-section-title font-semibold text-ink">Fleet register</h2><p className="mt-1 text-body-sm text-muted">A ledger row stays useful at phone width.</p></div><span className="font-data text-label text-muted">3 active units</span></div>
        <div className="mt-5 overflow-x-auto border-y border-rule">
          <table className="table-min w-full text-left text-body-sm"><thead className="text-label text-muted"><tr className="table-rule"><th className="px-3 py-3 font-semibold">Body</th><th className="px-3 py-3 font-semibold">Driver</th><th className="px-3 py-3 font-semibold">Remittance</th><th className="px-3 py-3 font-semibold">Permit expiry</th><th className="px-3 py-3 font-semibold">Status</th></tr></thead><tbody>{rows.map((row) => <tr className="table-rule" key={row.body}><td className="font-data px-3 py-3 text-data font-semibold text-brand-dark">{row.body}</td><td className="px-3 py-3">{row.driver}</td><td className="font-data px-3 py-3 text-data">{row.amount}</td><td className="font-data px-3 py-3 text-data">{row.expiry}</td><td className="px-3 py-3"><StatusBadge state={row.state as "ok" | "warning" | "danger"} /></td></tr>)}</tbody></table>
        </div>
      </Card>

      <Card className="grid gap-8 px-6 md:grid-cols-2">
        <div><h2 className="text-section-title font-semibold text-ink">Empty state</h2><div className="mt-4 border-y border-rule py-8 text-center"><p className="text-body font-semibold text-ink">No expenses recorded for March.</p><p className="mx-auto mt-2 max-w-sm text-body-sm text-muted">Add the first fuel, repair, or permit cost to start this month’s ledger.</p><button className="touch-target mt-5 rounded-md bg-brand px-4 font-semibold text-ink" type="button">Add first expense</button></div></div>
        <div><h2 className="text-section-title font-semibold text-ink">Loading state</h2><div className="mt-4 flex items-center gap-3 border-y border-rule py-8 text-body-sm text-muted"><LoaderCircle className="animate-spin text-brand-dark" aria-hidden="true" size={18} />Loading today’s fleet records…</div></div>
      </Card>
    </div>
  );
}
