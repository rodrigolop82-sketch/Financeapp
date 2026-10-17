-- C5 · Eliminar mi cuenta: hogar propio sin nadie más, hogar compartido
-- (pasa a la otra persona), miembro de un hogar ajeno, facturación anónima
-- y permisos (solo la service role puede llamarla).
\ir helpers.sql
DO $$
DECLARE
  sola UUID := test_user('sola@test.gt', 'Sola');
  ana UUID := test_user('ana.c5@test.gt', 'Ana');
  luis UUID := test_user('luis.c5@test.gt', 'Luis');
  hh_sola UUID; hh_ana UUID;
  cat UUID; g_shared UUID; g_private UUID; src_ana UUID; src_shared UUID;
  res JSONB; n INT; t TEXT;
BEGIN
  -- Sola: su hogar con datos y una suscripción con su evento de cobro.
  INSERT INTO households (name, owner_id) VALUES ('Sola', sola) RETURNING id INTO hh_sola;
  INSERT INTO household_members (household_id, user_id, role) VALUES (hh_sola, sola, 'owner');
  SELECT id INTO cat FROM budget_categories WHERE household_id = hh_sola AND name = 'Alimentación';
  INSERT INTO transactions (household_id, category_id, amount, description, date, type, created_by)
    VALUES (hh_sola, cat, 300, 'Super', CURRENT_DATE, 'expense', sola);
  INSERT INTO debts (household_id, name, balance, min_payment) VALUES (hh_sola, 'Tarjeta', 5000, 250);
  INSERT INTO subscriptions (user_id, provider_subscription_id, status, tier, last_amount_cents)
    VALUES (sola, 'sub_SOLA1', 'cancelled', 'premium', 4900);
  INSERT INTO billing_events (id, type, payload)
    VALUES ('evt_1', 'subscription.paid', jsonb_build_object('subscription', 'sub_SOLA1', 'customer', jsonb_build_object('email', 'sola@test.gt', 'name', 'Sola')));
  INSERT INTO billing_events (id, type, payload) VALUES ('evt_otro', 'subscription.paid', '{"subscription":"sub_OTRO"}');
  INSERT INTO feedback (user_id, type, message) VALUES (sola, 'idea', 'Me gusta');

  -- Ana (dueña) y Luis (miembro) comparten hogar.
  INSERT INTO households (name, owner_id) VALUES ('Casa', ana) RETURNING id INTO hh_ana;
  INSERT INTO household_members (household_id, user_id, role) VALUES (hh_ana, ana, 'owner');
  INSERT INTO household_members (household_id, user_id, role, access) VALUES (hh_ana, luis, 'member', 'full');
  SELECT id INTO cat FROM budget_categories WHERE household_id = hh_ana AND name = 'Alimentación';
  INSERT INTO transactions (household_id, category_id, amount, description, date, type, created_by, paid_by, scope)
    VALUES (hh_ana, cat, 800, 'Super compartido', CURRENT_DATE, 'expense', ana, ana, 'shared'),
           (hh_ana, cat, 120, 'Café de Ana', CURRENT_DATE, 'expense', ana, ana, 'personal'),
           (hh_ana, cat, 90, 'Café de Luis', CURRENT_DATE, 'expense', luis, luis, 'personal');
  INSERT INTO financial_goals (user_id, household_id, name, target_amount, current_amount, shared)
    VALUES (ana, hh_ana, 'Viaje juntos', 10000, 2000, true) RETURNING id INTO g_shared;
  INSERT INTO financial_goals (user_id, household_id, name, target_amount, current_amount, shared)
    VALUES (ana, hh_ana, 'Lo mío', 5000, 500, false) RETURNING id INTO g_private;
  INSERT INTO goal_contributions (goal_id, user_id, amount) VALUES (g_shared, ana, 2000);
  INSERT INTO financial_sources (household_id, kind, name, current_balance, balance_updated_at, owner_user_id, shared)
    VALUES (hh_ana, 'bank_account', 'Cuenta de Ana', 900, NOW(), ana, false) RETURNING id INTO src_ana;
  INSERT INTO financial_sources (household_id, kind, name, current_balance, balance_updated_at, owner_user_id, shared)
    VALUES (hh_ana, 'bank_account', 'Cuenta de la casa', 5000, NOW(), ana, true) RETURNING id INTO src_shared;

  -- Nadie más que la service role puede llamarla.
  PERFORM test_as(luis);
  BEGIN
    PERFORM eliminar_cuenta(ana);
    RAISE EXCEPTION 'FALLÓ: un usuario pudo llamar eliminar_cuenta';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  PERFORM test_as(NULL);

  -- 1) Sola: se borra su hogar y la facturación queda anónima.
  res := eliminar_cuenta(sola);
  PERFORM assert_eq((res->>'hogares_borrados')::int, 1, 'sola: hogar borrado');
  PERFORM assert_eq((SELECT count(*) FROM households WHERE id = hh_sola)::int, 0, 'sola: sin hogar');
  PERFORM assert_eq((SELECT count(*) FROM transactions WHERE household_id = hh_sola)::int, 0, 'sola: sin movimientos');
  PERFORM assert_eq((SELECT count(*) FROM debts WHERE household_id = hh_sola)::int, 0, 'sola: sin deudas');
  PERFORM assert_eq((SELECT count(*) FROM users WHERE id = sola)::int, 0, 'sola: sin users');
  PERFORM assert_eq((SELECT count(*) FROM auth.users WHERE id = sola)::int, 0, 'sola: sin auth.users');
  PERFORM assert_eq((SELECT count(*) FROM feedback WHERE message = 'Me gusta')::int, 0, 'sola: feedback borrado');
  SELECT count(*) INTO n FROM subscriptions WHERE provider_subscription_id = 'sub_SOLA1' AND user_id IS NULL AND last_amount_cents = 4900;
  PERFORM assert_eq(n, 1, 'sola: suscripción conservada sin dueño');
  SELECT payload::text INTO t FROM billing_events WHERE id = 'evt_1';
  PERFORM assert_eq(t, '{"anonimizado": true}', 'sola: evento de cobro anónimo');
  SELECT payload::text INTO t FROM billing_events WHERE id = 'evt_otro';
  PERFORM assert_eq(t, '{"subscription": "sub_OTRO"}', 'otros eventos intactos');
  PERFORM assert_eq((SELECT count(*) FROM cuentas_eliminadas)::int, 1, 'registro anónimo');

  -- 2) Ana (dueña de un hogar compartido): el hogar pasa a Luis.
  res := eliminar_cuenta(ana);
  PERFORM assert_eq((res->>'hogares_transferidos')::int, 1, 'ana: hogar transferido');
  PERFORM assert_eq((SELECT owner_id FROM households WHERE id = hh_ana), luis, 'el hogar es de Luis');
  PERFORM assert_eq((SELECT role FROM household_members WHERE household_id = hh_ana AND user_id = luis), 'owner', 'Luis es dueño');
  PERFORM assert_eq((SELECT count(*) FROM household_members WHERE household_id = hh_ana)::int, 1, 'Ana ya no es miembro');
  PERFORM assert_eq((SELECT count(*) FROM transactions WHERE description = 'Super compartido' AND paid_by IS NULL)::int, 1, 'lo compartido queda, sin quién pagó');
  PERFORM assert_eq((SELECT count(*) FROM transactions WHERE description = 'Café de Ana')::int, 0, 'lo personal de Ana se borra');
  PERFORM assert_eq((SELECT count(*) FROM transactions WHERE description = 'Café de Luis')::int, 1, 'lo personal de Luis queda');
  PERFORM assert_eq((SELECT user_id FROM financial_goals WHERE id = g_shared), luis, 'meta compartida pasa a Luis');
  PERFORM assert_eq((SELECT count(*) FROM goal_contributions WHERE goal_id = g_shared)::int, 1, 'sus aportes a la meta compartida quedan');
  PERFORM assert_eq((SELECT count(*) FROM financial_goals WHERE id = g_private)::int, 0, 'meta privada de Ana borrada');
  PERFORM assert_eq((SELECT count(*) FROM financial_sources WHERE id = src_ana)::int, 0, 'cuenta propia de Ana borrada');
  PERFORM assert_eq((SELECT count(*) FROM financial_sources WHERE id = src_shared)::int, 1, 'cuenta compartida queda');
  PERFORM assert_eq((SELECT count(*) FROM users WHERE id = ana)::int, 0, 'ana: sin users');

  -- 3) Luis ahora vive solo: al irse, se borra el hogar.
  res := eliminar_cuenta(luis);
  PERFORM assert_eq((SELECT count(*) FROM households WHERE id = hh_ana)::int, 0, 'luis: hogar borrado');

  -- 4) Un usuario que no existe.
  BEGIN
    PERFORM eliminar_cuenta(gen_random_uuid());
    RAISE EXCEPTION 'FALLÓ: borró un usuario inexistente';
  EXCEPTION WHEN raise_exception THEN
    GET STACKED DIAGNOSTICS t = MESSAGE_TEXT;
    PERFORM assert_eq(t, 'usuario_no_existe', 'usuario inexistente');
  END;
END $$;
