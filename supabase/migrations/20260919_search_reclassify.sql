-- Phase 1: Search and reclassification infrastructure
-- Adds: category_source, transaction_type on transactions
-- Creates: merchant_category_overrides table
-- Creates: search_transactions + search_transactions_month_totals RPCs
-- Adds: index on transactions(household_id, date)

-- ============================================================
-- 1.1 category_source column on transactions
-- ============================================================
ALTER TABLE transactions
  ADD COLUMN category_source TEXT NOT NULL DEFAULT 'auto'
    CHECK (category_source IN ('auto', 'manual', 'bulk'));

-- ============================================================
-- 1.1b transaction_type column on transactions
-- ============================================================
ALTER TABLE transactions
  ADD COLUMN transaction_type TEXT NOT NULL DEFAULT 'gasto'
    CHECK (transaction_type IN ('gasto', 'ingreso', 'ahorro'));

-- Backfill: derive transaction_type from the category's bucket
UPDATE transactions t
SET transaction_type = 'ahorro'
FROM budget_categories bc
WHERE t.category_id = bc.id
  AND bc.bucket = 'savings';

-- ============================================================
-- 1.2 unaccent extension (idempotent)
-- ============================================================
CREATE EXTENSION IF NOT EXISTS unaccent WITH SCHEMA extensions;

-- ============================================================
-- 1.3 merchant_category_overrides table
-- ============================================================
CREATE TABLE merchant_category_overrides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_key TEXT NOT NULL,
  category_id UUID NOT NULL REFERENCES budget_categories(id) ON DELETE CASCADE,
  household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (merchant_key, household_id)
);

ALTER TABLE merchant_category_overrides ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view household overrides"
  ON merchant_category_overrides FOR SELECT
  USING (household_id IN (SELECT get_my_household_ids()));

CREATE POLICY "Members can manage household overrides"
  ON merchant_category_overrides FOR ALL
  USING (household_id IN (SELECT get_my_household_ids()));

-- ============================================================
-- 1.4 Index on transactions(household_id, date DESC)
-- ============================================================
CREATE INDEX idx_transactions_household_date
  ON transactions (household_id, date DESC);

-- ============================================================
-- 1.5 search_transactions RPC
-- ============================================================
CREATE OR REPLACE FUNCTION search_transactions(
  p_query TEXT DEFAULT NULL,
  p_from DATE DEFAULT NULL,
  p_to DATE DEFAULT NULL,
  p_category_id UUID DEFAULT NULL,
  p_min_amount NUMERIC DEFAULT NULL,
  p_max_amount NUMERIC DEFAULT NULL,
  p_transaction_type TEXT DEFAULT NULL,
  p_limit INT DEFAULT 30,
  p_cursor_date DATE DEFAULT NULL,
  p_cursor_id UUID DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  household_id UUID,
  category_id UUID,
  amount NUMERIC,
  description TEXT,
  date DATE,
  source TEXT,
  payment_method TEXT,
  voice_raw_text TEXT,
  category_source TEXT,
  transaction_type TEXT,
  created_at TIMESTAMPTZ,
  category_name TEXT,
  category_bucket TEXT,
  category_icon TEXT
)
LANGUAGE sql STABLE
SECURITY INVOKER
SET search_path = public, extensions
AS $$
  SELECT
    t.id,
    t.household_id,
    t.category_id,
    t.amount,
    t.description,
    t.date,
    t.source,
    t.payment_method,
    t.voice_raw_text,
    t.category_source,
    t.transaction_type,
    t.created_at,
    bc.name AS category_name,
    bc.bucket AS category_bucket,
    bc.icon AS category_icon
  FROM transactions t
  LEFT JOIN budget_categories bc ON bc.id = t.category_id
  WHERE
    (p_query IS NULL OR p_query = '' OR
      extensions.unaccent(lower(t.description)) LIKE
        '%' || extensions.unaccent(lower(
          replace(replace(replace(p_query, '\', '\\'), '%', '\%'), '_', '\_')
        )) || '%'
    )
    AND (p_from IS NULL OR t.date >= p_from)
    AND (p_to IS NULL OR t.date <= p_to)
    AND (p_category_id IS NULL OR t.category_id = p_category_id)
    AND (p_min_amount IS NULL OR t.amount >= p_min_amount)
    AND (p_max_amount IS NULL OR t.amount <= p_max_amount)
    AND (p_transaction_type IS NULL OR t.transaction_type = p_transaction_type)
    AND (
      p_cursor_date IS NULL OR p_cursor_id IS NULL
      OR (t.date, t.id) < (p_cursor_date, p_cursor_id)
    )
  ORDER BY t.date DESC, t.id DESC
  LIMIT LEAST(p_limit, 100);
$$;

REVOKE ALL ON FUNCTION search_transactions FROM PUBLIC;
GRANT EXECUTE ON FUNCTION search_transactions TO authenticated;

-- ============================================================
-- 1.5b search_transactions_month_totals RPC
-- ============================================================
CREATE OR REPLACE FUNCTION search_transactions_month_totals(
  p_query TEXT DEFAULT NULL,
  p_from DATE DEFAULT NULL,
  p_to DATE DEFAULT NULL,
  p_category_id UUID DEFAULT NULL,
  p_min_amount NUMERIC DEFAULT NULL,
  p_max_amount NUMERIC DEFAULT NULL,
  p_transaction_type TEXT DEFAULT NULL
)
RETURNS TABLE (
  month TEXT,
  count BIGINT,
  sum_gastos NUMERIC
)
LANGUAGE sql STABLE
SECURITY INVOKER
SET search_path = public, extensions
AS $$
  SELECT
    to_char(t.date, 'YYYY-MM') AS month,
    count(*)::BIGINT AS count,
    coalesce(sum(CASE WHEN t.transaction_type = 'gasto' THEN t.amount ELSE 0 END), 0) AS sum_gastos
  FROM transactions t
  WHERE
    (p_query IS NULL OR p_query = '' OR
      extensions.unaccent(lower(t.description)) LIKE
        '%' || extensions.unaccent(lower(
          replace(replace(replace(p_query, '\', '\\'), '%', '\%'), '_', '\_')
        )) || '%'
    )
    AND (p_from IS NULL OR t.date >= p_from)
    AND (p_to IS NULL OR t.date <= p_to)
    AND (p_category_id IS NULL OR t.category_id = p_category_id)
    AND (p_min_amount IS NULL OR t.amount >= p_min_amount)
    AND (p_max_amount IS NULL OR t.amount <= p_max_amount)
    AND (p_transaction_type IS NULL OR t.transaction_type = p_transaction_type)
  GROUP BY to_char(t.date, 'YYYY-MM')
  ORDER BY month DESC;
$$;

REVOKE ALL ON FUNCTION search_transactions_month_totals FROM PUBLIC;
GRANT EXECUTE ON FUNCTION search_transactions_month_totals TO authenticated;
