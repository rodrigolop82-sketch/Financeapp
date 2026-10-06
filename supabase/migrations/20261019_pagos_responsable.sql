-- ══════════════════════════════════════════════
-- Pagos del mes con responsable y recordatorios
-- ══════════════════════════════════════════════
-- · recurring_bills: pagos fijos (renta, luz, colegio…) con día de pago,
--   responsable (NULL = cualquiera) y avisos.
-- · bill_payments: quién pagó cada pago (o cuota de deuda) en un mes.
-- · debts: responsable y avisos (las deudas con día de pago entran solas).

CREATE TABLE IF NOT EXISTS recurring_bills (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  emoji TEXT,
  amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  approx BOOLEAN NOT NULL DEFAULT false,
  due_day INT NOT NULL CHECK (due_day BETWEEN 1 AND 31),
  category_id UUID REFERENCES budget_categories(id) ON DELETE SET NULL,
  responsible_id UUID REFERENCES users(id) ON DELETE SET NULL,
  remind_3d BOOLEAN NOT NULL DEFAULT true,
  remind_0d BOOLEAN NOT NULL DEFAULT true,
  notify_other BOOLEAN NOT NULL DEFAULT true,
  active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL DEFAULT auth.uid(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_recurring_bills_household ON recurring_bills(household_id) WHERE active;

CREATE TABLE IF NOT EXISTS bill_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  bill_id UUID REFERENCES recurring_bills(id) ON DELETE CASCADE,
  debt_id UUID REFERENCES debts(id) ON DELETE CASCADE,
  month DATE NOT NULL,
  paid_by UUID REFERENCES users(id) ON DELETE SET NULL,
  paid_at TIMESTAMPTZ DEFAULT NOW(),
  transaction_id UUID REFERENCES transactions(id) ON DELETE SET NULL,
  CHECK ((bill_id IS NOT NULL) <> (debt_id IS NOT NULL))
);
CREATE UNIQUE INDEX IF NOT EXISTS bill_payments_bill_month ON bill_payments(bill_id, month) WHERE bill_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS bill_payments_debt_month ON bill_payments(debt_id, month) WHERE debt_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_bill_payments_household_month ON bill_payments(household_id, month);

ALTER TABLE debts ADD COLUMN IF NOT EXISTS responsible_id UUID REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE debts ADD COLUMN IF NOT EXISTS remind_3d BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE debts ADD COLUMN IF NOT EXISTS remind_0d BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE debts ADD COLUMN IF NOT EXISTS notify_other BOOLEAN NOT NULL DEFAULT true;

-- RLS: todos los del hogar ven; escribe quien tiene acceso completo.
ALTER TABLE recurring_bills ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Members can view bills" ON recurring_bills;
CREATE POLICY "Members can view bills" ON recurring_bills
  FOR SELECT USING (household_id IN (SELECT get_my_household_ids()));
DROP POLICY IF EXISTS "Writers can manage bills" ON recurring_bills;
CREATE POLICY "Writers can manage bills" ON recurring_bills
  FOR ALL USING (household_id IN (SELECT get_my_writable_household_ids()))
  WITH CHECK (household_id IN (SELECT get_my_writable_household_ids()));

ALTER TABLE bill_payments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Members can view bill payments" ON bill_payments;
CREATE POLICY "Members can view bill payments" ON bill_payments
  FOR SELECT USING (household_id IN (SELECT get_my_household_ids()));
DROP POLICY IF EXISTS "Writers can manage bill payments" ON bill_payments;
CREATE POLICY "Writers can manage bill payments" ON bill_payments
  FOR ALL USING (household_id IN (SELECT get_my_writable_household_ids()))
  WITH CHECK (household_id IN (SELECT get_my_writable_household_ids()));

-- Avisos de pagos a la persona responsable.
DO $$
BEGIN
  IF to_regclass('public.notification_log') IS NOT NULL THEN
    ALTER TABLE notification_log DROP CONSTRAINT IF EXISTS notification_log_type_check;
    ALTER TABLE notification_log
      ADD CONSTRAINT notification_log_type_check
      CHECK (type IN ('inactivity', 'month_close', 'month_start', 'due', 'cap', 'month_end', 'income', 'apple_pay', 'household', 'trial', 'bill', 'weekly'));
  END IF;
END $$;
