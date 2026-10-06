-- ══════════════════════════════════════════════
-- Solo ver: quien está en un hogar con access='view' ve todo y no escribe
-- ══════════════════════════════════════════════
-- Un miembro escribe en el hogar solo si su acceso es 'full' y el hogar es
-- Familiar (el dueño tiene plan 'family' o está en su prueba de 14 días).
-- El dueño siempre escribe. Las políticas de escritura que usaban
-- get_my_household_ids() pasan a get_my_writable_household_ids(); la
-- lectura no cambia.

CREATE OR REPLACE FUNCTION get_my_writable_household_ids()
RETURNS SETOF UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT h.id FROM households h WHERE h.owner_id = auth.uid()
  UNION
  SELECT hm.household_id
  FROM household_members hm
  JOIN households h ON h.id = hm.household_id
  JOIN users o ON o.id = h.owner_id
  WHERE hm.user_id = auth.uid()
    AND (
      hm.role = 'owner'
      OR (hm.access = 'full' AND (o.plan = 'family' OR o.trial_ends_at > NOW()))
    )
$$;

GRANT EXECUTE ON FUNCTION get_my_writable_household_ids() TO authenticated;

-- Reescribe cada política de escritura del esquema public que filtra por
-- get_my_household_ids(). Una política FOR ALL también daba lectura: se deja
-- una política FOR SELECT con la condición original para no quitarla.
DO $$
DECLARE
  p RECORD;
  roles TEXT;
  using_sql TEXT;
  check_sql TEXT;
BEGIN
  FOR p IN
    SELECT schemaname, tablename, policyname, permissive, roles AS role_list, cmd, qual, with_check
    FROM pg_policies
    WHERE schemaname = 'public'
      AND cmd IN ('ALL', 'INSERT', 'UPDATE', 'DELETE')
      AND (COALESCE(qual, '') LIKE '%get_my_household_ids()%' OR COALESCE(with_check, '') LIKE '%get_my_household_ids()%')
  LOOP
    roles := array_to_string(ARRAY(SELECT quote_ident(r) FROM unnest(p.role_list) r), ', ');
    using_sql := replace(p.qual, 'get_my_household_ids()', 'get_my_writable_household_ids()');
    check_sql := replace(p.with_check, 'get_my_household_ids()', 'get_my_writable_household_ids()');

    IF p.cmd = 'ALL' AND p.qual IS NOT NULL THEN
      EXECUTE format(
        'CREATE POLICY %I ON %I.%I AS %s FOR SELECT TO %s USING (%s)',
        left(p.policyname || ' (ver)', 63), p.schemaname, p.tablename, p.permissive, roles, p.qual
      );
    END IF;

    EXECUTE format('DROP POLICY %I ON %I.%I', p.policyname, p.schemaname, p.tablename);
    EXECUTE format(
      'CREATE POLICY %I ON %I.%I AS %s FOR %s TO %s%s%s',
      p.policyname, p.schemaname, p.tablename, p.permissive, p.cmd, roles,
      CASE WHEN using_sql IS NOT NULL AND p.cmd <> 'INSERT' THEN format(' USING (%s)', using_sql) ELSE '' END,
      CASE WHEN check_sql IS NOT NULL THEN format(' WITH CHECK (%s)', check_sql) ELSE '' END
    );
  END LOOP;
END $$;

-- Aviso de persona a persona en el hogar ("Avisarle a Ana").
DO $$
BEGIN
  IF to_regclass('public.notification_log') IS NOT NULL THEN
    ALTER TABLE notification_log DROP CONSTRAINT IF EXISTS notification_log_type_check;
    ALTER TABLE notification_log
      ADD CONSTRAINT notification_log_type_check
      CHECK (type IN ('inactivity', 'month_close', 'month_start', 'due', 'cap', 'month_end', 'income', 'apple_pay', 'household'));
  END IF;
END $$;
