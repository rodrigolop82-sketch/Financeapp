-- Add pace_mode and expected_day to budget_categories
-- pace_mode: 'linear' (spread over month) or 'fixed' (paid on a specific day)
-- expected_day: day of month (1-31) when a fixed expense is paid

ALTER TABLE budget_categories
  ADD COLUMN pace_mode TEXT NOT NULL DEFAULT 'linear'
    CHECK (pace_mode IN ('linear', 'fixed'));

ALTER TABLE budget_categories
  ADD COLUMN expected_day SMALLINT NULL
    CHECK (expected_day BETWEEN 1 AND 31);

-- Backfill: categories where ALL sub-items are is_fixed = true → pace_mode = 'fixed'
UPDATE budget_categories bc
SET pace_mode = 'fixed'
WHERE EXISTS (
  SELECT 1 FROM budget_sub_items bsi
  WHERE bsi.category_id = bc.id
)
AND NOT EXISTS (
  SELECT 1 FROM budget_sub_items bsi
  WHERE bsi.category_id = bc.id AND bsi.is_fixed = false
);
