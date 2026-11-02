"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronsDownUp, ChevronsUpDown, TriangleAlert } from "lucide-react";
import { bringBackDocumentVersion, getDocumentDetails, restoreDocumentVersion, revertDocumentUpload } from "@/app/actions/documents";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useToast } from "@/components/ui/toast";
import { clientErrorMessage } from "@/components/forms/use-action-form";
import type { UploadPreset, UploadSaved, UploadScope } from "@/components/forms/document-form";
import { Pane } from "@/components/documents/pane";
import { UnitTree } from "@/components/documents/unit-tree";
import { DriverLicenseList } from "@/components/documents/driver-license-list";
import { DocumentsHeaderActions } from "@/components/documents/documents-header-actions";
import { UploadDocumentDialog } from "@/components/documents/upload-document-dialog";
import { DocumentDetailsDialog } from "@/components/documents/document-details-dialog";
import { ConfirmVersionDialog, type ConfirmFile, type ConfirmVariant } from "@/components/documents/confirm-version-dialog";
import { RecentlyRevertedDialog } from "@/components/documents/recently-reverted-dialog";
import type { DocumentsPageData, RevertedEntry } from "@/lib/documents/page-query";
import type { DetailsReverted, DetailsVersion, DocumentDetails } from "@/lib/documents/details-query";
import { buildUnitFolders, filterAndSortFolders, filterLicenses, licensePaneCount, unitPaneCount } from "@/lib/documents/tree";
import { serializeDocumentsParams, unitDocumentTypes, type DocumentsUrlState } from "@/lib/documents/url-state";
import { documentStatusLabels, documentStatuses, type DocumentStatus } from "@/lib/documents/status";
import { documentTypeLabels } from "@/lib/validation/documents";

// Feature 013: the two-pane Documents page. The server loads the data once (research R12); search,
// filters and sort run here and are kept in the page address (FR-009a, R13).

const iconButton = "touch-target inline-flex w-11 items-center justify-center rounded-md text-muted hover:bg-brand-soft";
const statusOptions = documentStatuses.map((value) => ({ value, label: documentStatusLabels[value] }));
const typeOptions = unitDocumentTypes.map((value) => ({ value, label: documentTypeLabels[value] }));
const typeName = (type: string) => documentTypeLabels[type] ?? type;
const possessive = (name: string) => `${name}'s`;

interface Confirm { variant: ConfirmVariant; first?: ConfirmFile; second?: ConfirmFile; run: () => Promise<string | null> }

