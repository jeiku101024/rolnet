import { notFound } from "next/navigation";
import { requireApprovedSession } from "@/lib/auth/guards";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { PartsList } from "@/components/maintenance/parts-list";
import { TirePositions } from "@/components/maintenance/tire-positions";
import { PageHeader, SectionHeading } from "@/components/ui/page-header";

export default async function UnitMaintenancePage({ params }: { params: Promise<{ unitId: string }> }) { await requireApprovedSession(); const { unitId } = await params; const s = await createSupabaseServerClient(); const [{ data: unit }, { data: parts }, { data: tires }] = await Promise.all([s.from("units").select("body_number").eq("id", unitId).maybeSingle(), s.from("part_replacements").select("id,part_name,next_due_date,next_due_mileage").eq("unit_id", unitId).is("deleted_at", null), s.from("tire_installations").select("id,position,brand").eq("unit_id", unitId).is("deleted_at", null).is("replaced_by_id", null)]); if (!unit) notFound(); return <section className="workspace"><PageHeader eyebrow="Service register" title={`Body ${unit.body_number} maintenance`} description="Current parts and tires are grouped here for quick review." /><div className="mt-8 workspace-grid-wide"><section><SectionHeading title="Parts" /><div className="mt-4"><PartsList parts={parts ?? []} /></div></section><section><SectionHeading title="Current tires" /><div className="mt-4"><TirePositions tires={tires ?? []} /></div></section></div></section>; }
