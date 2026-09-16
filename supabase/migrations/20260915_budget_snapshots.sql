-- Budget snapshots: stores a copy of each household's budget per category
-- at the close of each month, so closed months can be evaluated against
-- the budget that was active at that time.

CREATE TABLE budget_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  category_id UUID NOT NULL REFERENCES budget_categories(id),
  month DATE NOT NULL,
  amount NUMERIC(12,2) NOT NULL,
  pace_mode TEXT NOT NULL CHECK (pace_mode IN ('linear', 'fixed')),
  expected_day SMALLINT CHECK (expected_day BETWEEN 1 AND 31),
  is_backfilled BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (household_id, category_id, month)
);

CREATE INDEX idx_budget_snapshots_household_month
  ON budget_snapshots (household_id, month);

-- RLS: same pattern as budget_categories
ALTER TABLE budget_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view budget snapshots" ON budget_snapshots
  FOR SELECT USING (household_id IN (SELECT get_my_household_ids()));

-- Write access only via service role or security definer functions.
-- No INSERT/UPDATE/DELETE policy for authenticated users.

-- Idempotent function: copies current budget for a household+month.
-- ON CONFLICT DO NOTHING so running twice is safe.
CREATE OR REPLACE FUNCTION snapshot_budget_month(
  p_household UUID,
  p_month DATE,
  p_backfilled BOOLEAN DEFAULT false
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  rows_inserted INTEGER;
BEGIN
  INSERT INTO budget_snapshots (household_id, category_id, month, amount, pace_mode, expected_day, is_backfilled)
  SELECT
    p_household,
    bc.id,
    p_month,
    bc.budgeted_amount,
    bc.pace_mode,
    bc.expected_day,
    p_backfilled
  FROM budget_categories bc
  WHERE bc.household_id = p_household
    AND bc.budgeted_amount > 0
  ON CONFLICT (household_id, category_id, month) DO NOTHING;

  GET DIAGNOSTICS rows_inserted = ROW_COUNT;
  RETURN rows_inserted;
END;
$$;
