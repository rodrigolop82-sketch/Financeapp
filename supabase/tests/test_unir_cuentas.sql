-- Unir dos cuentas y deshacer: datos en ambos lados, invitado vacío,
-- repetidos, metas unidas, RLS antes de aceptar y "nunca sin hogar".
\ir helpers.sql
DO $$
DECLARE
  ana UUID := test_user('ana.u@test.gt', 'Ana Pérez');
  luis UUID := test_user('luis.u@test.gt', 'Luis Pérez');
  sofi UUID := test_user('sofi.u@test.gt', 'Sofi');
  hh_ana UUID; hh_luis UUID; hh_sofi UUID;
  cat_ana_ali UUID; cat_luis_ali UUID; cat_luis_gym UUID;
  tx_dup UUID; tx_luis UUID;
  g_ana UUID; g_luis UUID;
  res JSONB; merge_id UUID;
  n INT; v NUMERIC; t TEXT;
BEGIN
  -- Ana: Familiar, con su hogar y datos.
  INSERT INTO households (name, owner_id) VALUES ('Casa Pérez', ana) RETURNING id INTO hh_ana;
  INSERT INTO household_members (household_id, user_id, role) VALUES (hh_ana, ana, 'owner');
  UPDATE users SET plan = 'family', trial_ends_at = NOW() - INTERVAL '1 day' WHERE id = ana;
  SELECT id INTO cat_ana_ali FROM budget_categories WHERE household_id = hh_ana AND name = 'Alimentación';
  UPDATE budget_categories SET budgeted_amount = 1500 WHERE id = cat_ana_ali;
  INSERT INTO transactions (household_id, category_id, amount, description, date, type, created_by)
    VALUES (hh_ana, cat_ana_ali, 512, 'Paiz', CURRENT_DATE - 5, 'expense', ana);
  INSERT INTO financial_goals (user_id, household_id, name, target_amount, current_amount)
    VALUES (ana, hh_ana, 'Fondo de emergencia', 15000, 3000) RETURNING id INTO g_ana;
  INSERT INTO household_invites (household_id, invite_code, created_by) VALUES (hh_ana, 'INVITA01', ana);

  -- Luis: su propio hogar con historia.
  INSERT INTO households (name, owner_id) VALUES ('Luis', luis) RETURNING id INTO hh_luis;
  INSERT INTO household_members (household_id, user_id, role) VALUES (hh_luis, luis, 'owner');
  UPDATE users SET trial_ends_at = NOW() - INTERVAL '1 day' WHERE id = luis;
  SELECT id INTO cat_luis_ali FROM budget_categories WHERE household_id = hh_luis AND name = 'Alimentación';
  UPDATE budget_categories SET budgeted_amount = 900 WHERE id = cat_luis_ali;
  INSERT INTO budget_categories (household_id, name, bucket, budgeted_amount, is_custom, parent_category_id, icon, color)
    SELECT hh_luis, 'Gimnasio', 'wants', 250, true, id, '🏋️', '#2563EB' FROM budget_categories WHERE household_id = hh_luis AND name = 'Entretenimiento'
    RETURNING id INTO cat_luis_gym;
  INSERT INTO transactions (household_id, category_id, amount, description, date, type, created_by)
    VALUES (hh_luis, cat_luis_ali, 512, 'Paiz', CURRENT_DATE - 5, 'expense', luis) RETURNING id INTO tx_dup;
  INSERT INTO transactions (household_id, category_id, amount, description, date, type, created_by)
    VALUES (hh_luis, cat_luis_gym, 250, 'Smart Fit', CURRENT_DATE - 3, 'expense', luis) RETURNING id INTO tx_luis;
  INSERT INTO debts (household_id, name, balance, min_payment, due_day) VALUES (hh_luis, 'Visa', 5000, 850, 8);
  INSERT INTO financial_goals (user_id, household_id, name, target_amount, current_amount)
    VALUES (luis, hh_luis, 'Emergencias', 10000, 2200) RETURNING id INTO g_luis;
  INSERT INTO goal_contributions (goal_id, user_id, amount) VALUES (g_luis, luis, 2200);
  UPDATE financial_goals SET current_amount = 2200 WHERE id = g_luis;

  -- RLS: antes de aceptar, Luis no ve nada de Ana.
  PERFORM test_as(luis);
  SELECT count(*) INTO n FROM transactions WHERE household_id = hh_ana;
  PERFORM assert_eq(n, 0, 'invitado no ve al host antes de aceptar');

  -- Unir: sumar Alimentación, juntar el repetido, unir las metas.
  res := merge_households('INVITA01', jsonb_build_object(
    'budget', jsonb_build_object(cat_luis_ali::text, 'sum'),
    'duplicates', jsonb_build_array(tx_dup::text),
    'goals', jsonb_build_object(g_luis::text, 'merge:' || g_ana::text)
  ));
  merge_id := (res->>'merge_id')::uuid;
  PERFORM test_as(NULL);

  PERFORM assert_eq((res->>'transactions')::int, 1, 'se mueve 1 movimiento (el repetido se queda)');
  SELECT budgeted_amount INTO v FROM budget_categories WHERE id = cat_ana_ali;
  PERFORM assert_eq(v, 2400::numeric, 'Alimentación sumada');
  SELECT household_id::text INTO t FROM budget_categories WHERE id = cat_luis_gym;
  PERFORM assert_eq(t, hh_ana::text, 'Gimnasio pasa al hogar');
  SELECT count(*) INTO n FROM transactions WHERE id = tx_luis AND household_id = hh_ana AND paid_by = luis AND origin_household_id = hh_luis;
  PERFORM assert_eq(n, 1, 'movimiento de Luis en el hogar, pagado por Luis');
  SELECT count(*) INTO n FROM transactions WHERE id = tx_dup AND household_id = hh_luis;
  PERFORM assert_eq(n, 1, 'el repetido no se borra');
  SELECT current_amount INTO v FROM financial_goals WHERE id = g_ana;
  PERFORM assert_eq(v, 5200::numeric, 'metas unidas suman');
  SELECT count(*) INTO n FROM goal_contributions WHERE goal_id = g_ana AND user_id = luis;
  PERFORM assert_eq(n, 1, 'el aporte conserva a Luis');
  SELECT count(*) INTO n FROM debts WHERE household_id = hh_ana AND responsible_id = luis;
  PERFORM assert_eq(n, 1, 'la deuda queda con Luis de responsable');
  SELECT count(*) INTO n FROM households WHERE id = hh_luis AND archived_at IS NOT NULL;
  PERFORM assert_eq(n, 1, 'el hogar de Luis se archiva');
  SELECT count(*) INTO n FROM households WHERE id = hh_ana AND family_since IS NOT NULL;
  PERFORM assert_eq(n, 1, 'family_since');

  -- Luis ve un solo hogar activo: el de Ana.
  PERFORM test_as(luis);
  SELECT count(*) INTO n FROM get_my_household_ids();
  PERFORM assert_eq(n, 1, 'un solo hogar activo');
  SELECT count(*) INTO n FROM transactions;
  PERFORM assert_eq(n, 2, 'Luis ve los movimientos del hogar (no el repetido archivado)');
  -- Registra algo nuevo después de unir.
  INSERT INTO transactions (household_id, category_id, amount, description, date, type, created_by)
    VALUES (hh_ana, cat_luis_gym, 99, 'Proteína', CURRENT_DATE, 'expense', luis);
  PERFORM test_as(NULL);

  -- Deshacer (dentro de los 30 días).
  PERFORM test_as(luis);
  res := unmerge_household(merge_id);
  PERFORM test_as(NULL);
  SELECT count(*) INTO n FROM transactions WHERE household_id = hh_luis;
  PERFORM assert_eq(n, 3, 'vuelven sus movimientos, el repetido y lo nuevo');
  SELECT count(*) INTO n FROM transactions WHERE household_id = hh_ana;
  PERFORM assert_eq(n, 1, 'Ana queda con lo suyo');
  SELECT budgeted_amount INTO v FROM budget_categories WHERE id = cat_ana_ali;
  PERFORM assert_eq(v, 1500::numeric, 'el plan de Ana vuelve');
  SELECT current_amount INTO v FROM financial_goals WHERE id = g_ana;
  PERFORM assert_eq(v, 3000::numeric, 'la meta de Ana vuelve');
  SELECT count(*) INTO n FROM goal_contributions WHERE goal_id = g_luis;
  PERFORM assert_eq(n, 1, 'el aporte vuelve a la meta de Luis');
  SELECT count(*) INTO n FROM financial_goals WHERE id = g_luis AND merged_into IS NULL AND household_id = hh_luis;
  PERFORM assert_eq(n, 1, 'la meta de Luis vuelve a ser suya');
  SELECT count(*) INTO n FROM households WHERE id = hh_luis AND archived_at IS NULL;
  PERFORM assert_eq(n, 1, 'su hogar se restaura');
  SELECT count(*) INTO n FROM household_members WHERE household_id = hh_ana AND user_id = luis;
  PERFORM assert_eq(n, 0, 'sale del hogar de Ana');
  SELECT count(*) INTO n FROM debts WHERE household_id = hh_luis;
  PERFORM assert_eq(n, 1, 'la deuda vuelve');

  -- Invitado sin datos: se une y su hogar vacío se archiva.
  INSERT INTO households (name, owner_id) VALUES ('Sofi', sofi) RETURNING id INTO hh_sofi;
  INSERT INTO household_members (household_id, user_id, role) VALUES (hh_sofi, sofi, 'owner');
  INSERT INTO household_invites (household_id, invite_code, created_by) VALUES (hh_ana, 'INVITA02', ana);
  PERFORM test_as(sofi);
  res := merge_households('INVITA02', '{}'::jsonb);
  PERFORM test_as(NULL);
  PERFORM assert_eq((res->>'transactions')::int, 0, 'invitado vacío');
  SELECT count(*) INTO n FROM household_members WHERE household_id = hh_ana AND user_id = sofi AND access = 'full';
  PERFORM assert_eq(n, 1, 'Sofi entra con acceso completo');

  -- Sin asiento libre: no entra un tercero.
  INSERT INTO household_invites (household_id, invite_code, created_by) VALUES (hh_ana, 'INVITA03', ana);
  PERFORM test_as(luis);
  BEGIN
    PERFORM merge_households('INVITA03', '{}'::jsonb);
    RAISE EXCEPTION 'FALLÓ: entró un tercer adulto';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'no_seat' THEN RAISE; END IF;
  END;
  PERFORM test_as(NULL);

  -- Host sin Familiar y el invitado con datos: no se une.
  DELETE FROM household_members WHERE household_id = hh_ana AND user_id = sofi;
  UPDATE users SET plan = 'premium' WHERE id = ana;
  INSERT INTO household_invites (household_id, invite_code, created_by) VALUES (hh_ana, 'INVITA04', ana);
  PERFORM test_as(luis);
  BEGIN
    PERFORM merge_households('INVITA04', '{}'::jsonb);
    RAISE EXCEPTION 'FALLÓ: se unió sin Familiar';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'host_not_family' THEN RAISE; END IF;
  END;
  PERFORM test_as(NULL);
END $$;
