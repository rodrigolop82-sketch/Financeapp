-- Add payment_method column to budget_sub_items
ALTER TABLE budget_sub_items
  ADD COLUMN IF NOT EXISTS payment_method TEXT DEFAULT 'efectivo'
  CHECK (payment_method IN ('efectivo', 'tarjeta', 'cheque', 'transferencia'));
