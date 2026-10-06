-- ══════════════════════════════════════════════
-- Unir dos cuentas en un hogar (y deshacerlo)
-- ══════════════════════════════════════════════
-- Antes: aceptar una invitación solo insertaba en household_members, y el
-- hogar propio del invitado quedaba huérfano (su historia dejaba de verse).
-- Ahora merge_households() mueve lo del invitado al hogar que lo invita, en
-- una transacción, y anota cada fila movida en household_merge_rows para
-- que unmerge_household() la regrese tal cual. Nunca se borra nada:
-- · el hogar del invitado se archiva (archived_at), no se borra;
-- · los repetidos que eligió juntar se quedan en ese hogar archivado.
-- · Un usuario tiene un solo hogar activo: get_my_household_ids() ignora los
--   archivados.

ALTER TABLE households ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;
ALTER TABLE households ADD COLUMN IF NOT EXISTS family_since TIMESTAMPTZ;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS origin_household_id UUID REFERENCES households(id) ON DELETE SET NULL;
ALTER TABLE financial_goals ADD COLUMN IF NOT EXISTS merged_into UUID REFERENCES financial_goals(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS household_merges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  host_household_id UUID REFERENCES households(id) ON DELETE CASCADE,
  guest_household_id UUID REFERENCES households(id) ON DELETE SET NULL,
  guest_user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  merged_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  undo_until TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '30 days',
  undone_at TIMESTAMPTZ,
  choices JSONB NOT NULL DEFAULT '{}'::jsonb,
  summary JSONB NOT NULL DEFAULT '{}'::jsonb
);
CREATE INDEX IF NOT EXISTS idx_household_merges_host ON household_merges(host_household_id);
CREATE INDEX IF NOT EXISTS idx_household_merges_guest ON household_merges(guest_user_id);

-- Lo que cambió cada unión: tabla, fila y valores de antes.
CREATE TABLE IF NOT EXISTS household_merge_rows (
  merge_id UUID NOT NULL REFERENCES household_merges(id) ON DELETE CASCADE,
  seq BIGSERIAL,
  tbl TEXT NOT NULL,
  row_id TEXT NOT NULL,
  old JSONB NOT NULL DEFAULT '{}'::jsonb,
  PRIMARY KEY (merge_id, seq)
);

ALTER TABLE household_merges ENABLE ROW LEVEL SECURITY;
ALTER TABLE household_merge_rows ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Members can view merges" ON household_merges;
CREATE POLICY "Members can view merges" ON household_merges
  FOR SELECT USING (guest_user_id = auth.uid() OR host_household_id IN (SELECT get_my_household_ids()));
-- household_merge_rows: sin políticas (solo las funciones).

-- ── Un solo hogar activo ──
CREATE OR REPLACE FUNCTION get_my_household_ids()
RETURNS SETOF UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT hm.household_id
  FROM household_members hm
  JOIN households h ON h.id = hm.household_id
  WHERE hm.user_id = auth.uid() AND h.archived_at IS NULL
$$;

CREATE OR REPLACE FUNCTION get_my_writable_household_ids()
RETURNS SETOF UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT h.id FROM households h WHERE h.owner_id = auth.uid() AND h.archived_at IS NULL
  UNION
  SELECT hm.household_id
  FROM household_members hm
  JOIN households h ON h.id = hm.household_id
  JOIN users o ON o.id = h.owner_id
  WHERE hm.user_id = auth.uid()
    AND h.archived_at IS NULL
    AND (
      hm.role = 'owner'
      OR (hm.access = 'full' AND (o.plan = 'family' OR o.trial_ends_at > NOW()))
    )
$$;

-- Nombre comparable de una categoría ("Alimentación" = "alimentacion").
CREATE OR REPLACE FUNCTION zafi_norm(p TEXT) RETURNS TEXT
LANGUAGE sql IMMUTABLE
SET search_path = public, extensions
AS $$ SELECT lower(extensions.unaccent(trim(coalesce(p, '')))) $$;

