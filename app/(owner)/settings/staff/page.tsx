import { PageHeader } from "@/components/ui/page-header";
import { requirePermission } from "@/lib/auth/guards";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { approveStaff, rejectStaff, setStaffStatus } from "@/app/actions/auth";
import { DataTable } from "@/components/ui/data-table";
import { StatusBadge } from "@/components/ui/feedback";
import { demoMode } from "@/lib/demo/mode";
import { pageRows, parseListPage, type SearchParams } from "@/lib/pagination/list-page";
import { loadListPage } from "@/lib/pagination/search-filter";
import { searchSpecs } from "@/lib/pagination/search-specs";
import { listView } from "@/components/ui/paged-list";

async function approve(formData: FormData) { "use server"; await approveStaff(String(formData.get("userId"))); }
async function reject(formData: FormData) { "use server"; await rejectStaff(String(formData.get("userId")), "Rejected by owner"); }
async function deactivate(formData: FormData) { "use server"; await setStaffStatus(String(formData.get("userId")), "deactivated"); }

export default async function StaffSettingsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  await requirePermission("manage_users");
  const params = await searchParams;
  const request = parseListPage(params);
  const supabase = demoMode ? null : await createSupabaseServerClient();
  const result = supabase
    ? await loadListPage(supabase, request, searchSpecs.staff, (from, to, filter) => {
      let query = supabase.from("profiles").select("user_id, display_name, account_status, created_at", { count: "exact" }).eq("role", "staff");
      if (filter) query = query.or(filter);
      return query.order("created_at", { ascending: false }).range(from, to);
    })
    : pageRows([] as { user_id: string; display_name: string; account_status: string; created_at: string }[], request, (person) => person.display_name);
  const staff = result.rows;
  const list = listView("/settings/staff", params, request, result, { searchLabel: "Search staff" });
  return <section className="workspace"><PageHeader eyebrow="Owner settings" title="Staff accounts" description="Approve pending registrations or deactivate approved staff." /><div className="mt-8"><DataTable list={list} headers={["Staff member", "Status", "Registered", "Actions"]} empty={<p className="p-6 text-muted">No staff registrations yet.</p>}>{staff.map((person) => <tr key={person.user_id}><td className="font-semibold">{person.display_name}</td><td><StatusBadge label={person.account_status} tone={person.account_status === "approved" ? "success" : person.account_status === "pending" ? "warning" : "muted"} /></td><td className="font-data text-body-sm">{new Date(person.created_at).toLocaleDateString()}</td><td><div className="flex flex-wrap gap-2">{person.account_status === "pending" ? <><form action={approve}><input type="hidden" name="userId" value={person.user_id} /><button className="touch-target border border-ok px-3 text-body-sm font-bold text-ok" type="submit">Approve</button></form><form action={reject}><input type="hidden" name="userId" value={person.user_id} /><button className="touch-target border border-danger px-3 text-body-sm font-bold text-danger" type="submit">Reject</button></form></> : null}{person.account_status === "approved" ? <form action={deactivate}><input type="hidden" name="userId" value={person.user_id} /><button className="touch-target border border-rule px-3 text-body-sm font-bold text-muted" type="submit">Deactivate</button></form> : null}</div></td></tr>)}</DataTable></div></section>;
}
