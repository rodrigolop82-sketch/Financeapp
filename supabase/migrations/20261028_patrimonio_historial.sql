-- ══════════════════════════════════════════════
-- F3 Etapa B: historial editable del patrimonio
-- ══════════════════════════════════════════════
-- · networth_manual_months: meses que la persona escribe a mano en "Editar
--   historial" (correcciones o meses de antes de usar Zafi), con el total
--   de lo que tenía y lo que debía. Uno por usuario y mes.
-- · La gráfica de evolución usa el dato manual del mes si existe; si no,
--   el cálculo actual (source_balance_snapshots + debt_balance_snapshots),
--   que no se toca.
-- · Es por usuario (igual que "Solo tú ves estos datos"): RLS user_id =
--   auth.uid(), como notification_preferences y statement_imports.
-- · Solo aditiva: tabla nueva, sin cambios en tablas existentes.

CREATE TABLE IF NOT EXISTS networth_manual_months (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL DEFAULT auth.uid() REFERENCES users(id) ON DELETE CASCADE,
  month TEXT NOT NULL CHECK (month ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
  assets NUMERIC(14,2) NOT NULL CHECK (assets >= 0),
  liabilities NUMERIC(14,2) NOT NULL CHECK (liabilities >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, month)
);
CREATE INDEX IF NOT EXISTS idx_networth_manual_user ON networth_manual_months(user_id, month);

ALTER TABLE networth_manual_months ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view own manual net worth" ON networth_manual_months;
CREATE POLICY "Users can view own manual net worth" ON networth_manual_months
  FOR SELECT USING (user_id = auth.uid());
DROP POLICY IF EXISTS "Users can manage own manual net worth" ON networth_manual_months;
CREATE POLICY "Users can manage own manual net worth" ON networth_manual_months
  FOR ALL USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
