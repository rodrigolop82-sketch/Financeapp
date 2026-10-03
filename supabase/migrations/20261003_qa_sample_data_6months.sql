-- QA sample data: 6 months of realistic household activity for
-- qa@zafiapp.com, built to exercise every budget-pace status
-- (sobregiro / riesgo / en_línea / sin_gasto) and every savings-alert
-- case (meta superada / meta parcial / sin ahorro registrado), so
-- Insights, Tendencias, Cierre de Mes, Presupuesto, Metas and the
-- dashboard's SmartAlert can all be validated visually against a
-- full dataset instead of near-empty data.
--
-- This REPLACES any existing transactions/budget_snapshots/income
-- confirmations/goals for the QA household — it is meant to be
-- re-run safely any time the QA account needs to be reseeded.
--
-- Month-by-month intent:
--   mayo      — mes saludable: todo en línea, meta de ahorro superada
--   junio     — sobregiros en varias categorías (Alimentación,
--               Transporte, Restaurantes, Entretenimiento, Varios),
--               ahorro parcial (no alcanza la meta)
--   julio     — "gastos no ejecutados": Salud, Educación, Ropa,
--               Suscripciones, Fondo de emergencia y Pago de deudas
--               no registran ningún movimiento ese mes
--   agosto    — mes mixto: sobregiros leves dispersos, Fondo de
--               emergencia superado, Ahorro metas sin ejecutar
--   septiembre— mes saludable (línea base limpia antes de octubre),
--               con movimientos ya en los días 1-3 para la
--               comparación "día a día" de Insights
--   octubre   — mes actual (solo días 1-3): un sobregiro inmediato
--               (Salud/medicinas), dos categorías en riesgo por
--               ritmo de gasto (Alimentación, Entretenimiento), y
--               el Fondo de emergencia aún sin movimiento este mes
--               (dispara la alerta "Aún no registrás ahorro")

DO $$
DECLARE
  v_user_id uuid;
  v_household_id uuid;
