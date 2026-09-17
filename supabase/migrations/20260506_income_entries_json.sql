-- Store income entries as JSONB in financial_profiles
-- Previously these were only saved in localStorage, causing data loss on app reload

ALTER TABLE financial_profiles
  ADD COLUMN IF NOT EXISTS income_entries JSONB DEFAULT '[]'::jsonb;
