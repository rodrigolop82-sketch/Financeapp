-- ══════════════════════════════════════════════
-- Resumen semanal ("Tu semana")
-- ══════════════════════════════════════════════
-- Los números no se guardan: se calculan al abrir la pantalla. Esta tabla
-- solo cachea el comentario de IA (Premium) y registra si se vio.

CREATE TABLE IF NOT EXISTS weekly_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  week_start DATE NOT NULL CHECK (EXTRACT(ISODOW FROM week_start) = 1),
  ai_commentary TEXT,
  data_hash TEXT,
  ai_generated_at TIMESTAMPTZ,
  viewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (household_id, week_start)
);

ALTER TABLE weekly_snapshots ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Members can view weekly snapshots" ON weekly_snapshots;
CREATE POLICY "Members can view weekly snapshots" ON weekly_snapshots
  FOR SELECT USING (household_id IN (SELECT get_my_household_ids()));
DROP POLICY IF EXISTS "Writers can manage weekly snapshots" ON weekly_snapshots;
CREATE POLICY "Writers can manage weekly snapshots" ON weekly_snapshots
  FOR ALL USING (household_id IN (SELECT get_my_writable_household_ids()))
  WITH CHECK (household_id IN (SELECT get_my_writable_household_ids()));

-- Preferencia: push del lunes con el resumen de la semana.
DO $$
BEGIN
  IF to_regclass('public.notification_preferences') IS NOT NULL THEN
    ALTER TABLE notification_preferences ADD COLUMN IF NOT EXISTS weekly_snapshot_enabled BOOLEAN NOT NULL DEFAULT true;
  END IF;
END $$;

-- Tipo de aviso nuevo (distinto del 'weekly' familiar de los domingos).
DO $$
BEGIN
  IF to_regclass('public.notification_log') IS NOT NULL THEN
    ALTER TABLE notification_log DROP CONSTRAINT IF EXISTS notification_log_type_check;
    ALTER TABLE notification_log
      ADD CONSTRAINT notification_log_type_check
      CHECK (type IN ('inactivity', 'month_close', 'month_start', 'due', 'cap', 'month_end', 'income', 'apple_pay', 'household', 'trial', 'bill', 'weekly',
                      'recurring_reminder', 'price_alert', 'weekly_snapshot'));
  END IF;
END $$;
