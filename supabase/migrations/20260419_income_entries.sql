-- income_entries table for per-source income breakdown
CREATE TABLE IF NOT EXISTS income_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  source TEXT NOT NULL DEFAULT '',
  member TEXT NOT NULL DEFAULT 'Persona 1',
  amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
  frequency TEXT NOT NULL DEFAULT 'mensual' CHECK (frequency IN ('mensual', 'quincenal', 'semanal', 'anual')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_income_entries_household ON income_entries(household_id);

ALTER TABLE income_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "household members can manage income_entries"
  ON income_entries
  FOR ALL
  USING (
    household_id IN (
      SELECT id FROM households WHERE owner_id = auth.uid()
      UNION
      SELECT household_id FROM household_members WHERE user_id = auth.uid()
    )
  );
