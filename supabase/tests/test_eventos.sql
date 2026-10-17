-- Eventos (20261105): los miembros ven, quienes escriben editan nombre,
-- fechas y conceptos; crear y reactivar solo por la API (service role).
-- Un gasto solo se asigna a un concepto de su hogar; al borrar el concepto
-- el gasto queda sin evento.
\ir helpers.sql
DO $$
DECLARE
  ana UUID := test_user('ana.eventos@test.gt', 'Ana');
  beto UUID := test_user('beto.eventos@test.gt', 'Beto');
  hh UUID; hh2 UUID; ev UUID; c_pastel UUID; c_otro UUID; cat UUID; tx UUID; n INT;
BEGIN
  INSERT INTO households (name, owner_id) VALUES ('Casa Ana', ana) RETURNING id INTO hh;
  INSERT INTO household_members (household_id, user_id, role) VALUES (hh, ana, 'owner');
  INSERT INTO households (name, owner_id) VALUES ('Casa Beto', beto) RETURNING id INTO hh2;
  INSERT INTO household_members (household_id, user_id, role) VALUES (hh2, beto, 'owner');

  -- La API (service role) crea el evento y sus conceptos.
  INSERT INTO eventos (household_id, tipo, nombre, fecha_inicio, created_by) VALUES (hh, 'cumpleanos', 'Cumple Sofía', '2026-12-12', ana) RETURNING id INTO ev;
  INSERT INTO evento_conceptos (evento_id, household_id, nombre, presupuesto, orden) VALUES (ev, hh, 'Pastel', 450, 0) RETURNING id INTO c_pastel;

  -- Un concepto no puede ir a un evento de otro hogar.
  BEGIN
    INSERT INTO evento_conceptos (evento_id, household_id, nombre) VALUES (ev, hh2, 'Intruso');
    RAISE EXCEPTION 'FALLÓ: concepto en otro hogar';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'concepto_de_otro_hogar' THEN RAISE; END IF;
  END;

  -- Ana (cliente): ve, edita nombre y conceptos, asigna un gasto.
  PERFORM test_as(ana);
  PERFORM assert_eq((SELECT count(*) FROM eventos)::int, 1, 'ana ve su evento');
  UPDATE eventos SET nombre = 'Cumple de Sofía' WHERE id = ev;
  PERFORM assert_eq((SELECT nombre FROM eventos WHERE id = ev), 'Cumple de Sofía', 'ana edita el nombre');
  INSERT INTO evento_conceptos (evento_id, household_id, nombre, presupuesto, orden) VALUES (ev, hh, 'Piñata', 200, 1) RETURNING id INTO c_otro;
  SELECT id INTO cat FROM budget_categories WHERE household_id = hh AND name = 'Alimentación';
  INSERT INTO transactions (household_id, category_id, amount, description, date, type, created_by, evento_concepto_id)
    VALUES (hh, cat, 480, 'Pastelería', '2026-12-10', 'expense', ana, c_pastel) RETURNING id INTO tx;
  PERFORM assert_eq((SELECT evento_concepto_id FROM transactions WHERE id = tx), c_pastel, 'gasto asignado');

  -- No puede crear eventos ni tocar archived_at (eso pasa por la API).
  BEGIN
    INSERT INTO eventos (household_id, tipo, nombre) VALUES (hh, 'boda', 'Boda');
    RAISE EXCEPTION 'FALLÓ: el cliente creó un evento';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    UPDATE eventos SET archived_at = NOW() WHERE id = ev;
    RAISE EXCEPTION 'FALLÓ: el cliente archivó un evento';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  PERFORM test_as(NULL);

  -- Beto no ve ni toca el evento de Ana, ni le asigna sus gastos.
  PERFORM test_as(beto);
  PERFORM assert_eq((SELECT count(*) FROM eventos)::int, 0, 'beto no ve eventos ajenos');
  PERFORM assert_eq((SELECT count(*) FROM evento_conceptos)::int, 0, 'beto no ve conceptos ajenos');
  UPDATE evento_conceptos SET presupuesto = 1 WHERE id = c_pastel;
  PERFORM test_as(NULL);
  PERFORM assert_eq((SELECT presupuesto FROM evento_conceptos WHERE id = c_pastel), 450::numeric, 'beto no cambia conceptos ajenos');
  SELECT id INTO cat FROM budget_categories WHERE household_id = hh2 AND name = 'Alimentación';
  BEGIN
    INSERT INTO transactions (household_id, category_id, amount, description, date, type, created_by, evento_concepto_id)
      VALUES (hh2, cat, 10, 'x', '2026-12-10', 'expense', beto, c_pastel);
    RAISE EXCEPTION 'FALLÓ: gasto asignado a concepto de otro hogar';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'concepto_de_otro_hogar' THEN RAISE; END IF;
  END;

  -- Borrar el concepto deja el gasto sin evento; borrar el evento borra sus conceptos.
  DELETE FROM evento_conceptos WHERE id = c_pastel;
  PERFORM assert_eq((SELECT evento_concepto_id FROM transactions WHERE id = tx), NULL::uuid, 'gasto queda sin evento');
  PERFORM assert_eq((SELECT count(*) FROM transactions WHERE id = tx)::int, 1, 'el gasto no se borra');
  DELETE FROM eventos WHERE id = ev;
  SELECT count(*) INTO n FROM evento_conceptos WHERE evento_id = ev;
  PERFORM assert_eq(n, 0, 'conceptos borrados con el evento');
END $$;
