-- Stores the individual income line items for each household.
-- Previously these lived in localStorage, causing data loss on refresh
-- and cross-device inconsistency.

CREATE TABLE IF NOT EXISTS income_entries (
  id           uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  household_id uuid        NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  source       text        NOT NULL DEFAULT '',
  member       text        NOT NULL DEFAULT 'Persona 1',
  amount       numeric     NOT NULL DEFAULT 0,
  frequency    text        NOT NULL DEFAULT 'mensual',
  created_at   timestamptz DEFAULT now()
);

ALTER TABLE income_entries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "household members can manage income_entries" ON income_entries;

CREATE POLICY "household members can manage income_entries" ON income_entries
  FOR ALL USING (
    household_id IN (
      SELECT id          FROM households        WHERE owner_id = auth.uid()
      UNION
      SELECT household_id FROM household_members WHERE user_id  = auth.uid()
    )
  );
