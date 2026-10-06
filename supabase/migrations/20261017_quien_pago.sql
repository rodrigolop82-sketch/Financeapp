-- ══════════════════════════════════════════════
-- Hogar: quién pagó, compartido o personal, y de quién es cada tarjeta
-- ══════════════════════════════════════════════
-- · transactions.paid_by (por defecto quien registra) y scope
--   ('shared' | 'personal'). Con el backfill desaparece "Sin atribuir".
-- · card_owners: últimos 4 dígitos → persona, para los estados de cuenta.
-- · search_transactions(+_summary) filtran por persona y por personal, y
--   devuelven paid_by y scope.

ALTER TABLE transactions ADD COLUMN IF NOT EXISTS paid_by UUID REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS scope TEXT NOT NULL DEFAULT 'shared';
ALTER TABLE transactions DROP CONSTRAINT IF EXISTS transactions_scope_check;
ALTER TABLE transactions ADD CONSTRAINT transactions_scope_check CHECK (scope IN ('shared', 'personal'));

UPDATE transactions SET paid_by = created_by WHERE paid_by IS NULL AND created_by IS NOT NULL;
-- Sin created_by (filas viejas): del dueño del hogar.
UPDATE transactions t SET paid_by = h.owner_id
FROM households h
WHERE t.paid_by IS NULL AND h.id = t.household_id;

CREATE INDEX IF NOT EXISTS idx_transactions_household_paid_by ON transactions(household_id, paid_by);

-- Toda fila nueva sin paid_by queda pagada por quien la registra (o por el
-- dueño del hogar): así no hace falta tocar cada forma de registrar.
CREATE OR REPLACE FUNCTION transactions_default_paid_by()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.paid_by IS NULL THEN
    NEW.paid_by := COALESCE(NEW.created_by, (SELECT owner_id FROM households WHERE id = NEW.household_id));
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS transactions_default_paid_by ON transactions;
CREATE TRIGGER transactions_default_paid_by
  BEFORE INSERT ON transactions
  FOR EACH ROW EXECUTE FUNCTION transactions_default_paid_by();

-- ── card_owners ──
CREATE TABLE IF NOT EXISTS card_owners (
  household_id UUID REFERENCES households(id) ON DELETE CASCADE,
  last4 TEXT NOT NULL CHECK (last4 ~ '^[0-9]{4}$'),
  -- NULL = "Cualquiera" (de los dos).
  owner_id UUID REFERENCES users(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (household_id, last4)
);
ALTER TABLE card_owners ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Members can view card owners" ON card_owners;
CREATE POLICY "Members can view card owners" ON card_owners
  FOR SELECT USING (household_id IN (SELECT get_my_household_ids()));
DROP POLICY IF EXISTS "Writers can manage card owners" ON card_owners;
CREATE POLICY "Writers can manage card owners" ON card_owners
  FOR ALL USING (household_id IN (SELECT get_my_writable_household_ids()))
  WITH CHECK (household_id IN (SELECT get_my_writable_household_ids()));

-- ── Búsqueda con persona y personal ──
DROP FUNCTION IF EXISTS search_transactions(TEXT, DATE, DATE, UUID, NUMERIC, NUMERIC, TEXT, INT, DATE, UUID, TEXT);

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
  p_type TEXT DEFAULT NULL,
  p_paid_by UUID DEFAULT NULL,
  p_scope TEXT DEFAULT NULL
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
  original_currency TEXT,
  paid_by UUID,
  scope TEXT
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
    t.original_currency,
    t.paid_by,
    t.scope
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
    AND (p_paid_by IS NULL OR t.paid_by = p_paid_by)
    AND (p_scope IS NULL OR t.scope = p_scope)
    AND (
      p_cursor_date IS NULL OR p_cursor_id IS NULL
      OR (t.date, t.id) < (p_cursor_date, p_cursor_id)
    )
  ORDER BY t.date DESC, t.id DESC
  LIMIT LEAST(p_limit, 100);
$$;

REVOKE ALL ON FUNCTION search_transactions FROM PUBLIC;
GRANT EXECUTE ON FUNCTION search_transactions TO authenticated;

DROP FUNCTION IF EXISTS search_transactions_summary(TEXT, DATE, DATE, UUID, NUMERIC, NUMERIC, TEXT, TEXT);

CREATE OR REPLACE FUNCTION search_transactions_summary(
  p_query TEXT DEFAULT NULL,
  p_from DATE DEFAULT NULL,
  p_to DATE DEFAULT NULL,
  p_category_id UUID DEFAULT NULL,
  p_min_amount NUMERIC DEFAULT NULL,
  p_max_amount NUMERIC DEFAULT NULL,
  p_transaction_type TEXT DEFAULT NULL,
  p_type TEXT DEFAULT NULL,
  p_paid_by UUID DEFAULT NULL,
  p_scope TEXT DEFAULT NULL
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
    AND (p_paid_by IS NULL OR t.paid_by = p_paid_by)
    AND (p_scope IS NULL OR t.scope = p_scope)
  GROUP BY to_char(t.date, 'YYYY-MM')
  ORDER BY month DESC;
$$;

REVOKE ALL ON FUNCTION search_transactions_summary FROM PUBLIC;
GRANT EXECUTE ON FUNCTION search_transactions_summary TO authenticated;
