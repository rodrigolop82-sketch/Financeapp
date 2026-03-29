-- Zafi Database Schema
-- Run this in Supabase SQL Editor

-- Usuarios (extiende auth.users de Supabase)
CREATE TABLE users (
  id UUID PRIMARY KEY REFERENCES auth.users(id),
  email TEXT NOT NULL,
  full_name TEXT,
  country TEXT DEFAULT 'GT',
  currency TEXT DEFAULT 'GTQ',
  plan TEXT DEFAULT 'free' CHECK (plan IN ('free', 'premium')),
  show_decimals BOOLEAN DEFAULT false,
  trial_ends_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL '14 days',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Núcleo: hogar (individual o familiar)
CREATE TABLE households (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  owner_id UUID REFERENCES users(id) ON DELETE CASCADE,
  type TEXT DEFAULT 'individual' CHECK (type IN ('individual', 'family')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Miembros del hogar (para modo familia - plan premium)
CREATE TABLE household_members (
  household_id UUID REFERENCES households(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  role TEXT DEFAULT 'member' CHECK (role IN ('owner', 'member')),
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (household_id, user_id)
);

-- Links de invitación para unirse a un hogar
CREATE TABLE household_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  invite_code TEXT NOT NULL UNIQUE,
  created_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'expired')),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '7 days',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Perfil financiero (resultado del diagnóstico)
CREATE TABLE financial_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID REFERENCES households(id) ON DELETE CASCADE,
  total_income NUMERIC(12,2) DEFAULT 0,
  income_type TEXT DEFAULT 'fixed' CHECK (income_type IN ('fixed', 'variable', 'mixed')),
  total_fixed_expenses NUMERIC(12,2) DEFAULT 0,
  total_debt NUMERIC(12,2) DEFAULT 0,
  total_savings NUMERIC(12,2) DEFAULT 0,
  savings_cash NUMERIC(12,2) DEFAULT 0,
  savings_investments NUMERIC(12,2) DEFAULT 0,
  has_emergency_fund BOOLEAN DEFAULT false,
  health_score INTEGER DEFAULT 0 CHECK (health_score BETWEEN 0 AND 100),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Categorías de presupuesto (50/30/20)
CREATE TABLE budget_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID REFERENCES households(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  bucket TEXT NOT NULL CHECK (bucket IN ('needs', 'wants', 'savings')),
  budgeted_amount NUMERIC(12,2) DEFAULT 0,
  is_custom BOOLEAN DEFAULT false
);

-- Transacciones (ingreso manual, OCR o CSV en el futuro)
CREATE TABLE transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID REFERENCES households(id) ON DELETE CASCADE,
  category_id UUID REFERENCES budget_categories(id),
  amount NUMERIC(12,2) NOT NULL,
  description TEXT,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  source TEXT DEFAULT 'manual' CHECK (source IN ('manual', 'ocr', 'csv')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Deudas
CREATE TABLE debts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID REFERENCES households(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT DEFAULT 'credit' CHECK (type IN ('credit', 'loan', 'informal')),
  balance NUMERIC(12,2) NOT NULL,
  interest_rate NUMERIC(5,2) DEFAULT 0,
  min_payment NUMERIC(12,2) DEFAULT 0,
  due_day INTEGER CHECK (due_day BETWEEN 1 AND 31),
  strategy TEXT DEFAULT 'snowball' CHECK (strategy IN ('snowball', 'avalanche')),
  is_paid BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Planes de acción mensuales
CREATE TABLE action_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID REFERENCES households(id) ON DELETE CASCADE,
  month DATE NOT NULL,
  steps JSONB DEFAULT '[]',
  completed_steps JSONB DEFAULT '[]',
  generated_by TEXT DEFAULT 'rule' CHECK (generated_by IN ('rule', 'ai')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (household_id, month)
);

-- Snapshots mensuales (historial de progreso)
CREATE TABLE monthly_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID REFERENCES households(id) ON DELETE CASCADE,
  month DATE NOT NULL,
  health_score INTEGER,
  income NUMERIC(12,2),
  expenses NUMERIC(12,2),
  savings NUMERIC(12,2),
  plan_completed BOOLEAN DEFAULT false,
  UNIQUE (household_id, month)
);

-- Suscripciones Stripe
CREATE TABLE subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  stripe_subscription_id TEXT UNIQUE,
  plan TEXT CHECK (plan IN ('monthly', 'annual')),
  status TEXT CHECK (status IN ('active', 'cancelled', 'past_due', 'trialing')),
  current_period_end TIMESTAMPTZ
);

-- Historial de conversaciones con Zafi AI
CREATE TABLE chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  model_used TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- Row Level Security (RLS)
-- ============================================================

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE households ENABLE ROW LEVEL SECURITY;
ALTER TABLE household_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE financial_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE budget_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE debts ENABLE ROW LEVEL SECURITY;
ALTER TABLE action_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE monthly_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

-- Helper: obtener household_ids del usuario actual
CREATE OR REPLACE FUNCTION get_my_household_ids()
RETURNS SETOF UUID AS $$
  SELECT household_id FROM household_members WHERE user_id = auth.uid()
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Users: solo puede ver/editar su propio registro
CREATE POLICY "Users can view own data" ON users
  FOR SELECT USING (id = auth.uid());
CREATE POLICY "Users can update own data" ON users
  FOR UPDATE USING (id = auth.uid());
CREATE POLICY "Users can insert own data" ON users
  FOR INSERT WITH CHECK (id = auth.uid());

-- Households: solo miembros
CREATE POLICY "Household members can view" ON households
  FOR SELECT USING (id IN (SELECT get_my_household_ids()));
CREATE POLICY "Owner can insert household" ON households
  FOR INSERT WITH CHECK (owner_id = auth.uid());
CREATE POLICY "Owner can update household" ON households
  FOR UPDATE USING (owner_id = auth.uid());
CREATE POLICY "Owner can delete household" ON households
  FOR DELETE USING (owner_id = auth.uid());

-- Household members
CREATE POLICY "Members can view members" ON household_members
  FOR SELECT USING (household_id IN (SELECT get_my_household_ids()));
CREATE POLICY "Owner can manage members" ON household_members
  FOR ALL USING (household_id IN (
    SELECT id FROM households WHERE owner_id = auth.uid()
  ));

-- Financial profiles: solo miembros del household
CREATE POLICY "Members can view profiles" ON financial_profiles
  FOR SELECT USING (household_id IN (SELECT get_my_household_ids()));
CREATE POLICY "Members can manage profiles" ON financial_profiles
  FOR ALL USING (household_id IN (SELECT get_my_household_ids()));

-- Budget categories
CREATE POLICY "Members can view categories" ON budget_categories
  FOR SELECT USING (household_id IN (SELECT get_my_household_ids()));
CREATE POLICY "Members can manage categories" ON budget_categories
  FOR ALL USING (household_id IN (SELECT get_my_household_ids()));

-- Transactions
CREATE POLICY "Members can view transactions" ON transactions
  FOR SELECT USING (household_id IN (SELECT get_my_household_ids()));
CREATE POLICY "Members can manage transactions" ON transactions
  FOR ALL USING (household_id IN (SELECT get_my_household_ids()));

-- Debts
CREATE POLICY "Members can view debts" ON debts
  FOR SELECT USING (household_id IN (SELECT get_my_household_ids()));
CREATE POLICY "Members can manage debts" ON debts
  FOR ALL USING (household_id IN (SELECT get_my_household_ids()));

-- Action plans
CREATE POLICY "Members can view plans" ON action_plans
  FOR SELECT USING (household_id IN (SELECT get_my_household_ids()));
CREATE POLICY "Members can manage plans" ON action_plans
  FOR ALL USING (household_id IN (SELECT get_my_household_ids()));

-- Monthly snapshots
CREATE POLICY "Members can view snapshots" ON monthly_snapshots
  FOR SELECT USING (household_id IN (SELECT get_my_household_ids()));
CREATE POLICY "Members can manage snapshots" ON monthly_snapshots
  FOR ALL USING (household_id IN (SELECT get_my_household_ids()));

-- Subscriptions: solo el usuario
CREATE POLICY "Users can view own subscriptions" ON subscriptions
  FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Users can manage own subscriptions" ON subscriptions
  FOR ALL USING (user_id = auth.uid());

-- Chat messages: solo el usuario
CREATE POLICY "Users can view own chat messages" ON chat_messages
  FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Users can insert own chat messages" ON chat_messages
  FOR INSERT WITH CHECK (user_id = auth.uid());

-- ============================================================
-- Función: crear categorías por defecto al crear household
-- ============================================================

CREATE OR REPLACE FUNCTION create_default_categories()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO budget_categories (household_id, name, bucket, budgeted_amount, is_custom) VALUES
    -- Necesidades (50%)
    (NEW.id, 'Vivienda/alquiler', 'needs', 0, false),
    (NEW.id, 'Alimentación', 'needs', 0, false),
    (NEW.id, 'Transporte', 'needs', 0, false),
    (NEW.id, 'Salud/medicinas', 'needs', 0, false),
    (NEW.id, 'Servicios (agua, luz, internet)', 'needs', 0, false),
    (NEW.id, 'Educación', 'needs', 0, false),
    -- Gustos (30%)
    (NEW.id, 'Restaurantes y salidas', 'wants', 0, false),
    (NEW.id, 'Ropa', 'wants', 0, false),
    (NEW.id, 'Entretenimiento', 'wants', 0, false),
    (NEW.id, 'Suscripciones', 'wants', 0, false),
    (NEW.id, 'Varios personales', 'wants', 0, false),
    -- Ahorro/Deudas (20%)
    (NEW.id, 'Fondo de emergencia', 'savings', 0, false),
    (NEW.id, 'Ahorro metas', 'savings', 0, false),
    (NEW.id, 'Pago de deudas extra', 'savings', 0, false);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_household_created
  AFTER INSERT ON households
  FOR EACH ROW EXECUTE FUNCTION create_default_categories();

-- ============================================================
-- Función: crear registro en users al registrarse
-- ============================================================

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', '')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();
