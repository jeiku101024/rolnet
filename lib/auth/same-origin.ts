import { headers } from "next/headers";

export async function assertSameOrigin() {
  const requestHeaders = await headers();
  const origin = requestHeaders.get("origin");
  const host = requestHeaders.get("host");
  if (origin && host && new URL(origin).host !== host) {
    throw new Error("Cross-origin mutation rejected");
  }
}