-- ══════════════════════════════════════════════
-- merge_households(código de invitación, elecciones)
-- ══════════════════════════════════════════════
-- p_choices:
--   budget:     { "<id categoría del invitado>": "sum" | "host" | "guest" }  (por defecto "sum")
--   duplicates: [ "<id movimiento del invitado>", … ]  se quedan en su hogar archivado
--   goals:      { "<id meta del invitado>": "shared" | "personal" | "merge:<id meta del hogar>" }
CREATE OR REPLACE FUNCTION merge_households(p_invite_code TEXT, p_choices JSONB DEFAULT '{}'::jsonb)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_guest UUID := auth.uid();
  v_inv household_invites%ROWTYPE;
  v_host UUID;
  v_host_owner UUID;
  v_guest_hh UUID;
  v_family BOOLEAN;
  v_has_data BOOLEAN := false;
  v_access TEXT;
  v_merge UUID;
  v_choice TEXT;
  v_goal_choice TEXT;
  v_target UUID;
  v_dups UUID[] := ARRAY(SELECT jsonb_array_elements_text(COALESCE(p_choices->'duplicates', '[]'::jsonb))::uuid);
  c RECORD;
  g RECORD;
  v_count_tx INT := 0;
  v_count_goals INT := 0;
  v_count_debts INT := 0;
