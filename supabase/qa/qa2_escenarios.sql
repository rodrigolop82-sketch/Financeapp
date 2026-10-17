-- Usuario de pruebas 2 (qa2@zafiapp.com): datos coherentes para validar los
-- casos límite de la Fase 1 y 2 (ingresos, ahorro, deudas, suscripciones,
-- Cerrar el mes). NO es una migración: se corre a mano en el editor SQL de
-- Supabase, y solo toca el hogar de qa2@zafiapp.com (borra y vuelve a crear
-- sus datos, así que se puede correr las veces que haga falta).
--
-- Cambia v_con_deudas para probar los dos casos:
--   true  → una tarjeta activa (Tarjeta BI, Q 8,000 al 36 %, cuota Q 400)
--   false → sin deudas (Pago de deudas extra queda con aviso en el plan)
--
-- Meses (hoy = octubre 2026):
--   julio, agosto → con ingreso registrado (Q 12,000)
--   septiembre    → SIN ingreso registrado (Falta registrar, puntaje
--                   provisional, Cerrar el mes bloqueado)
--   octubre       → con ingreso registrado, mes en curso (días 1–15)
--
-- Lo que debe verse (con deudas / sin deudas):
--   Julio y agosto:  Ingresos Q 12,000 · Gastaste Q 7,190 / Q 6,950
--                    Ahorro Q 4,810 (40 %) / Q 5,050 (42 %)
--                    A ahorro y deudas: Q 1,460 / Q 1,000
--                    (fondo Q 1,000 + extra Q 300 + abono a tarjeta Q 160;
--                     de los Q 400 de cuota, Q 240 son intereses y cuentan
--                     como gasto)
--   Septiembre:      Ingresos Q 0 "Falta registrar" · Gastaste Q 7,190 / Q 6,950
--                    Ahorro "—" · puntaje Provisional
--   Octubre:         Ingresos Q 12,000 · Gastaste Q 5,410 / Q 5,170
--                    Ahorro Q 6,590 / Q 6,830
--   Suscripciones:   Q 150/mes (Netflix y Spotify) · Pagos fijos: Q 620/mes (EEGSA luz)
--   Cerrar septiembre: 0 de 2 pasos (ingresos + estado de cuenta de Banco Industrial)

DO $$
DECLARE
  v_con_deudas boolean := true;   -- ← cambia aquí
  v_email text := 'qa2@zafiapp.com';
  v_user_id uuid;
  v_hh uuid;
  v_debt uuid;
  v_tx uuid;
  m text;
  months text[] := ARRAY['2026-07', '2026-08', '2026-09'];
