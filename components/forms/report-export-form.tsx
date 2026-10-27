"use client";

import { FormPanel } from "@/components/ui/form-panel";
import { Button } from "@/components/ui/button";
import { FormField, Input, Select } from "@/components/ui/form-field";

export function ReportExportForm() {
  return <FormPanel className=" space-y-5" action="/api/reports/monthly" method="get">
    <FormField label="Month" required><Input required name="month" type="month" /></FormField>
    <FormField label="Scope"><Select name="scope" defaultValue="fleet"><option value="fleet">Whole fleet</option><option value="unit">One unit</option></Select></FormField>
    <Button type="submit">Download CSV</Button>
  </FormPanel>;
}
