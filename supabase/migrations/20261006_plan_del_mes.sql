-- ══════════════════════════════════════════════
-- Rediseño Fase 5: Plan del mes
-- ══════════════════════════════════════════════
-- 1. Las partes (budget_sub_items) tienen día de vencimiento.
-- 2. Los ingresos son fijos o variables, con día de pago y la categoría
--    (bucket = 'income') con la que se registran.
-- 3. Un movimiento puede pertenecer a una parte de su categoría.

ALTER TABLE budget_sub_items ADD COLUMN IF NOT EXISTS expected_day SMALLINT CHECK (expected_day BETWEEN 1 AND 31);
ALTER TABLE income_entries  ADD COLUMN IF NOT EXISTS is_fixed BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE income_entries  ADD COLUMN IF NOT EXISTS expected_day SMALLINT CHECK (expected_day BETWEEN 1 AND 31);
ALTER TABLE income_entries  ADD COLUMN IF NOT EXISTS category_id UUID REFERENCES budget_categories(id) ON DELETE SET NULL; -- categoría bucket='income' con la que se registra
ALTER TABLE transactions    ADD COLUMN IF NOT EXISTS budget_sub_item_id UUID REFERENCES budget_sub_items(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_transactions_sub_item ON transactions(budget_sub_item_id);
