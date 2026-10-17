-- ══════════════════════════════════════════════
-- C5 · Eliminar mi cuenta dentro de la app
-- ══════════════════════════════════════════════
-- eliminar_cuenta(p_user) borra de verdad a una persona, en una sola
-- transacción (si algo falla, no se borra nada):
--
-- · Hogar donde vive sola → se borra el hogar completo (en cascada: plan,
--   movimientos, deudas, metas, cuentas…).
-- · Hogar compartido → se conserva y pasa a la otra persona (el miembro con
--   acceso completo más antiguo). Lo compartido queda; lo personal de quien
--   se va (movimientos personales, cuentas propias no compartidas, metas
--   privadas) se borra. Sus metas compartidas pasan a quien hereda.
-- · Facturación → se conserva sin datos personales: suscripciones y
--   checkouts quedan con user_id NULL y los eventos del proveedor que la
--   mencionan se reemplazan por {"anonimizado": true}.
-- · Ideas enviadas (feedback) → se borran (la ruta borra antes las capturas
--   del almacenamiento).
-- · Al final se borran public.users y auth.users (sesiones incluidas).
--
-- Solo la llama la ruta POST /api/cuenta/eliminar con la service role
-- después de cancelar la suscripción en Recurrente.

-- 1) Facturación: no se borra con el usuario, queda sin dueño.
DO $$
DECLARE c RECORD;
BEGIN
  FOR c IN
    SELECT con.conname, rel.relname
    FROM pg_constraint con
    JOIN pg_class rel ON rel.oid = con.conrelid
    JOIN pg_namespace ns ON ns.oid = rel.relnamespace
    JOIN pg_attribute att ON att.attrelid = con.conrelid AND att.attnum = ANY (con.conkey)
    WHERE con.contype = 'f' AND ns.nspname = 'public'
      AND rel.relname IN ('subscriptions', 'billing_checkouts') AND att.attname = 'user_id'
  LOOP
    EXECUTE format('ALTER TABLE public.%I DROP CONSTRAINT %I', c.relname, c.conname);
  END LOOP;
END $$;

ALTER TABLE subscriptions ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE billing_checkouts ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE subscriptions
  ADD CONSTRAINT subscriptions_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE billing_checkouts
  ADD CONSTRAINT billing_checkouts_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL;

-- 2) Registro anónimo de cuentas eliminadas (sin id, correo ni nombre).
CREATE TABLE IF NOT EXISTS cuentas_eliminadas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deleted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  hogares_borrados INT NOT NULL DEFAULT 0,
  hogares_transferidos INT NOT NULL DEFAULT 0,
  tenia_suscripcion BOOLEAN NOT NULL DEFAULT false
);
ALTER TABLE cuentas_eliminadas ENABLE ROW LEVEL SECURITY;

-- 3) La función.
CREATE OR REPLACE FUNCTION public.eliminar_cuenta(p_user UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email TEXT;
  h RECORD;
  v_heir UUID;
  v_borrados INT := 0;
  v_transferidos INT := 0;
  v_subs TEXT[];
  v_checkouts TEXT[];
BEGIN
  SELECT email INTO v_email FROM users WHERE id = p_user;
  IF v_email IS NULL AND NOT EXISTS (SELECT 1 FROM auth.users WHERE id = p_user) THEN
    RAISE EXCEPTION 'usuario_no_existe';
  END IF;

  -- Hogares donde participa: los suyos y aquellos donde es miembro.
  FOR h IN
    SELECT hh.id, hh.owner_id FROM households hh
    WHERE hh.owner_id = p_user
       OR hh.id IN (SELECT household_id FROM household_members WHERE user_id = p_user)
  LOOP
    IF h.owner_id IS DISTINCT FROM p_user THEN
      v_heir := h.owner_id;
    ELSE
      SELECT hm.user_id INTO v_heir
      FROM household_members hm
      WHERE hm.household_id = h.id AND hm.user_id <> p_user
      ORDER BY (hm.access = 'full') DESC, hm.joined_at ASC NULLS LAST
      LIMIT 1;
    END IF;

    IF v_heir IS NULL THEN
      -- Vive sola: se borra todo el hogar.
      DELETE FROM households WHERE id = h.id;
      v_borrados := v_borrados + 1;
      CONTINUE;
    END IF;

    IF h.owner_id = p_user THEN
      UPDATE households SET owner_id = v_heir WHERE id = h.id;
      UPDATE household_members SET role = 'owner', access = 'full' WHERE household_id = h.id AND user_id = v_heir;
      INSERT INTO household_members (household_id, user_id, role, access)
        SELECT h.id, v_heir, 'owner', 'full'
        WHERE NOT EXISTS (SELECT 1 FROM household_members WHERE household_id = h.id AND user_id = v_heir);
      v_transferidos := v_transferidos + 1;
    END IF;

    -- Lo personal de quien se va.
    DELETE FROM transactions
      WHERE household_id = h.id AND scope = 'personal' AND COALESCE(paid_by, created_by) = p_user;
    DELETE FROM financial_sources
      WHERE household_id = h.id AND owner_user_id = p_user AND NOT shared;
    -- Lo compartido pasa a quien hereda (si no, se borraría en cascada).
    UPDATE financial_goals SET user_id = v_heir
      WHERE user_id = p_user AND household_id = h.id AND shared;
    UPDATE goal_contributions SET user_id = v_heir
      WHERE user_id = p_user AND goal_id IN (SELECT id FROM financial_goals WHERE household_id = h.id AND shared);
    UPDATE merchant_category_overrides SET created_by = v_heir
      WHERE household_id = h.id AND created_by = p_user;
    DELETE FROM household_members WHERE household_id = h.id AND user_id = p_user;
  END LOOP;

  -- Aportes a metas de ahorro del hogar: se conservan sin autor.
  UPDATE saving_goal_contributions SET user_id = NULL WHERE user_id = p_user;

  -- Facturación sin datos personales.
  SELECT COALESCE(array_agg(provider_subscription_id) FILTER (WHERE provider_subscription_id IS NOT NULL), '{}')
    INTO v_subs FROM subscriptions WHERE user_id = p_user;
  SELECT COALESCE(array_agg(id), '{}') INTO v_checkouts FROM billing_checkouts WHERE user_id = p_user;
  UPDATE billing_events SET payload = jsonb_build_object('anonimizado', true)
    WHERE payload::text LIKE '%' || p_user::text || '%'
       OR (v_email IS NOT NULL AND lower(payload::text) LIKE '%' || lower(v_email) || '%')
       OR EXISTS (SELECT 1 FROM unnest(v_subs || v_checkouts) AS k WHERE payload::text LIKE '%' || k || '%');

  DELETE FROM feedback WHERE user_id = p_user;

  INSERT INTO cuentas_eliminadas (hogares_borrados, hogares_transferidos, tenia_suscripcion)
    VALUES (v_borrados, v_transferidos, cardinality(v_subs) > 0);

  -- La persona: public.users (cascada de lo suyo) y su acceso.
  DELETE FROM users WHERE id = p_user;
  DELETE FROM auth.users WHERE id = p_user;

  RETURN jsonb_build_object('hogares_borrados', v_borrados, 'hogares_transferidos', v_transferidos);
END;
$$;

REVOKE ALL ON FUNCTION public.eliminar_cuenta(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.eliminar_cuenta(UUID) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.eliminar_cuenta(UUID) TO service_role;
