-- Feature 016 (specs/016-sinking-fund-refinements), migration 1 of 2: the year-end close ledger type.
--
-- 'cycle_close' is the ledger row a distribution writes for each ticked participant: it takes their
-- savings (including the share just added) back to zero, so the totals stay derived from the ledger and
-- nothing is deleted or edited. It is a separate file because a new enum value cannot be used in the
-- transaction that adds it; migration 2 uses it.

alter type public.sf_transaction_type add value if not exists 'cycle_close';
