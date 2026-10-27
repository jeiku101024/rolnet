"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { assertSameOrigin } from "@/lib/auth/same-origin";
import { failure, success, type ActionResult } from "@/lib/actions/result";
import { demoMode, demoMasterEmail, demoMasterPassword } from "@/lib/demo/mode";

const credentialsSchema = z.object({ email: z.string().email(), password: z.string().min(6) });
const registrationSchema = credentialsSchema.extend({ displayName: z.string().trim().min(1).max(120) });

export async function signIn(formData: FormData): Promise<ActionResult<null>> {
  try {
    await assertSameOrigin();
    const input = credentialsSchema.parse({ email: formData.get("email"), password: formData.get("password") });
    if (demoMode) return input.email === demoMasterEmail && input.password === demoMasterPassword ? success(null) : failure("AUTH_FAILED", "Use the local demo owner credentials.");
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.signInWithPassword(input);
    if (error) return failure("AUTH_FAILED", "Email or password is incorrect.");
    return success(null);
  } catch {
    return failure("INVALID_INPUT", "Enter a valid email and password.");
  }
}

export async function registerStaff(formData: FormData): Promise<ActionResult<null>> {
  try {
    await assertSameOrigin();
    const input = registrationSchema.parse({
      email: formData.get("email"),
      password: formData.get("password"),
      displayName: formData.get("displayName"),
    });
    if (demoMode) return success(null, "Demo mode uses the master owner account; staff registration is disabled.");
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.signUp({
      email: input.email,
      password: input.password,
      options: { data: { display_name: input.displayName } },
    });
    if (error) return failure("REGISTRATION_FAILED", "We could not create this account. Check the details and try again.");
    return success(null, "Registration received. An owner must approve your account before you can use the app.");
  } catch {
    return failure("INVALID_INPUT", "Enter a name, valid email, and password with at least 6 characters.");
  }
}

export async function signOut(_previousState: ActionResult<null> | null = null): Promise<ActionResult<null>> {
  try {
    await assertSameOrigin();
    if (!demoMode) {
      const supabase = await createSupabaseServerClient();
      const { error } = await supabase.auth.signOut();
      const expiredSession = error && (
        error.code === "session_not_found" ||
        /session (missing|not found)/i.test(error.message)
      );
      if (error && !expiredSession) {
        return failure("SIGN_OUT_FAILED", "We could not log you out. Your session may still be active. Try again.");
      }
    }
  } catch {
    return failure("SIGN_OUT_FAILED", "We could not log you out. Your session may still be active. Try again.");
  }
  redirect("/login");
}

export async function approveStaff(userId: string) {
  const supabase = await createSupabaseServerClient();
  return supabase.rpc("approve_staff_registration", { p_user_id: userId });
}

export async function rejectStaff(userId: string, reason?: string) {
  const supabase = await createSupabaseServerClient();
  return supabase.rpc("reject_staff_registration", { p_user_id: userId, p_reason: reason });
}

export async function setStaffStatus(userId: string, status: "approved" | "deactivated") {
  const supabase = await createSupabaseServerClient();
  return supabase.rpc("set_staff_account_status", { p_user_id: userId, p_status: status });
}
