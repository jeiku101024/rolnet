import Link from "next/link";
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
      <div><p className="text-sm font-medium text-blue-700">ROLNET Fleet</p><h1 className="mt-2 text-2xl font-semibold">Sign in</h1><p className="mt-2 text-sm text-slate-600">Use your approved account to continue.</p></div>
      {demoMode ? <p className="rounded-md bg-blue-50 p-3 text-sm text-blue-900">Demo mode: <strong>{demoMasterEmail}</strong> / <strong>{demoMasterPassword}</strong></p> : null}
      {demoMode ? <DemoLoginForm /> : <form action={submitLogin} className="space-y-4">
        <label className="block text-sm font-medium">Email<input required name="email" type="email" autoComplete="email" className="mt-1 min-h-11 w-full rounded-md border p-3" /></label>
        <label className="block text-sm font-medium">Password<input required name="password" type="password" autoComplete="current-password" className="mt-1 min-h-11 w-full rounded-md border p-3" /></label>
        <button className="min-h-11 w-full rounded-md bg-slate-900 px-4 py-2 font-medium text-white" type="submit">Sign in</button>
      </form>}
      <p className="text-sm text-slate-600">New staff member? <Link className="font-medium text-blue-700 underline" href="/register">Register for approval</Link></p>
    </section>
  );
}
