import { PageHeader } from "@/components/ui/page-header";
import { requirePermission } from "@/lib/auth/guards";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { approveStaff, rejectStaff, setStaffStatus } from "@/app/actions/auth";
import { DataTable } from "@/components/ui/data-table";
import { StatusBadge } from "@/components/ui/feedback";
import { demoMode } from "@/lib/demo/mode";

async function approve(formData: FormData) { "use server"; await approveStaff(String(formData.get("userId"))); }
async function reject(formData: FormData) { "use server"; await rejectStaff(String(formData.get("userId")), "Rejected by owner"); }
async function deactivate(formData: FormData) { "use server"; await setStaffStatus(String(formData.get("userId")), "deactivated"); }

export default async function StaffSettingsPage() {
  await requirePermission("manage_users");
  const supabase = demoMode ? null : await createSupabaseServerClient();
  const { data: staff } = supabase ? await supabase.from("profiles").select("user_id, display_name, account_status, created_at").eq("role", "staff").order("created_at", { ascending: false }) : { data: [] };
  return <section className="workspace"><PageHeader eyebrow="Owner settings" title="Staff accounts" description="Approve pending registrations or deactivate approved staff." /><div className="mt-8"><DataTable headers={["Staff member", "Status", "Registered", "Actions"]} empty={<p className="p-6 text-muted">No staff registrations yet.</p>}>{(staff ?? []).map((person) => <tr key={person.user_id}><td className="font-semibold">{person.display_name}</td><td><StatusBadge label={person.account_status} tone={person.account_status === "approved" ? "success" : person.account_status === "pending" ? "warning" : "muted"} /></td><td className="font-data text-body-sm">{new Date(person.created_at).toLocaleDateString()}</td><td><div className="flex flex-wrap gap-2">{person.account_status === "pending" ? <><form action={approve}><input type="hidden" name="userId" value={person.user_id} /><button className="touch-target border border-ok px-3 text-body-sm font-bold text-ok" type="submit">Approve</button></form><form action={reject}><input type="hidden" name="userId" value={person.user_id} /><button className="touch-target border border-danger px-3 text-body-sm font-bold text-danger" type="submit">Reject</button></form></> : null}{person.account_status === "approved" ? <form action={deactivate}><input type="hidden" name="userId" value={person.user_id} /><button className="touch-target border border-rule px-3 text-body-sm font-bold text-muted" type="submit">Deactivate</button></form> : null}</div></td></tr>)}</DataTable></div></section>;
}
