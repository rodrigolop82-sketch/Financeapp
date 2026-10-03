-- ══════════════════════════════════════════════
-- Rediseño Fase 7: importar estado de cuenta sin duplicados
-- ══════════════════════════════════════════════
-- statement_import_id: de qué importación viene (o con cuál se juntó) un
-- movimiento. bank_description: la descripción original del banco; con
-- fecha y monto evita volver a importar el mismo cargo.

ALTER TABLE transactions ADD COLUMN IF NOT EXISTS statement_import_id UUID REFERENCES statement_imports(id) ON DELETE SET NULL;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS bank_description TEXT;
CREATE INDEX IF NOT EXISTS idx_transactions_statement_import ON transactions(statement_import_id);
