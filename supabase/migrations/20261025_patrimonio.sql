-- ══════════════════════════════════════════════
-- Patrimonio neto y Mis Fuentes
-- ══════════════════════════════════════════════
-- · financial_sources: cuentas, efectivo, inversiones, bienes y deudas que
--   el usuario declara con su saldo (siempre positivo; el signo lo da side).
-- · source_balance_snapshots: un registro por cada actualización de saldo.
--   Se guarda para todos los hogares; solo la gráfica es Premium.
-- · debt_balance_snapshots: historial de saldos del módulo Deudas, para
--   que la evolución del patrimonio incluya las deudas sin doble conteo.
--   Lo llena un trigger; el código de Deudas no cambia.

CREATE TABLE IF NOT EXISTS financial_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('bank_account', 'cash', 'investment', 'property_or_vehicle',
                                     'credit_card', 'loan', 'other_asset', 'other_liability')),
  side TEXT GENERATED ALWAYS AS (
    CASE WHEN kind IN ('credit_card', 'loan', 'other_liability') THEN 'liability' ELSE 'asset' END
  ) STORED,
  name TEXT NOT NULL CHECK (length(trim(name)) > 0),
  institution TEXT,
  current_balance NUMERIC(14,2) NOT NULL CHECK (current_balance >= 0),
  balance_updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  archived_at TIMESTAMPTZ,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL DEFAULT auth.uid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_financial_sources_household ON financial_sources(household_id, archived_at);

ALTER TABLE financial_sources ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Members can view financial sources" ON financial_sources;
CREATE POLICY "Members can view financial sources" ON financial_sources
  FOR SELECT USING (household_id IN (SELECT get_my_household_ids()));
DROP POLICY IF EXISTS "Writers can manage financial sources" ON financial_sources;
CREATE POLICY "Writers can manage financial sources" ON financial_sources
  FOR ALL USING (household_id IN (SELECT get_my_writable_household_ids()))
  WITH CHECK (household_id IN (SELECT get_my_writable_household_ids()));

CREATE TABLE IF NOT EXISTS source_balance_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  source_id UUID NOT NULL REFERENCES financial_sources(id) ON DELETE CASCADE,
  balance NUMERIC(14,2) NOT NULL CHECK (balance >= 0),
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  origin TEXT NOT NULL DEFAULT 'manual' CHECK (origin IN ('manual', 'statement_import'))
);
CREATE INDEX IF NOT EXISTS idx_source_snapshots_source ON source_balance_snapshots(source_id, recorded_at);
CREATE INDEX IF NOT EXISTS idx_source_snapshots_household ON source_balance_snapshots(household_id, recorded_at);

ALTER TABLE source_balance_snapshots ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Members can view balance snapshots" ON source_balance_snapshots;
CREATE POLICY "Members can view balance snapshots" ON source_balance_snapshots
  FOR SELECT USING (household_id IN (SELECT get_my_household_ids()));
DROP POLICY IF EXISTS "Writers can manage balance snapshots" ON source_balance_snapshots;
CREATE POLICY "Writers can manage balance snapshots" ON source_balance_snapshots
  FOR ALL USING (household_id IN (SELECT get_my_writable_household_ids()))
  WITH CHECK (household_id IN (SELECT get_my_writable_household_ids()));

-- Historial de deudas (solo lectura para miembros; lo escribe el trigger).
CREATE TABLE IF NOT EXISTS debt_balance_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  debt_id UUID NOT NULL REFERENCES debts(id) ON DELETE CASCADE,
  balance NUMERIC(12,2) NOT NULL,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_debt_snapshots_debt ON debt_balance_snapshots(debt_id, recorded_at);
CREATE INDEX IF NOT EXISTS idx_debt_snapshots_household ON debt_balance_snapshots(household_id, recorded_at);

ALTER TABLE debt_balance_snapshots ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Members can view debt snapshots" ON debt_balance_snapshots;
CREATE POLICY "Members can view debt snapshots" ON debt_balance_snapshots
  FOR SELECT USING (household_id IN (SELECT get_my_household_ids()));

CREATE OR REPLACE FUNCTION record_debt_balance_snapshot()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.household_id IS NULL THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'INSERT'
     OR NEW.balance IS DISTINCT FROM OLD.balance
     OR NEW.is_paid IS DISTINCT FROM OLD.is_paid THEN
    INSERT INTO debt_balance_snapshots (household_id, debt_id, balance)
    VALUES (NEW.household_id, NEW.id, CASE WHEN COALESCE(NEW.is_paid, false) THEN 0 ELSE NEW.balance END);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_debt_balance_snapshot ON debts;
CREATE TRIGGER trg_debt_balance_snapshot
  AFTER INSERT OR UPDATE OF balance, is_paid ON debts
  FOR EACH ROW EXECUTE FUNCTION record_debt_balance_snapshot();

-- Punto de partida: el saldo actual de cada deuda (una sola vez).
INSERT INTO debt_balance_snapshots (household_id, debt_id, balance, recorded_at)
SELECT d.household_id, d.id, CASE WHEN COALESCE(d.is_paid, false) THEN 0 ELSE d.balance END, COALESCE(d.created_at, NOW())
FROM debts d
WHERE d.household_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM debt_balance_snapshots s WHERE s.debt_id = d.id);
