"use server";
import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireApprovedSession, requirePermission } from "@/lib/auth/guards";
import { tireSchema } from "@/lib/validation/maintenance";
export async function installTire(input:unknown){await requireApprovedSession(); const v=tireSchema.parse(input); const s=await createSupabaseServerClient(); const {data:old}=await s.from("tire_installations").select("id").eq("unit_id",v.unitId).eq("position",v.position).is("replaced_by_id",null).is("deleted_at",null).maybeSingle(); // A replacement goes through replace_tire_installation(), which retires the current tire and inserts the new one in one transaction.
const {data:newTire,error}=old
  ? await s.rpc("replace_tire_installation",{p_current_id:old.id,p_replacement:{brand:v.brand,installed_on:v.installedOn,installed_mileage:v.installedMileage??null,cost_centavos:v.costCentavos,next_due_date:v.nextDueDate??null,next_due_mileage:v.nextDueMileage??null}})
  : await s.from("tire_installations").insert({unit_id:v.unitId,position:v.position,brand:v.brand,installed_on:v.installedOn,installed_mileage:v.installedMileage??null,cost_centavos:v.costCentavos,next_due_date:v.nextDueDate??null,next_due_mileage:v.nextDueMileage??null,replaced_by_id:null}).select().single();
if(error||!newTire) throw new Error("Could not install tire"); revalidatePath("/maintenance"); return newTire;}
export async function softDeleteTire(id:string){await requirePermission("manage_master_data"); const s=await createSupabaseServerClient(); const {data,error}=await s.rpc("soft_delete_record",{p_table:"tire_installations",p_id:id}); if(error||!data) throw new Error("Could not archive tire. Reload the page and try again."); revalidatePath("/maintenance");}