BEGIN
  IF v_guest IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;

  SELECT * INTO v_inv FROM household_invites WHERE invite_code = p_invite_code AND status = 'active' FOR UPDATE;
  IF NOT FOUND OR v_inv.expires_at < NOW() THEN RAISE EXCEPTION 'invite_invalid'; END IF;
  v_host := v_inv.household_id;
  SELECT owner_id INTO v_host_owner FROM households WHERE id = v_host AND archived_at IS NULL FOR UPDATE;
  IF v_host_owner IS NULL THEN RAISE EXCEPTION 'invite_invalid'; END IF;
  IF v_host_owner = v_guest THEN RAISE EXCEPTION 'own_household'; END IF;
  IF EXISTS (SELECT 1 FROM household_members WHERE household_id = v_host AND user_id = v_guest) THEN
    RAISE EXCEPTION 'already_member';
  END IF;
  -- Familiar: 2 adultos (el dueño + 1).
  IF EXISTS (SELECT 1 FROM household_members WHERE household_id = v_host AND role = 'member') THEN
    RAISE EXCEPTION 'no_seat';
  END IF;
  IF EXISTS (
    SELECT 1 FROM household_members hm JOIN households h ON h.id = hm.household_id
    WHERE hm.user_id = v_guest AND hm.role = 'member' AND h.archived_at IS NULL
  ) THEN
    RAISE EXCEPTION 'already_in_household';
  END IF;

  SELECT (plan = 'family' OR trial_ends_at > NOW()) INTO v_family FROM users WHERE id = v_host_owner;
  v_family := COALESCE(v_family, false);

  SELECT id INTO v_guest_hh FROM households
  WHERE owner_id = v_guest AND archived_at IS NULL
  ORDER BY created_at LIMIT 1;

  IF v_guest_hh IS NOT NULL THEN
    v_has_data := EXISTS (SELECT 1 FROM transactions WHERE household_id = v_guest_hh)
      OR EXISTS (SELECT 1 FROM financial_goals WHERE user_id = v_guest AND merged_into IS NULL)
      OR EXISTS (SELECT 1 FROM debts WHERE household_id = v_guest_hh);
  END IF;
  -- Juntar historias es de Familiar; sin Familiar solo entra a ver (y sin datos).
  IF v_has_data AND NOT v_family THEN RAISE EXCEPTION 'host_not_family'; END IF;
  v_access := CASE WHEN v_family THEN 'full' ELSE 'view' END;

  INSERT INTO household_merges (host_household_id, guest_household_id, guest_user_id, choices)
  VALUES (v_host, v_guest_hh, v_guest, COALESCE(p_choices, '{}'::jsonb))
  RETURNING id INTO v_merge;

  IF v_guest_hh IS NOT NULL THEN
    CREATE TEMP TABLE IF NOT EXISTS _zafi_catmap (old_id UUID PRIMARY KEY, new_id UUID NOT NULL) ON COMMIT DROP;
    CREATE TEMP TABLE IF NOT EXISTS _zafi_submoved (id UUID PRIMARY KEY) ON COMMIT DROP;
    TRUNCATE _zafi_catmap, _zafi_submoved;

    -- 1. Categorías: las que el hogar ya tiene (mismo nombre y grupo) se juntan;
    --    las demás se pasan al hogar. Primero los grupos (sin padre).
    FOR c IN
      SELECT * FROM budget_categories WHERE household_id = v_guest_hh
      ORDER BY (parent_category_id IS NOT NULL), created_at
    LOOP
      SELECT id INTO v_target FROM budget_categories
      WHERE household_id = v_host AND bucket = c.bucket AND zafi_norm(name) = zafi_norm(c.name)
      ORDER BY (archived_at IS NOT NULL), created_at LIMIT 1;

      IF v_target IS NOT NULL THEN
        INSERT INTO _zafi_catmap VALUES (c.id, v_target);
        v_choice := COALESCE(p_choices->'budget'->>c.id::text, 'sum');
        IF c.bucket <> 'income' AND (v_choice = 'sum' OR v_choice = 'guest') THEN
          INSERT INTO household_merge_rows (merge_id, tbl, row_id, old)
            SELECT v_merge, 'budget_categories.amount', id::text, jsonb_build_object('budgeted_amount', budgeted_amount)
            FROM budget_categories WHERE id = v_target;
          UPDATE budget_categories
          SET budgeted_amount = CASE WHEN v_choice = 'sum' THEN COALESCE(budgeted_amount, 0) + COALESCE(c.budgeted_amount, 0) ELSE COALESCE(c.budgeted_amount, 0) END
          WHERE id = v_target;
          IF v_choice = 'guest' THEN
            -- "De Luis": las partes del hogar quedan en 0 (se regresan al deshacer).
            INSERT INTO household_merge_rows (merge_id, tbl, row_id, old)
              SELECT v_merge, 'budget_sub_items.amount', id::text, jsonb_build_object('amount', amount)
              FROM budget_sub_items WHERE category_id = v_target;
            UPDATE budget_sub_items SET amount = 0 WHERE category_id = v_target;
          END IF;
          -- Sus partes pasan a la categoría del hogar.
          INSERT INTO household_merge_rows (merge_id, tbl, row_id, old)
            SELECT v_merge, 'budget_sub_items', id::text, jsonb_build_object('household_id', household_id, 'category_id', category_id)
            FROM budget_sub_items WHERE category_id = c.id;
          INSERT INTO _zafi_submoved SELECT id FROM budget_sub_items WHERE category_id = c.id ON CONFLICT DO NOTHING;
          UPDATE budget_sub_items SET household_id = v_host, category_id = v_target WHERE category_id = c.id;
        END IF;
      ELSE
        -- La categoría pasa completa (con su padre ya mapeado).
        INSERT INTO household_merge_rows (merge_id, tbl, row_id, old)
          VALUES (v_merge, 'budget_categories', c.id::text, jsonb_build_object('household_id', c.household_id, 'parent_category_id', c.parent_category_id));
        UPDATE budget_categories
        SET household_id = v_host,
            parent_category_id = COALESCE((SELECT new_id FROM _zafi_catmap WHERE old_id = c.parent_category_id), parent_category_id)
        WHERE id = c.id;
        INSERT INTO _zafi_catmap VALUES (c.id, c.id);
        INSERT INTO household_merge_rows (merge_id, tbl, row_id, old)
          SELECT v_merge, 'budget_sub_items', id::text, jsonb_build_object('household_id', household_id, 'category_id', category_id)
          FROM budget_sub_items WHERE category_id = c.id;
        INSERT INTO _zafi_submoved SELECT id FROM budget_sub_items WHERE category_id = c.id ON CONFLICT DO NOTHING;
        UPDATE budget_sub_items SET household_id = v_host WHERE category_id = c.id;
      END IF;
    END LOOP;

    -- 2. Movimientos (menos los repetidos que eligió juntar).
    INSERT INTO household_merge_rows (merge_id, tbl, row_id, old)
      SELECT v_merge, 'transactions', t.id::text, jsonb_build_object(
        'household_id', t.household_id, 'category_id', t.category_id, 'budget_sub_item_id', t.budget_sub_item_id,
        'paid_by', t.paid_by, 'origin_household_id', t.origin_household_id)
      FROM transactions t
      WHERE t.household_id = v_guest_hh AND NOT (t.id = ANY (v_dups));
    UPDATE transactions t SET
      household_id = v_host,
      category_id = COALESCE((SELECT new_id FROM _zafi_catmap WHERE old_id = t.category_id), t.category_id),
      budget_sub_item_id = CASE WHEN t.budget_sub_item_id IN (SELECT id FROM _zafi_submoved) THEN t.budget_sub_item_id ELSE NULL END,
      paid_by = COALESCE(t.paid_by, t.created_by, v_guest),
      origin_household_id = v_guest_hh
    WHERE t.household_id = v_guest_hh AND NOT (t.id = ANY (v_dups));
    GET DIAGNOSTICS v_count_tx = ROW_COUNT;

    -- 3. Metas del invitado.
    FOR g IN SELECT * FROM financial_goals WHERE user_id = v_guest AND merged_into IS NULL LOOP
      v_goal_choice := COALESCE(p_choices->'goals'->>g.id::text, 'shared');
      INSERT INTO household_merge_rows (merge_id, tbl, row_id, old)
        VALUES (v_merge, 'financial_goals', g.id::text, jsonb_build_object('household_id', g.household_id, 'shared', g.shared, 'merged_into', g.merged_into));
      IF v_goal_choice LIKE 'merge:%' THEN
        SELECT id INTO v_target FROM financial_goals
        WHERE id = substring(v_goal_choice FROM 7)::uuid AND household_id = v_host AND merged_into IS NULL;
        IF v_target IS NULL THEN RAISE EXCEPTION 'goal_not_found'; END IF;
        INSERT INTO household_merge_rows (merge_id, tbl, row_id, old)
          SELECT v_merge, 'financial_goals.amount', id::text, jsonb_build_object('current_amount', current_amount, 'target_amount', target_amount, 'shared', shared)
          FROM financial_goals WHERE id = v_target;
        INSERT INTO household_merge_rows (merge_id, tbl, row_id, old)
          SELECT v_merge, 'goal_contributions', id::text, jsonb_build_object('goal_id', goal_id)
          FROM goal_contributions WHERE goal_id = g.id;
        UPDATE goal_contributions SET goal_id = v_target WHERE goal_id = g.id;
        -- Unir = sumar lo ahorrado (cada aporte conserva quién lo hizo).
        UPDATE financial_goals SET current_amount = current_amount + g.current_amount, shared = true WHERE id = v_target;
        UPDATE financial_goals SET merged_into = v_target, household_id = v_host, shared = false WHERE id = g.id;
      ELSE
        UPDATE financial_goals SET household_id = v_host, shared = (v_goal_choice <> 'personal') WHERE id = g.id;
      END IF;
      v_count_goals := v_count_goals + 1;
    END LOOP;

    -- 4. Deudas: responsable = quien las traía.
    INSERT INTO household_merge_rows (merge_id, tbl, row_id, old)
      SELECT v_merge, 'debts', id::text, jsonb_build_object('household_id', household_id, 'responsible_id', responsible_id)
      FROM debts WHERE household_id = v_guest_hh;
    UPDATE debts SET household_id = v_host, responsible_id = COALESCE(responsible_id, v_guest) WHERE household_id = v_guest_hh;
    GET DIAGNOSTICS v_count_debts = ROW_COUNT;

    -- 5. Pagos fijos y sus pagos.
    INSERT INTO household_merge_rows (merge_id, tbl, row_id, old)
      SELECT v_merge, 'recurring_bills', id::text, jsonb_build_object('household_id', household_id, 'responsible_id', responsible_id, 'category_id', category_id)
      FROM recurring_bills WHERE household_id = v_guest_hh;
    UPDATE recurring_bills b SET
      household_id = v_host,
      responsible_id = COALESCE(responsible_id, v_guest),
      category_id = COALESCE((SELECT new_id FROM _zafi_catmap WHERE old_id = b.category_id), b.category_id)
    WHERE household_id = v_guest_hh;
    INSERT INTO household_merge_rows (merge_id, tbl, row_id, old)
      SELECT v_merge, 'bill_payments', id::text, jsonb_build_object('household_id', household_id)
      FROM bill_payments WHERE household_id = v_guest_hh;
    UPDATE bill_payments SET household_id = v_host WHERE household_id = v_guest_hh;

    -- 6. Tarjetas: se copian las que el hogar no conoce.
    INSERT INTO household_merge_rows (merge_id, tbl, row_id, old)
      SELECT v_merge, 'card_owners.added', o.last4, '{}'::jsonb
      FROM card_owners o
      WHERE o.household_id = v_guest_hh
        AND NOT EXISTS (SELECT 1 FROM card_owners h WHERE h.household_id = v_host AND h.last4 = o.last4);
    INSERT INTO card_owners (household_id, last4, owner_id)
      SELECT v_host, o.last4, COALESCE(o.owner_id, v_guest) FROM card_owners o
      WHERE o.household_id = v_guest_hh
      ON CONFLICT (household_id, last4) DO NOTHING;

    -- 7. Ingresos, reglas de comercio, importaciones y metas viejas.
    INSERT INTO household_merge_rows (merge_id, tbl, row_id, old)
      SELECT v_merge, 'income_entries', id::text, jsonb_build_object('household_id', household_id, 'category_id', category_id)
      FROM income_entries WHERE household_id = v_guest_hh;
    UPDATE income_entries e SET
      household_id = v_host,
      category_id = COALESCE((SELECT new_id FROM _zafi_catmap WHERE old_id = e.category_id), e.category_id)
    WHERE household_id = v_guest_hh;

    INSERT INTO household_merge_rows (merge_id, tbl, row_id, old)
      SELECT v_merge, 'merchant_category_overrides', o.id::text, jsonb_build_object('household_id', o.household_id, 'category_id', o.category_id)
      FROM merchant_category_overrides o
      WHERE o.household_id = v_guest_hh
        AND NOT EXISTS (SELECT 1 FROM merchant_category_overrides h WHERE h.household_id = v_host AND h.merchant_key = o.merchant_key);
    UPDATE merchant_category_overrides o SET
      household_id = v_host,
      category_id = COALESCE((SELECT new_id FROM _zafi_catmap WHERE old_id = o.category_id), o.category_id)
    WHERE o.household_id = v_guest_hh
      AND NOT EXISTS (SELECT 1 FROM merchant_category_overrides h WHERE h.household_id = v_host AND h.merchant_key = o.merchant_key);

    INSERT INTO household_merge_rows (merge_id, tbl, row_id, old)
      SELECT v_merge, 'statement_imports', id::text, jsonb_build_object('household_id', household_id)
      FROM statement_imports WHERE household_id = v_guest_hh;
    UPDATE statement_imports SET household_id = v_host WHERE household_id = v_guest_hh;

    INSERT INTO household_merge_rows (merge_id, tbl, row_id, old)
      SELECT v_merge, 'saving_goals', id::text, jsonb_build_object('household_id', household_id)
      FROM saving_goals WHERE household_id = v_guest_hh;
    UPDATE saving_goals SET household_id = v_host WHERE household_id = v_guest_hh;

    -- 8. Su hogar se archiva (no se borra).
    UPDATE households SET archived_at = NOW() WHERE id = v_guest_hh;
  END IF;

  INSERT INTO household_members (household_id, user_id, role, access) VALUES (v_host, v_guest, 'member', v_access);
  IF v_family THEN
    INSERT INTO household_merge_rows (merge_id, tbl, row_id, old)
      SELECT v_merge, 'households.family_since', id::text, jsonb_build_object('family_since', family_since)
      FROM households WHERE id = v_host;
    UPDATE households SET family_since = COALESCE(family_since, NOW()), type = 'family' WHERE id = v_host;
  END IF;
  UPDATE household_invites SET status = 'expired' WHERE id = v_inv.id;

  UPDATE household_merges SET summary = jsonb_build_object(
    'transactions', v_count_tx, 'goals', v_count_goals, 'debts', v_count_debts,
    'duplicates', COALESCE(array_length(v_dups, 1), 0), 'access', v_access
  ) WHERE id = v_merge;

  RETURN jsonb_build_object(
    'merge_id', v_merge, 'household_id', v_host, 'access', v_access,
    'transactions', v_count_tx, 'goals', v_count_goals, 'debts', v_count_debts,
    'duplicates', COALESCE(array_length(v_dups, 1), 0)
  );
