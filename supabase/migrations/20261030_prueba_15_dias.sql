-- ══════════════════════════════════════════════
-- Prueba de 15 días y arranque de los cobros con Recurrente
-- ══════════════════════════════════════════════
-- · Las cuentas nuevas reciben 15 días de prueba (antes 14).
-- · Todas las cuentas que no pagan (sin suscripción activa) pasan a Gratis y
--   reciben una prueba de 15 días desde que corre esta migración. Incluye las
--   cuentas con Premium puesto a mano (fundadoras, QA): al terminar la
--   prueba pierden Premium igual que las demás.
-- · Se borran los avisos de fin de prueba ya enviados, para que todos
--   reciban el del día 12 de la prueba nueva.
-- · Quien ya tiene una suscripción activa o en mora no se toca.
-- · Una sola vez: queda una marca en billing_events y, si se vuelve a
--   correr, no reinicia las pruebas.
--
-- Para revisar antes quién cambia:
--   SELECT email, plan, trial_ends_at FROM users u
--   WHERE NOT EXISTS (
--     SELECT 1 FROM subscriptions s
--     WHERE s.user_id = u.id AND s.status IN ('active', 'past_due')
--       AND (s.current_period_end IS NULL OR s.current_period_end > NOW())
--   );

ALTER TABLE users ALTER COLUMN trial_ends_at SET DEFAULT NOW() + INTERVAL '15 days';

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM billing_events WHERE id = 'migration:20261030_prueba_15_dias') THEN
    RAISE NOTICE 'Prueba de 15 días ya aplicada; no se reinicia';
    RETURN;
  END IF;

  UPDATE users u
  SET plan = 'free',
      trial_ends_at = NOW() + INTERVAL '15 days'
  WHERE NOT EXISTS (
    SELECT 1 FROM subscriptions s
    WHERE s.user_id = u.id
      AND s.status IN ('active', 'past_due')
      AND (s.current_period_end IS NULL OR s.current_period_end > NOW())
  );

  -- Con la prueba nueva, el aviso del día 12 vuelve a salir aunque ya se
  -- haya mandado el de la prueba anterior.
  IF to_regclass('public.notification_log') IS NOT NULL THEN
    DELETE FROM notification_log WHERE type = 'trial';
  END IF;

  INSERT INTO billing_events (id, type) VALUES ('migration:20261030_prueba_15_dias', 'migration');
END $$;
