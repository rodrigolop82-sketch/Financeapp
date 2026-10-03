-- Add an "income" bucket with default categories so deposits/income
-- transactions can actually be classified, instead of being forced into
-- an expense bucket (needs/wants/savings) or left without a category
-- (which was silently breaking "Guardar cambio" when editing a
-- transaction's type to Ingreso).
--
-- bucket has a CHECK constraint (budget_categories_bucket_check) that was
-- never added through a tracked migration in this repo — it must have been
-- created directly in the Supabase dashboard at some point. It currently
-- only allows 'needs' | 'wants' | 'savings', so it must be widened before
-- any 'income' row can be inserted.

-- 0. Widen the bucket CHECK constraint to allow 'income'.
ALTER TABLE budget_categories DROP CONSTRAINT IF EXISTS budget_categories_bucket_check;
ALTER TABLE budget_categories
  ADD CONSTRAINT budget_categories_bucket_check
  CHECK (bucket IN ('needs', 'wants', 'savings', 'income'));

-- 1. Backfill: give every existing household these two defaults if they
--    don't already have them (idempotent — safe to re-run).
INSERT INTO budget_categories (household_id, name, bucket, budgeted_amount, is_custom, is_default, icon)
SELECT h.id, v.name, 'income', 0, false, true, v.icon
FROM households h
CROSS JOIN (VALUES
  ('Salario', '💵'),
  ('Otros ingresos', '💰')
) AS v(name, icon)
WHERE NOT EXISTS (
  SELECT 1 FROM budget_categories bc
  WHERE bc.household_id = h.id AND bc.name = v.name AND bc.is_default = true
);

-- 2. Update the trigger so future households get these too.
CREATE OR REPLACE FUNCTION create_default_categories()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO budget_categories (household_id, name, bucket, budgeted_amount, is_custom, is_default, icon) VALUES
    -- Necesidades (50%)
    (NEW.id, 'Vivienda/alquiler', 'needs', 0, false, true, NULL),
    (NEW.id, 'Alimentación', 'needs', 0, false, true, NULL),
    (NEW.id, 'Transporte', 'needs', 0, false, true, NULL),
    (NEW.id, 'Salud/medicinas', 'needs', 0, false, true, NULL),
    (NEW.id, 'Servicios (agua, luz, internet)', 'needs', 0, false, true, NULL),
    (NEW.id, 'Educación', 'needs', 0, false, true, NULL),
    -- Gustos (30%)
    (NEW.id, 'Restaurantes y salidas', 'wants', 0, false, true, NULL),
    (NEW.id, 'Ropa', 'wants', 0, false, true, NULL),
    (NEW.id, 'Entretenimiento', 'wants', 0, false, true, NULL),
    (NEW.id, 'Suscripciones', 'wants', 0, false, true, NULL),
    (NEW.id, 'Varios personales', 'wants', 0, false, true, NULL),
    -- Ahorro/Deudas (20%)
    (NEW.id, 'Fondo de emergencia', 'savings', 0, false, true, NULL),
    (NEW.id, 'Ahorro metas', 'savings', 0, false, true, NULL),
    (NEW.id, 'Pago de deudas extra', 'savings', 0, false, true, NULL),
    -- Ingresos (no aplica al 50/30/20 — no se usa en presupuesto ni Health Score)
    (NEW.id, 'Salario', 'income', 0, false, true, '💵'),
    (NEW.id, 'Otros ingresos', 'income', 0, false, true, '💰');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
