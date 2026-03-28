-- Budget sub-items: detailed line items within each budget category
-- Example: "Educación" category → Colegiatura, Bus, Extracurriculares, Libros
CREATE TABLE IF NOT EXISTS budget_sub_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id UUID NOT NULL REFERENCES budget_categories(id) ON DELETE CASCADE,
  household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  amount NUMERIC(12,2) DEFAULT 0,
  is_fixed BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast lookups
CREATE INDEX idx_budget_sub_items_category ON budget_sub_items(category_id);
CREATE INDEX idx_budget_sub_items_household ON budget_sub_items(household_id);

-- RLS
ALTER TABLE budget_sub_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view sub-items"
  ON budget_sub_items FOR SELECT
  USING (household_id IN (
    SELECT household_id FROM household_members WHERE user_id = auth.uid()
  ));

CREATE POLICY "Members can insert sub-items"
  ON budget_sub_items FOR INSERT
  WITH CHECK (household_id IN (
    SELECT household_id FROM household_members WHERE user_id = auth.uid()
  ));

CREATE POLICY "Members can update sub-items"
  ON budget_sub_items FOR UPDATE
  USING (household_id IN (
    SELECT household_id FROM household_members WHERE user_id = auth.uid()
  ));

CREATE POLICY "Members can delete sub-items"
  ON budget_sub_items FOR DELETE
  USING (household_id IN (
    SELECT household_id FROM household_members WHERE user_id = auth.uid()
  ));
