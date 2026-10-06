-- ══════════════════════════════════════════════
-- Feedback: registrar si el correo a hola@zafiapp.com salió
-- ══════════════════════════════════════════════
-- Antes, si faltaba RESEND_API_KEY o Resend fallaba, el mensaje se guardaba y el
-- usuario veía "gracias", pero nadie se enteraba de que el correo no salió.
-- Ahora la API guarda aquí el resultado del envío y Admin › Feedback avisa
-- cuando hay mensajes que no llegaron por correo.
--
--   email_status: 'enviado' | 'omitido' (sin RESEND_API_KEY) | 'fallido' (Resend respondió error)
--   email_error:  detalle corto del error (solo si 'fallido'); null en los demás casos
--
-- Las filas anteriores quedan con NULL = "no se sabe" y no generan aviso.
-- Es aditiva: no cambia RLS ni políticas (los usuarios siguen sin SELECT/UPDATE).

ALTER TABLE feedback ADD COLUMN IF NOT EXISTS email_status TEXT
  CHECK (email_status IN ('enviado','omitido','fallido'));
ALTER TABLE feedback ADD COLUMN IF NOT EXISTS email_error TEXT;
