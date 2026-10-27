import { apiBaseUrl } from "./fixtures";

export function apiRequest(path: string, init: RequestInit = {}) {
  return new Request(`${apiBaseUrl}${path}`, {
    ...init,
    headers: { "content-type": "application/json", origin: "http://localhost:3001", ...init.headers },
  });
}

export async function jsonBody(response: Response): Promise<Record<string, unknown>> {
  return (await response.json()) as Record<string, unknown>;
}
