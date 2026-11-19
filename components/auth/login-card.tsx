"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { submitLogin } from "@/app/(auth)/actions";
import { demoMode, demoMasterEmail, demoMasterPassword } from "@/lib/demo/mode";
import { loginErrorMessage } from "@/lib/auth/login-errors";
import { DemoLoginForm } from "@/components/forms/demo-login-form";
import { FormField, Input, ValidationSummary } from "@/components/ui/form-field";
import { FormPanel } from "@/components/ui/form-panel";
import { Button } from "@/components/ui/button";

export function LoginCard() {
  const pathname = usePathname();
  const params = useSearchParams();
  const active = pathname === "/login";
  const error = active ? loginErrorMessage(params.get("error") ?? undefined) : undefined;
  const registered = active && params.get("registered") === "1";
  return (
    <div className="space-y-4">
      <div><h1 className="text-page-title font-semibold">Sign in</h1><p className="mt-2 text-body-sm text-muted">Use your approved account to continue.</p></div>
      {registered ? <p role="status" className="rounded-md bg-ok-soft p-3 text-body-sm text-ok">Registration received. An owner must approve your account before you can sign in.</p> : null}
      {demoMode ? <p className="rounded-md bg-brand-soft p-3 text-body-sm text-brand-dark">Demo mode: <strong>{demoMasterEmail}</strong> / <strong>{demoMasterPassword}</strong></p> : null}
      <ValidationSummary message={error} />
      {demoMode ? <DemoLoginForm /> : <FormPanel action={submitLogin} className="space-y-4">
        <FormField label="Email" required><Input required name="email" type="email" autoComplete="email" /></FormField>
        <FormField label="Password" required><Input required name="password" type="password" autoComplete="current-password" /></FormField>
        <Button className="w-full" type="submit">Sign in</Button>
      </FormPanel>}
      <p className="text-body-sm text-muted">New staff member? <Link className="font-semibold text-brand-dark underline" href="/register">Register for approval</Link></p>
    </div>
  );
}
