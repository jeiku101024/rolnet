import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSessionProfile } from "@/lib/auth/guards";
import { isApproved, startPageFor } from "@/lib/permissions/roles";

export const metadata: Metadata = { title: "Sign in | ROLNET Fleet Ledger" };

// The card itself is rendered by app/(auth)/layout.tsx; this page only redirects signed-in users.
export default async function LoginPage() {
  const profile = await getSessionProfile();
  if (profile && isApproved(profile.accountStatus)) redirect(startPageFor(profile.role));
  return null;
}
