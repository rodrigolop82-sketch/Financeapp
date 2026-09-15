-- Custom categories: parent_category_id, color, archived_at on budget_categories
-- + household_hidden_categories table, validation trigger, RLS, unique index
--
-- Design decisions (from Phase 0 audit):
--   - expense_type NOT added: pace_mode ('linear'='variable', 'fixed'='fijo')
--     already lives on budget_categories since 20260913_pace_mode.sql
--   - expected_day NOT added: already exists from 20260913_pace_mode.sql
--   - icon column already exists from 20260802_unify_categories.sql — reused for emoji
--   - bucket is inherited from parent_category_id at insert/update time via trigger

-- ============================================================
-- 1. New columns on budget_categories
-- ============================================================

ALTER TABLE budget_categories
  ADD COLUMN IF NOT EXISTS parent_category_id UUID NULL REFERENCES budget_categories(id),
  ADD COLUMN IF NOT EXISTS color TEXT NULL,
  ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ NULL;

-- Name length constraint: 2-30 chars for custom categories only
ALTER TABLE budget_categories
  ADD CONSTRAINT chk_custom_name_length
  CHECK (is_default = true OR char_length(name) BETWEEN 2 AND 30);

-- ============================================================
-- 2. Unique index: no duplicate active custom category names per household
--    (case-insensitive, excludes archived and default categories)
-- ============================================================

CREATE UNIQUE INDEX IF NOT EXISTS uix_custom_category_name
  ON budget_categories (household_id, lower(name))
  WHERE archived_at IS NULL AND is_default = false;

-- ============================================================
-- 3. Validation trigger for custom categories
-- ============================================================

CREATE OR REPLACE FUNCTION validate_custom_category()
RETURNS TRIGGER AS $$
DECLARE
  active_count INTEGER;
  parent_row RECORD;
BEGIN
  IF NEW.is_default = true THEN
    RETURN NEW;
  END IF;

  -- Required fields for custom categories
  IF NEW.household_id IS NULL THEN
    RAISE EXCEPTION 'Las categorías personalizadas requieren household_id';
  END IF;

  IF NEW.parent_category_id IS NULL THEN
    RAISE EXCEPTION 'Las categorías personalizadas requieren un grupo padre';
  END IF;

  IF NEW.icon IS NULL OR NEW.icon = '' THEN
    RAISE EXCEPTION 'Las categorías personalizadas requieren un emoji';
  END IF;

  IF NEW.color IS NULL OR NEW.color = '' THEN
    RAISE EXCEPTION 'Las categorías personalizadas requieren un color';
  END IF;

  -- Parent must exist and be a default category
  SELECT is_default, bucket INTO parent_row
  FROM budget_categories
  WHERE id = NEW.parent_category_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'El grupo padre no existe';
  END IF;

  IF parent_row.is_default = false THEN
    RAISE EXCEPTION 'El grupo padre debe ser una categoría predeterminada';
  END IF;

  -- Inherit bucket from parent
  NEW.bucket := parent_row.bucket;

  -- Max 15 active custom categories per household (on insert or un-archive)
  IF TG_OP = 'INSERT'
     OR (TG_OP = 'UPDATE' AND OLD.archived_at IS NOT NULL AND NEW.archived_at IS NULL)
  THEN
    SELECT COUNT(*) INTO active_count
    FROM budget_categories
    WHERE household_id = NEW.household_id
      AND is_default = false
      AND archived_at IS NULL
      AND id IS DISTINCT FROM NEW.id;

    IF active_count >= 15 THEN
      RAISE EXCEPTION 'Máximo 15 categorías personalizadas activas por hogar';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_validate_custom_category
  BEFORE INSERT OR UPDATE ON budget_categories
  FOR EACH ROW EXECUTE FUNCTION validate_custom_category();

-- ============================================================
-- 4. RLS: replace catch-all FOR ALL with explicit INSERT/UPDATE (no DELETE)
-- ============================================================

DROP POLICY IF EXISTS "Members can manage categories" ON budget_categories;

CREATE POLICY "Members can insert categories" ON budget_categories
  FOR INSERT WITH CHECK (household_id IN (SELECT get_my_household_ids()));

CREATE POLICY "Members can update categories" ON budget_categories
  FOR UPDATE USING (household_id IN (SELECT get_my_household_ids()));

-- Existing SELECT policies remain:
--   "Members can view categories" (household_id match)
--   "Anyone can view system default categories" (household_id IS NULL)
-- No DELETE policy: categories are archived, never deleted.

-- ============================================================
-- 5. New table: household_hidden_categories
-- ============================================================

CREATE TABLE IF NOT EXISTS household_hidden_categories (
  household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  category_id UUID NOT NULL REFERENCES budget_categories(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (household_id, category_id)
);

ALTER TABLE household_hidden_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view hidden categories" ON household_hidden_categories
  FOR SELECT USING (household_id IN (SELECT get_my_household_ids()));

CREATE POLICY "Members can insert hidden categories" ON household_hidden_categories
  FOR INSERT WITH CHECK (household_id IN (SELECT get_my_household_ids()));

CREATE POLICY "Members can delete hidden categories" ON household_hidden_categories
  FOR DELETE USING (household_id IN (SELECT get_my_household_ids()));

-- ============================================================
-- Rollback
-- ============================================================
-- DROP TRIGGER IF EXISTS trg_validate_custom_category ON budget_categories;
-- DROP FUNCTION IF EXISTS validate_custom_category();
-- DROP TABLE IF EXISTS household_hidden_categories;
-- DROP INDEX IF EXISTS uix_custom_category_name;
-- ALTER TABLE budget_categories DROP CONSTRAINT IF EXISTS chk_custom_name_length;
-- ALTER TABLE budget_categories DROP COLUMN IF EXISTS archived_at;
-- ALTER TABLE budget_categories DROP COLUMN IF EXISTS color;
-- ALTER TABLE budget_categories DROP COLUMN IF EXISTS parent_category_id;
-- Re-create: CREATE POLICY "Members can manage categories" ON budget_categories FOR ALL USING (household_id IN (SELECT get_my_household_ids()));
