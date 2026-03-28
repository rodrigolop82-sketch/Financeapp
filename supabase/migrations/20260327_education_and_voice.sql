-- ══════════════════════════════════════════════
-- EDUCACIÓN FINANCIERA
-- ══════════════════════════════════════════════

-- Módulos temáticos
CREATE TABLE IF NOT EXISTS capsule_modules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  icon TEXT,
  color TEXT DEFAULT '#7C3AED',
  order_index INTEGER DEFAULT 0,
  is_premium BOOLEAN DEFAULT false,
  total_capsules INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Cápsulas individuales
CREATE TABLE IF NOT EXISTS capsules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  module_id UUID REFERENCES capsule_modules(id) ON DELETE CASCADE,
  slug TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  subtitle TEXT,
  content_md TEXT NOT NULL DEFAULT '',
  key_takeaway TEXT,
  read_time_minutes INTEGER DEFAULT 3,
  order_index INTEGER DEFAULT 0,
  is_premium BOOLEAN DEFAULT false,
  tags TEXT[] DEFAULT '{}',
  related_score_component TEXT CHECK (
    related_score_component IN (
      'savingsRate', 'debtBurden', 'emergencyFund', 'expenseRatio', 'incomeStability'
    )
  ),
  score_threshold INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Progreso del usuario en educación
CREATE TABLE IF NOT EXISTS user_capsule_progress (
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  capsule_id UUID REFERENCES capsules(id) ON DELETE CASCADE,
  read_at TIMESTAMPTZ DEFAULT NOW(),
  bookmarked BOOLEAN DEFAULT false,
  PRIMARY KEY (user_id, capsule_id)
);

-- ══════════════════════════════════════════════
-- RLS
-- ══════════════════════════════════════════════

ALTER TABLE capsule_modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE capsules ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_capsule_progress ENABLE ROW LEVEL SECURITY;

-- capsule_modules: readable by all authenticated users
CREATE POLICY "capsule_modules_read" ON capsule_modules
  FOR SELECT TO authenticated USING (true);

-- capsules: readable by all authenticated users
CREATE POLICY "capsules_read" ON capsules
  FOR SELECT TO authenticated USING (true);

-- user_capsule_progress: users manage their own progress
CREATE POLICY "progress_select" ON user_capsule_progress
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "progress_insert" ON user_capsule_progress
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "progress_update" ON user_capsule_progress
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "progress_delete" ON user_capsule_progress
  FOR DELETE USING (auth.uid() = user_id);

-- ══════════════════════════════════════════════
-- VOICE: agregar campo voice_raw_text a transactions
-- ══════════════════════════════════════════════

ALTER TABLE transactions
  ADD COLUMN IF NOT EXISTS voice_raw_text TEXT;

-- Actualizar el CHECK de source para incluir 'voice'
ALTER TABLE transactions
  DROP CONSTRAINT IF EXISTS transactions_source_check;

ALTER TABLE transactions
  ADD CONSTRAINT transactions_source_check
  CHECK (source IN ('manual', 'voice', 'ocr', 'csv'));

-- ══════════════════════════════════════════════
-- CHAT: agregar input_mode a chat_messages
-- ══════════════════════════════════════════════

ALTER TABLE chat_messages
  ADD COLUMN IF NOT EXISTS input_mode TEXT DEFAULT 'text'
  CHECK (input_mode IN ('text', 'voice'));

-- ══════════════════════════════════════════════
-- SEED: Módulos de educación financiera
-- ══════════════════════════════════════════════

INSERT INTO capsule_modules (slug, title, description, icon, color, order_index, is_premium)
VALUES
  ('tarjetas',    'Tarjetas de crédito',   'Cómo usar, elegir y maximizar tus tarjetas',          'credit-card',   '#7C3AED', 1, false),
  ('deudas',      'Deudas y préstamos',    'Salí de deudas y tomá préstamos inteligentes',         'trending-down', '#D97706', 2, false),
  ('presupuesto', 'Presupuesto y ahorro',  'Organizá tu dinero y construí el hábito del ahorro',  'pie-chart',     '#059669', 3, false),
  ('inversiones', 'Inversiones',           'Hacé crecer tu dinero con las opciones disponibles',   'trending-up',   '#2563EB', 4, true),
  ('familias',    'Finanzas familiares',   'Gestioná las finanzas en pareja y con hijos',          'home',          '#DC2626', 5, true)
