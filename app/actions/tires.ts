"use server";
import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireApprovedSession, requirePermission } from "@/lib/auth/guards";
import { tireSchema } from "@/lib/validation/maintenance";
export async function installTire(input:unknown){await requireApprovedSession(); const v=tireSchema.parse(input); const s=await createSupabaseServerClient(); const {data:old}=await s.from("tire_installations").select("id").eq("unit_id",v.unitId).eq("position",v.position).is("replaced_by_id",null).is("deleted_at",null).maybeSingle(); const {data:newTire,error}=await s.from("tire_installations").insert({unit_id:v.unitId,position:v.position,brand:v.brand,installed_on:v.installedOn,installed_mileage:v.installedMileage??null,cost_centavos:v.costCentavos,next_due_date:v.nextDueDate??null,next_due_mileage:v.nextDueMileage??null,replaced_by_id:null}).select().single(); if(error) throw new Error("Could not install tire"); if(old) await s.from("tire_installations").update({replaced_by_id:newTire.id}).eq("id",old.id); revalidatePath("/maintenance"); return newTire;}
export async function softDeleteTire(id:string){await requirePermission("manage_master_data"); const s=await createSupabaseServerClient(); await s.from("tire_installations").update({deleted_at:new Date().toISOString()}).eq("id",id); revalidatePath("/maintenance");}
