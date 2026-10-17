-- ══════════════════════════════════════════════
-- C15 · Android: gastos que llegan solos desde los avisos del banco
-- ══════════════════════════════════════════════
-- MacroDroid/Tasker manda el texto del aviso a /api/parse-notification con
-- la clave personal (la misma del atajo de Apple Pay). Esos gastos se
-- guardan con source = 'android'. Solo amplía la lista de valores
-- permitidos: no cambia ni borra datos.

ALTER TABLE transactions
  DROP CONSTRAINT IF EXISTS transactions_source_check;

ALTER TABLE transactions
  ADD CONSTRAINT transactions_source_check
  CHECK (source IN ('manual', 'voice', 'ocr', 'csv', 'statement', 'text', 'apple_pay', 'android'));
