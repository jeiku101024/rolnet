import Link from "next/link";
import { PageHeader } from "@/components/ui/page-header";

export default function ParticipantNotFound() {
  return <section className="workspace">
    <PageHeader eyebrow="Sinking fund" title="Participant not found" />
    <p className="mt-6 text-body-sm text-muted">This participant does not exist or was archived. Go back to the participants list and pick another one.</p>
    <Link href="/sinking-fund?view=participants" className="touch-target mt-4 inline-flex items-center rounded-md border border-control-border bg-surface px-4 text-body-sm font-semibold text-ink hover:bg-brand-soft">Back to participants</Link>
  </section>;
}
