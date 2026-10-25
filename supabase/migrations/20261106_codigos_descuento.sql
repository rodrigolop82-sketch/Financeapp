-- ══════════════════════════════════════════════
-- Códigos de descuento
-- ══════════════════════════════════════════════
-- · discount_codes: los crea el admin. percent_off 1–99 se cobra con el
--   cupón de Recurrente del mismo código (POST /checkouts › discount_code);
--   100 es gratis y lo da la app, sin pasar por Recurrente.
-- · duration_months NULL = indefinido (fundadores).
-- · discount_redemptions: un uso por persona y por código. El cupo
--   (max_redemptions) se cuenta con estas filas.
-- · Un plan gratis por código es una fila de subscriptions con
--   provider = 'code'; el cron la vence en current_period_end (NULL = nunca).
-- Todo solo con service role.

CREATE TABLE IF NOT EXISTS discount_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE CHECK (code = upper(code) AND code ~ '^[A-Z0-9_-]{3,32}$'),
  percent_off INT NOT NULL CHECK (percent_off BETWEEN 1 AND 100),
  duration_months INT CHECK (duration_months IS NULL OR duration_months BETWEEN 1 AND 120),
  tiers TEXT[] NOT NULL DEFAULT ARRAY['premium', 'family']
    CHECK (cardinality(tiers) > 0 AND tiers <@ ARRAY['premium', 'family']),
  cycles TEXT[] NOT NULL DEFAULT ARRAY['monthly', 'annual']
    CHECK (cardinality(cycles) > 0 AND cycles <@ ARRAY['monthly', 'annual']),
  max_redemptions INT CHECK (max_redemptions IS NULL OR max_redemptions > 0),
  expires_at TIMESTAMPTZ,
  active BOOLEAN NOT NULL DEFAULT true,
  note TEXT,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE discount_codes ENABLE ROW LEVEL SECURITY;
-- Sin políticas: solo el service role.

CREATE TABLE IF NOT EXISTS discount_redemptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code_id UUID NOT NULL REFERENCES discount_codes(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  checkout_id TEXT,
  redeemed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (code_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_discount_redemptions_code ON discount_redemptions(code_id);
ALTER TABLE discount_redemptions ENABLE ROW LEVEL SECURITY;
-- Sin políticas: solo el service role.

-- Qué código se usó en cada checkout y en cada suscripción.
ALTER TABLE billing_checkouts ADD COLUMN IF NOT EXISTS discount_code_id UUID REFERENCES discount_codes(id) ON DELETE SET NULL;
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS discount_code_id UUID REFERENCES discount_codes(id) ON DELETE SET NULL;
