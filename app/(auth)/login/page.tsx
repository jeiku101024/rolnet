import Link from "next/link";
import Image from "next/image";
import { redirect } from "next/navigation";
import { signIn } from "@/app/actions/auth";
import { getSessionProfile } from "@/lib/auth/guards";
import { isApproved, startPageFor } from "@/lib/permissions/roles";
import { demoMode, demoMasterEmail, demoMasterPassword } from "@/lib/demo/mode";
import { loginErrorMessage } from "@/lib/auth/login-errors";
import { DemoLoginForm } from "@/components/forms/demo-login-form";
import { FormField, Input, ValidationSummary } from "@/components/ui/form-field";
import { FormPanel } from "@/components/ui/form-panel";
import { Button } from "@/components/ui/button";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const profile = await getSessionProfile();
  if (profile && isApproved(profile.accountStatus)) redirect(startPageFor(profile.role));
  const { error } = await searchParams;
  return <LoginContent error={loginErrorMessage(error)} />;
}

async function submitLogin(formData: FormData) {
  "use server";
  const result = await signIn(formData);
  if (!result.ok) redirect(`/login?error=${encodeURIComponent(result.code)}`);
  redirect("/");
}

function LoginContent({ error }: { error?: string }) {
  return (
    <section className="workspace workspace-narrow flex-1 justify-center py-10">
      <Image className="logo-full-auth" src="/brand/rolnet-logo.svg" alt="ROLNET" width={300} height={225} priority />
      <div><h1 className="mt-2 text-page-title font-semibold">Sign in</h1><p className="mt-2 text-body-sm text-muted">Use your approved account to continue.</p></div>
      {demoMode ? <p className="rounded-md bg-brand-soft p-3 text-body-sm text-brand-dark">Demo mode: <strong>{demoMasterEmail}</strong> / <strong>{demoMasterPassword}</strong></p> : null}
      <ValidationSummary message={error} />
      {demoMode ? <DemoLoginForm /> : <FormPanel action={submitLogin} className="space-y-4">
        <FormField label="Email" required><Input required name="email" type="email" autoComplete="email" /></FormField>
        <FormField label="Password" required><Input required name="password" type="password" autoComplete="current-password" /></FormField>
        <Button className="w-full" type="submit">Sign in</Button>
      </FormPanel>}
      <p className="text-body-sm text-muted">New staff member? <Link className="font-semibold text-brand-dark underline" href="/register">Register for approval</Link></p>
    </section>
  );
}
