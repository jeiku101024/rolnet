import Link from "next/link";
import { redirect } from "next/navigation";
import { registerStaff } from "@/app/actions/auth";
import { FormField, Input } from "@/components/ui/form-field";
import { FormPanel } from "@/components/ui/form-panel";
import { Button } from "@/components/ui/button";

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
      <FormPanel action={submitRegistration} className="space-y-4">
        <FormField label="Display name" required><Input required name="displayName" /></FormField>
        <FormField label="Email" required><Input required name="email" type="email" autoComplete="email" /></FormField>
        <FormField label="Password" required hint="Use at least 6 characters."><Input required name="password" type="password" minLength={6} autoComplete="new-password" /></FormField>
        <Button className="w-full" type="submit">Submit registration</Button>
      </FormPanel>
      <p className="text-body-sm text-muted">Already registered? <Link className="font-semibold text-brand-dark underline" href="/login">Return to sign in</Link></p>
    </section>
  );
}
