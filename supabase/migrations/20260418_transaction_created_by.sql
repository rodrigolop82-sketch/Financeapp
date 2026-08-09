-- Add created_by to track which household member registered each transaction
ALTER TABLE transactions
  ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES users(id) ON DELETE SET NULL;

-- Index for fast queries on the familia spending breakdown
CREATE INDEX IF NOT EXISTS idx_transactions_created_by ON transactions(created_by);
