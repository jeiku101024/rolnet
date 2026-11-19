"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { submitRegistration } from "@/app/(auth)/actions";
import { FormField, Input, ValidationSummary } from "@/components/ui/form-field";
import { FormPanel } from "@/components/ui/form-panel";
import { Button } from "@/components/ui/button";

export function RegisterCard() {
  const pathname = usePathname();
  const params = useSearchParams();
  const error = pathname === "/register" && params.get("error")
    ? "We could not create this account. Check your name, email and a password of at least 6 characters, then try again."
    : undefined;
  return (
    <div className="space-y-4">
      <div><p className="text-label font-semibold text-brand-dark">ROLNET Fleet</p><h1 className="mt-2 text-page-title font-semibold">Staff registration</h1><p className="mt-2 text-body-sm text-muted">An owner must approve your account before you can access fleet data.</p></div>
      <ValidationSummary message={error} />
      <FormPanel action={submitRegistration} className="space-y-4">
        <FormField label="Display name" required><Input required name="displayName" autoComplete="name" /></FormField>
        <FormField label="Email" required><Input required name="email" type="email" autoComplete="email" /></FormField>
        <FormField label="Password" required hint="Use at least 6 characters."><Input required name="password" type="password" minLength={6} autoComplete="new-password" /></FormField>
        <Button className="w-full" type="submit">Submit registration</Button>
      </FormPanel>
      <p className="text-body-sm text-muted">Already registered? <Link className="font-semibold text-brand-dark underline" href="/login">Return to sign in</Link></p>
    </div>
  );
}