END;
$$;

REVOKE ALL ON FUNCTION merge_households(TEXT, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION merge_households(TEXT, JSONB) TO authenticated;

-- ══════════════════════════════════════════════
-- unmerge_household(id de la unión)
-- ══════════════════════════════════════════════
-- Durante los 30 días: regresa cada fila anotada tal como estaba y, además,
-- lo nuevo desde la unión que pagó el invitado. Después de los 30 días
-- ("Salir del hogar"): solo por paid_by y por dueño de metas y deudas.
CREATE OR REPLACE FUNCTION unmerge_household(p_merge_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  m household_merges%ROWTYPE;
  v_me UUID := auth.uid();
  v_host_owner UUID;
  v_window BOOLEAN;
  v_guest_hh UUID;
  r RECORD;
  v_moved INT := 0;
BEGIN
  SELECT * INTO m FROM household_merges WHERE id = p_merge_id AND undone_at IS NULL FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'merge_not_found'; END IF;
  SELECT owner_id INTO v_host_owner FROM households WHERE id = m.host_household_id;
  IF v_me IS NULL OR (v_me <> m.guest_user_id AND v_me <> v_host_owner) THEN RAISE EXCEPTION 'not_allowed'; END IF;
  v_window := NOW() <= m.undo_until;

  -- Hogar al que vuelve: el archivado o, si no traía uno, uno nuevo.
  v_guest_hh := m.guest_household_id;
  IF v_guest_hh IS NULL OR NOT EXISTS (SELECT 1 FROM households WHERE id = v_guest_hh) THEN
    INSERT INTO households (name, owner_id, type)
      SELECT COALESCE(NULLIF(split_part(full_name, ' ', 1), ''), 'Mi hogar'), id, 'individual' FROM users WHERE id = m.guest_user_id
      RETURNING id INTO v_guest_hh;
    INSERT INTO household_members (household_id, user_id, role) VALUES (v_guest_hh, m.guest_user_id, 'owner')
      ON CONFLICT DO NOTHING;
  END IF;
  UPDATE households SET archived_at = NULL WHERE id = v_guest_hh;

  IF v_window THEN
    -- Lo anotado, de lo último a lo primero.
    FOR r IN SELECT * FROM household_merge_rows WHERE merge_id = m.id ORDER BY seq DESC LOOP
      CASE r.tbl
        WHEN 'budget_categories' THEN
          UPDATE budget_categories SET household_id = (r.old->>'household_id')::uuid, parent_category_id = (r.old->>'parent_category_id')::uuid WHERE id = r.row_id::uuid;
        WHEN 'budget_categories.amount' THEN
          UPDATE budget_categories SET budgeted_amount = (r.old->>'budgeted_amount')::numeric WHERE id = r.row_id::uuid;
        WHEN 'budget_sub_items' THEN
          UPDATE budget_sub_items SET household_id = (r.old->>'household_id')::uuid, category_id = (r.old->>'category_id')::uuid WHERE id = r.row_id::uuid;
        WHEN 'budget_sub_items.amount' THEN
          UPDATE budget_sub_items SET amount = (r.old->>'amount')::numeric WHERE id = r.row_id::uuid;
        WHEN 'transactions' THEN
          UPDATE transactions SET
            household_id = (r.old->>'household_id')::uuid,
            category_id = (r.old->>'category_id')::uuid,
            budget_sub_item_id = (r.old->>'budget_sub_item_id')::uuid,
            paid_by = (r.old->>'paid_by')::uuid,
            origin_household_id = (r.old->>'origin_household_id')::uuid
          WHERE id = r.row_id::uuid;
          v_moved := v_moved + 1;
        WHEN 'financial_goals' THEN
          UPDATE financial_goals SET household_id = (r.old->>'household_id')::uuid, shared = (r.old->>'shared')::boolean, merged_into = (r.old->>'merged_into')::uuid WHERE id = r.row_id::uuid;
        WHEN 'financial_goals.amount' THEN
          UPDATE financial_goals SET current_amount = (r.old->>'current_amount')::numeric, shared = (r.old->>'shared')::boolean WHERE id = r.row_id::uuid;
        WHEN 'goal_contributions' THEN
          UPDATE goal_contributions SET goal_id = (r.old->>'goal_id')::uuid WHERE id = r.row_id::uuid;
        WHEN 'debts' THEN
          UPDATE debts SET household_id = (r.old->>'household_id')::uuid, responsible_id = (r.old->>'responsible_id')::uuid WHERE id = r.row_id::uuid;
        WHEN 'recurring_bills' THEN
          UPDATE recurring_bills SET household_id = (r.old->>'household_id')::uuid, responsible_id = (r.old->>'responsible_id')::uuid, category_id = (r.old->>'category_id')::uuid WHERE id = r.row_id::uuid;
        WHEN 'bill_payments' THEN
          UPDATE bill_payments SET household_id = (r.old->>'household_id')::uuid WHERE id = r.row_id::uuid;
        WHEN 'card_owners.added' THEN
          DELETE FROM card_owners WHERE household_id = m.host_household_id AND last4 = r.row_id;
        WHEN 'income_entries' THEN
          UPDATE income_entries SET household_id = (r.old->>'household_id')::uuid, category_id = (r.old->>'category_id')::uuid WHERE id = r.row_id::uuid;
        WHEN 'merchant_category_overrides' THEN
          UPDATE merchant_category_overrides SET household_id = (r.old->>'household_id')::uuid, category_id = (r.old->>'category_id')::uuid WHERE id = r.row_id::uuid;
        WHEN 'statement_imports' THEN
          UPDATE statement_imports SET household_id = (r.old->>'household_id')::uuid WHERE id = r.row_id::uuid;
        WHEN 'saving_goals' THEN
          UPDATE saving_goals SET household_id = (r.old->>'household_id')::uuid WHERE id = r.row_id::uuid;
        WHEN 'households.family_since' THEN
          UPDATE households SET family_since = (r.old->>'family_since')::timestamptz WHERE id = r.row_id::uuid;
        ELSE NULL;
      END CASE;
    END LOOP;
  END IF;

  -- Lo que pagó el invitado y sigue en el hogar (lo nuevo desde la unión, o
  -- todo después de los 30 días) se va a su hogar, con su categoría si la tiene.
  WITH moved AS (
    UPDATE transactions t SET
      household_id = v_guest_hh,
      category_id = (
        SELECT gc.id FROM budget_categories hc
        JOIN budget_categories gc ON gc.household_id = v_guest_hh AND gc.bucket = hc.bucket AND zafi_norm(gc.name) = zafi_norm(hc.name)
        WHERE hc.id = t.category_id
        ORDER BY (gc.archived_at IS NOT NULL) LIMIT 1
      ),
      budget_sub_item_id = NULL,
      origin_household_id = NULL
    WHERE t.household_id = m.host_household_id
      AND t.paid_by = m.guest_user_id
      AND (NOT v_window OR t.created_at >= m.merged_at)
    RETURNING 1
  )
  SELECT v_moved + count(*) INTO v_moved FROM moved;

  -- Movimientos que se quedan en el hogar con una categoría que volvió con el
  -- invitado: a la del hogar con el mismo nombre (o sin categoría).
  UPDATE transactions t SET category_id = (
    SELECT hc.id FROM budget_categories gc
    JOIN budget_categories hc ON hc.household_id = m.host_household_id AND hc.bucket = gc.bucket AND zafi_norm(hc.name) = zafi_norm(gc.name)
    WHERE gc.id = t.category_id
    ORDER BY (hc.archived_at IS NOT NULL) LIMIT 1
  )
  WHERE t.household_id = m.host_household_id
    AND t.category_id IN (SELECT id FROM budget_categories WHERE household_id = v_guest_hh);

  IF NOT v_window THEN
    UPDATE financial_goals SET household_id = v_guest_hh WHERE user_id = m.guest_user_id AND household_id = m.host_household_id;
    UPDATE debts SET household_id = v_guest_hh WHERE household_id = m.host_household_id AND responsible_id = m.guest_user_id;
    UPDATE recurring_bills SET household_id = v_guest_hh WHERE household_id = m.host_household_id AND responsible_id = m.guest_user_id;
  END IF;

  DELETE FROM household_members WHERE household_id = m.host_household_id AND user_id = m.guest_user_id;
  UPDATE household_merges SET undone_at = NOW() WHERE id = m.id;

  RETURN jsonb_build_object('household_id', v_guest_hh, 'transactions', v_moved, 'within_window', v_window);
END;
$$;

REVOKE ALL ON FUNCTION unmerge_household(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION unmerge_household(UUID) TO authenticated;
