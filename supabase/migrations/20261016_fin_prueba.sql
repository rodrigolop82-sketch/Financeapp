-- ══════════════════════════════════════════════
-- Fin de prueba: aviso del día 11 (push + correo) en notification_log
-- ══════════════════════════════════════════════
DO $$
BEGIN
  IF to_regclass('public.notification_log') IS NOT NULL THEN
    ALTER TABLE notification_log DROP CONSTRAINT IF EXISTS notification_log_type_check;
    ALTER TABLE notification_log
      ADD CONSTRAINT notification_log_type_check
      CHECK (type IN ('inactivity', 'month_close', 'month_start', 'due', 'cap', 'month_end', 'income', 'apple_pay', 'household', 'trial'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_users_trial_ends_at ON users(trial_ends_at);
