-- ══════════════════════════════════════════════
-- Rediseño Fase 12: Admin › Para reactivar (CSV para Mailchimp)
-- ══════════════════════════════════════════════
-- users.marketing_opt_in: la persona aceptó "Recibir consejos y novedades
--   por correo". Por defecto false: nadie entra al CSV de Mailchimp sin
--   haberlo marcado (en el registro o en Mi cuenta › Recordatorios).
-- RLS: la política existente "Users can update own data" (FOR UPDATE USING
--   id = auth.uid()) ya deja a cada usuario cambiar su propia fila, incluida
--   esta columna. No se agregan políticas nuevas.
-- Registro: el formulario manda marketing_opt_in en los metadatos de
--   auth.signUp. Un trigger BEFORE INSERT en public.users lo copia a la
--   columna cuando handle_new_user() (o la API de onboarding) crea la fila.
--   No se toca handle_new_user().

ALTER TABLE users ADD COLUMN IF NOT EXISTS marketing_opt_in BOOLEAN DEFAULT false;

CREATE OR REPLACE FUNCTION set_marketing_opt_in_from_signup()
RETURNS TRIGGER AS $$
DECLARE
  meta_opt_in TEXT;
BEGIN
  IF COALESCE(NEW.marketing_opt_in, false) THEN
    RETURN NEW;
  END IF;
  SELECT lower(raw_user_meta_data->>'marketing_opt_in')
    INTO meta_opt_in
    FROM auth.users
   WHERE id = NEW.id;
  NEW.marketing_opt_in := (meta_opt_in = 'true');
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Nunca bloquear el alta de un usuario por esto.
  NEW.marketing_opt_in := COALESCE(NEW.marketing_opt_in, false);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

DROP TRIGGER IF EXISTS users_marketing_opt_in_from_signup ON users;
CREATE TRIGGER users_marketing_opt_in_from_signup
  BEFORE INSERT ON users
  FOR EACH ROW
  EXECUTE FUNCTION set_marketing_opt_in_from_signup();
