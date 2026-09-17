-- Tabla para guardar los detalles de ingresos por hogar
CREATE TABLE IF NOT EXISTS income_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  source TEXT NOT NULL DEFAULT '',
  member TEXT NOT NULL DEFAULT 'Persona 1',
  amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  frequency TEXT NOT NULL DEFAULT 'mensual'
    CHECK (frequency IN ('mensual', 'quincenal', 'semanal', 'anual')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE income_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "income_entries_select" ON income_entries
  FOR SELECT USING (
    household_id IN (
      SELECT id FROM households WHERE owner_id = auth.uid()
      UNION
      SELECT household_id FROM household_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "income_entries_insert" ON income_entries
  FOR INSERT WITH CHECK (
    household_id IN (
      SELECT id FROM households WHERE owner_id = auth.uid()
      UNION
      SELECT household_id FROM household_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "income_entries_update" ON income_entries
  FOR UPDATE USING (
    household_id IN (
      SELECT id FROM households WHERE owner_id = auth.uid()
      UNION
      SELECT household_id FROM household_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "income_entries_delete" ON income_entries
  FOR DELETE USING (
    household_id IN (
      SELECT id FROM households WHERE owner_id = auth.uid()
      UNION
      SELECT household_id FROM household_members WHERE user_id = auth.uid()
    )
  );
