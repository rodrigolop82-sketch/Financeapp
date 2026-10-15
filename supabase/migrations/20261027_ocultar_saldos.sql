-- ══════════════════════════════════════════════
-- F9: Ocultar saldos
-- ══════════════════════════════════════════════
-- · users.ocultar_saldos: cubre los montos de Inicio y Mi patrimonio con
--   "Q ••••". Por defecto false. Vive junto a currency y show_decimals,
--   las otras preferencias de cómo se ven los montos.
-- · RLS: la política existente "Users can update own data" (FOR UPDATE
--   USING id = auth.uid()) ya deja a cada usuario cambiar su propia fila,
--   incluida esta columna. No se agregan políticas nuevas.
-- · El bloqueo con Face ID o huella se guarda en el dispositivo, no aquí:
--   la biometría es de cada teléfono.

ALTER TABLE users ADD COLUMN IF NOT EXISTS ocultar_saldos BOOLEAN NOT NULL DEFAULT false;
