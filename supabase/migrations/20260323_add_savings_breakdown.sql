-- Add savings breakdown columns to financial_profiles
ALTER TABLE financial_profiles
  ADD COLUMN IF NOT EXISTS savings_cash NUMERIC(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS savings_investments NUMERIC(12,2) DEFAULT 0;

-- Migrate existing data: assume all savings are cash
UPDATE financial_profiles
  SET savings_cash = total_savings
  WHERE savings_cash = 0 AND total_savings > 0;
