"use client";

import { useActionState } from "react";
import { LogOut } from "lucide-react";
import { signOut } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";

export function LogoutButton() {
  const [state, formAction, pending] = useActionState(signOut, null);

  return (
    <form action={formAction} className="grid gap-2">
      <Button
        aria-label="Logout"
        className="w-full justify-start border border-rule text-danger hover:bg-danger-soft"
        disabled={pending}
        type="submit"
        variant="ghost"
      >
        <LogOut aria-hidden="true" />
        <span>{pending ? "Signing out…" : "Logout"}</span>
      </Button>
      {state && !state.ok ? <p className="text-label leading-body text-danger" role="alert">{state.message}</p> : null}
    </form>
  );
}
