import { ApiError } from "./errors";

export interface PageInput { page: number; pageSize: number; from: number; to: number; sort?: string; ascending: boolean; include: string[] }

export function parsePage(url: URL, allowedSorts: readonly string[], allowedIncludes: readonly string[] = []): PageInput {
  const page = Number(url.searchParams.get("page") ?? 1);
  const pageSize = Number(url.searchParams.get("pageSize") ?? 25);
  if (!Number.isInteger(page) || page < 1 || !Number.isInteger(pageSize) || pageSize < 1 || pageSize > 100) throw new ApiError(400, "INVALID_QUERY", "Use page 1 or higher and pageSize from 1 to 100.");
  const sort = url.searchParams.get("sort") ?? undefined;
  if (sort && !allowedSorts.includes(sort)) throw new ApiError(400, "INVALID_QUERY", "The requested sort field is not supported.");
  const direction = url.searchParams.get("direction") ?? "asc";
  if (!(["asc", "desc"] as const).includes(direction as "asc" | "desc")) throw new ApiError(400, "INVALID_QUERY", "direction must be asc or desc.");
  const include = (url.searchParams.get("include") ?? "").split(",").filter(Boolean);
  if (include.some((entry) => !allowedIncludes.includes(entry))) throw new ApiError(400, "INVALID_QUERY", "One or more requested relationships are not supported.");
  const from = (page - 1) * pageSize;
  return { page, pageSize, from, to: from + pageSize - 1, sort, ascending: direction === "asc", include };
}
