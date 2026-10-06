-- ══════════════════════════════════════════════
-- Planes: Gratis · Premium · Familiar, cobros con Recurrente
-- ══════════════════════════════════════════════
-- · users.plan acepta 'family'. Las cuentas con plan='premium' (fundadoras,
--   QA) se quedan igual.
-- · subscriptions deja de ser de Stripe: provider_subscription_id, tier,
--   cycle (antes en `plan`), último pago para prorrateos y reembolsos.
-- · household_members.access: 'full' o 'view' (solo ver).
-- · billing_events: idempotencia del webhook.
-- · El plan y la prueba solo los cambia el servidor (service role): antes
--   la política "Users can update own data" dejaba que el cliente se
--   pusiera plan='premium' él mismo.

-- ── users.plan ──
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_plan_check;
ALTER TABLE users ADD CONSTRAINT users_plan_check CHECK (plan IN ('free', 'premium', 'family'));

-- ── subscriptions ──
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'subscriptions' AND column_name = 'stripe_subscription_id'
  ) THEN
    ALTER TABLE subscriptions RENAME COLUMN stripe_subscription_id TO provider_subscription_id;
  END IF;
END $$;

ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS provider_subscription_id TEXT;
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS provider TEXT DEFAULT 'recurrente';
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS tier TEXT DEFAULT 'premium';
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS cycle TEXT;
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS last_payment_id TEXT;
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS last_amount_cents INT;
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS current_period_start TIMESTAMPTZ;
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS cancel_at_period_end BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

ALTER TABLE subscriptions DROP CONSTRAINT IF EXISTS subscriptions_tier_check;
ALTER TABLE subscriptions ADD CONSTRAINT subscriptions_tier_check CHECK (tier IN ('premium', 'family'));
ALTER TABLE subscriptions DROP CONSTRAINT IF EXISTS subscriptions_cycle_check;
ALTER TABLE subscriptions ADD CONSTRAINT subscriptions_cycle_check CHECK (cycle IN ('monthly', 'annual'));

-- La columna `plan` guardaba monthly/annual: pasa a `cycle` y deja de usarse.
UPDATE subscriptions SET cycle = plan WHERE cycle IS NULL AND plan IN ('monthly', 'annual');

-- Una fila por suscripción del proveedor (antes una por usuario: un cambio
-- de plan necesita la vieja y la nueva a la vez mientras se reembolsa).
CREATE UNIQUE INDEX IF NOT EXISTS subscriptions_provider_subscription_id_key
  ON subscriptions(provider_subscription_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_user_status ON subscriptions(user_id, status);

-- El cliente solo lee su suscripción; escribe el webhook con service role.
DROP POLICY IF EXISTS "Users can manage own subscriptions" ON subscriptions;

-- ── household_members.access ──
ALTER TABLE household_members ADD COLUMN IF NOT EXISTS access TEXT NOT NULL DEFAULT 'full';
ALTER TABLE household_members DROP CONSTRAINT IF EXISTS household_members_access_check;
ALTER TABLE household_members ADD CONSTRAINT household_members_access_check CHECK (access IN ('full', 'view'));

-- ── billing_events (idempotencia) ──
CREATE TABLE IF NOT EXISTS billing_events (
  id TEXT PRIMARY KEY,
  type TEXT,
  payload JSONB,
  received_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE billing_events ENABLE ROW LEVEL SECURITY;
-- Sin políticas: solo el service role la lee y escribe.

-- ── plan y prueba: solo el servidor ──
CREATE OR REPLACE FUNCTION protect_user_plan()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF COALESCE(auth.role(), '') IN ('authenticated', 'anon') THEN
    NEW.plan := OLD.plan;
    NEW.trial_ends_at := OLD.trial_ends_at;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS users_protect_plan ON users;
CREATE TRIGGER users_protect_plan
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION protect_user_plan();

-- ── billing_checkouts ──
-- Cada checkout abierto: de quién es, qué plan compra y, en un cambio de
-- plan, qué suscripción reemplaza y cuánto se le devuelve. El webhook lo usa
-- si el proveedor no devuelve la metadata.
CREATE TABLE IF NOT EXISTS billing_checkouts (
  id TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tier TEXT NOT NULL CHECK (tier IN ('premium', 'family')),
  cycle TEXT NOT NULL CHECK (cycle IN ('monthly', 'annual')),
  replaces_subscription_id TEXT,
  credit_cents INT NOT NULL DEFAULT 0,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_billing_checkouts_user ON billing_checkouts(user_id);
ALTER TABLE billing_checkouts ENABLE ROW LEVEL SECURITY;
-- Sin políticas: solo el service role.
