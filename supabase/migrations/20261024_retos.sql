-- ══════════════════════════════════════════════
-- Retos (challenges) y tip contextual
-- ══════════════════════════════════════════════
-- El progreso se calcula desde las transacciones; aquí solo se guarda qué
-- reto inició el hogar, sus parámetros y el resultado al cerrarse.

CREATE TABLE IF NOT EXISTS challenge_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  type TEXT NOT NULL CHECK (type IN ('spend_reduction', 'logging_streak', 'no_spend_category', 'review_subscriptions')),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  duration_days SMALLINT NOT NULL CHECK (duration_days BETWEEN 1 AND 90),
  health_component TEXT,          -- etiqueta para el copy; no afecta el score
  default_config JSONB NOT NULL DEFAULT '{}'::jsonb,
  active BOOLEAN NOT NULL DEFAULT true
);

ALTER TABLE challenge_templates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Authenticated can read challenge templates" ON challenge_templates;
CREATE POLICY "Authenticated can read challenge templates" ON challenge_templates
  FOR SELECT TO authenticated USING (true);
-- Sin políticas de escritura: solo service role / migraciones.

CREATE TABLE IF NOT EXISTS user_challenges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  template_id UUID NOT NULL REFERENCES challenge_templates(id),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'abandoned')),
  category_id UUID REFERENCES budget_categories(id) ON DELETE SET NULL,
  baseline_daily NUMERIC(12,2),
  target_amount NUMERIC(12,2) CHECK (target_amount IS NULL OR target_amount >= 0),
  started_at DATE NOT NULL,
  ends_at DATE NOT NULL,
  result JSONB,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL DEFAULT auth.uid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (ends_at >= started_at)
);
CREATE INDEX IF NOT EXISTS idx_user_challenges_household_status ON user_challenges(household_id, status);

ALTER TABLE user_challenges ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Members can view challenges" ON user_challenges;
CREATE POLICY "Members can view challenges" ON user_challenges
  FOR SELECT USING (household_id IN (SELECT get_my_household_ids()));
DROP POLICY IF EXISTS "Writers can manage challenges" ON user_challenges;
CREATE POLICY "Writers can manage challenges" ON user_challenges
  FOR ALL USING (household_id IN (SELECT get_my_writable_household_ids()))
  WITH CHECK (household_id IN (SELECT get_my_writable_household_ids()));

CREATE TABLE IF NOT EXISTS contextual_tip_dismissals (
  household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  tip_key TEXT NOT NULL,
  period TEXT NOT NULL CHECK (period ~ '^\d{4}-\d{2}$'),
  dismissed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (household_id, tip_key, period)
);

ALTER TABLE contextual_tip_dismissals ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Members can view tip dismissals" ON contextual_tip_dismissals;
CREATE POLICY "Members can view tip dismissals" ON contextual_tip_dismissals
  FOR SELECT USING (household_id IN (SELECT get_my_household_ids()));
DROP POLICY IF EXISTS "Writers can manage tip dismissals" ON contextual_tip_dismissals;
CREATE POLICY "Writers can manage tip dismissals" ON contextual_tip_dismissals
  FOR ALL USING (household_id IN (SELECT get_my_writable_household_ids()))
  WITH CHECK (household_id IN (SELECT get_my_writable_household_ids()));

-- Plantillas. review_subscriptions queda activa porque el detector de
-- suscripciones (20261022) ya existe.
INSERT INTO challenge_templates (slug, type, title, description, duration_days, health_component, default_config, active) VALUES
  ('spend_reduction_30d', 'spend_reduction', 'Reduce tu gasto en {categoria} por 30 días',
    'Cada día que gastes en {categoria} menos que tu promedio diario de los últimos 3 meses cuenta como cumplido.',
    30, 'Gasto del mes', '{"requires_category": true}'::jsonb, true),
  ('logging_streak_7d', 'logging_streak', '7 días seguidos registrando gastos',
    'Registra al menos un gasto cada día durante una semana.',
    7, 'Gasto del mes', '{}'::jsonb, true),
  ('no_spend_category_14d', 'no_spend_category', '14 días sin {categoria}',
    'Cada día sin gastos en {categoria} cuenta como cumplido.',
    14, 'Ahorro', '{"requires_category": true, "suggested_category": "Restaurantes y salidas"}'::jsonb, true),
  ('review_subscriptions', 'review_subscriptions', 'Revisa tus suscripciones',
    'Revisa tus cobros recurrentes y decide cuáles mantener.',
    7, 'Gasto del mes', '{}'::jsonb, true)
ON CONFLICT (slug) DO NOTHING;