BEGIN
  SELECT id INTO v_user_id FROM users WHERE lower(email) = v_email;
  IF v_user_id IS NULL THEN RAISE EXCEPTION '% no existe en users', v_email; END IF;
  SELECT id INTO v_hh FROM households WHERE owner_id = v_user_id LIMIT 1;
  IF v_hh IS NULL THEN RAISE EXCEPTION 'No hay hogar para % (termina el onboarding primero)', v_email; END IF;

  -- 1) Limpiar solo este hogar
  DELETE FROM bill_payments WHERE household_id = v_hh;
  DELETE FROM transactions WHERE household_id = v_hh;
  DELETE FROM financial_sources WHERE household_id = v_hh;
  DELETE FROM debts WHERE household_id = v_hh;
  DELETE FROM income_month_confirmations WHERE household_id = v_hh;
  DELETE FROM monthly_snapshots WHERE household_id = v_hh;
  DELETE FROM income_entries WHERE household_id = v_hh;

  -- 2) Plan del mes
  UPDATE budget_categories SET budgeted_amount = 0 WHERE household_id = v_hh;
  UPDATE budget_categories SET budgeted_amount = 3500, pace_mode = 'fixed', expected_day = 1 WHERE household_id = v_hh AND name = 'Vivienda/alquiler';
  UPDATE budget_categories SET budgeted_amount = 2000, pace_mode = 'linear' WHERE household_id = v_hh AND name = 'Alimentación';
  UPDATE budget_categories SET budgeted_amount = 600, pace_mode = 'linear' WHERE household_id = v_hh AND name = 'Transporte';
  UPDATE budget_categories SET budgeted_amount = 700, pace_mode = 'fixed', expected_day = 5 WHERE household_id = v_hh AND name = 'Servicios (agua, luz, internet)';
  UPDATE budget_categories SET budgeted_amount = 600, pace_mode = 'linear' WHERE household_id = v_hh AND name = 'Restaurantes y salidas';
  UPDATE budget_categories SET budgeted_amount = 150, pace_mode = 'fixed', expected_day = 3 WHERE household_id = v_hh AND name = 'Suscripciones';
  UPDATE budget_categories SET budgeted_amount = 1000 WHERE household_id = v_hh AND name = 'Fondo de emergencia';
  UPDATE budget_categories SET budgeted_amount = 300 WHERE household_id = v_hh AND name = 'Pago de deudas extra';

  INSERT INTO income_entries (household_id, source, member, amount, frequency)
    VALUES (v_hh, 'Salario', 'Persona 1', 12000, 'mensual');
  UPDATE financial_profiles SET total_income = 12000, total_fixed_expenses = 4350, total_savings = 6000,
    total_debt = CASE WHEN v_con_deudas THEN 8000 ELSE 0 END
    WHERE household_id = v_hh;

  -- 3) Deuda (solo con v_con_deudas) y cuentas en Mis cuentas
  IF v_con_deudas THEN
    INSERT INTO debts (household_id, name, type, balance, interest_rate, min_payment, due_day, is_paid)
      VALUES (v_hh, 'Tarjeta BI', 'credit', 8000, 36, 400, 15, false)
      RETURNING id INTO v_debt;
    -- La tarjeta no guarda saldo: lo toma de su deuda (debt_id).
    INSERT INTO financial_sources (household_id, kind, name, institution, current_balance, balance_updated_at, created_by, owner_user_id, tracks_statements, debt_id)
      VALUES (v_hh, 'credit_card', 'Tarjeta BI', 'Banco Industrial', NULL, NULL, v_user_id, v_user_id, false, v_debt);
  END IF;
  INSERT INTO financial_sources (household_id, kind, name, institution, current_balance, balance_updated_at, created_by, owner_user_id, tracks_statements)
    VALUES (v_hh, 'bank_account', 'Cuenta monetaria', 'Banco Industrial', 9500, now(), v_user_id, v_user_id, true);

  -- 4) Movimientos de julio, agosto y septiembre (septiembre sin ingreso)
  FOREACH m IN ARRAY months LOOP
    IF m <> '2026-09' THEN
      INSERT INTO transactions (household_id, category_id, amount, description, date, type, transaction_type, payment_method, source, created_by)
      SELECT v_hh, id, 12000, 'Salario', (m || '-01')::date, 'income', 'ingreso', 'transferencia', 'manual', v_user_id
      FROM budget_categories WHERE household_id = v_hh AND name = 'Salario';
    END IF;

    INSERT INTO transactions (household_id, category_id, amount, description, date, type, transaction_type, payment_method, source, created_by)
    SELECT v_hh, bc.id, v.amount, v.description, (m || '-' || v.day)::date, 'expense', v.ttype, v.pm, 'manual', v_user_id
    FROM (VALUES
      ('Vivienda/alquiler', 3500, 'Alquiler apartamento', '01', 'gasto', 'transferencia'),
      ('Suscripciones', 150, 'Netflix y Spotify', '03', 'gasto', 'tarjeta'),
      ('Servicios (agua, luz, internet)', 620, 'EEGSA luz', '05', 'gasto', 'transferencia'),
      ('Alimentación', 1200, 'Supermercado', '08', 'gasto', 'tarjeta'),
      ('Transporte', 450, 'Gasolina', '12', 'gasto', 'efectivo'),
      ('Restaurantes y salidas', 380, 'Cena con amigos', '16', 'gasto', 'tarjeta'),
      ('Alimentación', 650, 'Mercado', '22', 'gasto', 'efectivo'),
      ('Fondo de emergencia', 1000, 'Transferencia a fondo de emergencia', '28', 'ahorro', 'transferencia')
    ) AS v(cat, amount, description, day, ttype, pm)
    JOIN budget_categories bc ON bc.household_id = v_hh AND bc.name = v.cat;

    IF v_con_deudas THEN
      INSERT INTO transactions (household_id, category_id, amount, description, date, type, transaction_type, payment_method, source, created_by)
      SELECT v_hh, id, 300, 'Pago extra a Tarjeta BI', (m || '-20')::date, 'expense', 'ahorro', 'transferencia', 'manual', v_user_id
      FROM budget_categories WHERE household_id = v_hh AND name = 'Pago de deudas extra';
      -- Cuota mínima marcada en Pagos del mes (sin categoría, como lo hace la app).
      INSERT INTO transactions (household_id, category_id, amount, description, date, type, transaction_type, payment_method, source, created_by)
        VALUES (v_hh, NULL, 400, 'Tarjeta BI', (m || '-15')::date, 'expense', 'ahorro', 'transferencia', 'manual', v_user_id)
        RETURNING id INTO v_tx;
      INSERT INTO bill_payments (household_id, debt_id, month, paid_by, transaction_id)
        VALUES (v_hh, v_debt, (m || '-01')::date, v_user_id, v_tx);
    END IF;
  END LOOP;

  -- 5) Octubre (mes en curso, días 1–15)
  INSERT INTO transactions (household_id, category_id, amount, description, date, type, transaction_type, payment_method, source, created_by)
  SELECT v_hh, bc.id, v.amount, v.description, v.d::date, v.t, v.tt, v.pm, 'manual', v_user_id
  FROM (VALUES
    ('Salario', 12000, 'Salario', '2026-10-01', 'income', 'ingreso', 'transferencia'),
    ('Vivienda/alquiler', 3500, 'Alquiler apartamento', '2026-10-01', 'expense', 'gasto', 'transferencia'),
    ('Suscripciones', 150, 'Netflix y Spotify', '2026-10-03', 'expense', 'gasto', 'tarjeta'),
    ('Servicios (agua, luz, internet)', 620, 'EEGSA luz', '2026-10-05', 'expense', 'gasto', 'transferencia'),
    ('Alimentación', 700, 'Supermercado', '2026-10-08', 'expense', 'gasto', 'tarjeta'),
    ('Transporte', 200, 'Gasolina', '2026-10-12', 'expense', 'gasto', 'efectivo')
  ) AS v(cat, amount, description, d, t, tt, pm)
  JOIN budget_categories bc ON bc.household_id = v_hh AND bc.name = v.cat;

  IF v_con_deudas THEN
    INSERT INTO transactions (household_id, category_id, amount, description, date, type, transaction_type, payment_method, source, created_by)
      VALUES (v_hh, NULL, 400, 'Tarjeta BI', '2026-10-15', 'expense', 'ahorro', 'transferencia', 'manual', v_user_id)
      RETURNING id INTO v_tx;
    INSERT INTO bill_payments (household_id, debt_id, month, paid_by, transaction_id)
      VALUES (v_hh, v_debt, '2026-10-01', v_user_id, v_tx);
  END IF;

  -- 6) Julio y agosto cerrados; septiembre queda abierto para probar el cierre
  INSERT INTO income_month_confirmations (household_id, year_month, confirmed)
    VALUES (v_hh, '2026-07', true), (v_hh, '2026-08', true)
    ON CONFLICT (household_id, year_month) DO NOTHING;
END $$;
