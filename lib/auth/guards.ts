import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isApproved, type Permission } from "@/lib/permissions/roles";
import type { AppRole, ProfileStatus } from "@/types/database";
import { demoMode } from "@/lib/demo/mode";

export interface SessionProfile {
  userId: string;
  displayName: string;
  role: AppRole;
  accountStatus: ProfileStatus;
}

export async function getSessionProfile(): Promise<SessionProfile | null> {
  if (demoMode) return { userId: "demo-owner", displayName: "Demo Owner", role: "owner", accountStatus: "approved" };
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await supabase
    .from("profiles")
    .select("user_id, display_name, role, account_status")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!profile) return null;
  return {
    userId: profile.user_id,
    displayName: profile.display_name,
    role: profile.role,
    accountStatus: profile.account_status,
  };
}

export async function requireApprovedSession() {
  const profile = await getSessionProfile();
  if (!profile) redirect("/login");
  if (!isApproved(profile.accountStatus)) redirect(`/login?error=${profile.accountStatus}`);
  return profile;
}

export async function requirePermission(permission: Permission) {
  const profile = await requireApprovedSession();
  const { hasPermission } = await import("@/lib/permissions/roles");
  if (!hasPermission(profile.role, permission)) redirect("/forbidden");
  return profile;
}
