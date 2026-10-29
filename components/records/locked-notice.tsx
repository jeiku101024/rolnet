import { Feedback } from "@/components/ui/feedback";
import { lockedMessage, type DriverStatus, type UnitStatus } from "@/lib/status/record-status";

/** Read-only notice on a locked unit or driver page, with the step that unlocks it (feature 005). */
export function LockedNotice(props: { kind: "unit"; status: UnitStatus } | { kind: "driver"; status: DriverStatus }) {
  const message = props.kind === "unit" ? lockedMessage("unit", props.status) : lockedMessage("driver", props.status);
  return <Feedback type="warning" message={message} />;
}