ON CONFLICT (slug) DO NOTHING;

-- ══════════════════════════════════════════════
-- SEED: Cápsulas — Módulo 1: Tarjetas de crédito
-- ══════════════════════════════════════════════

INSERT INTO capsules (module_id, slug, title, subtitle, key_takeaway, read_time_minutes, order_index, is_premium, tags, related_score_component, score_threshold)
VALUES
  ((SELECT id FROM capsule_modules WHERE slug = 'tarjetas'),
   'como-funciona-tarjeta',
   'Cómo funciona realmente una tarjeta de crédito',
   'Período de gracia, fecha de corte y cómo no pagar intereses jamás',
   'Si pagás el saldo total antes de la fecha de pago, nunca pagás intereses.',
   4, 1, false, ARRAY['tarjetas','intereses','básicos'], 'debtBurden', 50),

  ((SELECT id FROM capsule_modules WHERE slug = 'tarjetas'),
   'costo-pago-minimo',
   'El costo real de pagar solo el mínimo',
   'Números reales de lo que paga alguien con Q 14,000 en tarjeta al 28%',
   'Pagar solo el mínimo puede triplicar lo que debés en 5 años.',
   5, 2, false, ARRAY['tarjetas','intereses','deuda'], 'debtBurden', 40),

  ((SELECT id FROM capsule_modules WHERE slug = 'tarjetas'),
   'elegir-mejor-tarjeta',
   'Cómo elegir la tarjeta correcta para vos',
   'Millas vs cashback vs puntos: cuándo conviene cada una',
   'La mejor tarjeta es la que se adapta a dónde realmente gastás.',
   4, 3, false, ARRAY['tarjetas','millas','puntos','beneficios'], NULL, NULL),

  ((SELECT id FROM capsule_modules WHERE slug = 'tarjetas'),
   'maximizar-millas-puntos',
   'Cómo maximizar tus millas y puntos',
   'Acumulá el doble, usá categorías bonus y canjea en el momento correcto',
   'Las millas valen más cuando las usás para vuelos que para efectivo.',
   4, 4, false, ARRAY['tarjetas','millas','puntos','beneficios'], NULL, NULL),

  ((SELECT id FROM capsule_modules WHERE slug = 'tarjetas'),
   'cuotas-sin-interes',
   'El error más caro: compras en cuotas',
   'Por qué las cuotas "sin interés" a veces sí tienen costo oculto',
   'Preguntá siempre el precio de contado antes de aceptar cuotas.',
   3, 5, false, ARRAY['tarjetas','cuotas','intereses'], 'debtBurden', 50),

  ((SELECT id FROM capsule_modules WHERE slug = 'tarjetas'),
   'salir-deuda-tarjeta',
   'Cómo salir de la deuda de tarjeta paso a paso',
   'Método bola de nieve y avalancha aplicado a tarjetas guatemaltecas',
   'Primero la tarjeta con mayor tasa, no la de mayor saldo.',
   5, 6, false, ARRAY['tarjetas','deuda','estrategia'], 'debtBurden', 35),

  ((SELECT id FROM capsule_modules WHERE slug = 'tarjetas'),
   'tarjetas-guatemala-comparativa',
   'Tarjetas en Guatemala: comparativa real',
   'BAC, Banrural, G&T, Industrial, Bantrab — tasas, beneficios, requisitos',
   'La tasa importa más que los beneficios si tenés saldo pendiente.',
   5, 7, false, ARRAY['tarjetas','Guatemala','bancos','comparativa'], NULL, NULL)

ON CONFLICT (slug) DO NOTHING;

-- ══════════════════════════════════════════════
-- SEED: Cápsulas — Módulo 2: Deudas y préstamos
-- ══════════════════════════════════════════════

