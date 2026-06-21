-- Merchant category learning: global dictionary of merchant → category overrides
-- learned from user corrections. Shared across all users (not per-household).

CREATE TABLE merchant_category_overrides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_normalized TEXT NOT NULL UNIQUE,
  category TEXT NOT NULL,
  source TEXT DEFAULT 'user_correction',
  times_confirmed INTEGER DEFAULT 1,
  last_corrected_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_merchant_overrides_normalized ON merchant_category_overrides(merchant_normalized);

ALTER TABLE merchant_category_overrides ENABLE ROW LEVEL SECURITY;

-- Global read: any authenticated user can look up overrides
CREATE POLICY "Authenticated users can read overrides" ON merchant_category_overrides
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- Global write: any authenticated user can insert overrides
CREATE POLICY "Authenticated users can insert overrides" ON merchant_category_overrides
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- Global update: any authenticated user can update overrides
CREATE POLICY "Authenticated users can update overrides" ON merchant_category_overrides
  FOR UPDATE USING (auth.uid() IS NOT NULL);

-- NOTE for future scaling: if the user base grows and override quality becomes
-- a risk, consider requiring 2-3 independent confirmations (from distinct user_ids)
-- before applying an override globally, instead of letting a single correction
-- overwrite immediately. Do NOT implement this yet.
