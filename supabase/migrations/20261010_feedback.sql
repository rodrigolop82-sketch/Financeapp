-- ══════════════════════════════════════════════
-- Rediseño Fase 11: "Envíanos tu idea"
-- ══════════════════════════════════════════════
-- feedback: mensajes que los usuarios mandan desde Mi cuenta y Más.
--   La API POST /api/feedback valida la sesión, guarda la fila con el
--   service role (user_id siempre sale de la sesión, nunca del cliente),
--   sube la captura y manda el correo a hola@zafiapp.com.
--   Límite: 5 por usuario por día (lo cuenta la API).
-- RLS: el usuario solo puede insertar sus propias filas; no hay SELECT,
--   UPDATE ni DELETE para usuarios. La lectura es solo con service role
--   (Admin › Feedback, fase 12).
-- Storage: bucket privado "feedback" sin políticas para usuarios. Solo la
--   API (service role) sube capturas, en {user_id}/{feedback_id}.{ext}, tras
--   validar tipo (imagen) y tamaño (≤ 5 MB). Los enlaces del correo son
--   firmados y vencen en 7 días.

CREATE TABLE IF NOT EXISTS feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  type TEXT NOT NULL CHECK (type IN ('idea','bug','otro')),
  message TEXT NOT NULL,
  screen TEXT,                 -- ruta desde donde se abrió
  screenshot_path TEXT,        -- Supabase Storage, bucket privado 'feedback'
  status TEXT NOT NULL DEFAULT 'nuevo' CHECK (status IN ('nuevo','leido','respondido')),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS feedback_user_created_idx ON feedback (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS feedback_created_idx ON feedback (created_at DESC);

ALTER TABLE feedback ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users can insert own feedback" ON feedback;
CREATE POLICY "users can insert own feedback" ON feedback
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Bucket privado para capturas (si el esquema de Storage existe).
DO $$
BEGIN
  IF to_regclass('storage.buckets') IS NOT NULL THEN
    INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    VALUES (
      'feedback', 'feedback', false, 5242880,
      ARRAY['image/png','image/jpeg','image/webp','image/gif','image/heic','image/heif']
    )
    ON CONFLICT (id) DO NOTHING;
  END IF;
END $$;
