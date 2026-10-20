import { requirePermission } from "@/lib/auth/guards";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { approveStaff, rejectStaff, setStaffStatus } from "@/app/actions/auth";

async function approve(formData: FormData) {
  "use server";
  await approveStaff(String(formData.get("userId")));
}

async function reject(formData: FormData) {
  "use server";
  await rejectStaff(String(formData.get("userId")), "Rejected by owner");
}

async function deactivate(formData: FormData) {
  "use server";
  await setStaffStatus(String(formData.get("userId")), "deactivated");
}

export default async function StaffSettingsPage() {
  await requirePermission("manage_users");
  const supabase = await createSupabaseServerClient();
  const { data: staff } = await supabase.from("profiles").select("user_id, display_name, account_status, created_at").eq("role", "staff").order("created_at", { ascending: false });
  return (
    <section className="mx-auto w-full max-w-2xl space-y-6 px-4 py-6">
      <div><p className="text-sm font-medium text-blue-700">Owner settings</p><h1 className="mt-1 text-2xl font-semibold">Staff accounts</h1><p className="mt-2 text-sm text-slate-600">Approve pending registrations or deactivate approved staff.</p></div>
      <ul className="space-y-3">{(staff ?? []).map((person) => <li className="rounded-lg border bg-white p-4" key={person.user_id}><div className="flex items-center justify-between gap-4"><span className="font-medium">{person.display_name}</span><span className="rounded-full bg-slate-100 px-2 py-1 text-xs capitalize">{person.account_status}</span></div><div className="mt-3 flex flex-wrap gap-2">{person.account_status === "pending" ? <><form action={approve}><input type="hidden" name="userId" value={person.user_id} /><button className="min-h-10 rounded-md bg-emerald-700 px-3 text-sm font-medium text-white" type="submit">Approve</button></form><form action={reject}><input type="hidden" name="userId" value={person.user_id} /><button className="min-h-10 rounded-md border border-red-300 px-3 text-sm font-medium text-red-700" type="submit">Reject</button></form></> : null}{person.account_status === "approved" ? <form action={deactivate}><input type="hidden" name="userId" value={person.user_id} /><button className="min-h-10 rounded-md border border-slate-300 px-3 text-sm" type="submit">Deactivate</button></form> : null}</div></li>)}</ul>
    </section>
  );
}
