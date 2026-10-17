-- ══════════════════════════════════════════════
-- Pasivos de Mi patrimonio → Plan › Deudas (una sola fuente de deudas)
-- ══════════════════════════════════════════════
-- Las deudas viven solo en `debts`: ahí las ven el puntaje, el plan de
-- pago, Pregúntale a Zafi y Mi patrimonio. "Otra deuda" (y 'loan') en
-- financial_sources ya no se crea desde la app; esta migración pasa las que
-- existan y luego prohíbe esos tipos.
--
-- Por cada cuenta 'other_liability' o 'loan':
-- · Con saldo (hoy o en su historial) y sin deuda vinculada → se crea su
--   deuda ('informal' o 'loan', sin pago fijo ni tasa, con su fecha de
--   creación) y se copia su historial de saldos a debt_balance_snapshots.
--   Si estaba archivada, la deuda queda pagada y con saldo 0 desde que se
--   archivó (la historia de meses pasados no cambia).
-- · Siempre: la fila original y su historial se guardan completos en
--   `pasivos_migrados` (para revertir) y la cuenta se borra. Borrarla (no
--   archivarla) evita contarla dos veces en la historia del patrimonio.
--
-- En producción, al 17-oct-2026 no hay ninguna de estas cuentas: hoy no
-- mueve ni borra filas. Es idempotente (se puede volver a correr).

CREATE TABLE IF NOT EXISTS pasivos_migrados (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  migrado_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  source_id UUID NOT NULL,
  household_id UUID NOT NULL,
  -- La deuda creada (NULL si no tenía saldo o ya estaba vinculada a una).
  debt_id UUID,
  fila JSONB NOT NULL,
  historial JSONB NOT NULL DEFAULT '[]'
);
-- Solo la service role la lee (sin políticas).
ALTER TABLE pasivos_migrados ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.migrar_pasivos_a_deudas()
RETURNS INT
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  s RECORD;
  v_debt UUID;
  v_hist JSONB;
  v_tiene_saldo BOOLEAN;
  v_n INT := 0;
BEGIN
  FOR s IN SELECT * FROM financial_sources WHERE kind IN ('other_liability', 'loan') ORDER BY created_at LOOP
    v_debt := NULL;
    SELECT COALESCE(jsonb_agg(to_jsonb(sn) ORDER BY sn.recorded_at), '[]') INTO v_hist
      FROM source_balance_snapshots sn WHERE sn.source_id = s.id;
    v_tiene_saldo := COALESCE(s.current_balance, 0) > 0
      OR EXISTS (SELECT 1 FROM source_balance_snapshots sn WHERE sn.source_id = s.id AND sn.balance > 0);

    IF s.debt_id IS NULL AND v_tiene_saldo THEN
      INSERT INTO debts (household_id, name, type, balance, interest_rate, min_payment, due_day, is_paid, created_at)
      VALUES (
        s.household_id, s.name, CASE WHEN s.kind = 'loan' THEN 'loan' ELSE 'informal' END,
        CASE WHEN s.archived_at IS NULL THEN COALESCE(s.current_balance, 0) ELSE 0 END,
        0, 0, NULL,
        s.archived_at IS NOT NULL OR COALESCE(s.current_balance, 0) = 0,
        s.created_at
      )
      RETURNING id INTO v_debt;
      -- El trigger ya guardó el saldo de hoy; se agrega el historial.
      INSERT INTO debt_balance_snapshots (household_id, debt_id, balance, recorded_at)
        SELECT s.household_id, v_debt, sn.balance, sn.recorded_at
        FROM source_balance_snapshots sn WHERE sn.source_id = s.id;
      IF s.archived_at IS NOT NULL THEN
        INSERT INTO debt_balance_snapshots (household_id, debt_id, balance, recorded_at)
          VALUES (s.household_id, v_debt, 0, s.archived_at);
      END IF;
    END IF;

    INSERT INTO pasivos_migrados (source_id, household_id, debt_id, fila, historial)
      VALUES (s.id, s.household_id, v_debt, to_jsonb(s), v_hist);
    DELETE FROM financial_sources WHERE id = s.id;
    v_n := v_n + 1;
  END LOOP;
  RETURN v_n;
END;
$$;
REVOKE ALL ON FUNCTION public.migrar_pasivos_a_deudas() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.migrar_pasivos_a_deudas() FROM anon, authenticated;

SELECT public.migrar_pasivos_a_deudas();

-- Desde ahora, financial_sources no acepta deudas (las tarjetas sí: se
-- vinculan a su deuda y no llevan saldo propio).
ALTER TABLE financial_sources DROP CONSTRAINT IF EXISTS financial_sources_kind_check;
ALTER TABLE financial_sources ADD CONSTRAINT financial_sources_kind_check
  CHECK (kind IN ('bank_account', 'cash', 'investment', 'vehicle', 'real_estate',
                  'credit_card', 'other_asset'));
