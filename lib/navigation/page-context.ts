export const pageContext = {
  dashboard: { title: "Dashboard", eyebrow: "Fleet overview", description: "A live read of the records that need attention and the work completed most recently." },
  units: { title: "Units", eyebrow: "Fleet register", description: "Keep every tricycle’s identity, status, and mileage easy to scan." },
  drivers: { title: "Drivers", eyebrow: "People and coverage", description: "Review driver identity, license status, and operating coverage." },
  remittances: { title: "Remittances", eyebrow: "Daily income", description: "Record what each operating unit brought back today." },
  expenses: { title: "Expenses", eyebrow: "Operating costs", description: "Keep unit costs visible, categorized, and reconciled." },
  maintenance: { title: "Maintenance", eyebrow: "Service register", description: "Encode parts and tires before a due item becomes downtime." },
  documents: { title: "Documents", eyebrow: "Compliance register", description: "Keep OR/CR, licenses, franchise, and insurance records current." },
  reports: { title: "Reports", eyebrow: "Monthly reporting", description: "Download a reconciled monthly summary for bookkeeping." },
  audit: { title: "Audit history", eyebrow: "Accountability", description: "Review who changed important fleet records and when." },
  staff: { title: "Staff accounts", eyebrow: "Owner settings", description: "Approve pending registrations and manage staff access." },
} as const;
