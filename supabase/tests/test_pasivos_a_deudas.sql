-- Pasivos de Mi patrimonio → Plan › Deudas (20261104): la deuda queda en
-- debts con el mismo saldo e historial (el patrimonio de cada mes no
-- cambia), la cuenta se borra con respaldo y el tipo queda prohibido.
\ir helpers.sql
BEGIN;
-- La regla nueva no deja crear 'other_liability': se quita solo aquí para
-- simular cuentas viejas (todo se deshace con ROLLBACK).
ALTER TABLE financial_sources DROP CONSTRAINT financial_sources_kind_check;

DO $$
DECLARE
  ana UUID := test_user('ana.pasivos@test.gt', 'Ana');
  hh UUID;
  s_tio UUID; s_vieja UUID; s_vacia UUID;
  d UUID; n INT;
  fechas TIMESTAMPTZ[] := ARRAY['2026-07-31 23:00-06', '2026-08-31 23:00-06', '2026-09-30 23:00-06'];
  antes NUMERIC[] := '{}'; despues NUMERIC[] := '{}';
  f TIMESTAMPTZ;
BEGIN
  INSERT INTO households (name, owner_id) VALUES ('Casa', ana) RETURNING id INTO hh;
  INSERT INTO household_members (household_id, user_id, role) VALUES (hh, ana, 'owner');

  -- Préstamo del tío: Q 6,000 en julio, Q 5,000 en agosto, Q 4,500 hoy.
  INSERT INTO financial_sources (household_id, kind, name, current_balance, balance_updated_at, created_at, owner_user_id, shared)
    VALUES (hh, 'other_liability', 'Préstamo del tío', 4500, '2026-09-15', '2026-07-01', ana, true) RETURNING id INTO s_tio;
  INSERT INTO source_balance_snapshots (household_id, source_id, balance, recorded_at) VALUES
    (hh, s_tio, 6000, '2026-07-01'), (hh, s_tio, 5000, '2026-08-10'), (hh, s_tio, 4500, '2026-09-15');
  -- Una deuda vieja que se archivó en septiembre (ya pagada).
  INSERT INTO financial_sources (household_id, kind, name, current_balance, balance_updated_at, created_at, archived_at, owner_user_id, shared)
    VALUES (hh, 'other_liability', 'Fiado tienda', 300, '2026-07-05', '2026-07-05', '2026-09-10', ana, true) RETURNING id INTO s_vieja;
  INSERT INTO source_balance_snapshots (household_id, source_id, balance, recorded_at) VALUES (hh, s_vieja, 300, '2026-07-05');
  -- Una sin saldo (no contaba en nada).
  INSERT INTO financial_sources (household_id, kind, name, current_balance, balance_updated_at, owner_user_id, shared)
    VALUES (hh, 'other_liability', 'Pendiente', NULL, NULL, ana, true) RETURNING id INTO s_vacia;

  -- Pasivos por mes antes: último saldo de cada cuenta hasta esa fecha (0 si ya estaba archivada).
  FOREACH f IN ARRAY fechas LOOP
    antes := antes || (
      SELECT COALESCE(sum(CASE WHEN fs.archived_at IS NOT NULL AND fs.archived_at <= f THEN 0 ELSE (
        SELECT sn.balance FROM source_balance_snapshots sn WHERE sn.source_id = fs.id AND sn.recorded_at <= f ORDER BY sn.recorded_at DESC LIMIT 1) END), 0)
      FROM financial_sources fs WHERE fs.household_id = hh);
  END LOOP;

  n := migrar_pasivos_a_deudas();
  PERFORM assert_eq(n, 3, 'tres cuentas migradas');

  -- Préstamo del tío: deuda informal activa, sin pago, mismo saldo.
  SELECT id INTO d FROM debts WHERE household_id = hh AND name = 'Préstamo del tío';
  PERFORM assert_eq((SELECT type FROM debts WHERE id = d), 'informal', 'tipo informal');
  PERFORM assert_eq((SELECT balance FROM debts WHERE id = d), 4500::numeric, 'mismo saldo');
  PERFORM assert_eq((SELECT is_paid FROM debts WHERE id = d), false, 'activa');
  PERFORM assert_eq((SELECT min_payment FROM debts WHERE id = d), 0::numeric, 'sin pago fijo');
  PERFORM assert_eq((SELECT created_at FROM debts WHERE id = d), '2026-07-01'::timestamptz, 'fecha original');
  -- La archivada: pagada y en 0.
  PERFORM assert_eq((SELECT is_paid FROM debts WHERE household_id = hh AND name = 'Fiado tienda'), true, 'archivada → pagada');
  PERFORM assert_eq((SELECT balance FROM debts WHERE household_id = hh AND name = 'Fiado tienda'), 0::numeric, 'archivada → saldo 0');
  -- La vacía no crea deuda.
  PERFORM assert_eq((SELECT count(*) FROM debts WHERE household_id = hh AND name = 'Pendiente')::int, 0, 'sin saldo: sin deuda');

  -- Cuentas borradas, con respaldo completo.
  PERFORM assert_eq((SELECT count(*) FROM financial_sources WHERE household_id = hh)::int, 0, 'cuentas borradas');
  PERFORM assert_eq((SELECT count(*) FROM pasivos_migrados WHERE household_id = hh)::int, 3, 'respaldo de las tres');
  PERFORM assert_eq((SELECT jsonb_array_length(historial) FROM pasivos_migrados WHERE source_id = s_tio), 3, 'historial respaldado');
  PERFORM assert_eq((SELECT debt_id FROM pasivos_migrados WHERE source_id = s_tio), d, 'respaldo apunta a la deuda');
  PERFORM assert_eq((SELECT debt_id FROM pasivos_migrados WHERE source_id = s_vacia), NULL::uuid, 'sin deuda en el respaldo');

  -- Pasivos por mes después (desde el historial de deudas): igual que antes.
  FOREACH f IN ARRAY fechas LOOP
    despues := despues || (
      SELECT COALESCE(sum((SELECT ds.balance FROM debt_balance_snapshots ds WHERE ds.debt_id = x.id AND ds.recorded_at <= f ORDER BY ds.recorded_at DESC LIMIT 1)), 0)
      FROM debts x WHERE x.household_id = hh);
  END LOOP;
  PERFORM assert_eq(despues, antes, 'el patrimonio de cada mes no cambia');
  PERFORM assert_eq(antes, ARRAY[6300, 5300, 4500]::numeric[], 'pasivos de julio, agosto y septiembre');

  -- Otra vez: no hay nada que mover.
  PERFORM assert_eq(migrar_pasivos_a_deudas(), 0, 'idempotente');
END $$;
ROLLBACK;

-- Con la regla de la migración, ya no se puede crear "Otra deuda".
DO $$
DECLARE hh UUID;
BEGIN
  INSERT INTO households (name, owner_id) VALUES ('Casa 2', test_user('luis.pasivos@test.gt', 'Luis')) RETURNING id INTO hh;
  BEGIN
    INSERT INTO financial_sources (household_id, kind, name, current_balance) VALUES (hh, 'other_liability', 'X', 10);
    RAISE EXCEPTION 'FALLÓ: se pudo crear other_liability';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
  PERFORM assert_eq((SELECT has_function_privilege('authenticated', 'migrar_pasivos_a_deudas()', 'EXECUTE')), false, 'solo admin');
END $$;
