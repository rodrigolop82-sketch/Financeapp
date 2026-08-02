-- Phase 1: Unify categories — evolve budget_categories into the single source of truth
-- Adds icon, is_default, created_at; makes household_id nullable for system defaults

-- Add new columns
ALTER TABLE budget_categories
  ADD COLUMN IF NOT EXISTS icon TEXT,
  ADD COLUMN IF NOT EXISTS is_default BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

-- Set is_default for existing non-custom categories
UPDATE budget_categories SET is_default = true WHERE is_custom = false;

-- Make household_id nullable to support system-wide default categories
ALTER TABLE budget_categories ALTER COLUMN household_id DROP NOT NULL;

-- Update RLS: system defaults (household_id IS NULL) visible to all authenticated users
CREATE POLICY "Anyone can view system default categories" ON budget_categories
  FOR SELECT USING (household_id IS NULL);

-- Update the trigger to mark auto-created categories as defaults
CREATE OR REPLACE FUNCTION create_default_categories()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO budget_categories (household_id, name, bucket, budgeted_amount, is_custom, is_default) VALUES
    -- Necesidades (50%)
    (NEW.id, 'Vivienda/alquiler', 'needs', 0, false, true),
    (NEW.id, 'Alimentación', 'needs', 0, false, true),
    (NEW.id, 'Transporte', 'needs', 0, false, true),
    (NEW.id, 'Salud/medicinas', 'needs', 0, false, true),
    (NEW.id, 'Servicios (agua, luz, internet)', 'needs', 0, false, true),
    (NEW.id, 'Educación', 'needs', 0, false, true),
    -- Gustos (30%)
    (NEW.id, 'Restaurantes y salidas', 'wants', 0, false, true),
    (NEW.id, 'Ropa', 'wants', 0, false, true),
    (NEW.id, 'Entretenimiento', 'wants', 0, false, true),
    (NEW.id, 'Suscripciones', 'wants', 0, false, true),
    (NEW.id, 'Varios personales', 'wants', 0, false, true),
    -- Ahorro/Deudas (20%)
    (NEW.id, 'Fondo de emergencia', 'savings', 0, false, true),
    (NEW.id, 'Ahorro metas', 'savings', 0, false, true),
    (NEW.id, 'Pago de deudas extra', 'savings', 0, false, true);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
