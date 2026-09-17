-- Add type column to transactions table to support income alongside expenses.
-- Default 'expense' ensures backward compatibility with existing rows.
ALTER TABLE transactions
  ADD COLUMN type TEXT NOT NULL DEFAULT 'expense'
  CHECK (type IN ('expense', 'income'));
