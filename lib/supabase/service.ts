import { createClient } from "@supabase/supabase-js";

// Feature 013 (research R10): the service-role client, used only by the daily purge route
// (app/api/cron/purge-document-files). It bypasses RLS, so it must never reach the browser: ESLint
// forbids importing this module anywhere else, and the key has no NEXT_PUBLIC_ name.
export function createSupabaseServiceClient() {
  if (typeof window !== "undefined") throw new Error("The service-role client is server-only.");
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("SUPABASE_SERVICE_ROLE_KEY or NEXT_PUBLIC_SUPABASE_URL is missing.");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}
