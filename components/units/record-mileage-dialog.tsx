"use client";

import { useState } from "react";
import { Gauge } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";
import { MileageForm } from "@/components/forms/mileage-form";

/**
 * "Record mileage" on a Units Daily view card (feature 011, FR-034a). Staff can't open the unit
 * page, so this is where they record odometer readings; the rules are the same.
 */
export function RecordMileageDialog({ unitId, unitLabel, currentMileage }: { unitId: string; unitLabel: string; currentMileage: number }) {
  const toast = useToast();
  const [open, setOpen] = useState(false);
  return <Dialog open={open} onOpenChange={setOpen}>
    <DialogTrigger render={<Button type="button" variant="ghost" className="w-fit" />}><Gauge aria-hidden="true" size={16} />Record mileage</DialogTrigger>
    <DialogContent title={`Record mileage · ${unitLabel}`}>
      {open ? <MileageForm unitId={unitId} currentMileage={currentMileage} heading={false} onSaved={() => { setOpen(false); toast("Mileage saved"); }} /> : null}
    </DialogContent>
  </Dialog>;
}
