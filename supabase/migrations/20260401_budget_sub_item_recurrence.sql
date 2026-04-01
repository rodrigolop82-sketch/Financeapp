-- Add recurrence column to budget_sub_items
ALTER TABLE budget_sub_items
  ADD COLUMN recurrence TEXT DEFAULT 'mensual'
  CHECK (recurrence IN ('mensual', 'trimestral', 'semestral', 'anual', 'unica'));
