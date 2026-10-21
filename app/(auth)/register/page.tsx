import Link from "next/link";
import { redirect } from "next/navigation";
import { registerStaff } from "@/app/actions/auth";
import { FormField, Input } from "@/components/ui/form-field";

async function submitRegistration(formData: FormData) {
  "use server";
  const result = await registerStaff(formData);
  if (!result.ok) redirect(`/register?error=${result.code}`);
  redirect("/login?registered=1");
}

export default function RegisterPage() {
  return (
    <section className="workspace workspace-narrow flex-1 justify-center py-10">
      <div><p className="text-label font-semibold text-brand-dark">ROLNET Fleet</p><h1 className="mt-2 text-page-title font-semibold">Staff registration</h1><p className="mt-2 text-body-sm text-muted">An owner must approve your account before you can access fleet data.</p></div>
      <form action={submitRegistration} className="data-region space-y-4">
        <FormField label="Display name" required><Input required name="displayName" /></FormField>
        <FormField label="Email" required><Input required name="email" type="email" autoComplete="email" /></FormField>
        <FormField label="Password" required hint="Use at least 6 characters."><Input required name="password" type="password" minLength={6} autoComplete="new-password" /></FormField>
        <button className="min-h-11 w-full rounded-md bg-slate-900 px-4 py-2 font-medium text-white" type="submit">Submit registration</button>
      </form>
      <p className="text-sm text-slate-600">Already registered? <Link className="font-medium text-blue-700 underline" href="/login">Return to sign in</Link></p>
    </section>
  );
}
