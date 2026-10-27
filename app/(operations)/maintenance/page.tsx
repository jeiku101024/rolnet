import { requireApprovedSession } from "@/lib/auth/guards";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { PartReplacementForm } from "@/components/forms/part-replacement-form";
import { TireInstallationForm } from "@/components/forms/tire-installation-form";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/feedback";
import { demoMode, demoUnits } from "@/lib/demo/mode";

export default async function MaintenancePage() {
  await requireApprovedSession();
  const s = demoMode ? null : await createSupabaseServerClient();
  const { data: units } = s ? await s.from("units").select("id,body_number").is("deleted_at", null).order("body_number") : { data: demoUnits.map((unit) => ({ id: unit.id, body_number: unit.body_number })) };
  const unit = units?.[0];
  return <section className="workspace"><PageHeader eyebrow="Service register" title="Maintenance" description="Encode parts and tires before a due item becomes downtime." />{unit ? <div className="mt-8 workspace-grid"><div className="border-t border-rule pt-5"><h2 className="text-section-title font-bold">Body {unit.body_number}</h2><p className="mt-1 text-body-sm text-muted">Choose a unit’s current maintenance context before saving a replacement.</p></div><div className="space-y-8"><PartReplacementForm unitId={unit.id} /><TireInstallationForm unitId={unit.id} /></div></div> : <div className="mt-8"><EmptyState title="No active units yet." description="Add a unit before recording maintenance." /></div>}</section>;
}
