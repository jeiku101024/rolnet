import { permanentRedirect } from "next/navigation";

/** Feature 011: Maintenance merged into Expenses. Old links and bookmarks land on Expenses (FR-002). */
export default function MaintenancePage() {
  permanentRedirect("/expenses");
}
