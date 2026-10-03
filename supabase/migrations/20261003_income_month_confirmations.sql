-- Tracks whether a household has confirmed/reviewed its income for a
-- specific month, for the "Cierre de mes" checklist. income_entries is a
-- static per-household income profile (no date column), so it cannot tell
-- the checklist whether income was reviewed for *this* month vs. any past
-- month. This table adds that month-scoped signal, mirroring the existing
-- source_monthly_status pattern used for bank/card sources.

CREATE TABLE IF NOT EXISTS income_month_confirmations (
  id           uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  household_id uuid        NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  year_month   text        NOT NULL,
  confirmed    boolean     NOT NULL DEFAULT true,
  confirmed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (household_id, year_month)
);

CREATE INDEX IF NOT EXISTS idx_income_month_confirmations_household_month
  ON income_month_confirmations(household_id, year_month);

ALTER TABLE income_month_confirmations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "household members can manage income_month_confirmations" ON income_month_confirmations;

CREATE POLICY "household members can manage income_month_confirmations" ON income_month_confirmations
  FOR ALL USING (
    household_id IN (
      SELECT id           FROM households        WHERE owner_id = auth.uid()
      UNION
      SELECT household_id FROM household_members WHERE user_id  = auth.uid()
    )
  );
