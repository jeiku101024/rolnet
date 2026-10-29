import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { requireApprovedSession } from "@/lib/auth/guards";
import { startPageFor } from "@/lib/permissions/roles";

// requirePermission() redirects here when an approved user opens a page their role cannot use
// (for example staff opening the owner dashboard, documents or reports).
export default async function ForbiddenPage() {
  const profile = await requireApprovedSession();
  return (
    <section className="workspace">
      <PageHeader eyebrow="Access" title="This page is for the owner" description="Your account can record remittances, expenses and maintenance. Ask the owner if you need this information." />
      <div className="mt-8"><Link className={buttonVariants()} href={startPageFor(profile.role)}>Go to your start page</Link></div>
    </section>
  );
}
