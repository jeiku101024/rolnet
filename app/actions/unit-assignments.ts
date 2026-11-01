"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/auth/guards";
import { fleetToday } from "@/lib/dates/fleet-date";
import { saveUnitAssignmentSchema, upcomingAssignmentsSchema } from "@/lib/validation/unit-assignments";
import { ActionError } from "@/lib/actions/errors";
import { run } from "@/lib/actions/run";

/**
 * Feature 010: saves a Daily assignment card. Without expectedUpdatedAt it records a new assignment;
 * with it, it overwrites the one the card showed (FR-018). Owner and staff (FR-056). The database
 * enforces one driver per unit and one unit per driver per day, blocked dates, and the lock after a
 * remittance; "Driver already assigned today" comes back as code DRIVER_TAKEN (FR-016).
 */
export async function saveUnitAssignment(input: unknown) {
  return run("Could not save the assignment. Reload the page and try again.", async () => {
    await requirePermission("encode_operations");
    const value = saveUnitAssignmentSchema.parse(input);
    if (!value.driverId) throw new ActionError("DRIVER_REQUIRED", "Choose a driver first");
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.rpc("save_unit_assignment", {
      p_unit_id: value.unitId, p_service_date: value.serviceDate, p_driver_id: value.driverId, p_notes: value.notes, p_expected_updated_at: value.expectedUpdatedAt ?? null,
    }).single();
    if (error) throw error;
    const saved = data as { id: string; driver_id: string; notes: string | null; updated_at: string };
    revalidatePath("/units");
    revalidatePath("/remittances");
    return { id: saved.id, driverId: saved.driver_id, notes: saved.notes ?? "", updatedAt: saved.updated_at };
  }, { driverId: "driver", notes: "notes (500 characters at most)" });
}

/**
 * Feature 010: how many saved assignments a status change, archive, or driver deactivation would
 * release (dated today or later, without a remittance that day), so the screen can confirm first
 * (FR-030, FR-029b). The release itself happens in the database with the change.
 */
export async function upcomingAssignmentCount(input: unknown) {
  return run("Could not check the upcoming assignments. Reload the page and try again.", async () => {
    await requirePermission("manage_master_data");
    const value = upcomingAssignmentsSchema.parse(input);
    const supabase = await createSupabaseServerClient();
    let query = supabase.from("unit_assignments").select("unit_id, service_date").gte("service_date", fleetToday()).is("deleted_at", null);
    query = "unitId" in value ? query.eq("unit_id", value.unitId) : query.eq("driver_id", value.driverId);
    const { data, error } = await query;
    if (error) throw error;
    const rows = (data ?? []) as { unit_id: string; service_date: string }[];
    if (!rows.length) return { count: 0 };
    const { data: remitted, error: remittedError } = await supabase.from("remittances").select("unit_id, service_date").in("unit_id", [...new Set(rows.map((row) => row.unit_id))]).gte("service_date", fleetToday()).is("deleted_at", null);
    if (remittedError) throw remittedError;
    const locked = new Set((remitted ?? []).map((row) => `${row.unit_id}:${row.service_date}`));
    return { count: rows.filter((row) => !locked.has(`${row.unit_id}:${row.service_date}`)).length };
  });
}
