"use client";

import { useState, type FormEvent } from "react";
import { saveFundSettings } from "@/app/actions/sinking-fund";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { ValidationSummary } from "@/components/ui/form-field";
import { useSfSubmit } from "@/components/sinking-fund/form-kit";
import { formatPesos } from "@/lib/money/centavos";
import { sfMessages } from "@/lib/sinking-fund/messages";
import { SF_INTEREST_RATE_BP, SF_LOAN_STEP_CENTAVOS, SF_LOAN_TERM_MONTHS } from "@/lib/sinking-fund/rules";
import type { SfPrefill } from "@/lib/sinking-fund/types";

/** "Fund settings" (spec section 10), owner only. The default only pre-fills the payment form and is used for payments recorded by others. */
export function FundSettingsDialog({ prefill, open, onOpenChange }: { prefill: SfPrefill; open: boolean; onOpenChange: (open: boolean) => void }) {
  const [value, setValue] = useState<SfPrefill>(prefill);
  const form = useSfSubmit(() => onOpenChange(false));

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    await form.submit(() => saveFundSettings({ prefill: value }), () => sfMessages.settingsSaved);
  }

  const options: { value: SfPrefill; label: string; hint: string }[] = [
    { value: "first", label: "Take interest first", hint: "Pre-fills the largest allowed interest part." },
    { value: "last", label: "Take interest last", hint: "Pre-fills the smallest allowed interest part (₱0.00 until the principal is repaid)." },
  ];
  return <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent title="Fund settings">
      <form noValidate className="grid gap-4" onSubmit={onSubmit}>
        <fieldset className="grid gap-2">
          <legend className="text-sm font-medium text-ink">Default interest part for new payments</legend>
          {options.map((option) => <label key={option.value} className="touch-target flex items-start gap-3 rounded-md border border-control-border p-3 text-body-sm has-checked:border-brand has-checked:bg-brand-soft">
            <input type="radio" name="sf-prefill" className="mt-1 size-4" checked={value === option.value} onChange={() => setValue(option.value)} />
            <span><span className="block font-semibold">{option.label}</span><span className="text-muted">{option.hint}</span></span>
          </label>)}
          <p className="text-body-sm text-muted">This only pre-fills the payment form and is used for payments recorded by others. You decide the interest part of each payment, and can change it later.</p>
        </fieldset>
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 rounded-md bg-canvas p-3 text-body-sm">
          <dt className="text-muted">Interest rate</dt><dd className="text-right">{SF_INTEREST_RATE_BP / 100}%</dd>
          <dt className="text-muted">Loan steps</dt><dd className="text-right">{formatPesos(SF_LOAN_STEP_CENTAVOS).replace(".00", "")}</dd>
          <dt className="text-muted">Loan term</dt><dd className="text-right">{SF_LOAN_TERM_MONTHS} month</dd>
        </dl>
        <ValidationSummary message={form.failure} />
        <Button type="submit" disabled={form.pending}>{form.pending ? "Saving…" : "Save settings"}</Button>
      </form>
    </DialogContent>
  </Dialog>;
}