INSERT INTO capsules (module_id, slug, title, subtitle, key_takeaway, read_time_minutes, order_index, is_premium, tags, related_score_component, score_threshold)
VALUES
  ((SELECT id FROM capsule_modules WHERE slug = 'deudas'),
   'tipos-deuda-orden-ataque',
   'Los 4 tipos de deuda: cuál atacar primero',
   'Informal, tarjeta, consumo, hipoteca — el orden correcto importa',
   'La deuda informal con familia, aunque sin interés, daña relaciones — priorizala.',
   4, 1, false, ARRAY['deudas','estrategia','prioridad'], 'debtBurden', 50),

  ((SELECT id FROM capsule_modules WHERE slug = 'deudas'),
   'prestamo-personal-cuando',
   'Préstamo personal: cuándo tiene sentido y cuándo no',
   'Consolidación de deudas vs contraer nuevo crédito',
   'Un préstamo para consolidar deudas solo tiene sentido si la tasa nueva es menor.',
   4, 2, false, ARRAY['préstamos','consumo','consolidación'], 'debtBurden', 45),

  ((SELECT id FROM capsule_modules WHERE slug = 'deudas'),
   'leer-contrato-prestamo',
   'Cómo leer un contrato de préstamo',
   'TEA, TEN, gastos administrativos y el seguro de vida que nadie explica',
   'La tasa que te ofrecen en el banco no es la tasa real que pagás.',
   5, 3, false, ARRAY['préstamos','contratos','tasa','básicos'], NULL, NULL),

  ((SELECT id FROM capsule_modules WHERE slug = 'deudas'),
   'deuda-informal-familia',
   'La deuda informal con familia y amigos',
   'Cómo manejarla correctamente sin dañar la relación',
   'Ponerla por escrito, aunque sea informal, protege la relación.',
   3, 4, false, ARRAY['deudas','informal','familia','LATAM'], 'debtBurden', 60),

  ((SELECT id FROM capsule_modules WHERE slug = 'deudas'),
   'prestamo-vehiculo',
   'Préstamo de vehículo: lo que los concesionarios no te dicen',
   'Tasa real, seguro incluido y el impacto en el valor de reventa',
   'El costo total de un vehículo en cuotas puede ser el doble del precio de lista.',
   5, 5, true, ARRAY['préstamos','vehículo','concesionario'], NULL, NULL),

  ((SELECT id FROM capsule_modules WHERE slug = 'deudas'),
   'prestamo-vivienda-guatemala',
   'Préstamo de vivienda en Guatemala',
   'Bancos vs FOPAVI: requisitos, plazos, tasa fija vs variable',
   'FOPAVI tiene tasas subsidiadas que los bancos no pueden igualar si calificás.',
   6, 6, true, ARRAY['préstamos','vivienda','hipoteca','Guatemala'], NULL, NULL),

  ((SELECT id FROM capsule_modules WHERE slug = 'deudas'),
   'refinanciamiento-cuando-conviene',
   'Refinanciamiento: cuándo conviene y cuándo no',
   'Calculá el ahorro real antes de firmar cualquier refinanciamiento',
   'Refinanciar tiene sentido solo si el ahorro en intereses supera los costos de cierre.',
   4, 7, true, ARRAY['préstamos','refinanciamiento','estrategia'], 'debtBurden', 30)

ON CONFLICT (slug) DO NOTHING;

-- ══════════════════════════════════════════════
-- SEED: Cápsulas — Módulo 3: Presupuesto y ahorro
-- ══════════════════════════════════════════════

