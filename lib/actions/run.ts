import { unstable_rethrow } from "next/navigation";
import { runAction } from "@/lib/actions/errors";

/** Server Action wrapper: returns an ActionResult and lets redirect()/notFound() through. */
export function run<T>(fallback: string, body: () => Promise<T>, labels?: Record<string, string>) {
  return runAction({ fallback, labels, rethrow: unstable_rethrow }, body);
}
