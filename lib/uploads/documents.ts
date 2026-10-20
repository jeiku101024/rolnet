import { createSupabaseBrowserClient } from "@/lib/supabase/client";
export async function uploadDocument(file:File,path:string){const s=createSupabaseBrowserClient();const {error}=await s.storage.from("documents").upload(path,file,{contentType:file.type,upsert:false});if(error)throw new Error("Document upload failed");return {sizeBytes:file.size};}
