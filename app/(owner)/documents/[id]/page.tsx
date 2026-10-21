import { notFound } from "next/navigation";
import { requirePermission } from "@/lib/auth/guards";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ExpiryStatus } from "@/components/documents/expiry-status";
import { PageHeader } from "@/components/ui/page-header";

export default async function DocumentDetail({ params }: { params: Promise<{ id: string }> }) { await requirePermission("manage_documents"); const { id } = await params; const s = await createSupabaseServerClient(); const { data: doc } = await s.from("documents").select("id,document_type,expires_on,lifecycle_status,object_path").eq("id", id).maybeSingle(); if (!doc) notFound(); return <section className="workspace"><PageHeader eyebrow="Compliance register" title="Document detail" description={doc.document_type.replace("_", " ")} /><div className="mt-8 max-w-xl border-t border-rule pt-5"><div className="flex flex-wrap items-center justify-between gap-4"><p className="font-data text-body">Expires {doc.expires_on}</p><ExpiryStatus expiresOn={doc.expires_on} /></div><p className="mt-4 text-body-sm text-muted">Lifecycle: {doc.lifecycle_status}. {doc.object_path ? "File uploaded." : "File missing."}</p></div></section>; }
