-- ══════════════════════════════════════════════
-- Registro: "Database error saving new user"
-- ══════════════════════════════════════════════
-- Supabase Auth inserta en auth.users con search_path = auth. Los triggers
-- en cadena (auth.users → handle_new_user → public.users →
-- create_default_notification_prefs) heredan ese search_path, y
-- create_default_notification_prefs() usaba "notification_preferences" sin
-- esquema → la relación no existe → se aborta el alta del usuario.
-- Se fija search_path y se califican los nombres. Además, las preferencias
-- de notificación nunca deben bloquear un registro.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', '')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.create_default_notification_prefs()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.notification_preferences (user_id) VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Nunca bloquear el alta de un usuario por esto.
  RAISE WARNING 'create_default_notification_prefs: %', SQLERRM;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
