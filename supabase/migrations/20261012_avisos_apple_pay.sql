-- ══════════════════════════════════════════════
-- Rediseño Fase 13: Avisos en el teléfono y Apple Pay
-- ══════════════════════════════════════════════
-- 1. notification_preferences: tres tipos de aviso nuevos (se conservan las
--    columnas existentes). Ingresos recibidos viene apagado por defecto.
-- 2. notification_log: tipos nuevos. Máximo 1 aviso por usuario por día
--    (lo cuenta lib/avisos.ts; 'apple_pay' es la respuesta a un pago del
--    propio usuario y no cuenta para el límite).
-- 3. transactions.source = 'apple_pay' y transactions.payment_card (la
--    tarjeta de Wallet que manda el atajo, p. ej. "BI Visa ··4821").
-- 4. shortcut_tokens: clave personal para el atajo de iOS. Solo se guarda el
--    SHA-256 del token; el token se muestra una vez. La API lo crea con el
--    service role; el usuario solo puede ver (sin el hash) y revocar los suyos.
--    rate_window_* es el límite por clave (lo aplica la API).
-- notification_preferences y notification_log vienen de las migraciones
-- 20260803_*; si no se aplicaron, sus pasos se saltan.

-- 1 ─────────────────────────────────────────────
DO $$
BEGIN
  IF to_regclass('public.notification_preferences') IS NOT NULL THEN
    ALTER TABLE notification_preferences ADD COLUMN IF NOT EXISTS due_enabled BOOLEAN NOT NULL DEFAULT true;
    ALTER TABLE notification_preferences ADD COLUMN IF NOT EXISTS cap_enabled BOOLEAN NOT NULL DEFAULT true;
    ALTER TABLE notification_preferences ADD COLUMN IF NOT EXISTS income_enabled BOOLEAN NOT NULL DEFAULT false;
  END IF;
END $$;

-- 2 ─────────────────────────────────────────────
DO $$
BEGIN
  IF to_regclass('public.notification_log') IS NOT NULL THEN
    ALTER TABLE notification_log DROP CONSTRAINT IF EXISTS notification_log_type_check;
    ALTER TABLE notification_log
      ADD CONSTRAINT notification_log_type_check
      CHECK (type IN ('inactivity', 'month_close', 'month_start', 'due', 'cap', 'month_end', 'income', 'apple_pay'));
    CREATE INDEX IF NOT EXISTS idx_notification_log_user_sent ON notification_log(user_id, sent_at DESC);
  END IF;
END $$;

-- 3 ─────────────────────────────────────────────
ALTER TABLE transactions
  DROP CONSTRAINT IF EXISTS transactions_source_check;

ALTER TABLE transactions
  ADD CONSTRAINT transactions_source_check
  CHECK (source IN ('manual', 'voice', 'ocr', 'csv', 'statement', 'text', 'apple_pay'));

ALTER TABLE transactions ADD COLUMN IF NOT EXISTS payment_card TEXT;

-- 4 ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS shortcut_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL,                 -- SHA-256 (hex) del token; nunca sale al cliente
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_used_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  rate_window_start TIMESTAMPTZ,
  rate_window_count INTEGER NOT NULL DEFAULT 0
);

CREATE UNIQUE INDEX IF NOT EXISTS shortcut_tokens_hash_idx ON shortcut_tokens(token_hash);
CREATE INDEX IF NOT EXISTS shortcut_tokens_user_idx ON shortcut_tokens(user_id, created_at DESC);

ALTER TABLE shortcut_tokens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users can view own shortcut tokens" ON shortcut_tokens;
CREATE POLICY "users can view own shortcut tokens" ON shortcut_tokens
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "users can revoke own shortcut tokens" ON shortcut_tokens;
CREATE POLICY "users can revoke own shortcut tokens" ON shortcut_tokens
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Sin INSERT ni DELETE para usuarios: los crea la API (service role).
-- Por columna: el hash y el contador nunca se leen ni se escriben desde el cliente.
REVOKE ALL ON shortcut_tokens FROM anon, authenticated;
GRANT SELECT (id, user_id, created_at, last_used_at, revoked_at) ON shortcut_tokens TO authenticated;
GRANT UPDATE (revoked_at) ON shortcut_tokens TO authenticated;
