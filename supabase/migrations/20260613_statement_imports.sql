-- Add 'statement' to transactions source check constraint
ALTER TABLE transactions
  DROP CONSTRAINT IF EXISTS transactions_source_check;

ALTER TABLE transactions
  ADD CONSTRAINT transactions_source_check
  CHECK (source IN ('manual', 'voice', 'ocr', 'csv', 'statement'));

-- Audit table for statement imports
CREATE TABLE IF NOT EXISTS statement_imports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  household_id UUID REFERENCES households(id) ON DELETE CASCADE NOT NULL,
  bank_detected TEXT,
  file_type TEXT CHECK (file_type IN ('image', 'pdf')),
  transactions_found INTEGER DEFAULT 0,
  transactions_imported INTEGER DEFAULT 0,
  duplicates_detected INTEGER DEFAULT 0,
  status TEXT CHECK (status IN ('processing', 'completed', 'failed')) DEFAULT 'processing',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE statement_imports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see own imports"
  ON statement_imports FOR ALL
  USING (auth.uid() = user_id);
