-- ══════════════════════════════════════════════
-- Eventos: presupuesto para un cumpleaños, graduación, vacación, boda…
-- ══════════════════════════════════════════════
-- · eventos: uno por ocasión, del hogar. `tipo` dice de qué plantilla salió
--   (los conceptos sugeridos viven en lib/eventos.ts). Un evento "activo" no
--   está archivado; en Gratis solo puede haber uno activo.
-- · evento_conceptos: lo que se piensa gastar, concepto por concepto.
-- · transactions.evento_concepto_id: un gasto asignado a un concepto del
--   evento. El gasto sigue en su categoría del mes (no se cuenta doble): el
--   evento solo suma lo que lleva gastado.
-- · eventos.goal_id: la meta de "Ahorrar para esto" (opcional).
--
-- Crear un evento y reactivarlo pasan por la API (revisa el límite de
-- Gratis): el cliente no puede insertar eventos ni tocar archived_at.

CREATE TABLE IF NOT EXISTS eventos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL CHECK (tipo IN ('cumpleanos', 'graduacion', 'vacacion', 'boda', 'otro')),
  nombre TEXT NOT NULL CHECK (length(trim(nombre)) > 0),
  fecha_inicio DATE,
  fecha_fin DATE,
  goal_id UUID REFERENCES financial_goals(id) ON DELETE SET NULL,
  archived_at TIMESTAMPTZ,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL DEFAULT auth.uid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (fecha_fin IS NULL OR fecha_inicio IS NULL OR fecha_fin >= fecha_inicio)
);
CREATE INDEX IF NOT EXISTS idx_eventos_household ON eventos(household_id, archived_at);

CREATE TABLE IF NOT EXISTS evento_conceptos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  evento_id UUID NOT NULL REFERENCES eventos(id) ON DELETE CASCADE,
  household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  nombre TEXT NOT NULL CHECK (length(trim(nombre)) > 0),
  presupuesto NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (presupuesto >= 0),
  orden INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_evento_conceptos_evento ON evento_conceptos(evento_id, orden);

ALTER TABLE transactions
  ADD COLUMN IF NOT EXISTS evento_concepto_id UUID REFERENCES evento_conceptos(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_transactions_evento_concepto ON transactions(evento_concepto_id) WHERE evento_concepto_id IS NOT NULL;

-- El concepto es del mismo hogar que su evento (RLS mira household_id).
CREATE OR REPLACE FUNCTION evento_concepto_mismo_hogar()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM eventos e WHERE e.id = NEW.evento_id AND e.household_id = NEW.household_id) THEN
    RAISE EXCEPTION 'concepto_de_otro_hogar';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_evento_concepto_hogar ON evento_conceptos;
CREATE TRIGGER trg_evento_concepto_hogar
  BEFORE INSERT OR UPDATE OF evento_id, household_id ON evento_conceptos
  FOR EACH ROW EXECUTE FUNCTION evento_concepto_mismo_hogar();

-- Un gasto solo se asigna a un concepto de su mismo hogar.
CREATE OR REPLACE FUNCTION transaccion_evento_mismo_hogar()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.evento_concepto_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM evento_conceptos c WHERE c.id = NEW.evento_concepto_id AND c.household_id = NEW.household_id
  ) THEN
    RAISE EXCEPTION 'concepto_de_otro_hogar';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_transaccion_evento_hogar ON transactions;
CREATE TRIGGER trg_transaccion_evento_hogar
  BEFORE INSERT OR UPDATE OF evento_concepto_id, household_id ON transactions
  FOR EACH ROW EXECUTE FUNCTION transaccion_evento_mismo_hogar();

-- RLS: los miembros ven; quienes pueden escribir editan (sin crear eventos).
ALTER TABLE eventos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Members can view eventos" ON eventos;
CREATE POLICY "Members can view eventos" ON eventos
  FOR SELECT USING (household_id IN (SELECT get_my_household_ids()));
DROP POLICY IF EXISTS "Writers can update eventos" ON eventos;
CREATE POLICY "Writers can update eventos" ON eventos
  FOR UPDATE USING (household_id IN (SELECT get_my_writable_household_ids()))
  WITH CHECK (household_id IN (SELECT get_my_writable_household_ids()));
DROP POLICY IF EXISTS "Writers can delete eventos" ON eventos;
CREATE POLICY "Writers can delete eventos" ON eventos
  FOR DELETE USING (household_id IN (SELECT get_my_writable_household_ids()));

REVOKE ALL ON eventos FROM anon, authenticated;
GRANT SELECT, DELETE ON eventos TO authenticated;
GRANT UPDATE (nombre, fecha_inicio, fecha_fin, goal_id, updated_at) ON eventos TO authenticated;

ALTER TABLE evento_conceptos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Members can view evento conceptos" ON evento_conceptos;
CREATE POLICY "Members can view evento conceptos" ON evento_conceptos
  FOR SELECT USING (household_id IN (SELECT get_my_household_ids()));
DROP POLICY IF EXISTS "Writers can manage evento conceptos" ON evento_conceptos;
CREATE POLICY "Writers can manage evento conceptos" ON evento_conceptos
  FOR ALL USING (household_id IN (SELECT get_my_writable_household_ids()))
  WITH CHECK (household_id IN (SELECT get_my_writable_household_ids()));
REVOKE ALL ON evento_conceptos FROM anon;
