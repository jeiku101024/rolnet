"use server";

import { redirect } from "next/navigation";
import { registerStaff, signIn } from "@/app/actions/auth";

export async function submitLogin(formData: FormData) {
  const result = await signIn(formData);
  if (!result.ok) redirect(`/login?error=${encodeURIComponent(result.code)}`);
  redirect("/");
}

export async function submitRegistration(formData: FormData) {
  const result = await registerStaff(formData);
  if (!result.ok) redirect(`/register?error=${encodeURIComponent(result.code)}`);
  redirect("/login?registered=1");
}
