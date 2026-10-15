-- ══════════════════════════════════════════════
-- F7: Resumen mensual por correo
-- ══════════════════════════════════════════════
-- · notification_preferences.resumen_mensual_correo: "Resumen mensual por
--   correo" en Cuenta › Recordatorios. Opt-in: apagado por defecto. Usa la
--   RLS existente de notification_preferences (user_id = auth.uid()).
-- · monthly_email_log: un registro por usuario y mes enviado. UNIQUE
--   (user_id, month) evita mandar dos veces el mismo resumen. Lo escribe solo
--   el servidor (service role); cada usuario puede leer los suyos.
-- · Solo aditiva.

ALTER TABLE notification_preferences
  ADD COLUMN IF NOT EXISTS resumen_mensual_correo BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS monthly_email_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  month TEXT NOT NULL CHECK (month ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
  sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, month)
);

ALTER TABLE monthly_email_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view own monthly emails" ON monthly_email_log;
CREATE POLICY "Users can view own monthly emails" ON monthly_email_log
  FOR SELECT USING (user_id = auth.uid());
