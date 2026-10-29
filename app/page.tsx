import { redirect } from "next/navigation";
import { getSessionProfile } from "@/lib/auth/guards";
import { isApproved, startPageFor } from "@/lib/permissions/roles";

// `/` has no screen of its own: approved users go to their role's start page, everyone else to
// sign in (T143; replaces the former design-specimen page with sample data).
export default async function Home() {
  const profile = await getSessionProfile();
  if (!profile) redirect("/login");
  if (!isApproved(profile.accountStatus)) redirect(`/login?error=${profile.accountStatus}`);
  redirect(startPageFor(profile.role));
}
