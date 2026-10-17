-- Cerrar el mes (C4): "No hubo ingresos" este mes. Solo agrega una columna
-- (no borra ni cambia datos). Con sin_ingresos = true el paso de ingresos
-- queda completo aunque el mes no tenga ingresos registrados, y el puntaje
-- deja de ser provisional (el ahorro cuenta como 0 %).

ALTER TABLE income_month_confirmations
  ADD COLUMN IF NOT EXISTS sin_ingresos boolean NOT NULL DEFAULT false;
