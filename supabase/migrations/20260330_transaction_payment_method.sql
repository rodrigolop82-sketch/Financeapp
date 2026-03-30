-- Add payment_method column to transactions
ALTER TABLE transactions
ADD COLUMN payment_method TEXT DEFAULT 'efectivo'
CHECK (payment_method IN ('efectivo', 'tarjeta', 'cheque', 'transferencia'));
