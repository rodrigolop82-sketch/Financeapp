-- ══════════════════════════════════════════════
-- Movimientos: búsqueda anual
-- ══════════════════════════════════════════════
-- search_transactions_summary: con los mismos filtros que search_transactions,
-- cuántos movimientos hay por mes y cuánto suman gastos e ingresos (por
-- `type`). Alimenta la tarjeta de resumen de búsqueda, los encabezados de mes
-- y el "Ver más (N)", sin depender de las filas paginadas.
-- La API cae a search_transactions_month_totals si esta función no existe.

CREATE OR REPLACE FUNCTION search_transactions_summary(
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
  sum_expense NUMERIC,
  sum_income NUMERIC
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
    coalesce(sum(CASE WHEN t.type = 'expense' THEN t.amount ELSE 0 END), 0) AS sum_expense,
    coalesce(sum(CASE WHEN t.type = 'income' THEN t.amount ELSE 0 END), 0) AS sum_income
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

REVOKE ALL ON FUNCTION search_transactions_summary FROM PUBLIC;
GRANT EXECUTE ON FUNCTION search_transactions_summary TO authenticated;

-- Búsquedas por hogar y fecha en todo el año.
CREATE INDEX IF NOT EXISTS idx_transactions_household_date_desc
  ON transactions (household_id, date DESC);
