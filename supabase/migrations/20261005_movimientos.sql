-- ══════════════════════════════════════════════
-- Rediseño Fase 3: Movimientos
-- ══════════════════════════════════════════════
-- 1. Nota libre por movimiento (se edita desde el detalle).
-- 2. source = 'text' para lo que se agrega escribiendo en la hoja de agregar.
-- 3. La búsqueda también coincide con el nombre de la categoría y acepta
--    un filtro por tipo (expense | income). Devuelve type, note y moneda
--    original para pintar la fila sin otra consulta.
-- 4. transactions_month_summary: totales del mes por tipo para la tarjeta
--    "Gastaste / Te entró" (no depende de las filas cargadas).

-- 1 ─────────────────────────────────────────────
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS note TEXT;

-- 2 ─────────────────────────────────────────────
ALTER TABLE transactions
  DROP CONSTRAINT IF EXISTS transactions_source_check;

ALTER TABLE transactions
  ADD CONSTRAINT transactions_source_check
  CHECK (source IN ('manual', 'voice', 'ocr', 'csv', 'statement', 'text'));

-- 3 ─────────────────────────────────────────────
-- Cambian los parámetros y las columnas devueltas: hay que borrar las
-- versiones anteriores para no dejar sobrecargas ambiguas.
DROP FUNCTION IF EXISTS search_transactions(TEXT, DATE, DATE, UUID, NUMERIC, NUMERIC, TEXT, INT, DATE, UUID);
DROP FUNCTION IF EXISTS search_transactions_month_totals(TEXT, DATE, DATE, UUID, NUMERIC, NUMERIC, TEXT);

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
  p_cursor_id UUID DEFAULT NULL,
  p_type TEXT DEFAULT NULL
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
  category_icon TEXT,
  type TEXT,
  note TEXT,
  original_amount NUMERIC,
  original_currency TEXT
)
LANGUAGE sql STABLE
SECURITY INVOKER
SET search_path = public, extensions
AS $$
  WITH q AS (
    SELECT '%' || extensions.unaccent(lower(
      replace(replace(replace(p_query, '\', '\\'), '%', '\%'), '_', '\_')
    )) || '%' AS pattern
  )
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
    bc.icon AS category_icon,
    t.type,
    t.note,
    t.original_amount,
    t.original_currency
  FROM transactions t
  LEFT JOIN budget_categories bc ON bc.id = t.category_id
  CROSS JOIN q
  WHERE
    (p_query IS NULL OR p_query = '' OR
      extensions.unaccent(lower(coalesce(t.description, ''))) LIKE q.pattern OR
      extensions.unaccent(lower(coalesce(bc.name, ''))) LIKE q.pattern
    )
    AND (p_from IS NULL OR t.date >= p_from)
    AND (p_to IS NULL OR t.date <= p_to)
    AND (p_category_id IS NULL OR t.category_id = p_category_id)
    AND (p_min_amount IS NULL OR t.amount >= p_min_amount)
    AND (p_max_amount IS NULL OR t.amount <= p_max_amount)
    AND (p_transaction_type IS NULL OR t.transaction_type = p_transaction_type)
    AND (p_type IS NULL OR t.type = p_type)
    AND (
      p_cursor_date IS NULL OR p_cursor_id IS NULL
      OR (t.date, t.id) < (p_cursor_date, p_cursor_id)
    )
  ORDER BY t.date DESC, t.id DESC
  LIMIT LEAST(p_limit, 100);
$$;

REVOKE ALL ON FUNCTION search_transactions FROM PUBLIC;
GRANT EXECUTE ON FUNCTION search_transactions TO authenticated;

CREATE OR REPLACE FUNCTION search_transactions_month_totals(
  p_query TEXT DEFAULT NULL,
  p_from DATE DEFAULT NULL,
  p_to DATE DEFAULT NULL,
  p_category_id UUID DEFAULT NULL,
  p_min_amount NUMERIC DEFAULT NULL,
  p_max_amount NUMERIC DEFAULT NULL,
  p_transaction_type TEXT DEFAULT NULL,
  p_type TEXT DEFAULT NULL
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
  WITH q AS (
    SELECT '%' || extensions.unaccent(lower(
      replace(replace(replace(p_query, '\', '\\'), '%', '\%'), '_', '\_')
    )) || '%' AS pattern
  )
  SELECT
    to_char(t.date, 'YYYY-MM') AS month,
    count(*)::BIGINT AS count,
    coalesce(sum(CASE WHEN t.transaction_type = 'gasto' THEN t.amount ELSE 0 END), 0) AS sum_gastos
  FROM transactions t
  LEFT JOIN budget_categories bc ON bc.id = t.category_id
  CROSS JOIN q
  WHERE
    (p_query IS NULL OR p_query = '' OR
      extensions.unaccent(lower(coalesce(t.description, ''))) LIKE q.pattern OR
      extensions.unaccent(lower(coalesce(bc.name, ''))) LIKE q.pattern
    )
    AND (p_from IS NULL OR t.date >= p_from)
    AND (p_to IS NULL OR t.date <= p_to)
    AND (p_category_id IS NULL OR t.category_id = p_category_id)
    AND (p_min_amount IS NULL OR t.amount >= p_min_amount)
    AND (p_max_amount IS NULL OR t.amount <= p_max_amount)
    AND (p_transaction_type IS NULL OR t.transaction_type = p_transaction_type)
    AND (p_type IS NULL OR t.type = p_type)
  GROUP BY to_char(t.date, 'YYYY-MM')
  ORDER BY month DESC;
$$;

REVOKE ALL ON FUNCTION search_transactions_month_totals FROM PUBLIC;
GRANT EXECUTE ON FUNCTION search_transactions_month_totals TO authenticated;

-- 4 ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION transactions_month_summary(
  p_from DATE,
  p_to DATE
)
RETURNS TABLE (
  sum_expense NUMERIC,
  sum_income NUMERIC
)
LANGUAGE sql STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT
    coalesce(sum(CASE WHEN t.type = 'expense' THEN t.amount ELSE 0 END), 0) AS sum_expense,
    coalesce(sum(CASE WHEN t.type = 'income' THEN t.amount ELSE 0 END), 0) AS sum_income
  FROM transactions t
  WHERE t.date >= p_from AND t.date <= p_to;
$$;

REVOKE ALL ON FUNCTION transactions_month_summary FROM PUBLIC;
GRANT EXECUTE ON FUNCTION transactions_month_summary TO authenticated;
