-- ══════════════════════════════════════════════
-- Rediseño Fase 6: Inicio de mes
-- ══════════════════════════════════════════════
-- month_starts: el hogar hizo su inicio de mes ('YYYY-MM').
-- month_start_items: lo que eligió en la hoja "Empieza {mes}".
--   kind = 'expense' → counted = apartado (hoja fija: categoría o parte)
--   kind = 'income'  → counted = cuento con él (ingreso fijo)
-- NULLS NOT DISTINCT: sin él, las filas con columnas NULL nunca chocan en
-- el UNIQUE y el upsert duplicaría elecciones.

CREATE TABLE IF NOT EXISTS month_starts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  year_month TEXT NOT NULL,                 -- 'YYYY-MM'
  completed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  remind_monthly BOOLEAN NOT NULL DEFAULT true,
  UNIQUE (household_id, year_month)
);

CREATE TABLE IF NOT EXISTS month_start_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  year_month TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('expense','income')),
  category_id UUID REFERENCES budget_categories(id) ON DELETE CASCADE,
  sub_item_id UUID REFERENCES budget_sub_items(id) ON DELETE CASCADE,
  income_entry_id UUID REFERENCES income_entries(id) ON DELETE CASCADE,
  counted BOOLEAN NOT NULL,                 -- expense: apartado · income: cuento con él
  UNIQUE NULLS NOT DISTINCT (household_id, year_month, kind, category_id, sub_item_id, income_entry_id)
);

CREATE INDEX IF NOT EXISTS idx_month_start_items_household_month
  ON month_start_items(household_id, year_month);

ALTER TABLE month_starts ENABLE ROW LEVEL SECURITY;
ALTER TABLE month_start_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "household members can manage month_starts" ON month_starts;
CREATE POLICY "household members can manage month_starts" ON month_starts
  FOR ALL USING (
    household_id IN (
      SELECT id           FROM households        WHERE owner_id = auth.uid()
      UNION
      SELECT household_id FROM household_members WHERE user_id  = auth.uid()
    )
  );

DROP POLICY IF EXISTS "household members can manage month_start_items" ON month_start_items;
CREATE POLICY "household members can manage month_start_items" ON month_start_items
  FOR ALL USING (
    household_id IN (
      SELECT id           FROM households        WHERE owner_id = auth.uid()
      UNION
      SELECT household_id FROM household_members WHERE user_id  = auth.uid()
    )
  );

-- Recordatorio del día 1 ("Empieza {mes}") en el log de notificaciones.
ALTER TABLE notification_log DROP CONSTRAINT IF EXISTS notification_log_type_check;
ALTER TABLE notification_log
  ADD CONSTRAINT notification_log_type_check
  CHECK (type IN ('inactivity', 'month_close', 'month_start'));
