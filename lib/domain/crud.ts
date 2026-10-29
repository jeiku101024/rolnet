import "server-only";
import { ApiError } from "@/lib/api/errors";
import { parsePage } from "@/lib/api/pagination";
import { readIdempotencyKey, readJsonObject } from "@/lib/api/request";
import { requireIfMatch } from "@/lib/api/concurrency";
import { apiContext } from "./context";
import { resources, type ResourceConfig } from "./resource-config";

type Row = Record<string, unknown>;

const camelToSnake = (key: string) => key.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
const snakeToCamel = (key: string) => key.replace(/_([a-z])/g, (_, letter: string) => letter.toUpperCase());

function dto(row: Row, config: ResourceConfig) {
  const hidden = new Set(config.hiddenFields ?? []);
  return Object.fromEntries(Object.entries(row).filter(([key]) => !hidden.has(key)).map(([key, value]) => [snakeToCamel(key), value]));
}

function input(body: Row, allowed: readonly string[]) {
  const allowedSet = new Set(allowed);
  const result: Row = {};
  for (const [key, value] of Object.entries(body)) {
    const dbKey = camelToSnake(key);
    if (!allowedSet.has(dbKey)) throw new ApiError(400, "IMMUTABLE_FIELD", `${key} cannot be changed.`);
    result[dbKey] = value;
  }
  return result;
}

function resource(name: string) {
  const found = resources[name];
  if (!found) throw new ApiError(404, "NOT_FOUND", "API resource not found.");
  return found;
}

async function contextForRead(config: ResourceConfig) { return apiContext(config.readPermission); }
async function contextForWrite(config: ResourceConfig) {
  const context = await apiContext(config.writePermission);
  if (config.ownerWrite && context.role !== "owner") throw new ApiError(403, "FORBIDDEN", "Owner access is required.");
  if (config.readOnly) throw new ApiError(405, "FORBIDDEN", "This resource is read only.");
  return context;
}

export async function listRows(name: string, url: URL, forced: Row = {}) {
  const config = resource(name);
  const { supabase } = await contextForRead(config);
  const page = parsePage(url, config.sortFields, config.includeFields);
  let query = supabase.from(config.table).select("*", { count: "exact" });
  if (config.table !== "audit_events") query = query.is("deleted_at", null);
  for (const field of config.filterFields) {
    const value = url.searchParams.get(snakeToCamel(field));
    if (value !== null) query = query.eq(field, value);
  }
  for (const [field, value] of Object.entries(forced)) query = query.eq(field, value);
  const sort = page.sort ?? config.defaultSort;
  query = query.order(sort, { ascending: page.sort ? page.ascending : (config.defaultAscending ?? true) });
  if (sort !== (config.idColumn ?? "id")) query = query.order(config.idColumn ?? "id", { ascending: true });
  const { data, error, count } = await query.range(page.from, page.to);
  if (error) throw error;
  return { data: (data ?? []).map((row) => dto(row as Row, config)), meta: { page: page.page, pageSize: page.pageSize, total: count ?? 0 } };
}

export async function getRow(name: string, id: string) {
  const config = resource(name);
  const { supabase } = await contextForRead(config);
  const idColumn = config.idColumn ?? "id";
  let query = supabase.from(config.table).select("*").eq(idColumn, config.singleton ? true : id);
  if (config.table !== "audit_events") query = query.is("deleted_at", null);
  const { data, error } = await query.maybeSingle();
  if (error) throw error;
  if (!data) throw new ApiError(404, "NOT_FOUND", "Record not found.");
  return { data: dto(data as Row, config), updatedAt: (data as Row).updated_at as string | undefined };
}

export async function createRow(name: string, request: Request, forced: Row = {}) {
  const config = resource(name);
  const { supabase } = await contextForWrite(config);
  if (config.singleton || !config.createFields.length) throw new ApiError(405, "FORBIDDEN", "Creation is not supported for this resource.");
  const values = { ...input(await readJsonObject(request), config.createFields), ...forced };
  const key = readIdempotencyKey(request, config.idempotent);
  if (key) values.idempotency_key = key;
  const { data, error } = await supabase.from(config.table).insert(values).select().single();
  if (error) {
    if (key && error.code === "23505") {
      const existing = await supabase.from(config.table).select("*").eq("idempotency_key", key).maybeSingle();
      if (existing.data) return dto(existing.data as Row, config);
    }
    throw error;
  }
  return dto(data as Row, config);
}

export async function updateRow(name: string, id: string, request: Request) {
  const config = resource(name);
  const { supabase } = await contextForWrite(config);
  if (!config.updateFields.length) throw new ApiError(405, "FORBIDDEN", "Updates are not supported for this resource.");
  const expected = requireIfMatch(request);
  const values = input(await readJsonObject(request), config.updateFields);
  const idColumn = config.idColumn ?? "id";
  const query = supabase.from(config.table).update(values).eq(idColumn, config.singleton ? true : id).eq("updated_at", expected).is("deleted_at", null);
  const { data, error } = await query.select().maybeSingle();
  if (error) throw error;
  if (!data) {
    const current = await getRow(name, id);
    throw new ApiError(409, "STALE_RECORD", "This record changed. Review the latest values and try again.", undefined, current.data);
  }
  return { data: dto(data as Row, config), updatedAt: (data as Row).updated_at as string };
}

export async function softDeleteRow(name: string, id: string, request: Request) {
  const config = resource(name);
  const { supabase, role, userId } = await contextForWrite(config);
  if (role !== "owner" || !config.softDelete) throw new ApiError(403, "FORBIDDEN", "Owner deletion is not supported for this resource.");
  const expected = requireIfMatch(request);
  // Documents have an owner-only SELECT policy, so the owner updates them directly. Every other
  // table hides deleted rows from SELECT, so deletion goes through the owner-checked
  // soft_delete_record() function (supabase/migrations/20261029000900_owner_soft_delete_path.sql).
  const { data, error } = config.table === "documents"
    ? await supabase.from(config.table).update({ deleted_at: new Date().toISOString(), deleted_by: userId }).eq(config.idColumn ?? "id", id).eq("updated_at", expected).is("deleted_at", null).select().maybeSingle()
    : await supabase.rpc("soft_delete_record", { p_table: config.table, p_id: id, p_expected_updated_at: expected });
  if (error) throw error;
  if (!data) throw new ApiError(409, "STALE_RECORD", "This record changed or was already removed.");
  return dto(data as Row, config);
}

export async function restoreRow(name: string, id: string, request: Request) {
  const config = resource(name);
  const { supabase, role } = await contextForWrite(config);
  if (role !== "owner" || !config.softDelete) throw new ApiError(403, "FORBIDDEN", "Owner restoration is not supported for this resource.");
  const expected = requireIfMatch(request);
  const { data, error } = config.table === "documents"
    ? await supabase.from(config.table).update({ deleted_at: null, deleted_by: null }).eq(config.idColumn ?? "id", id).eq("updated_at", expected).not("deleted_at", "is", null).select().maybeSingle()
    : await supabase.rpc("restore_record", { p_table: config.table, p_id: id, p_expected_updated_at: expected });
  if (error) throw error;
  if (!data) throw new ApiError(409, "RESTORE_CONFLICT", "This record changed or cannot be restored.");
  return { data: dto(data as Row, config), updatedAt: (data as Row).updated_at as string };
}
