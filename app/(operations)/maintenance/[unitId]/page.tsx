import { permanentRedirect } from "next/navigation";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Feature 011: a unit's old maintenance page now opens Expenses filtered to that unit (FR-002). */
export default async function UnitMaintenancePage({ params }: { params: Promise<{ unitId: string }> }) {
  const { unitId } = await params;
  permanentRedirect(uuidPattern.test(unitId) ? `/expenses?unit=${unitId}` : "/expenses");
}
