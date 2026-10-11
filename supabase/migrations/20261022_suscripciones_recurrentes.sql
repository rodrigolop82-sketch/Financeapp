-- ══════════════════════════════════════════════
-- Suscripciones y cobros recurrentes
-- ══════════════════════════════════════════════
-- · recurring_overrides: decisiones del hogar sobre un cobro detectado
--   ("No es una suscripción", "Ya la cancelé") y recordatorio Premium.
--   La detección es bajo demanda: no hay tabla de cobros detectados.
-- · merchant_cancel_info: catálogo global de "cómo cancelar" (solo lectura).
-- · notification_log: tipos nuevos de aviso para recordatorios y alzas.

CREATE TABLE IF NOT EXISTS recurring_overrides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  merchant_key TEXT NOT NULL,
  status TEXT CHECK (status IN ('dismissed', 'cancelled_by_user')),
  remind_days_before SMALLINT CHECK (remind_days_before IN (1, 2, 3)),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (household_id, merchant_key)
);
CREATE INDEX IF NOT EXISTS idx_recurring_overrides_reminders
  ON recurring_overrides(household_id) WHERE remind_days_before IS NOT NULL;

ALTER TABLE recurring_overrides ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Members can view recurring overrides" ON recurring_overrides;
CREATE POLICY "Members can view recurring overrides" ON recurring_overrides
  FOR SELECT USING (household_id IN (SELECT get_my_household_ids()));
DROP POLICY IF EXISTS "Writers can manage recurring overrides" ON recurring_overrides;
CREATE POLICY "Writers can manage recurring overrides" ON recurring_overrides
  FOR ALL USING (household_id IN (SELECT get_my_writable_household_ids()))
  WITH CHECK (household_id IN (SELECT get_my_writable_household_ids()));

-- Catálogo global. match_patterns: textos que, si aparecen en la clave
-- normalizada del comercio, lo identifican (p. ej. 'netflix').
CREATE TABLE IF NOT EXISTS merchant_cancel_info (
  merchant_key TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  match_patterns TEXT[] NOT NULL DEFAULT '{}',
  cancel_url TEXT,
  cancel_email TEXT,
  steps TEXT[] NOT NULL DEFAULT '{}',
  notes TEXT,
  verified_at TIMESTAMPTZ
);

ALTER TABLE merchant_cancel_info ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Authenticated can read cancel info" ON merchant_cancel_info;
CREATE POLICY "Authenticated can read cancel info" ON merchant_cancel_info
  FOR SELECT TO authenticated USING (true);
-- Sin políticas de escritura: solo service role / migraciones.

-- Seed. verified_at queda NULL en todas: Rodrigo debe verificarlas a mano.
-- No se incluyen URLs ni correos de los que no hay certeza.
INSERT INTO merchant_cancel_info (merchant_key, display_name, match_patterns, cancel_url, steps, notes) VALUES
  ('netflix', 'Netflix', ARRAY['netflix'], 'https://www.netflix.com/cancelplan',
    ARRAY['Inicia sesión en netflix.com desde un navegador.', 'Abre Cuenta.', 'Toca "Cancelar membresía" y confirma.'],
    'Si pagas Netflix a través de otro proveedor (por ejemplo tu cable o Apple), se cancela con ese proveedor.'),
  ('spotify', 'Spotify', ARRAY['spotify'], 'https://www.spotify.com/account/subscription/',
    ARRAY['Inicia sesión en spotify.com desde un navegador (no desde la app).', 'Abre tu cuenta y la sección de tu plan.', 'Elige cambiar o cancelar el plan y confirma.'],
    NULL),
  ('disney plus', 'Disney+', ARRAY['disney'], NULL,
    ARRAY['Inicia sesión en Disney+ desde un navegador.', 'Abre tu perfil y luego Cuenta.', 'Elige tu suscripción y toca "Cancelar suscripción".'],
    NULL),
  ('max', 'Max', ARRAY['hbo max', 'hbomax', 'max com'], NULL, '{}', NULL),
  ('amazon prime', 'Amazon Prime', ARRAY['amazon prime', 'prime video', 'amzn prime'], NULL,
    ARRAY['Inicia sesión en Amazon.', 'Abre "Tu membresía Prime".', 'Elige terminar la membresía y confirma.'],
    NULL),
  ('youtube premium', 'YouTube Premium', ARRAY['youtube', 'google youtube'], 'https://www.youtube.com/paid_memberships',
    ARRAY['Inicia sesión en YouTube con la cuenta que paga.', 'Abre "Compras y membresías".', 'Elige YouTube Premium y toca "Desactivar" o "Cancelar".'],
    NULL),
  ('apple', 'Apple (iCloud / Apple One)', ARRAY['apple com', 'itunes', 'icloud'], NULL,
    ARRAY['En tu iPhone abre Ajustes.', 'Toca tu nombre y luego Suscripciones.', 'Elige la suscripción y toca "Cancelar suscripción".'],
    'Se gestiona desde los ajustes de la cuenta de Apple del dispositivo.'),
  ('google one', 'Google One', ARRAY['google one', 'google storage'], NULL,
    ARRAY['Abre la app o el sitio de Google One con la cuenta que paga.', 'Abre Configuración.', 'Elige cancelar la membresía y confirma.'],
    NULL),
  ('microsoft 365', 'Microsoft 365', ARRAY['microsoft', 'msft'], 'https://account.microsoft.com/services',
    ARRAY['Inicia sesión en tu cuenta Microsoft.', 'Abre "Servicios y suscripciones".', 'Elige Microsoft 365 y toca "Administrar" y luego cancelar.'],
    NULL)
ON CONFLICT (merchant_key) DO NOTHING;

-- Tipos de aviso nuevos: recordatorio de cobro y alza de precio.
DO $$
BEGIN
  IF to_regclass('public.notification_log') IS NOT NULL THEN
    ALTER TABLE notification_log DROP CONSTRAINT IF EXISTS notification_log_type_check;
    ALTER TABLE notification_log
      ADD CONSTRAINT notification_log_type_check
      CHECK (type IN ('inactivity', 'month_close', 'month_start', 'due', 'cap', 'month_end', 'income', 'apple_pay', 'household', 'trial', 'bill', 'weekly',
                      'recurring_reminder', 'price_alert'));
  END IF;
END $$;
