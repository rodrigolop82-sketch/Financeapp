-- ══════════════════════════════════════════════
-- Buscar duplicados: parejas que el usuario marcó como "Son distintos"
-- ══════════════════════════════════════════════
-- Una fila por pareja de movimientos que NO son el mismo cargo, para que
-- "Buscar duplicados" no vuelva a proponerla. Los ids van ordenados
-- (tx_a_id < tx_b_id) para que la pareja no se repita al revés. Si se borra
-- cualquiera de los dos movimientos, la fila se va con él.

CREATE TABLE IF NOT EXISTS duplicate_dismissals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  tx_a_id UUID NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
  tx_b_id UUID NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL DEFAULT auth.uid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (tx_a_id < tx_b_id),
  UNIQUE (tx_a_id, tx_b_id)
);
CREATE INDEX IF NOT EXISTS idx_duplicate_dismissals_household ON duplicate_dismissals(household_id);

ALTER TABLE duplicate_dismissals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members can view duplicate dismissals" ON duplicate_dismissals;
CREATE POLICY "Members can view duplicate dismissals" ON duplicate_dismissals
  FOR SELECT USING (household_id IN (SELECT get_my_household_ids()));

DROP POLICY IF EXISTS "Writers can insert duplicate dismissals" ON duplicate_dismissals;
CREATE POLICY "Writers can insert duplicate dismissals" ON duplicate_dismissals
  FOR INSERT WITH CHECK (household_id IN (SELECT get_my_writable_household_ids()));

DROP POLICY IF EXISTS "Writers can delete duplicate dismissals" ON duplicate_dismissals;
CREATE POLICY "Writers can delete duplicate dismissals" ON duplicate_dismissals
  FOR DELETE USING (household_id IN (SELECT get_my_writable_household_ids()));

-- Solo lo necesario: ver, descartar una pareja y quitar ese descarte.
REVOKE ALL ON duplicate_dismissals FROM anon, authenticated;
GRANT SELECT, DELETE ON duplicate_dismissals TO authenticated;
GRANT INSERT (household_id, tx_a_id, tx_b_id) ON duplicate_dismissals TO authenticated;
