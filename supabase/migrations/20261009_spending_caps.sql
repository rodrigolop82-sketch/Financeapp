-- ══════════════════════════════════════════════
-- Rediseño Fase 10: Cómo te fue — topes por % de ingreso
-- ══════════════════════════════════════════════
-- spending_caps: tope (máximo ideal, % de los ingresos recibidos) que el
--   hogar eligió para cada grupo. Sin fila se usa el recomendado:
--   vivienda 30 · carro 15 · comida 15 · gustos 10 · deudas 20 · suscripciones 5.
-- budget_categories.cap_key: a qué tope pertenece cada categoría de gasto.
--   La tabla real de categorías es budget_categories (no "categories").
--
-- Mapeo inicial por nombre (sin tildes, minúsculas; la primera regla gana).
-- Solo Lo básico (needs) y Gustos (wants): Ahorro y deudas (savings) es parte
-- del 20 % que se ahorra y no lleva tope. Las mismas reglas están en
-- lib/recomendaciones.ts (inferCapKey) para categorías nuevas.
--   suscripciones  suscrip, streaming, netflix, spotify, gimnasio, membres…
--   deudas         deuda, préstamo, tarjeta, crédito
--   vivienda       vivienda, alquiler, renta, casa, hipoteca, apartamento
--   carro          carro, auto, moto, vehículo, transporte, gasolina, combustible, parqueo
--   comida         alimentación, comida, súper, café, mercado, restaurantes, despensa
--   gustos         entretenimiento, salidas, ropa, varios personales, diversión, ocio, viajes, compras
-- Con los nombres por defecto queda: Vivienda/alquiler → vivienda,
-- Transporte → carro, Alimentación y Restaurantes y salidas → comida,
-- Entretenimiento, Ropa y Varios personales → gustos, Suscripciones →
-- suscripciones. Salud, Servicios y Educación quedan sin tope. Las
-- categorías personalizadas sin coincidencia heredan el tope de su padre.

CREATE TABLE IF NOT EXISTS spending_caps (
  household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  cap_key TEXT NOT NULL CHECK (cap_key IN ('vivienda', 'carro', 'comida', 'gustos', 'deudas', 'suscripciones')),
  pct NUMERIC(5,2) NOT NULL CHECK (pct > 0 AND pct <= 100),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (household_id, cap_key)
);

ALTER TABLE spending_caps ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "household members can manage spending_caps" ON spending_caps;
CREATE POLICY "household members can manage spending_caps" ON spending_caps
  FOR ALL USING (
    household_id IN (
      SELECT id           FROM households        WHERE owner_id = auth.uid()
      UNION
      SELECT household_id FROM household_members WHERE user_id  = auth.uid()
    )
  )
  WITH CHECK (
    household_id IN (
      SELECT id           FROM households        WHERE owner_id = auth.uid()
      UNION
      SELECT household_id FROM household_members WHERE user_id  = auth.uid()
    )
  );

ALTER TABLE budget_categories ADD COLUMN IF NOT EXISTS cap_key TEXT;
ALTER TABLE budget_categories DROP CONSTRAINT IF EXISTS budget_categories_cap_key_check;
ALTER TABLE budget_categories ADD CONSTRAINT budget_categories_cap_key_check
  CHECK (cap_key IS NULL OR cap_key IN ('vivienda', 'carro', 'comida', 'gustos', 'deudas', 'suscripciones'));

-- 1. Por nombre (solo las que aún no tienen tope).
UPDATE budget_categories AS bc
SET cap_key = m.cap_key
FROM (
  SELECT id,
    CASE
      WHEN n ~ 'suscrip|streaming|netflix|spotify|gimnasio|membres' THEN 'suscripciones'
      WHEN n ~ 'deuda|prestamo|tarjeta|credito' THEN 'deudas'
      WHEN n ~ 'vivienda|alquiler|(^|[^a-z])(renta|casa)|hipoteca|apartamento' THEN 'vivienda'
      WHEN n ~ 'carro|(^|[^a-z])(auto|moto)|vehicul|transporte|gasolina|combustible|parqueo' THEN 'carro'
      WHEN n ~ 'aliment|comida|(^|[^a-z])(super|cafe)|mercado|restaurant|despensa' THEN 'comida'
      WHEN n ~ 'entreten|salida|ropa|varios personales|diversion|ocio|viaje|compras|hobby|gusto' THEN 'gustos'
    END AS cap_key
  FROM (
    SELECT id, translate(lower(name), 'áéíóúüñ', 'aeiouun') AS n
    FROM budget_categories
    WHERE cap_key IS NULL AND bucket IN ('needs', 'wants')
  ) s
) m
WHERE bc.id = m.id AND m.cap_key IS NOT NULL;

-- 2. Personalizadas sin coincidencia: el tope de su categoría padre
--    (parent_category_id viene de 20260915_custom_categories.sql; sin ella se salta).
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'budget_categories' AND column_name = 'parent_category_id'
  ) THEN
    UPDATE budget_categories AS child
    SET cap_key = parent.cap_key
    FROM budget_categories AS parent
    WHERE child.parent_category_id = parent.id
      AND child.cap_key IS NULL
      AND parent.cap_key IS NOT NULL
      AND child.bucket IN ('needs', 'wants');
  END IF;
END $$;
