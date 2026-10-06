-- Ayudas para las pruebas: crear usuarios, actuar como uno y afirmar.
CREATE OR REPLACE FUNCTION test_user(p_email TEXT, p_name TEXT) RETURNS UUID LANGUAGE plpgsql AS $$
DECLARE v UUID := gen_random_uuid();
BEGIN
  INSERT INTO auth.users (id, email, raw_user_meta_data) VALUES (v, p_email, jsonb_build_object('full_name', p_name));
  RETURN v;
END $$;

-- Actuar como un usuario autenticado (RLS) o volver a postgres (NULL).
CREATE OR REPLACE FUNCTION test_as(p_user UUID) RETURNS VOID LANGUAGE plpgsql AS $$
BEGIN
  IF p_user IS NULL THEN
    PERFORM set_config('request.jwt.claim.sub', '', false);
    PERFORM set_config('request.jwt.claim.role', '', false);
    EXECUTE 'RESET ROLE';
  ELSE
    PERFORM set_config('request.jwt.claim.sub', p_user::text, false);
    PERFORM set_config('request.jwt.claim.role', 'authenticated', false);
    EXECUTE 'SET ROLE authenticated';
  END IF;
END $$;

CREATE OR REPLACE FUNCTION assert_eq(p_got ANYELEMENT, p_want ANYELEMENT, p_what TEXT) RETURNS VOID LANGUAGE plpgsql AS $$
BEGIN
  IF p_got IS DISTINCT FROM p_want THEN
    RAISE EXCEPTION 'FALLÓ: % (esperaba %, salió %)', p_what, p_want, p_got;
  END IF;
END $$;
GRANT EXECUTE ON FUNCTION test_as(UUID), assert_eq(ANYELEMENT, ANYELEMENT, TEXT) TO authenticated;
