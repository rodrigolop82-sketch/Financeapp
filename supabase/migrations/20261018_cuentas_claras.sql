-- ══════════════════════════════════════════════
-- Este mes en casa: cómo reparten, ingresos por persona y saldos
-- ══════════════════════════════════════════════
-- · households.split_mode: 'pool' (bolsa común), 'half' (50/50) o
--   'income' (según lo que gana cada uno).
-- · household_members.monthly_income: para 'income'.
-- · settlements: "Luis le pasó Q X a Ana" en un mes.

ALTER TABLE households ADD COLUMN IF NOT EXISTS split_mode TEXT NOT NULL DEFAULT 'pool';
ALTER TABLE households DROP CONSTRAINT IF EXISTS households_split_mode_check;
ALTER TABLE households ADD CONSTRAINT households_split_mode_check CHECK (split_mode IN ('pool', 'half', 'income'));

ALTER TABLE household_members ADD COLUMN IF NOT EXISTS monthly_income NUMERIC(12,2);

CREATE TABLE IF NOT EXISTS settlements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  month DATE NOT NULL,
  from_user UUID REFERENCES users(id) ON DELETE SET NULL,
  to_user UUID REFERENCES users(id) ON DELETE SET NULL,
  amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  created_by UUID REFERENCES users(id) ON DELETE SET NULL DEFAULT auth.uid(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_settlements_household_month ON settlements(household_id, month);

ALTER TABLE settlements ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Members can view settlements" ON settlements;
CREATE POLICY "Members can view settlements" ON settlements
  FOR SELECT USING (household_id IN (SELECT get_my_household_ids()));
DROP POLICY IF EXISTS "Writers can add settlements" ON settlements;
CREATE POLICY "Writers can add settlements" ON settlements
  FOR INSERT WITH CHECK (household_id IN (SELECT get_my_writable_household_ids()));
DROP POLICY IF EXISTS "Writers can delete settlements" ON settlements;
CREATE POLICY "Writers can delete settlements" ON settlements
  FOR DELETE USING (household_id IN (SELECT get_my_writable_household_ids()));
