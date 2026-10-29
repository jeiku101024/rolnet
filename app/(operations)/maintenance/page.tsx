import Link from "next/link";
import { requireApprovedSession } from "@/lib/auth/guards";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui/page-header";
import { DataTable } from "@/components/ui/data-table";
import { EmptyState, StatusBadge } from "@/components/ui/feedback";
import { demoMode, demoUnits } from "@/lib/demo/mode";

/** Unit picker: choose the unit, then record mileage, parts and tires on its page (T140). */
export default async function MaintenancePage() {
  await requireApprovedSession();
  const s = demoMode ? null : await createSupabaseServerClient();
  const { data: units } = s ? await s.from("units").select("id, body_number, plate_number, status, current_mileage").is("deleted_at", null).order("body_number") : { data: demoUnits };
  return <section className="workspace"><PageHeader eyebrow="Service register" title="Maintenance" description="Choose a unit to record mileage, part replacements and tires, and to see its service history." />
    <div className="mt-8">{units?.length ? <DataTable headers={["Unit", "Plate", "Mileage", "Status"]}>{units.map((unit) => <tr key={unit.id}><td><Link className="muted-link font-semibold" href={`/maintenance/${unit.id}`}>Body {unit.body_number}</Link></td><td className="font-data">{unit.plate_number}</td><td className="font-data">{unit.current_mileage.toLocaleString()} km</td><td><StatusBadge label={unit.status.replace("_", " ")} tone={unit.status === "active" ? "success" : unit.status === "in_repair" ? "warning" : "danger"} /></td></tr>)}</DataTable> : <EmptyState title="No active units yet." description="Add a unit before recording maintenance." />}</div>
  </section>;
}
