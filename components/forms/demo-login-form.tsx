"use client";

import { useState } from "react";
import { demoMasterEmail, demoMasterPassword } from "@/lib/demo/mode";
import { Button } from "@/components/ui/button";
import { FormField, Input, ValidationSummary } from "@/components/ui/form-field";
import { FormPanel } from "@/components/ui/form-panel";

export function DemoLoginForm() {
  const [error, setError] = useState("");
  return <FormPanel className="space-y-4" onSubmit={(event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    if (form.get("email") === demoMasterEmail && form.get("password") === demoMasterPassword) window.location.assign("/");
    else setError("Use the demo credentials shown above.");
  }}>
    <FormField label="Email" required><Input required name="email" type="email" /></FormField>
    <FormField label="Password" required><Input required name="password" type="password" /></FormField>
    <Button className="w-full" type="submit">Sign in</Button>
    <ValidationSummary message={error} />
  </FormPanel>;
}