export function DocumentsWorkspace({ data, initial }: { data: DocumentsPageData; initial: DocumentsUrlState }) {
  const router = useRouter();
  const toast = useToast();
  const [state, setState] = useState(initial);
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  const beforeSearch = useRef<Set<string> | null>(null);
  const [upload, setUpload] = useState<{ scope: UploadScope; preset?: UploadPreset } | null>(null);
  // The last details loaded, by version id; a reload keeps showing them until the new ones arrive.
  const [loaded, setLoaded] = useState<{ id: string; data: DocumentDetails | null; error: string | null } | null>(null);
  const [detailsTick, setDetailsTick] = useState(0);
  const [confirm, setConfirm] = useState<Confirm | null>(null);
  const [revertedOpen, setRevertedOpen] = useState(false);

  // Back/forward (or a link) brings new params from the server; adopt them when they differ.
  const initialQuery = serializeDocumentsParams(initial);
  const lastInitial = useRef(initialQuery);
  useEffect(() => {
    if (lastInitial.current !== initialQuery) { lastInitial.current = initialQuery; setState(initial); }
  }, [initial, initialQuery]);

  // Write the state to the address without a server round trip (Next syncs replaceState).
  const query = serializeDocumentsParams(state);
  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (window.location.search !== query) window.history.replaceState(null, "", `${window.location.pathname}${query}`);
      lastInitial.current = query;
    }, 300);
    return () => window.clearTimeout(timer);
  }, [query]);

  const update = useCallback((changes: Partial<DocumentsUrlState>) => setState((previous) => ({ ...previous, ...changes })), []);

  // Unit search forces matching folders open; clearing it restores the folders open before (FR-021).
  const searching = Boolean(state.usearch.trim());
  useEffect(() => {
    if (searching && !beforeSearch.current) beforeSearch.current = new Set(expanded);
    if (!searching && beforeSearch.current) { setExpanded(beforeSearch.current); beforeSearch.current = null; }
  }, [searching, expanded]);

  const folders = useMemo(() => buildUnitFolders(data.units, data.unitDocs), [data.units, data.unitDocs]);
  const tree = useMemo(() => filterAndSortFolders({ folders, query: state.usearch, types: state.utype, statuses: state.ustatus, sort: state.sort }), [folders, state.usearch, state.utype, state.ustatus, state.sort]);
  const licenses = useMemo(() => filterLicenses(data.licenses, state.dsearch, state.dstatus, state.sort), [data.licenses, state.dsearch, state.dstatus, state.sort]);
  const currentByKey = useMemo(() => Object.fromEntries([...data.unitDocs, ...data.licenses].map((doc) => [`${doc.documentType}:${doc.unitId ?? doc.driverId}`, doc.id])), [data.unitDocs, data.licenses]);
  const currentById = useMemo(() => new Map([...data.unitDocs, ...data.licenses].map((doc) => [doc.id, doc])), [data.unitDocs, data.licenses]);

  const isOpen = (unitId: string) => (tree.searching ? tree.folders.some((folder) => folder.unitId === unitId) : expanded.has(unitId));
  const toggle = (unitId: string, open: boolean) => {
    if (tree.searching) return;
    setExpanded((previous) => { const next = new Set(previous); if (open) next.add(unitId); else next.delete(unitId); return next; });
  };
  const expand = (unitId: string) => setExpanded((previous) => new Set(previous).add(unitId));

  // The details modal follows `doc` in the address.
  useEffect(() => {
    const id = state.doc;
    if (!id) return;
    let live = true;
    getDocumentDetails({ id }).then((result) => {
      if (live) setLoaded(result.ok ? { id, data: result.data, error: null } : { id, data: null, error: result.message });
    }).catch((reason) => { if (live) setLoaded({ id, data: null, error: clientErrorMessage(reason) }); });
    return () => { live = false; };
  }, [state.doc, detailsTick]);
  const details = state.doc && loaded?.id === state.doc ? loaded : null;
  const openDocument = (id: string) => update({ doc: id });
  const reloadDetails = () => setDetailsTick((tick) => tick + 1);
  const refresh = () => { router.refresh(); reloadDetails(); };

  function undo(savedId: string) {
    revertDocumentUpload({ currentId: savedId }).then((result) => {
      if (result.ok) { toast("Upload reverted. You can bring it back from Recently reverted."); refresh(); return; }
      toast(result.code === "STALE_RECORD" ? "Nothing changed. This document was updated since." : result.message);
    }).catch((reason) => toast(clientErrorMessage(reason)));
  }

  function onSaved(saved: UploadSaved) {
    setUpload(null);
    if (saved.unitId) expand(saved.unitId);
    const message = saved.renewed ? `Renewed ${typeName(saved.documentType)} for ${saved.holderName}. Previous file kept in history.` : `Document uploaded for ${saved.holderName}.`;
    toast(message, { action: { label: "Undo", onClick: () => undo(saved.id) }, timeout: 7000 });
    refresh();
  }

  const doc = details?.data ?? null;
  function askRevert() {
    const current = doc?.current;
    if (!doc || !current) return;
    const previous = doc.history[0];
    setConfirm({
      variant: current.hasPrevious ? "revert-previous" : "revert-remove",
      first: { name: current.fileName, expiresOn: current.expiresOn },
      second: previous ? { name: previous.fileName, expiresOn: previous.expiresOn } : undefined,
      run: async () => {
        const result = await revertDocumentUpload({ currentId: current.id });
        if (!result.ok) return result.message;
        setConfirm(null);
        if (result.data.result === "removed") { update({ doc: null }); toast(`Upload removed for ${doc.holder.name}.`); }
        else toast(`Upload reverted. ${possessive(doc.holder.name)} ${typeName(doc.documentType)} is back to the previous version.`);
        refresh();
        return null;
      },
    });
  }

  function askRestore(version: DetailsVersion) {
    const current = doc?.current;
    if (!doc) return;
    setConfirm({
      variant: "restore",
      first: { name: version.fileName, expiresOn: version.expiresOn },
      second: current ? { name: current.fileName, expiresOn: current.expiresOn } : undefined,
      run: async () => {
        const result = await restoreDocumentVersion({ versionId: version.id, currentId: current?.id ?? null });
        if (!result.ok) return result.message;
        setConfirm(null);
        toast(`Restored ${version.fileName} as the current version of ${possessive(doc.holder.name)} ${typeName(doc.documentType)}.`);
        refresh();
        return null;
      },
    });
  }

  function askBringBack(entry: { id: string; fileName: string; expiresOn: string; documentType: string; unitId: string | null; driverId: string | null; holderName: string }) {
    const currentId = currentByKey[`${entry.documentType}:${entry.unitId ?? entry.driverId}`] ?? null;
    const current = currentId ? currentById.get(currentId) : undefined;
    setConfirm({
      variant: currentId ? "bring-back-swap" : "bring-back-recreate",
      first: { name: entry.fileName, expiresOn: entry.expiresOn },
      second: current ? { name: current.fileName, expiresOn: current.expiresOn } : undefined,
      run: async () => {
        const result = await bringBackDocumentVersion({ versionId: entry.id, currentId });
        if (!result.ok) return result.message;
        setConfirm(null);
        if (result.data.result === "recreated" && entry.unitId) expand(entry.unitId);
        toast(`Brought back ${entry.fileName} for ${possessive(entry.holderName)} ${typeName(entry.documentType)}.`);
        refresh();
        return null;
      },
    });
  }
  const bringBackFromDetails = (entry: DetailsReverted) => doc && askBringBack({ ...entry, documentType: doc.documentType, unitId: doc.holder.kind === "unit" ? doc.holder.id : null, driverId: doc.holder.kind === "driver" ? doc.holder.id : null, holderName: doc.holder.name });
  const bringBackFromList = (entry: RevertedEntry) => askBringBack(entry);

  function renew() {
    if (!doc) return;
    const preset: UploadPreset = doc.holder.kind === "unit" ? { documentType: doc.documentType, unitId: doc.holder.id } : { documentType: doc.documentType, driverId: doc.holder.id };
    update({ doc: null });
    setUpload({ scope: doc.holder.kind, preset });
  }

  const unitFilters = [
    { key: "utype", label: "Type", options: typeOptions, chosen: state.utype as string[] },
    { key: "ustatus", label: "Status", options: statusOptions, chosen: state.ustatus as string[] },
  ];
  const driverFilters = [{ key: "dstatus", label: "Status", options: statusOptions, chosen: state.dstatus as string[] }];

  return <section className="workspace">
    <header className="workspace-header">
      <div><p className="text-label font-bold text-brand-dark">Records and compliance</p><h1 className="mt-2 text-page-title font-bold leading-tight text-ink">Documents</h1></div>
      <div className="flex w-full min-w-0 flex-wrap items-end gap-2 sm:w-auto">
        <DocumentsHeaderActions revertedCount={data.recentlyReverted.length} onOpenReverted={() => setRevertedOpen(true)} sort={state.sort} onSort={(sort) => update({ sort })} />
      </div>
    </header>

    {data.purgeOverdue ? <p className="mt-4 flex items-start gap-2 rounded-md bg-warn-soft p-3 text-body-sm text-warn" role="status">
      <TriangleAlert aria-hidden="true" size={16} className="mt-0.5 shrink-0" />File cleanup is overdue. Re-enable the daily purge workflow in GitHub Actions.
    </p> : null}

    <div className="mt-6 grid gap-6 lg:grid-cols-20">
      <div className="min-w-0 lg:col-span-11">
        <Pane title="Unit documents" count={unitPaneCount(folders)} uploadLabel="Upload unit document" onUpload={() => setUpload({ scope: "unit" })}
          filters={unitFilters} onFilterChange={(key, values) => update(key === "utype" ? { utype: values as DocumentsUrlState["utype"] } : { ustatus: values as DocumentStatus[] })}
          onClearFilters={() => update({ utype: [], ustatus: [] })} searchLabel="Search unit documents" search={state.usearch} onSearch={(usearch) => update({ usearch })}
          summary={tree.summary}
          summaryActions={<>
            <Tooltip><TooltipTrigger render={<button type="button" className={iconButton} aria-label="Expand all folders" onClick={() => setExpanded(new Set(folders.map((folder) => folder.unitId)))} />}><ChevronsUpDown aria-hidden="true" size={18} /></TooltipTrigger><TooltipContent>Expand all</TooltipContent></Tooltip>
            <Tooltip><TooltipTrigger render={<button type="button" className={iconButton} aria-label="Collapse all folders" onClick={() => setExpanded(new Set())} />}><ChevronsDownUp aria-hidden="true" size={18} /></TooltipTrigger><TooltipContent>Collapse all</TooltipContent></Tooltip>
          </>}>
          {tree.folders.length
            ? <UnitTree folders={tree.folders} isOpen={isOpen} onToggle={toggle} onOpenDocument={openDocument} onUpload={(unitId) => setUpload({ scope: "unit", preset: { unitId } })} query={state.usearch} today={data.today} />
            : <p className="px-2 py-6 text-center text-body-sm text-muted">{folders.length ? "No documents match." : "No units yet. Add a unit first."}</p>}
        </Pane>
      </div>
      <div className="min-w-0 lg:col-span-9">
        <Pane title="Driver licenses" count={licensePaneCount(data.licenses)} uploadLabel="Upload driver license" onUpload={() => setUpload({ scope: "driver" })}
          filters={driverFilters} onFilterChange={(_key, values) => update({ dstatus: values as DocumentStatus[] })} onClearFilters={() => update({ dstatus: [] })}
          searchLabel="Search driver licenses" search={state.dsearch} onSearch={(dsearch) => update({ dsearch })} summary={licenses.summary}>
          <DriverLicenseList rows={licenses.rows} total={data.licenses.length} query={state.dsearch} today={data.today} onOpenDocument={openDocument} />
        </Pane>
      </div>
    </div>

    <UploadDocumentDialog open={Boolean(upload)} scope={upload?.scope ?? "unit"} preset={upload?.preset} units={data.units} drivers={data.drivers}
      currentByKey={currentByKey} onClose={() => setUpload(null)} onSaved={onSaved} />
    <DocumentDetailsDialog open={Boolean(state.doc)} details={doc} loading={Boolean(state.doc) && !details} error={details?.error ?? null} onClose={() => update({ doc: null })}
      onRenew={renew} onRevert={askRevert} onRestore={askRestore} onBringBack={bringBackFromDetails} />
    <RecentlyRevertedDialog open={revertedOpen} entries={data.recentlyReverted} onClose={() => setRevertedOpen(false)} onBringBack={bringBackFromList} />
    <ConfirmVersionDialog variant={confirm?.variant ?? null} first={confirm?.first} second={confirm?.second} onCancel={() => setConfirm(null)} onConfirm={() => confirm?.run() ?? Promise.resolve(null)} />
  </section>;
}
