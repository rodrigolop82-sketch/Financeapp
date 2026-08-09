ALTER TABLE transactions
  ADD COLUMN IF NOT EXISTS original_amount   NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS original_currency TEXT;
