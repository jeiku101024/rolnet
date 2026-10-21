import { requirePermission } from "@/lib/auth/guards";
import { ReportExportForm } from "@/components/forms/report-export-form";
import { PageHeader } from "@/components/ui/page-header";

export default async function ReportsPage() { await requirePermission("export_reports"); return <section className="workspace"><PageHeader eyebrow="Monthly reporting" title="Reports" description="Download a reconciled monthly CSV summary for bookkeeping." /><div className="mt-8 max-w-xl border-t border-rule pt-5"><ReportExportForm /></div></section>; }
