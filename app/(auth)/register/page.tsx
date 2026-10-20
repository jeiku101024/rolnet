import Link from "next/link";
import { redirect } from "next/navigation";
import { registerStaff } from "@/app/actions/auth";

async function submitRegistration(formData: FormData) {
  "use server";
  const result = await registerStaff(formData);
  if (!result.ok) redirect(`/register?error=${result.code}`);
  redirect("/login?registered=1");
}

export default function RegisterPage() {
  return (
    <section className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-6 px-4 py-8">
      <div><p className="text-sm font-medium text-blue-700">ROLNET Fleet</p><h1 className="mt-2 text-2xl font-semibold">Staff registration</h1><p className="mt-2 text-sm text-slate-600">An owner must approve your account before you can access fleet data.</p></div>
      <form action={submitRegistration} className="space-y-4">
        <label className="block text-sm font-medium">Display name<input required name="displayName" className="mt-1 min-h-11 w-full rounded-md border p-3" /></label>
        <label className="block text-sm font-medium">Email<input required name="email" type="email" autoComplete="email" className="mt-1 min-h-11 w-full rounded-md border p-3" /></label>
        <label className="block text-sm font-medium">Password<input required name="password" type="password" minLength={6} autoComplete="new-password" className="mt-1 min-h-11 w-full rounded-md border p-3" /></label>
        <button className="min-h-11 w-full rounded-md bg-slate-900 px-4 py-2 font-medium text-white" type="submit">Submit registration</button>
      </form>
      <p className="text-sm text-slate-600">Already registered? <Link className="font-medium text-blue-700 underline" href="/login">Return to sign in</Link></p>
    </section>
  );
}
