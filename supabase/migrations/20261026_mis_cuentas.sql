-- ══════════════════════════════════════════════
-- Mis cuentas: une "Mis bancos" (user_sources) con Mis Fuentes
-- ══════════════════════════════════════════════
-- · financial_sources pasa a ser la única lista de cuentas. El saldo es
--   opcional (sin saldo no cuenta en el patrimonio).
-- · Cada cuenta es personal (owner_user_id) o compartida con el hogar.
-- · Las tarjetas de crédito no llevan saldo propio: se vinculan a su deuda
--   de Plan › Deudas (debt_id), que es la que cuenta en el patrimonio.
-- · source_statement_status reemplaza a source_monthly_status (cierre de mes).
-- · user_sources y source_monthly_status NO se borran (respaldo).

ALTER TABLE financial_sources ALTER COLUMN current_balance DROP NOT NULL;
ALTER TABLE financial_sources ALTER COLUMN balance_updated_at DROP NOT NULL;
ALTER TABLE financial_sources ALTER COLUMN balance_updated_at DROP DEFAULT;
ALTER TABLE financial_sources ADD COLUMN IF NOT EXISTS owner_user_id UUID REFERENCES users(id) ON DELETE SET NULL DEFAULT auth.uid();
ALTER TABLE financial_sources ADD COLUMN IF NOT EXISTS shared BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE financial_sources ADD COLUMN IF NOT EXISTS detection_method TEXT NOT NULL DEFAULT 'manual';
ALTER TABLE financial_sources ADD COLUMN IF NOT EXISTS tracks_statements BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE financial_sources ADD COLUMN IF NOT EXISTS last4 TEXT;
ALTER TABLE financial_sources ADD COLUMN IF NOT EXISTS debt_id UUID REFERENCES debts(id) ON DELETE SET NULL;
ALTER TABLE financial_sources ADD COLUMN IF NOT EXISTS legacy_user_source_id UUID UNIQUE;

DO $$
BEGIN
  ALTER TABLE financial_sources DROP CONSTRAINT IF EXISTS financial_sources_detection_method_check;
  ALTER TABLE financial_sources ADD CONSTRAINT financial_sources_detection_method_check CHECK (detection_method IN ('auto', 'manual'));
  ALTER TABLE financial_sources DROP CONSTRAINT IF EXISTS financial_sources_last4_check;
  ALTER TABLE financial_sources ADD CONSTRAINT financial_sources_last4_check CHECK (last4 IS NULL OR last4 ~ '^[0-9]{4}$');
  -- Saldo y fecha van juntos; las tarjetas toman el saldo de su deuda.
  ALTER TABLE financial_sources DROP CONSTRAINT IF EXISTS financial_sources_balance_pair_check;
  ALTER TABLE financial_sources ADD CONSTRAINT financial_sources_balance_pair_check CHECK ((current_balance IS NULL) = (balance_updated_at IS NULL));
  ALTER TABLE financial_sources DROP CONSTRAINT IF EXISTS financial_sources_card_balance_check;
  ALTER TABLE financial_sources ADD CONSTRAINT financial_sources_card_balance_check CHECK (kind <> 'credit_card' OR current_balance IS NULL);
END $$;

-- Las fuentes que ya existían eran del hogar: quedan compartidas.
UPDATE financial_sources SET owner_user_id = created_by, shared = true WHERE owner_user_id IS NULL AND legacy_user_source_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_financial_sources_owner ON financial_sources(owner_user_id);

-- ¿Puede ver / editar esta cuenta? Del hogar y (compartida o propia).
CREATE OR REPLACE FUNCTION can_see_financial_source(p_household UUID, p_owner UUID, p_shared BOOLEAN)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT p_household IN (SELECT get_my_household_ids()) AND (p_shared OR p_owner IS NULL OR p_owner = auth.uid())
$$;
CREATE OR REPLACE FUNCTION can_edit_financial_source(p_household UUID, p_owner UUID, p_shared BOOLEAN)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT p_household IN (SELECT get_my_writable_household_ids()) AND (p_shared OR p_owner IS NULL OR p_owner = auth.uid())
$$;
GRANT EXECUTE ON FUNCTION can_see_financial_source(UUID, UUID, BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION can_edit_financial_source(UUID, UUID, BOOLEAN) TO authenticated;

DROP POLICY IF EXISTS "Members can view financial sources" ON financial_sources;
CREATE POLICY "Members can view financial sources" ON financial_sources
  FOR SELECT USING (can_see_financial_source(household_id, owner_user_id, shared));
DROP POLICY IF EXISTS "Writers can manage financial sources" ON financial_sources;
CREATE POLICY "Writers can manage financial sources" ON financial_sources
  FOR ALL USING (can_edit_financial_source(household_id, owner_user_id, shared))
  WITH CHECK (can_edit_financial_source(household_id, owner_user_id, shared));

-- Historial de saldos: lo ve quien ve la cuenta.
DROP POLICY IF EXISTS "Members can view balance snapshots" ON source_balance_snapshots;
CREATE POLICY "Members can view balance snapshots" ON source_balance_snapshots
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM financial_sources f WHERE f.id = source_balance_snapshots.source_id
      AND can_see_financial_source(f.household_id, f.owner_user_id, f.shared)));
