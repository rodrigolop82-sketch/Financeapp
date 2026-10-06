-- ══════════════════════════════════════════════
-- Metas compartidas con aportes por persona
-- ══════════════════════════════════════════════
-- financial_goals era solo del usuario. Ahora:
-- · household_id y shared (por defecto true): una meta compartida la ven y
--   la mueven los dos del hogar; una personal, solo quien la creó.
-- · goal_contributions.user_id = quien aporta; created_by = quien registra
--   (pueden ser distintos: "Aporta Luis", lo registra Ana).

ALTER TABLE financial_goals ADD COLUMN IF NOT EXISTS household_id UUID REFERENCES households(id) ON DELETE SET NULL;
ALTER TABLE financial_goals ADD COLUMN IF NOT EXISTS shared BOOLEAN NOT NULL DEFAULT true;

-- Hogar de cada meta: el que tiene como miembro (si se unió) o el suyo.
UPDATE financial_goals g SET household_id = COALESCE(
  (SELECT hm.household_id FROM household_members hm WHERE hm.user_id = g.user_id AND hm.role = 'member' LIMIT 1),
  (SELECT h.id FROM households h WHERE h.owner_id = g.user_id ORDER BY h.created_at LIMIT 1)
)
WHERE g.household_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_financial_goals_household ON financial_goals(household_id) WHERE shared;

ALTER TABLE goal_contributions ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL DEFAULT auth.uid();
UPDATE goal_contributions SET created_by = user_id WHERE created_by IS NULL;

-- ── RLS ──
DROP POLICY IF EXISTS "own goals" ON financial_goals;
DROP POLICY IF EXISTS "Goals: view own or shared" ON financial_goals;
CREATE POLICY "Goals: view own or shared" ON financial_goals
  FOR SELECT USING (
    user_id = auth.uid()
    OR (shared AND household_id IN (SELECT get_my_household_ids()))
  );
DROP POLICY IF EXISTS "Goals: insert own" ON financial_goals;
CREATE POLICY "Goals: insert own" ON financial_goals
  FOR INSERT WITH CHECK (
    user_id = auth.uid()
    AND (household_id IS NULL OR household_id IN (SELECT get_my_writable_household_ids()))
  );
DROP POLICY IF EXISTS "Goals: change own or shared" ON financial_goals;
CREATE POLICY "Goals: change own or shared" ON financial_goals
  FOR UPDATE USING (
    (user_id = auth.uid() AND (household_id IS NULL OR household_id IN (SELECT get_my_writable_household_ids())))
    OR (shared AND household_id IN (SELECT get_my_writable_household_ids()))
  );
DROP POLICY IF EXISTS "Goals: delete own or shared" ON financial_goals;
CREATE POLICY "Goals: delete own or shared" ON financial_goals
  FOR DELETE USING (
    (user_id = auth.uid() AND (household_id IS NULL OR household_id IN (SELECT get_my_writable_household_ids())))
    OR (shared AND household_id IN (SELECT get_my_writable_household_ids()))
  );

DROP POLICY IF EXISTS "own contributions" ON goal_contributions;
DROP POLICY IF EXISTS "Contributions: view" ON goal_contributions;
CREATE POLICY "Contributions: view" ON goal_contributions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM financial_goals g
      WHERE g.id = goal_contributions.goal_id
        AND (g.user_id = auth.uid() OR (g.shared AND g.household_id IN (SELECT get_my_household_ids())))
    )
  );
DROP POLICY IF EXISTS "Contributions: write" ON goal_contributions;
CREATE POLICY "Contributions: write" ON goal_contributions
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM financial_goals g
      WHERE g.id = goal_contributions.goal_id
        AND (
          (g.user_id = auth.uid() AND (g.household_id IS NULL OR g.household_id IN (SELECT get_my_writable_household_ids())))
          OR (g.shared AND g.household_id IN (SELECT get_my_writable_household_ids()))
        )
    )
  )
  WITH CHECK (
    -- Quien aporta tiene que ser del hogar de la meta (o uno mismo).
    (user_id = auth.uid() OR user_id IN (
      SELECT hm.user_id FROM household_members hm
      JOIN financial_goals g ON g.household_id = hm.household_id
      WHERE g.id = goal_contributions.goal_id
    ))
    AND EXISTS (
      SELECT 1 FROM financial_goals g
      WHERE g.id = goal_contributions.goal_id
        AND (
          (g.user_id = auth.uid() AND (g.household_id IS NULL OR g.household_id IN (SELECT get_my_writable_household_ids())))
          OR (g.shared AND g.household_id IN (SELECT get_my_writable_household_ids()))
        )
    )
  );