BEGIN
  SELECT id INTO v_user_id FROM users WHERE email = 'qa@zafiapp.com';
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'qa@zafiapp.com not found in users';
  END IF;

  SELECT id INTO v_household_id FROM households WHERE owner_id = v_user_id LIMIT 1;
  IF v_household_id IS NULL THEN
    RAISE EXCEPTION 'No household found for qa@zafiapp.com';
  END IF;

  -- 1) Budget per category (also drives historical snapshots below)
  UPDATE budget_categories SET budgeted_amount = 3000, pace_mode = 'fixed', expected_day = 1
    WHERE household_id = v_household_id AND name = 'Vivienda/alquiler';
  UPDATE budget_categories SET budgeted_amount = 2200, pace_mode = 'linear', expected_day = NULL
    WHERE household_id = v_household_id AND name = 'Alimentación';
  UPDATE budget_categories SET budgeted_amount = 800, pace_mode = 'linear', expected_day = NULL
    WHERE household_id = v_household_id AND name = 'Transporte';
  UPDATE budget_categories SET budgeted_amount = 400, pace_mode = 'linear', expected_day = NULL
    WHERE household_id = v_household_id AND name = 'Salud/medicinas';
  UPDATE budget_categories SET budgeted_amount = 600, pace_mode = 'fixed', expected_day = 5
    WHERE household_id = v_household_id AND name = 'Servicios (agua, luz, internet)';
  UPDATE budget_categories SET budgeted_amount = 500, pace_mode = 'linear', expected_day = NULL
    WHERE household_id = v_household_id AND name = 'Educación';
  UPDATE budget_categories SET budgeted_amount = 800, pace_mode = 'linear', expected_day = NULL
    WHERE household_id = v_household_id AND name = 'Restaurantes y salidas';
  UPDATE budget_categories SET budgeted_amount = 400, pace_mode = 'linear', expected_day = NULL
    WHERE household_id = v_household_id AND name = 'Ropa';
  UPDATE budget_categories SET budgeted_amount = 500, pace_mode = 'linear', expected_day = NULL
    WHERE household_id = v_household_id AND name = 'Entretenimiento';
  UPDATE budget_categories SET budgeted_amount = 250, pace_mode = 'fixed', expected_day = 1
    WHERE household_id = v_household_id AND name = 'Suscripciones';
  UPDATE budget_categories SET budgeted_amount = 300, pace_mode = 'linear', expected_day = NULL
    WHERE household_id = v_household_id AND name = 'Varios personales';
  UPDATE budget_categories SET budgeted_amount = 1000, pace_mode = 'linear', expected_day = NULL
    WHERE household_id = v_household_id AND name = 'Fondo de emergencia';
  UPDATE budget_categories SET budgeted_amount = 800, pace_mode = 'linear', expected_day = NULL
    WHERE household_id = v_household_id AND name = 'Ahorro metas';
  UPDATE budget_categories SET budgeted_amount = 500, pace_mode = 'linear', expected_day = NULL
    WHERE household_id = v_household_id AND name = 'Pago de deudas extra';

  -- 2) Income: a single steady source of Q15,000/mes
  DELETE FROM income_entries WHERE household_id = v_household_id;
  INSERT INTO income_entries (household_id, source, member, amount, frequency)
    VALUES (v_household_id, 'Salario', 'Persona 1', 15000, 'mensual');

  UPDATE financial_profiles SET total_income = 15000 WHERE household_id = v_household_id;
  IF NOT FOUND THEN
    INSERT INTO financial_profiles (household_id, total_income) VALUES (v_household_id, 15000);
  END IF;

  -- 3) Wipe previous seed data for a clean, idempotent reseed
  DELETE FROM transactions WHERE household_id = v_household_id;
  DELETE FROM budget_snapshots WHERE household_id = v_household_id;
  DELETE FROM income_month_confirmations WHERE household_id = v_household_id;
  DELETE FROM goal_contributions WHERE user_id = v_user_id;
  DELETE FROM financial_goals WHERE user_id = v_user_id;

  -- 4) Historical budget snapshots (closed months: mayo-septiembre),
  --    using each category's budget/pace as just configured above
  INSERT INTO budget_snapshots (household_id, category_id, month, amount, pace_mode, expected_day, is_backfilled)
  SELECT v_household_id, bc.id, m.month::date, bc.budgeted_amount, bc.pace_mode, bc.expected_day, true
  FROM budget_categories bc
  CROSS JOIN (VALUES ('2026-05-01'), ('2026-06-01'), ('2026-07-01'), ('2026-08-01'), ('2026-09-01')) AS m(month)
  WHERE bc.household_id = v_household_id
  ON CONFLICT (household_id, category_id, month) DO UPDATE SET
    amount = EXCLUDED.amount, pace_mode = EXCLUDED.pace_mode,
    expected_day = EXCLUDED.expected_day, is_backfilled = EXCLUDED.is_backfilled;

  -- 5) Income confirmations for the closed months
  INSERT INTO income_month_confirmations (household_id, year_month, confirmed, confirmed_at)
  VALUES
    (v_household_id, '2026-05', true, '2026-05-28'),
    (v_household_id, '2026-06', true, '2026-06-28'),
    (v_household_id, '2026-07', true, '2026-07-28'),
    (v_household_id, '2026-08', true, '2026-08-28'),
    (v_household_id, '2026-09', true, '2026-09-28')
  ON CONFLICT (household_id, year_month) DO UPDATE SET confirmed = true, confirmed_at = EXCLUDED.confirmed_at;

  -- 6) Transactions — 6 months, category by category, with the
  --    scenarios described at the top of this file
  INSERT INTO transactions (household_id, category_id, amount, description, date, payment_method, type)
  SELECT v_household_id, bc.id, v.amount, v.description, v.tdate, v.pm, 'expense'
  FROM (VALUES
    -- ===== MAYO 2026 — mes saludable, meta de ahorro superada =====
    ('Vivienda/alquiler', 3000, 'Pago alquiler mayo', '2026-05-01'::date, 'transferencia'),
    ('Alimentación', 1300, 'Supermercado quincena', '2026-05-08'::date, 'tarjeta'),
    ('Alimentación', 800, 'Supermercado quincena 2', '2026-05-22'::date, 'tarjeta'),
    ('Transporte', 750, 'Gasolina y parqueos', '2026-05-10'::date, 'efectivo'),
    ('Salud/medicinas', 300, 'Farmacia Galeno', '2026-05-12'::date, 'tarjeta'),
    ('Servicios (agua, luz, internet)', 580, 'Pago EEGSA, agua y Claro', '2026-05-05'::date, 'transferencia'),
    ('Educación', 500, 'Colegiatura', '2026-05-03'::date, 'transferencia'),
    ('Restaurantes y salidas', 300, 'Cena fin de semana', '2026-05-06'::date, 'tarjeta'),
    ('Restaurantes y salidas', 400, 'Almuerzos de la semana', '2026-05-20'::date, 'tarjeta'),
    ('Ropa', 350, 'Ropa y zapatos', '2026-05-18'::date, 'tarjeta'),
    ('Entretenimiento', 450, 'Cine y streaming', '2026-05-14'::date, 'tarjeta'),
    ('Suscripciones', 250, 'Netflix, Spotify, Disney+', '2026-05-01'::date, 'tarjeta'),
    ('Varios personales', 280, 'Gastos varios', '2026-05-25'::date, 'efectivo'),
    ('Fondo de emergencia', 1000, 'Transferencia a ahorro - fondo de emergencia', '2026-05-28'::date, 'transferencia'),
    ('Ahorro metas', 900, 'Transferencia a ahorro - meta viaje', '2026-05-28'::date, 'transferencia'),
    ('Pago de deudas extra', 500, 'Pago extra a tarjeta de crédito', '2026-05-28'::date, 'transferencia'),

    -- ===== JUNIO 2026 — sobregiros en varias categorías =====
    ('Vivienda/alquiler', 3000, 'Pago alquiler junio', '2026-06-01'::date, 'transferencia'),
    ('Alimentación', 1500, 'Supermercado quincena', '2026-06-09'::date, 'tarjeta'),
    ('Alimentación', 1100, 'Supermercado quincena 2', '2026-06-23'::date, 'tarjeta'),
    ('Transporte', 820, 'Gasolina, Uber y parqueos', '2026-06-11'::date, 'tarjeta'),
    ('Salud/medicinas', 150, 'Farmacia', '2026-06-14'::date, 'efectivo'),
    ('Servicios (agua, luz, internet)', 600, 'Pago EEGSA, agua y Claro', '2026-06-05'::date, 'transferencia'),
    ('Educación', 500, 'Colegiatura', '2026-06-03'::date, 'transferencia'),
    ('Restaurantes y salidas', 500, 'Cena de cumpleaños', '2026-06-07'::date, 'tarjeta'),
    ('Restaurantes y salidas', 600, 'Salidas fin de semana', '2026-06-21'::date, 'tarjeta'),
    ('Ropa', 400, 'Ropa y zapatos', '2026-06-19'::date, 'tarjeta'),
    ('Entretenimiento', 300, 'Concierto', '2026-06-02'::date, 'tarjeta'),
    ('Entretenimiento', 600, 'Streaming y salidas', '2026-06-16'::date, 'tarjeta'),
    ('Suscripciones', 250, 'Netflix, Spotify, Disney+', '2026-06-01'::date, 'tarjeta'),
    ('Varios personales', 320, 'Gastos varios', '2026-06-24'::date, 'efectivo'),
    ('Fondo de emergencia', 600, 'Transferencia a ahorro - fondo de emergencia', '2026-06-27'::date, 'transferencia'),
    ('Ahorro metas', 400, 'Transferencia a ahorro - meta viaje', '2026-06-27'::date, 'transferencia'),
    ('Pago de deudas extra', 500, 'Pago extra a tarjeta de crédito', '2026-06-27'::date, 'transferencia'),

    -- ===== JULIO 2026 — gastos/ahorros no ejecutados =====
    -- (Salud, Educación, Ropa, Suscripciones, Fondo de emergencia y
    --  Pago de deudas quedan sin ninguna transacción este mes)
    ('Vivienda/alquiler', 3000, 'Pago alquiler julio', '2026-07-01'::date, 'transferencia'),
    ('Alimentación', 1900, 'Supermercado del mes', '2026-07-10'::date, 'tarjeta'),
    ('Transporte', 700, 'Gasolina y parqueos', '2026-07-12'::date, 'efectivo'),
    ('Servicios (agua, luz, internet)', 600, 'Pago EEGSA, agua y Claro', '2026-07-05'::date, 'transferencia'),
    ('Restaurantes y salidas', 600, 'Salidas del mes', '2026-07-20'::date, 'tarjeta'),
    ('Entretenimiento', 400, 'Streaming y cine', '2026-07-15'::date, 'tarjeta'),
    ('Varios personales', 250, 'Gastos varios', '2026-07-22'::date, 'efectivo'),
    ('Ahorro metas', 800, 'Transferencia a ahorro - meta viaje', '2026-07-28'::date, 'transferencia'),

    -- ===== AGOSTO 2026 — mes mixto: sobregiros leves dispersos =====
    -- (Ahorro metas queda sin ejecutar este mes)
    ('Vivienda/alquiler', 3000, 'Pago alquiler agosto', '2026-08-01'::date, 'transferencia'),
    ('Alimentación', 1300, 'Supermercado quincena', '2026-08-09'::date, 'tarjeta'),
    ('Alimentación', 1000, 'Supermercado quincena 2', '2026-08-24'::date, 'tarjeta'),
    ('Transporte', 780, 'Gasolina y parqueos', '2026-08-13'::date, 'efectivo'),
    ('Salud/medicinas', 500, 'Consulta médica y medicinas', '2026-08-16'::date, 'tarjeta'),
    ('Servicios (agua, luz, internet)', 610, 'Pago EEGSA, agua y Claro', '2026-08-05'::date, 'transferencia'),
    ('Educación', 500, 'Colegiatura', '2026-08-04'::date, 'transferencia'),
    ('Restaurantes y salidas', 400, 'Cena fin de semana', '2026-08-08'::date, 'tarjeta'),
    ('Restaurantes y salidas', 350, 'Almuerzos de la semana', '2026-08-22'::date, 'tarjeta'),
    ('Ropa', 420, 'Ropa y zapatos', '2026-08-19'::date, 'tarjeta'),
    ('Entretenimiento', 480, 'Cine y streaming', '2026-08-14'::date, 'tarjeta'),
    ('Suscripciones', 250, 'Netflix, Spotify, Disney+', '2026-08-01'::date, 'tarjeta'),
    ('Varios personales', 300, 'Gastos varios', '2026-08-25'::date, 'efectivo'),
    ('Fondo de emergencia', 1200, 'Transferencia a ahorro - fondo de emergencia', '2026-08-27'::date, 'transferencia'),
    ('Pago de deudas extra', 500, 'Pago extra a tarjeta de crédito', '2026-08-27'::date, 'transferencia'),

    -- ===== SEPTIEMBRE 2026 — mes saludable, línea base para octubre =====
    -- (incluye movimientos en los días 1-3 para la comparación de Insights)
    ('Vivienda/alquiler', 3000, 'Pago alquiler septiembre', '2026-09-01'::date, 'transferencia'),
    ('Alimentación', 180, 'Super rápido', '2026-09-01'::date, 'tarjeta'),
    ('Alimentación', 970, 'Supermercado quincena', '2026-09-09'::date, 'tarjeta'),
    ('Alimentación', 1000, 'Supermercado quincena 2', '2026-09-23'::date, 'tarjeta'),
    ('Transporte', 50, 'Gasolina', '2026-09-02'::date, 'efectivo'),
    ('Transporte', 710, 'Gasolina y parqueos', '2026-09-11'::date, 'efectivo'),
    ('Salud/medicinas', 250, 'Farmacia', '2026-09-13'::date, 'tarjeta'),
    ('Servicios (agua, luz, internet)', 590, 'Pago EEGSA, agua y Claro', '2026-09-05'::date, 'transferencia'),
    ('Educación', 500, 'Colegiatura', '2026-09-10'::date, 'transferencia'),
    ('Restaurantes y salidas', 120, 'Almuerzo', '2026-09-03'::date, 'tarjeta'),
    ('Restaurantes y salidas', 560, 'Salidas fin de semana', '2026-09-19'::date, 'tarjeta'),
    ('Ropa', 300, 'Ropa y zapatos', '2026-09-17'::date, 'tarjeta'),
    ('Entretenimiento', 420, 'Cine y streaming', '2026-09-14'::date, 'tarjeta'),
    ('Suscripciones', 250, 'Netflix, Spotify, Disney+', '2026-09-01'::date, 'tarjeta'),
    ('Varios personales', 270, 'Gastos varios', '2026-09-24'::date, 'efectivo'),
    ('Fondo de emergencia', 1000, 'Transferencia a ahorro - fondo de emergencia', '2026-09-27'::date, 'transferencia'),
    ('Ahorro metas', 850, 'Transferencia a ahorro - meta viaje', '2026-09-27'::date, 'transferencia'),
    ('Pago de deudas extra', 500, 'Pago extra a tarjeta de crédito', '2026-09-27'::date, 'transferencia'),

    -- ===== OCTUBRE 2026 — mes actual, solo días 1-3 =====
    -- Salud/medicinas ya está en sobregiro; Alimentación y
    -- Entretenimiento ya van en riesgo por ritmo de gasto; Fondo de
    -- emergencia sigue sin movimiento (dispara "aún no registrás
    -- ahorro este mes").
    ('Vivienda/alquiler', 3000, 'Pago alquiler octubre', '2026-10-01'::date, 'transferencia'),
    ('Transporte', 40, 'Gasolina', '2026-10-01'::date, 'efectivo'),
    ('Salud/medicinas', 450, 'Emergencia dental', '2026-10-01'::date, 'tarjeta'),
    ('Restaurantes y salidas', 80, 'Almuerzo', '2026-10-01'::date, 'efectivo'),
    ('Suscripciones', 250, 'Netflix, Spotify, Disney+', '2026-10-01'::date, 'tarjeta'),
    ('Entretenimiento', 200, 'Streaming y salida', '2026-10-02'::date, 'tarjeta'),
    ('Alimentación', 300, 'Supermercado', '2026-10-03'::date, 'tarjeta')
  ) AS v(cat_name, amount, description, tdate, pm)
  JOIN budget_categories bc ON bc.name = v.cat_name AND bc.household_id = v_household_id;

  -- 7) Metas de ahorro (financial_goals / goal_contributions)
  --    current_amount se actualiza solo vía el trigger de contribuciones.
  DECLARE
    v_goal_emergencia uuid;
    v_goal_viaje uuid;
    v_goal_carro uuid;
  BEGIN
    INSERT INTO financial_goals (user_id, name, emoji, target_amount, monthly_contribution, goal_type, status)
      VALUES (v_user_id, 'Fondo de emergencia', '🛟', 30000, 1000, 'emergency_fund', 'active')
      RETURNING id INTO v_goal_emergencia;
    INSERT INTO financial_goals (user_id, name, emoji, target_amount, monthly_contribution, goal_type, status)
      VALUES (v_user_id, 'Viaje a Antigua', '✈️', 8000, 2000, 'travel', 'active')
      RETURNING id INTO v_goal_viaje;
    INSERT INTO financial_goals (user_id, name, emoji, target_amount, monthly_contribution, target_date, goal_type, status)
      VALUES (v_user_id, 'Carro nuevo', '🚗', 50000, 500, '2028-06-01', 'vehicle', 'active')
      RETURNING id INTO v_goal_carro;

    INSERT INTO goal_contributions (goal_id, user_id, amount, note, created_at) VALUES
      (v_goal_emergencia, v_user_id, 3000, 'Aporte mayo', '2026-05-28T10:00:00Z'),
      (v_goal_emergencia, v_user_id, 3000, 'Aporte junio', '2026-06-27T10:00:00Z'),
      (v_goal_emergencia, v_user_id, 3000, 'Aporte julio', '2026-07-28T10:00:00Z'),
      (v_goal_emergencia, v_user_id, 3000, 'Aporte agosto', '2026-08-27T10:00:00Z'),
      (v_goal_emergencia, v_user_id, 3000, 'Aporte septiembre', '2026-09-27T10:00:00Z'),
      (v_goal_emergencia, v_user_id, 3000, 'Aporte octubre', '2026-10-01T10:00:00Z'),

      (v_goal_viaje, v_user_id, 2000, 'Aporte mayo', '2026-05-28T10:00:00Z'),
      (v_goal_viaje, v_user_id, 2000, 'Aporte junio', '2026-06-27T10:00:00Z'),
      (v_goal_viaje, v_user_id, 2000, 'Aporte julio', '2026-07-28T10:00:00Z'),
      (v_goal_viaje, v_user_id, 2000, 'Aporte agosto — ¡meta completada!', '2026-08-27T10:00:00Z'),

      (v_goal_carro, v_user_id, 1000, 'Aporte mayo', '2026-05-28T10:00:00Z'),
      (v_goal_carro, v_user_id, 1000, 'Aporte junio', '2026-06-27T10:00:00Z'),
      (v_goal_carro, v_user_id, 1000, 'Aporte julio', '2026-07-28T10:00:00Z'),
      (v_goal_carro, v_user_id, 1000, 'Aporte agosto', '2026-08-27T10:00:00Z'),
      (v_goal_carro, v_user_id, 1000, 'Aporte septiembre', '2026-09-27T10:00:00Z');
  END;

  RAISE NOTICE 'QA sample data loaded for household %', v_household_id;
END $$;
