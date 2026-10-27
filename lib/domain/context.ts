import "server-only";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ApiError } from "@/lib/api/errors";
import { hasPermission, type Permission } from "@/lib/permissions/roles";
import type { AppRole } from "@/types/database";

export async function apiContext(permission?: Permission) {
  const supabase = await createSupabaseServerClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) throw new ApiError(401, "UNAUTHENTICATED", "Sign in to continue.");
  const { data: profile } = await supabase.from("profiles").select("user_id, display_name, role, account_status").eq("user_id", user.id).maybeSingle();
  if (!profile || profile.account_status !== "approved") throw new ApiError(403, "ACCOUNT_NOT_APPROVED", "Your account is not approved for fleet access.");
  const role = profile.role as AppRole;
  if (permission && !hasPermission(role, permission)) throw new ApiError(403, "FORBIDDEN", "You do not have permission to do that.");
  return { supabase, userId: user.id, role, profile };
}