INSERT INTO capsules (module_id, slug, title, subtitle, key_takeaway, read_time_minutes, order_index, is_premium, tags, related_score_component, score_threshold)
VALUES
  ((SELECT id FROM capsule_modules WHERE slug = 'presupuesto'),
   'metodo-50-30-20-guatemala',
   'El método 50/30/20 para Guatemala',
   'Con ejemplos reales en Q 4,000, Q 8,000 y Q 15,000 de ingreso mensual',
   'El 50/30/20 es un punto de partida, no una regla rígida — adaptalo a tu realidad.',
   4, 1, false, ARRAY['presupuesto','50/30/20','básicos','Guatemala'], 'expenseRatio', 60),

  ((SELECT id FROM capsule_modules WHERE slug = 'presupuesto'),
   'fondo-emergencia-cuanto-donde',
   'El fondo de emergencia: cuánto, dónde y cómo armarlo',
   'Por qué 3 meses de gastos, no de ingresos, y dónde guardarlo',
   'El fondo de emergencia se mide en meses de gastos fijos, no de ingreso.',
   4, 2, false, ARRAY['ahorro','emergencia','básicos'], 'emergencyFund', 50),

  ((SELECT id FROM capsule_modules WHERE slug = 'presupuesto'),
   'ahorro-automatico',
   'Ahorro automático: el truco que realmente funciona',
   'Por qué ahorrar lo que "sobra" nunca funciona — y qué hacer en cambio',
   'Ahorrá el día del cobro, antes de gastar. Lo que no ves, no lo gastás.',
   3, 3, false, ARRAY['ahorro','automatico','hábitos'], 'savingsRate', 40),

  ((SELECT id FROM capsule_modules WHERE slug = 'presupuesto'),
   'aguinaldo-como-no-desperdiciarlo',
   'El aguinaldo: cómo no desperdiciarlo',
   'Un plan concreto de distribución del bono anual según tu situación',
   'El aguinaldo es la oportunidad más grande del año para mejorar tu puntaje Zafi.',
   4, 4, false, ARRAY['ahorro','aguinaldo','LATAM','Guatemala'], NULL, NULL),

  ((SELECT id FROM capsule_modules WHERE slug = 'presupuesto'),
   'metas-financieras-smart',
   'Metas financieras que realmente se cumplen',
   'Cómo definir una meta SMART con números concretos y fecha real',
   'Una meta sin fecha y sin monto específico es solo un deseo.',
   3, 5, false, ARRAY['metas','ahorro','planificación'], 'savingsRate', 50)

ON CONFLICT (slug) DO NOTHING;

-- ══════════════════════════════════════════════
-- SEED: Cápsulas — Módulo 4: Inversiones (PREMIUM)
-- ══════════════════════════════════════════════

INSERT INTO capsules (module_id, slug, title, subtitle, key_takeaway, read_time_minutes, order_index, is_premium, tags, related_score_component, score_threshold)
VALUES
  ((SELECT id FROM capsule_modules WHERE slug = 'inversiones'),
   'inflacion-dinero-colchon',
   'Por qué el dinero guardado pierde valor',
   'La inflación en Guatemala explicada con números reales',
   'El dinero que no trabaja para vos, trabaja en tu contra.',
   3, 1, true, ARRAY['inversiones','inflación','básicos'], 'savingsRate', 30),

  ((SELECT id FROM capsule_modules WHERE slug = 'inversiones'),
   'certificados-deposito-guatemala',
   'Certificados de depósito (CDs) en Guatemala',
   'Qué bancos pagan más, plazos, riesgo y liquidez',
   'Los CDs son la inversión más segura disponible — pero no la más rentable.',
   4, 2, true, ARRAY['inversiones','CDs','bancos','Guatemala'], 'savingsRate', 40),

  ((SELECT id FROM capsule_modules WHERE slug = 'inversiones'),
   'cuentas-ahorro-tasas',
   'Cuentas de ahorro: cuál paga más en Guatemala',
   'Comparativa de tasas en los principales bancos guatemaltecos',
   'La diferencia entre la mejor y la peor tasa puede ser Q 500 al año en Q 50,000 ahorrados.',
   3, 3, true, ARRAY['inversiones','ahorro','bancos','Guatemala'], 'savingsRate', 35),

  ((SELECT id FROM capsule_modules WHERE slug = 'inversiones'),
   'fondos-inversion-guatemala',
   'Fondos de inversión desde Q 500',
   'Cómo entrar al mercado sin ser millonario en Guatemala',
   'Los fondos de inversión te dan diversificación que no podés lograr solo.',
   4, 4, true, ARRAY['inversiones','fondos','Guatemala'], 'savingsRate', 50),

  ((SELECT id FROM capsule_modules WHERE slug = 'inversiones'),
   'acciones-primer-paso',
   'Acciones de empresas: primeros pasos desde Guatemala',
   'Plataformas accesibles y cómo comprar tu primera acción',
   'Invertir en acciones requiere primero tener fondo de emergencia y deudas bajo control.',
   5, 5, true, ARRAY['inversiones','acciones','bolsa'], 'savingsRate', 60),

  ((SELECT id FROM capsule_modules WHERE slug = 'inversiones'),
   'diversificacion-basica',
   'Diversificación: no pongas todos los huevos en una canasta',
   'El portafolio básico para alguien con puntaje Zafi mayor a 70',
   'Diversificar reduce el riesgo sin reducir necesariamente el rendimiento.',
   4, 6, true, ARRAY['inversiones','diversificación','portafolio'], 'savingsRate', 65),

  ((SELECT id FROM capsule_modules WHERE slug = 'inversiones'),
   'cuando-empezar-invertir',
   'Cuándo empezar a invertir según tu puntaje Zafi',
   'El semáforo: qué hacer primero según dónde estás financieramente',
   'Invertir con deudas caras activas es como llenar un balde con huecos.',
   4, 7, true, ARRAY['inversiones','estrategia','puntaje'], NULL, NULL)

