-- ══════════════════════════════════════════════
-- Mi patrimonio agrupado por tipo
-- ══════════════════════════════════════════════
-- · financial_sources.kind: "Casa o vehículo" se divide en 'vehicle' y
--   'real_estate', para agrupar los activos en Efectivo y equivalentes,
--   Inversiones, Vehículos e Inmuebles. Las filas existentes se reparten por
--   su nombre (marcas y palabras de vehículo → 'vehicle'; el resto →
--   'real_estate'). La persona puede cambiar el tipo al editar la cuenta.
-- · debts.original_amount: cuánto se pidió prestado (opcional), para mostrar
--   cuánto llevas pagado.
-- · debts.purpose: para qué es un préstamo (vehículo, inmueble o personal).
--   Opcional; sirve para agrupar las deudas por plazo.

UPDATE financial_sources SET kind = 'vehicle'
WHERE kind = 'property_or_vehicle'
  AND name ~* '(carro|auto|veh[ií]culo|moto|camioneta|pick ?up|cami[oó]n|bus|toyota|honda|mazda|nissan|hyundai|kia|suzuki|mitsubishi|ford|chevrolet|jeep|bmw|mercedes|audi|volkswagen|isuzu|yamaha|subaru|tesla)';
UPDATE financial_sources SET kind = 'real_estate' WHERE kind = 'property_or_vehicle';

ALTER TABLE financial_sources DROP CONSTRAINT IF EXISTS financial_sources_kind_check;
ALTER TABLE financial_sources ADD CONSTRAINT financial_sources_kind_check
  CHECK (kind IN ('bank_account', 'cash', 'investment', 'vehicle', 'real_estate',
                  'credit_card', 'loan', 'other_asset', 'other_liability'));

ALTER TABLE debts ADD COLUMN IF NOT EXISTS original_amount NUMERIC(12,2);
ALTER TABLE debts DROP CONSTRAINT IF EXISTS debts_original_amount_check;
ALTER TABLE debts ADD CONSTRAINT debts_original_amount_check CHECK (original_amount IS NULL OR original_amount >= 0);

ALTER TABLE debts ADD COLUMN IF NOT EXISTS purpose TEXT;
ALTER TABLE debts DROP CONSTRAINT IF EXISTS debts_purpose_check;
ALTER TABLE debts ADD CONSTRAINT debts_purpose_check CHECK (purpose IS NULL OR purpose IN ('vehicle', 'real_estate', 'personal'));
