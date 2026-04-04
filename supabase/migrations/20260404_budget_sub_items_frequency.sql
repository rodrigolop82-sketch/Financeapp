-- Add frequency/periodicity to budget sub-items
-- Values: mensual (monthly), trimestral (quarterly), anual (yearly)
ALTER TABLE budget_sub_items
  ADD COLUMN IF NOT EXISTS frequency TEXT DEFAULT 'mensual'
  CHECK (frequency IN ('mensual', 'trimestral', 'anual'));
