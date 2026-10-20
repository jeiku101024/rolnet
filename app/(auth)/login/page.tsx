import Link from "next/link";
import Image from "next/image";
import { redirect } from "next/navigation";
import { signIn } from "@/app/actions/auth";
import { demoMode, demoMasterEmail, demoMasterPassword } from "@/lib/demo/mode";
import { DemoLoginForm } from "@/components/forms/demo-login-form";

export default function LoginPage() {
  return <LoginContent />;
}

async function submitLogin(formData: FormData) {
  "use server";
  const result = await signIn(formData);
  if (!result.ok) redirect(`/login?error=${result.code}`);
  redirect("/");
}

function LoginContent() {
  return (
    <section className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-6 px-4 py-8">
      <Image className="logo-full-auth" src="/brand/rolnet-logo.svg" alt="ROLNET" width={300} height={225} priority />
      <div><h1 className="mt-2 text-page-title font-semibold">Sign in</h1><p className="mt-2 text-body-sm text-muted">Use your approved account to continue.</p></div>
      {demoMode ? <p className="rounded-md bg-brand-soft p-3 text-body-sm text-brand-dark">Demo mode: <strong>{demoMasterEmail}</strong> / <strong>{demoMasterPassword}</strong></p> : null}
      {demoMode ? <DemoLoginForm /> : <form action={submitLogin} className="space-y-4">
        <label className="block text-body-sm font-semibold">Email<input required name="email" type="email" autoComplete="email" className="touch-target mt-1 block w-full rounded-md border bg-surface p-3" /></label>
        <label className="block text-body-sm font-semibold">Password<input required name="password" type="password" autoComplete="current-password" className="touch-target mt-1 block w-full rounded-md border bg-surface p-3" /></label>
        <button className="touch-target w-full rounded-md bg-brand px-4 font-semibold text-ink" type="submit">Sign in</button>
      </form>}
      <p className="text-body-sm text-muted">New staff member? <Link className="font-semibold text-brand-dark underline" href="/register">Register for approval</Link></p>
    </section>
  );
}
