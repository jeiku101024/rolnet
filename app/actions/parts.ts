"use server";
import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireApprovedSession, requirePermission } from "@/lib/auth/guards";
import { partSchema } from "@/lib/validation/maintenance";
export async function logPartReplacement(input:unknown){ await requireApprovedSession(); const v=partSchema.parse(input); const s=await createSupabaseServerClient(); const {data,error}=await s.from("part_replacements").insert({unit_id:v.unitId,part_name:v.partName,cost_centavos:v.costCentavos,replaced_on:v.replacedOn,replacement_mileage:v.replacementMileage??null,next_due_date:v.nextDueDate??null,next_due_mileage:v.nextDueMileage??null,notes:v.notes??null}).select().single(); if(error) throw new Error("Could not save part replacement"); revalidatePath("/maintenance"); return data; }
export async function softDeletePart(id:string){await requirePermission("manage_master_data"); const s=await createSupabaseServerClient(); const {data,error}=await s.rpc("soft_delete_record",{p_table:"part_replacements",p_id:id}); if(error||!data) throw new Error("Could not archive part replacement. Reload the page and try again."); revalidatePath("/maintenance");}
