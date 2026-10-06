-- Solo ver: el miembro de un hogar que no es Familiar ve y no escribe; con
-- Familiar escribe. El plan no lo cambia el cliente.
\ir helpers.sql
DO $$
DECLARE
  ana UUID := test_user('ana@test.gt', 'Ana Pérez');
  luis UUID := test_user('luis@test.gt', 'Luis Pérez');
  hh UUID;
  n INT;
BEGIN
  INSERT INTO households (name, owner_id) VALUES ('Casa Pérez', ana) RETURNING id INTO hh;
  INSERT INTO household_members (household_id, user_id, role) VALUES (hh, ana, 'owner');
  INSERT INTO household_members (household_id, user_id, role, access) VALUES (hh, luis, 'member', 'full');
  UPDATE users SET plan = 'premium', trial_ends_at = NOW() - INTERVAL '1 day' WHERE id = ana;
  UPDATE users SET trial_ends_at = NOW() - INTERVAL '1 day' WHERE id = luis;
  INSERT INTO transactions (household_id, amount, description, date, type, created_by) VALUES (hh, 100, 'Super', CURRENT_DATE, 'expense', ana);

  -- Premium (no Familiar): Luis ve pero no escribe.
  PERFORM test_as(luis);
  SELECT count(*) INTO n FROM transactions WHERE household_id = hh;
  PERFORM assert_eq(n, 1, 'Luis ve los movimientos');
  BEGIN
    INSERT INTO transactions (household_id, amount, description, date, type, created_by) VALUES (hh, 50, 'Uber', CURRENT_DATE, 'expense', luis);
    RAISE EXCEPTION 'FALLÓ: Luis pudo registrar en solo ver';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  UPDATE transactions SET amount = 1 WHERE household_id = hh;
  PERFORM test_as(NULL);
  SELECT amount::int INTO n FROM transactions WHERE household_id = hh;
  PERFORM assert_eq(n, 100, 'Luis no pudo editar');

  -- Familiar: Luis escribe y paid_by queda con quien registra.
  UPDATE users SET plan = 'family' WHERE id = ana;
  PERFORM test_as(luis);
  INSERT INTO transactions (household_id, amount, description, date, type, created_by) VALUES (hh, 50, 'Uber', CURRENT_DATE, 'expense', luis);
  PERFORM test_as(NULL);
  SELECT count(*) INTO n FROM transactions WHERE household_id = hh AND paid_by = luis;
  PERFORM assert_eq(n, 1, 'paid_by por defecto = quien registra');

  -- Acceso 'view' guardado: no escribe aunque el hogar sea Familiar.
  UPDATE household_members SET access = 'view' WHERE user_id = luis;
  PERFORM test_as(luis);
  BEGIN
    INSERT INTO budget_sub_items (household_id, category_id, name, amount)
      SELECT hh, id, 'Parte', 10 FROM budget_categories WHERE household_id = hh LIMIT 1;
    RAISE EXCEPTION 'FALLÓ: Luis pudo crear una parte en solo ver';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;

  -- El cliente no se puede subir el plan.
  UPDATE users SET plan = 'family', trial_ends_at = NOW() + INTERVAL '1 year' WHERE id = luis;
  PERFORM test_as(NULL);
  SELECT count(*) INTO n FROM users WHERE id = luis AND plan = 'free' AND trial_ends_at < NOW();
  PERFORM assert_eq(n, 1, 'plan y prueba protegidos');
END $$;
