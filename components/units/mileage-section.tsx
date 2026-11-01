import { SectionHeading } from "@/components/ui/page-header";
import { PagedList, type ListView } from "@/components/ui/paged-list";
import { MileageForm } from "@/components/forms/mileage-form";
import { formatShortDate } from "@/lib/dates/fleet-date";

type Reading = { id: string; reading_date: string; mileage: number; notes: string | null };

/** Mileage on the unit page (feature 011, FR-034a): record a reading and see them newest first. */
export function MileageSection({ unitId, currentMileage, list, readings }: { unitId: string; currentMileage: number; list: ListView; readings: Reading[] }) {
  return <div>
    <SectionHeading title="Mileage" description="Newest reading first. Staff record mileage from the Units Daily view." />
    <div className="mt-4 grid gap-6">
      <MileageForm unitId={unitId} currentMileage={currentMileage} />
      <PagedList list={list} hasRows={readings.length > 0} empty={<p className="py-6 text-body-sm text-muted">No mileage readings yet.</p>}>
        <ul className="divide-y divide-rule">{readings.map((reading) => <li key={reading.id} className="flex flex-wrap justify-between gap-3 py-3 text-body-sm">
          <span className="font-data">{formatShortDate(reading.reading_date)}, {reading.reading_date.slice(0, 4)}</span>
          <span className="font-data font-semibold">{reading.mileage.toLocaleString()} km{reading.notes ? <span className="font-sans font-normal text-muted"> · {reading.notes}</span> : null}</span>
        </li>)}</ul>
      </PagedList>
    </div>
  </div>;
}