DROP POLICY IF EXISTS "Writers can manage balance snapshots" ON source_balance_snapshots;
CREATE POLICY "Writers can manage balance snapshots" ON source_balance_snapshots
  FOR ALL USING (EXISTS (
    SELECT 1 FROM financial_sources f WHERE f.id = source_balance_snapshots.source_id
      AND can_edit_financial_source(f.household_id, f.owner_user_id, f.shared)))
  WITH CHECK (EXISTS (
    SELECT 1 FROM financial_sources f WHERE f.id = source_balance_snapshots.source_id
      AND can_edit_financial_source(f.household_id, f.owner_user_id, f.shared)));

-- Cierre de mes: estado de cuenta cargado por cuenta y mes.
CREATE TABLE IF NOT EXISTS source_statement_status (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id UUID NOT NULL REFERENCES financial_sources(id) ON DELETE CASCADE,
  year_month TEXT NOT NULL CHECK (year_month ~ '^\d{4}-\d{2}$'),
  loaded BOOLEAN NOT NULL DEFAULT false,
  loaded_at TIMESTAMPTZ,
  UNIQUE (source_id, year_month)
);

ALTER TABLE source_statement_status ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Members can view statement status" ON source_statement_status;
CREATE POLICY "Members can view statement status" ON source_statement_status
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM financial_sources f WHERE f.id = source_statement_status.source_id
      AND can_see_financial_source(f.household_id, f.owner_user_id, f.shared)));
DROP POLICY IF EXISTS "Writers can manage statement status" ON source_statement_status;
CREATE POLICY "Writers can manage statement status" ON source_statement_status
  FOR ALL USING (EXISTS (
    SELECT 1 FROM financial_sources f WHERE f.id = source_statement_status.source_id
      AND can_edit_financial_source(f.household_id, f.owner_user_id, f.shared)))
  WITH CHECK (EXISTS (
    SELECT 1 FROM financial_sources f WHERE f.id = source_statement_status.source_id
      AND can_edit_financial_source(f.household_id, f.owner_user_id, f.shared)));

-- Copia de Mis bancos: cada cuenta al hogar activo de su dueño (primero el
-- hogar al que se unió, si no el propio), personal y sin saldo.
INSERT INTO financial_sources (
  household_id, kind, name, institution, current_balance, balance_updated_at, archived_at,
  owner_user_id, created_by, shared, detection_method, tracks_statements, legacy_user_source_id, created_at, updated_at
)
SELECT
  hh.household_id,
  CASE us.type WHEN 'cuenta_bancaria' THEN 'bank_account' WHEN 'efectivo' THEN 'cash' ELSE 'credit_card' END,
  COALESCE(NULLIF(trim(us.nickname), ''), us.bank_name),
  us.bank_name,
  NULL, NULL,
  CASE WHEN us.active THEN NULL ELSE NOW() END,
  us.user_id, us.user_id, false, us.detection_method, true, us.id, us.created_at, NOW()
FROM user_sources us
JOIN LATERAL (
  SELECT m.household_id
  FROM household_members m
  JOIN households h ON h.id = m.household_id
  WHERE m.user_id = us.user_id AND h.archived_at IS NULL
  ORDER BY (m.role = 'member') DESC, h.created_at ASC
  LIMIT 1
) hh ON true
WHERE EXISTS (SELECT 1 FROM users u WHERE u.id = us.user_id)
ON CONFLICT (legacy_user_source_id) DO NOTHING;

INSERT INTO source_statement_status (source_id, year_month, loaded, loaded_at)
SELECT f.id, s.year_month, s.loaded, s.loaded_at
FROM source_monthly_status s
JOIN financial_sources f ON f.legacy_user_source_id = s.user_source_id
WHERE s.year_month ~ '^\d{4}-\d{2}$'
ON CONFLICT (source_id, year_month) DO NOTHING;