ON CONFLICT (slug) DO NOTHING;

-- ══════════════════════════════════════════════
-- SEED: Cápsulas — Módulo 5: Finanzas familiares (PREMIUM)
-- ══════════════════════════════════════════════

INSERT INTO capsules (module_id, slug, title, subtitle, key_takeaway, read_time_minutes, order_index, is_premium, tags, related_score_component, score_threshold)
VALUES
  ((SELECT id FROM capsule_modules WHERE slug = 'familias'),
   'hablar-dinero-pareja',
   'Cómo hablar de dinero en pareja sin pelear',
   'El método de la reunión mensual de finanzas que funciona',
   'Las peleas de dinero en pareja son de expectativas, no de números.',
   4, 1, true, ARRAY['pareja','familia','comunicación'], NULL, NULL),

  ((SELECT id FROM capsule_modules WHERE slug = 'familias'),
   'cuentas-conjuntas',
   'Cuentas conjuntas: pros, contras y alternativas',
   'Cuándo tener cuenta conjunta y cuándo mantener cuentas separadas',
   'No existe una respuesta correcta — existe la que funciona para su pareja.',
   4, 2, true, ARRAY['pareja','familia','cuentas'], NULL, NULL),

  ((SELECT id FROM capsule_modules WHERE slug = 'familias'),
   'educacion-hijos-ahorro',
   'Planificar la educación de los hijos desde que nacen',
   'Costos reales de educación en Guatemala y cómo ahorrar con tiempo',
   'Cada año que empezás antes de ahorrar para la educación es dinero que no tenés que poner después.',
   5, 3, true, ARRAY['familia','hijos','educación','Guatemala'], 'savingsRate', 40),

  ((SELECT id FROM capsule_modules WHERE slug = 'familias'),
   'seguro-vida-cuando-cuanto',
   'El seguro de vida: cuándo necesitás uno y cuánto',
   'No es un lujo — es una herramienta de planificación financiera familiar',
   'Necesitás seguro de vida si alguien depende económicamente de vos.',
   4, 4, true, ARRAY['familia','seguro','planificación'], NULL, NULL)

ON CONFLICT (slug) DO NOTHING;

-- ══════════════════════════════════════════════
-- Trigger: actualizar total_capsules en capsule_modules
-- ══════════════════════════════════════════════

CREATE OR REPLACE FUNCTION update_module_capsule_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE capsule_modules SET total_capsules = (
      SELECT COUNT(*) FROM capsules WHERE module_id = NEW.module_id
    ) WHERE id = NEW.module_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE capsule_modules SET total_capsules = (
      SELECT COUNT(*) FROM capsules WHERE module_id = OLD.module_id
    ) WHERE id = OLD.module_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS capsule_count_trigger ON capsules;
CREATE TRIGGER capsule_count_trigger
  AFTER INSERT OR DELETE ON capsules
  FOR EACH ROW EXECUTE FUNCTION update_module_capsule_count();

-- Actualizar conteos iniciales
UPDATE capsule_modules m SET total_capsules = (
  SELECT COUNT(*) FROM capsules WHERE module_id = m.id
);
