-- ══════════════════════════════════════════════
-- Rediseño Fase 1: tuteo en el contenido educativo
-- ══════════════════════════════════════════════
-- Reescribe en tuteo (tú) los textos visibles que se sembraron con voseo
-- en 20260327_education_and_voice.sql y 20260330_education_content.sql.
-- No modifica esas migraciones: solo hace UPDATE sobre los mismos registros.

-- Módulos: descripciones
UPDATE capsule_modules SET description = 'Sal de deudas y toma préstamos inteligentes' WHERE slug = 'deudas';
UPDATE capsule_modules SET description = 'Organiza tu dinero y construye el hábito del ahorro' WHERE slug = 'presupuesto';
UPDATE capsule_modules SET description = 'Haz crecer tu dinero con las opciones disponibles' WHERE slug = 'inversiones';
UPDATE capsule_modules SET description = 'Gestiona las finanzas en pareja y con hijos' WHERE slug = 'familias';

-- Cápsulas: título, subtítulo y frase clave
UPDATE capsules SET title = 'Cómo funciona realmente una tarjeta de crédito', subtitle = 'Período de gracia, fecha de corte y cómo no pagar intereses jamás', key_takeaway = 'Si pagas el saldo total antes de la fecha de pago, nunca pagas intereses.' WHERE slug = 'como-funciona-tarjeta';
UPDATE capsules SET title = 'El costo real de pagar solo el mínimo', subtitle = 'Números reales de lo que paga alguien con Q 14,000 en tarjeta al 28%', key_takeaway = 'Pagar solo el mínimo puede triplicar lo que debes en 5 años.' WHERE slug = 'costo-pago-minimo';
UPDATE capsules SET title = 'Cómo elegir la tarjeta correcta para ti', subtitle = 'Millas vs cashback vs puntos: cuándo conviene cada una', key_takeaway = 'La mejor tarjeta es la que se adapta a dónde realmente gastas.' WHERE slug = 'elegir-mejor-tarjeta';
UPDATE capsules SET title = 'Cómo maximizar tus millas y puntos', subtitle = 'Acumula el doble, usa categorías bonus y canjea en el momento correcto', key_takeaway = 'Las millas valen más cuando las usas para vuelos que para efectivo.' WHERE slug = 'maximizar-millas-puntos';
UPDATE capsules SET title = 'El error más caro: compras en cuotas', subtitle = 'Por qué las cuotas "sin interés" a veces sí tienen costo oculto', key_takeaway = 'Pregunta siempre el precio de contado antes de aceptar cuotas.' WHERE slug = 'cuotas-sin-interes';
UPDATE capsules SET title = 'Tarjetas en Guatemala: comparativa real', subtitle = 'BAC, Banrural, G&T, Industrial, Bantrab — tasas, beneficios, requisitos', key_takeaway = 'La tasa importa más que los beneficios si tienes saldo pendiente.' WHERE slug = 'tarjetas-guatemala-comparativa';
UPDATE capsules SET title = 'Los 4 tipos de deuda: cuál atacar primero', subtitle = 'Informal, tarjeta, consumo, hipoteca — el orden correcto importa', key_takeaway = 'La deuda informal con familia, aunque sin interés, daña relaciones — priorízala.' WHERE slug = 'tipos-deuda-orden-ataque';
UPDATE capsules SET title = 'Cómo leer un contrato de préstamo', subtitle = 'TEA, TEN, gastos administrativos y el seguro de vida que nadie explica', key_takeaway = 'La tasa que te ofrecen en el banco no es la tasa real que pagas.' WHERE slug = 'leer-contrato-prestamo';
UPDATE capsules SET title = 'Préstamo de vivienda en Guatemala', subtitle = 'Bancos vs FOPAVI: requisitos, plazos, tasa fija vs variable', key_takeaway = 'FOPAVI tiene tasas subsidiadas que los bancos no pueden igualar si calificas.' WHERE slug = 'prestamo-vivienda-guatemala';
UPDATE capsules SET title = 'Refinanciamiento: cuándo conviene y cuándo no', subtitle = 'Calcula el ahorro real antes de firmar cualquier refinanciamiento', key_takeaway = 'Refinanciar tiene sentido solo si el ahorro en intereses supera los costos de cierre.' WHERE slug = 'refinanciamiento-cuando-conviene';
UPDATE capsules SET title = 'El método 50/30/20 para Guatemala', subtitle = 'Con ejemplos reales en Q 4,000, Q 8,000 y Q 15,000 de ingreso mensual', key_takeaway = 'El 50/30/20 es un punto de partida, no una regla rígida — adáptalo a tu realidad.' WHERE slug = 'metodo-50-30-20-guatemala';
UPDATE capsules SET title = 'Ahorro automático: el truco que realmente funciona', subtitle = 'Por qué ahorrar lo que "sobra" nunca funciona — y qué hacer en cambio', key_takeaway = 'Ahorra el día del cobro, antes de gastar. Lo que no ves, no lo gastas.' WHERE slug = 'ahorro-automatico';
UPDATE capsules SET title = 'Por qué el dinero guardado pierde valor', subtitle = 'La inflación en Guatemala explicada con números reales', key_takeaway = 'El dinero que no trabaja para ti, trabaja en tu contra.' WHERE slug = 'inflacion-dinero-colchon';
UPDATE capsules SET title = 'Fondos de inversión desde Q 500', subtitle = 'Cómo entrar al mercado sin ser millonario en Guatemala', key_takeaway = 'Los fondos de inversión te dan diversificación que no puedes lograr solo.' WHERE slug = 'fondos-inversion-guatemala';
UPDATE capsules SET title = 'Planificar la educación de los hijos desde que nacen', subtitle = 'Costos reales de educación en Guatemala y cómo ahorrar con tiempo', key_takeaway = 'Cada año que empiezas antes de ahorrar para la educación es dinero que no tienes que poner después.' WHERE slug = 'educacion-hijos-ahorro';
UPDATE capsules SET title = 'El seguro de vida: cuándo necesitas uno y cuánto', subtitle = 'No es un lujo — es una herramienta de planificación financiera familiar', key_takeaway = 'Necesitas seguro de vida si alguien depende económicamente de ti.' WHERE slug = 'seguro-vida-cuando-cuanto';

-- Cápsulas: contenido

-- ══════════════════════════════════════════════
-- CONTENIDO EDUCATIVO: Módulo 1 — Tarjetas de crédito
-- ══════════════════════════════════════════════

UPDATE capsules SET content_md = '## Cómo funciona realmente una tarjeta de crédito

La tarjeta de crédito no es dinero extra — es un **préstamo automático** que el banco te da cada vez que la usas. Si no entiendes cómo funciona, puede costarte miles de quetzales al año.

### Las 3 fechas que tienes que conocer

1. **Fecha de corte**: El día que el banco "cierra la cuenta" del mes. Todo lo que compraste desde el último corte se suma en un estado de cuenta.
2. **Fecha de pago**: Generalmente 15-20 días después del corte. Es tu deadline para pagar.
3. **Período de gracia**: El tiempo entre tu compra y la fecha de pago. Si pagas el total dentro de este período, **no pagas ni un centavo de interés**.

### Ejemplo práctico

Digamos que tu fecha de corte es el 15 de cada mes y tu fecha de pago es el 5 del mes siguiente:

- Compras algo el **16 de enero** → aparece en el estado del **15 de febrero** → tienes hasta el **5 de marzo** para pagar sin intereses.
- Eso te da hasta **48 días de crédito gratis**.

### El truco para nunca pagar intereses

Es simple: **paga el saldo total antes de la fecha de pago**. No el mínimo. No un abono. El total.

Si pagas Q 5,000 y tu saldo total es Q 5,000 → intereses = Q 0.

Si pagas Q 500 (el mínimo) → los Q 4,500 restantes generan intereses del **28% al 60% anual** dependiendo de tu banco.

### ¿Qué pasa si pagas solo el mínimo?

El mínimo generalmente es el 5% del saldo o Q 200 (lo que sea mayor). Parece cómodo, pero:

- Con Q 10,000 de saldo al 42% anual, pagar solo el mínimo te tomará **más de 7 años** para liquidar.
- Vas a pagar más de **Q 18,000 en total** — casi el doble de lo que compraste.

### Regla de oro

> Usa la tarjeta como si fuera débito: solo compra lo que ya tienes en tu cuenta bancaria. Así siempre puedes pagar el total.
' WHERE slug = 'como-funciona-tarjeta';

UPDATE capsules SET content_md = '## El costo real de pagar solo el mínimo

"Paga el mínimo y sigue disfrutando." Esa frase de los bancos es la trampa más cara que existe en finanzas personales.

### Un caso real con números guatemaltecos

**Situación:** Saldo de Q 14,000 en una tarjeta con tasa del 28% anual. Pago mínimo: 5% del saldo.

| Estrategia | Tiempo para pagar | Total pagado | Intereses pagados |
|---|---|---|---|
| Solo mínimo | 7 años 4 meses | Q 22,890 | Q 8,890 |
| Q 500/mes fijo | 3 años 5 meses | Q 20,360 | Q 6,360 |
| Q 1,000/mes fijo | 1 año 5 meses | Q 16,940 | Q 2,940 |
| Pago total | 1 mes | Q 14,000 | Q 0 |

### ¿Por qué el mínimo es tan caro?

Porque el mínimo **baja cada mes**. Como es un porcentaje del saldo, mientras más pagas, más baja el pago — y más lento sales de la deuda.

- Mes 1: Mínimo = Q 700 (5% de Q 14,000)
- Mes 12: Mínimo = Q 520
- Mes 36: Mínimo = Q 310

Cada mes pagas menos, pero los intereses siguen corriendo sobre lo que debes.

### El efecto bola de nieve inversa

Si sigues usando la tarjeta mientras pagas el mínimo, la deuda **crece en vez de bajar**. Esto es lo que le pasa a la mayoría:

1. Debes Q 14,000
2. Pagas mínimo de Q 700
3. Usas Q 2,000 más en el mes
4. Al siguiente mes debes Q 14,670 (incluyendo intereses)
5. Repetir... y en un año debes Q 20,000+

### ¿Qué hacer si ya estás pagando solo el mínimo?

1. **Deja de usar la tarjeta.** Sácala de tu billetera.
2. **Fija un pago mensual** que sea al menos el doble del mínimo actual.
3. **Nunca bajes ese pago**, aunque el mínimo baje.
4. Si puedes, transfiere el saldo a una tarjeta con menor tasa.

### La regla más importante

> Si no puedes pagar el total este mes, paga lo máximo posible — pero nunca, nunca solo el mínimo.
' WHERE slug = 'costo-pago-minimo';

UPDATE capsules SET content_md = '## Cómo elegir la tarjeta correcta para ti

No todas las tarjetas son iguales. La mejor tarjeta depende de **cómo y dónde gastas**.

### Los 3 tipos de beneficios

#### 1. Millas aéreas
- Acumulas millas por cada quetzal gastado (generalmente 1 milla por Q 5-10)
- Las canjeas por vuelos
- **Ideal si:** viajas al menos 1-2 veces al año

#### 2. Cashback
- Te devuelven un porcentaje de tus compras (1-3%)
- Se aplica como crédito a tu estado de cuenta
- **Ideal si:** prefieres beneficio directo y simple

#### 3. Puntos canjeables
- Similar a millas pero se canjean por productos, gift cards, etc.
- **Ideal si:** no viajas mucho pero quieres beneficios

### Lo que importa más que los beneficios

Antes de elegir por beneficios, revisa esto:

| Factor | Por qué importa |
|---|---|
| **Tasa de interés** | Si alguna vez no pagas el total, esta es la que te cobra. Rango en Guatemala: 28%-60% |
| **Anualidad** | El costo anual por tener la tarjeta. Rango: Q 0 - Q 2,500 |
| **Cuota de manejo** | Cargo mensual adicional en algunas tarjetas |
| **Seguros incluidos** | Algunas incluyen seguro de viaje o compras |

### La fórmula para decidir

**Si tienes saldo pendiente** → la tasa de interés es lo único que importa. Elige la de menor tasa.

**Si siempre pagas el total** → enfócate en beneficios y anualidad.

### Calcula tu beneficio real

Ejemplo: Gastas Q 8,000/mes en tu tarjeta.

- **Tarjeta A:** 1% cashback, anualidad Q 500 → Beneficio anual: (Q 8,000 × 12 × 1%) - Q 500 = **Q 460**
- **Tarjeta B:** 2% cashback, anualidad Q 1,500 → Beneficio anual: (Q 8,000 × 12 × 2%) - Q 1,500 = **Q 420**
- **Tarjeta C:** Millas equivalentes a Q 0.015/Q, anualidad Q 800 → (Q 8,000 × 12 × Q 0.015) - Q 800 = **Q 640** (si usas las millas para vuelos)

### Regla de oro

> La mejor tarjeta es la que te da más beneficio **neto** (beneficios menos costos) según tu patrón real de gasto.
' WHERE slug = 'elegir-mejor-tarjeta';

UPDATE capsules SET content_md = '## Cómo maximizar tus millas y puntos

Si ya tienes una tarjeta con millas o puntos, la mayoría de personas deja dinero sobre la mesa por no saber cómo maximizarlos.

### Regla #1: Usa la tarjeta para todo (si pagas el total)

Cada quetzal que pagas en efectivo es una milla perdida. Pasa por la tarjeta:
- Supermercado
- Gasolina
- Servicios (internet, teléfono, electricidad)
- Seguros
- Suscripciones

**Importante:** Esto SOLO tiene sentido si pagas el total cada mes. Si pagas intereses, las millas no valen nada comparado con lo que pierdes.

### Regla #2: Conoce las categorías bonus

Muchas tarjetas dan el doble o triple de millas en categorías específicas:
- Supermercados: 2x millas
- Gasolina: 2x millas
- Restaurantes: 3x millas
- Viajes: 3x millas

Revisa tu programa de lealtad para saber cuáles son tus categorías bonus.

### Regla #3: Canjea en el momento correcto

Las millas tienen diferentes valores según cómo las uses:

| Forma de canjeo | Valor por milla |
|---|---|
| Vuelos internacionales | Q 0.12 - Q 0.25 |
| Vuelos nacionales | Q 0.08 - Q 0.15 |
| Productos del catálogo | Q 0.03 - Q 0.08 |
| Efectivo/crédito | Q 0.02 - Q 0.05 |

**Conclusión:** Las millas valen **3-5 veces más** canjeadas en vuelos que en productos o efectivo.

### Regla #4: No dejes que las millas expiren

La mayoría de programas tienen millas que expiran en 12-24 meses sin actividad. Revisa:
- Fecha de expiración de tus millas actuales
- Si hay un mínimo de actividad para mantenerlas vivas
- Si puedes transferirlas a otro programa

### Regla #5: Combina tarjetas

Si tienes dos tarjetas del mismo banco, muchas veces puedes **combinar las millas** en una sola cuenta. Esto te permite llegar más rápido a un canjeo de vuelo.

### Ejemplo práctico

Gastas Q 10,000/mes pasando todo por la tarjeta:
- Millas base: 10,000 × 12 = 120,000 millas/año
- Con categorías bonus: ~150,000 millas/año
- Un vuelo Guatemala-Miami ida y vuelta: ~25,000-35,000 millas
- **Resultado: 4-5 vuelos gratis al año** solo por usar tu tarjeta en vez de efectivo

> Las millas son dinero. Tratálas como tal.
' WHERE slug = 'maximizar-millas-puntos';

UPDATE capsules SET content_md = '## El error más caro: compras en cuotas

"Sin intereses a 12 meses." Suena genial, ¿verdad? No siempre lo es.

### Cuotas "sin intereses" — la letra pequeña

En Guatemala, las cuotas "sin intereses" a menudo tienen:

1. **Precio inflado:** El precio en cuotas es mayor que el precio de contado. La tienda ya incluyó los intereses en el precio.
2. **Comisión por cuotas:** Tu banco puede cobrarte 2-5% extra por dividir en cuotas.
3. **Seguro de desgravamen:** Un seguro obligatorio que se suma a cada cuota.

### Ejemplo real

Quieres comprar una computadora:
- **Precio de contado:** Q 8,500
- **Precio en 12 cuotas "sin intereses":** Q 9,200 (Q 767/mes)
- **Costo real de las cuotas:** Q 700 extra = 8.2% de interés disfrazado

### Cuándo SÍ convienen las cuotas

Las cuotas tienen sentido cuando:
- El precio en cuotas es **exactamente igual** al precio de contado
- No te cobran comisión bancaria por dividir
- Tienes el dinero pero prefieres mantener liquidez
- Es un gasto necesario que no puedes pagar de contado

### Cuándo NO convienen

- Cuando el precio en cuotas es mayor que el de contado
- Cuando tu banco cobra comisión por cuotas
- Cuando es un gasto impulsivo que no necesitas
- Cuando ya tienes saldo pendiente en la tarjeta

### La pregunta clave

Antes de aceptar cuotas, pregunta siempre:

> "¿Cuál es el precio de contado?"

Si el precio es diferente, haz la cuenta:
- (Precio en cuotas - Precio de contado) ÷ Precio de contado × 100 = **tasa real**

### El efecto en tu capacidad de pago

Las cuotas reducen tu capacidad futura. Si ganas Q 15,000 y ya tienes Q 4,000 en cuotas fijas:
- Capacidad disponible: Q 11,000
- Si agregas Q 2,000 más en cuotas: Q 9,000
- Si agregas Q 3,000 más: Q 6,000

Cada cuota que sumas reduce tu margen para emergencias.

> Las cuotas son deuda. Si no lo pagarías en efectivo, no lo pagues en cuotas.
' WHERE slug = 'cuotas-sin-interes';

UPDATE capsules SET content_md = '## Cómo salir de la deuda de tarjeta paso a paso

Si tienes deuda en una o varias tarjetas, acá tienes un plan concreto para salir.

### Paso 1: Deja de agregar deuda

Lo primero es **dejar de usar las tarjetas** para compras nuevas. Si sigues usando la tarjeta mientras intentas pagar, es como tratar de vaciar una piscina con una cubeta mientras la manguera sigue abierta.

- Saca las tarjetas de tu billetera
- Elimina los datos guardados en tiendas online
- Usa efectivo o débito para gastos del día a día

### Paso 2: Haz la lista de tus deudas

Anota cada tarjeta con:
- Saldo actual
- Tasa de interés anual
- Pago mínimo

Ejemplo:
| Tarjeta | Saldo | Tasa | Mínimo |
|---|---|---|---|
| Visa BAC | Q 8,500 | 42% | Q 425 |
| MC Industrial | Q 14,000 | 36% | Q 700 |
| Visa Banrural | Q 3,200 | 28% | Q 200 |

### Paso 3: Elige tu estrategia

**Avalancha (recomendada para ahorrar más):**
Paga el mínimo en todas y el extra va a la de **mayor tasa** (Visa BAC al 42%).

**Bola de nieve (recomendada para motivación):**
Paga el mínimo en todas y el extra va a la de **menor saldo** (Visa Banrural con Q 3,200).

### Paso 4: Encuentra dinero extra

Busca al menos Q 500-1,000 extra al mes:
- Cancela suscripciones que no usas
- Reduce gastos de restaurantes por un tiempo
- Vende cosas que no usas
- Busca ingreso extra temporal

### Paso 5: Negocia con el banco

Llama al banco y pide:
- **Reducción de tasa:** "Quiero negociar mi tasa de interés." A veces la bajan 5-10 puntos.
- **Plan de pagos:** Si estás muy endeudado, muchos bancos ofrecen planes con tasa reducida.
- **Congelamiento de intereses:** En casos extremos, puedes negociar que congelen los intereses mientras pagas el capital.

### Paso 6: Automatiza los pagos

Configura pagos automáticos por al menos el mínimo para nunca atrasarte (los atrasos agregan cargos y dañan tu historial).

### Línea de tiempo realista

Con Q 25,700 de deuda total y Q 2,000 de pago extra mensual (además de los mínimos):
- **Método avalancha:** Libre de deuda en ~14 meses
- **Método bola de nieve:** Libre de deuda en ~15 meses, pero la primera victoria llega en 2 meses

> No importa cuánto debas. Importa que hoy decidiste dejar de deber.
' WHERE slug = 'salir-deuda-tarjeta';

UPDATE capsules SET content_md = '## Tarjetas en Guatemala: comparativa real

Una guía práctica de las principales tarjetas disponibles en Guatemala con datos reales.

### Las tasas de interés en Guatemala

Guatemala tiene algunas de las tasas de interés en tarjetas más altas de la región:

| Rango | Tasa anual |
|---|---|
| Baja | 28% - 32% |
| Media | 33% - 42% |
| Alta | 43% - 60% |

Comparación regional: México 30-45%, Colombia 25-35%, Chile 20-30%.

### Principales emisores

#### BAC Credomatic
- **Tasas:** 36% - 48% según producto
- **Puntos:** Programa Membership Rewards
- **Ventaja:** Red amplia en Centroamérica, app robusta
- **Anualidad:** Q 400 - Q 2,000

#### Banco Industrial
- **Tasas:** 28% - 42%
- **Puntos:** Programa de puntos propio
- **Ventaja:** Tasas competitivas, presencia nacional
- **Anualidad:** Q 300 - Q 1,500

#### G&T Continental
- **Tasas:** 32% - 45%
- **Puntos:** Programa de millas
- **Ventaja:** Buenos programas de millas para viajeros
- **Anualidad:** Q 350 - Q 1,800

#### Banrural
- **Tasas:** 28% - 38%
- **Puntos:** Limitados
- **Ventaja:** Tasas más bajas, accesibilidad
- **Anualidad:** Q 200 - Q 800

#### Bantrab
- **Tasas:** 30% - 40%
- **Puntos:** Programa propio
- **Ventaja:** Opciones para trabajadores del estado
- **Anualidad:** Q 250 - Q 1,000

### ¿Qué buscar al comparar?

**Si tienes saldo pendiente:**
1. Tasa de interés (lo más bajo posible)
2. Cargos por mora
3. Posibilidad de negociar tasa

**Si pagas el total cada mes:**
1. Programa de recompensas
2. Anualidad vs beneficios
3. Seguros incluidos
4. Aceptación (Visa vs Mastercard)

### Costos ocultos a revisar

- **Avance de efectivo:** 5-10% de comisión + intereses desde el día 1 (sin período de gracia)
- **Cargo por tipo de cambio:** 2-4% en compras en dólares
- **Cargo por sobregiro:** Q 200-500
- **Reposición de tarjeta:** Q 50-150

### Consejo final

> La tasa de interés importa más que cualquier beneficio si alguna vez no pagas el total. Una tarjeta con 28% y sin millas es mejor que una con 48% y millas premium — si tienes saldo.
' WHERE slug = 'tarjetas-guatemala-comparativa';

-- ══════════════════════════════════════════════
-- CONTENIDO EDUCATIVO: Módulo 2 — Deudas y préstamos
-- ══════════════════════════════════════════════

UPDATE capsules SET content_md = '## Los 4 tipos de deuda: cuál atacar primero

No todas las deudas son iguales. Algunas te cuestan mucho más que otras, y el orden en que las pagas hace una diferencia enorme.

### Los 4 tipos, del más urgente al menos

#### 1. Deuda informal (familia/amigos)
- **Tasa:** Generalmente 0%
- **Por qué es urgente:** Aunque no cobra intereses, **daña relaciones**. El estrés emocional es real.
- **Acción:** Establece un plan de pago claro, ponlo por escrito, y cúmplelo.

#### 2. Tarjetas de crédito
- **Tasa:** 28% - 60% anual en Guatemala
- **Por qué es urgente:** Es la deuda más cara. Cada mes que pasa, crece exponencialmente.
- **Acción:** Deja de usarlas, paga más del mínimo, ataca la de mayor tasa primero.

#### 3. Préstamos de consumo
- **Tasa:** 15% - 28% anual
- **Por qué importa:** Tasas altas pero menores que tarjetas. Generalmente con cuota fija.
- **Acción:** Mantén los pagos puntuales. Si puedes, abonos extraordinarios al capital.

#### 4. Préstamo hipotecario
- **Tasa:** 8% - 14% anual
- **Por qué es la menos urgente:** Tasa baja, plazo largo, y el inmueble se valoriza.
- **Acción:** Paga puntualmente. No es urgente prepagar si tienes deudas más caras.

### La regla del orden de ataque

1. **Primero:** Pon al día cualquier deuda atrasada (los cargos por mora son brutales)
2. **Segundo:** Paga la deuda informal para proteger relaciones
3. **Tercero:** Ataca las tarjetas de crédito con la mayor tasa
4. **Cuarto:** Abonos extra a préstamos de consumo
5. **Último:** Prepagos a la hipoteca (solo si todo lo demás está en orden)

### ¿Y si tengo varias deudas del mismo tipo?

Usa el simulador de deudas en Zafi para comparar:
- **Avalancha:** La de mayor tasa primero (ahorras más en intereses)
- **Bola de nieve:** La de menor saldo primero (ganas motivación rápido)

> No intentes pagar todo al mismo tiempo. Enfoca tu energía extra en UNA deuda a la vez.
' WHERE slug = 'tipos-deuda-orden-ataque';

UPDATE capsules SET content_md = '## Préstamo personal: cuándo tiene sentido y cuándo no

Un préstamo personal puede ser tu mejor amigo o tu peor enemigo financiero. La diferencia está en **por qué lo tomas**.

### Cuándo SÍ tiene sentido

#### Consolidación de deudas
Si tienes Q 20,000 en tarjetas al 42% y un banco te ofrece un préstamo al 18% para pagarlas:
- **Antes:** Q 20,000 × 42% = Q 8,400/año en intereses
- **Después:** Q 20,000 × 18% = Q 3,600/año en intereses
- **Ahorro:** Q 4,800/año

**Pero cuidado:** Solo funciona si **no vuelves a usar las tarjetas** después de pagarlas.

#### Emergencia real
Si necesitas pagar algo urgente (médico, reparación esencial) y no tienes fondo de emergencia, un préstamo personal es mejor que la tarjeta de crédito.

#### Inversión en educación o negocio
Si el préstamo genera un retorno mayor que su costo (estudios que aumentan tu ingreso, capital para un negocio viable).

### Cuándo NO tiene sentido

- **Para vacaciones o lujos:** Si no puedes pagarlo en efectivo, no puedes pagarlo
- **Para "respirar" financieramente:** Es poner una curita en una herida que necesita sutura
- **Si ya tienes otras deudas activas:** Agregar deuda sobre deuda acelera el problema
- **Si no tienes ingreso estable:** Sin certeza de pago, es una bomba de tiempo

### Qué revisar antes de firmar

| Factor | Qué buscar |
|---|---|
| **TEA (Tasa Efectiva Anual)** | La tasa REAL incluyendo todos los costos |
| **Gastos administrativos** | Comisión de apertura (1-3% del monto) |
| **Seguro de desgravamen** | Obligatorio en la mayoría, suma a la cuota |
| **Penalización por prepago** | ¿Te cobran si pagas antes? |
| **Cuota fija vs variable** | Prefiere cuota fija para predecir mejor |

### La regla de oro

> Un préstamo solo tiene sentido si la tasa es menor que la deuda que reemplaza, o si genera un retorno mayor que su costo.
' WHERE slug = 'prestamo-personal-cuando';

UPDATE capsules SET content_md = '## Cómo leer un contrato de préstamo

Antes de firmar un préstamo, necesitas entender qué estás firmando. Acá te explico los términos clave.

### La tasa que te dicen vs la tasa que pagas

- **Tasa nominal (TN):** La que el banco te dice. Ej: "18% anual."
- **Tasa efectiva anual (TEA):** La tasa real incluyendo capitalización. Siempre es mayor que la nominal.
- **Costo total del crédito:** La TEA + gastos administrativos + seguros. Esta es la cifra real.

**Ejemplo:**
- Tasa nominal: 18%
- TEA: 19.56%
- Con gastos + seguros: 23.4%

Siempre pregunta: "¿Cuál es el **costo total** del crédito?"

### Los gastos que se suman

#### Comisión de apertura (desembolso)
- Generalmente 1-3% del monto
- Se cobra al inicio, a veces se suma al préstamo
- En Q 50,000 al 2% = Q 1,000 que pagas aunque no uses el dinero

#### Seguro de desgravamen
- Cubre la deuda si falleces o quedas incapacitado
- Se suma a cada cuota mensual
- Puede agregar Q 50-200/mes a tu cuota

#### Seguro de vida
- Algunos bancos lo requieren como condición
- Verifica si ya tienes uno antes de aceptar otro

### La tabla de amortización

Pide siempre la tabla de amortización. Te muestra mes a mes:
- Cuánto va a capital (reducir la deuda)
- Cuánto va a intereses
- El saldo restante

Al inicio, la mayor parte de tu cuota va a intereses. Con el tiempo, más va a capital.

**Mes 1 de Q 50,000 al 18%:**
- Cuota: Q 1,508
- A intereses: Q 750
- A capital: Q 758
- Saldo: Q 49,242

**Mes 24:**
- Cuota: Q 1,508
- A intereses: Q 467
- A capital: Q 1,041
- Saldo: Q 30,107

### Penalización por prepago

Algunos bancos te cobran si pagas antes del plazo. Esto puede ser:
- Un porcentaje del saldo (1-3%)
- Un número fijo de cuotas de interés (1-3 meses)

**Importante:** Verifica esto ANTES de firmar. Si piensas que puedes pagar antes, negocia que no haya penalización.

### Checklist antes de firmar

- [ ] Conozco la TEA, no solo la tasa nominal
- [ ] Sé cuánto es la comisión de apertura
- [ ] Conozco el costo del seguro de desgravamen
- [ ] Tengo la tabla de amortización completa
- [ ] Sé si hay penalización por prepago
- [ ] La cuota mensual no supera el 30% de mi ingreso
- [ ] He comparado con al menos 2 bancos más

> Nunca firmes lo que no entiendes. Si algo no está claro, pregunta hasta que lo esté.
' WHERE slug = 'leer-contrato-prestamo';

UPDATE capsules SET content_md = '## La deuda informal con familia y amigos

En Guatemala y Latinoamérica, prestar dinero entre familia es muy común. Pero es también la deuda que más relaciones destruye.

### Por qué es diferente

- No hay contrato formal
- No hay tasa de interés (generalmente)
- La presión es emocional, no legal
- El costo real es la **relación**

### Las situaciones más comunes

1. **"Préstame que el viernes te pago"** → el viernes se convierte en mes
2. **"Ayúdame con la emergencia"** → la emergencia se repite cada mes
3. **"Invierte en mi negocio"** → el negocio no funciona y el dinero se perdió

### Si tú debes: cómo manejarlo

#### 1. Reconoce la deuda
No pretendas que no existe. Habla con la persona directamente.

#### 2. Ponlo por escrito
Aunque suene formal, escribe un mensaje o correo con:
- Monto que debes
- Plan de pago (cuánto y cuándo)
- Fecha estimada de liquidación

#### 3. Cumple con el plan
Prioriza esta deuda. Es más importante que cualquier gasto no esencial.

#### 4. Si no puedes pagar todo, paga algo
Un abono pequeño pero constante demuestra compromiso. Q 200/mes es mejor que Q 0 y promesas vacías.

### Si te deben: cómo manejarlo

#### 1. Establece expectativas claras desde el inicio
Antes de prestar, define:
- Monto exacto
- Cuándo te van a pagar
- Qué pasa si no pueden pagar a tiempo

#### 2. Solo presta lo que puedes perder
Si prestarle Q 5,000 a tu hermano te va a causar problemas financieros a ti, **no lo prestes**. Ofrece menos o ayuda de otra forma.

#### 3. No prestes otra vez si no te pagaron
Suena duro, pero prestar más a alguien que no cumplió es perder dos veces.

### La fórmula para proteger la relación

> Trata la deuda informal con la misma seriedad que una deuda bancaria. La diferencia es que en el banco puedes perder tu historial crediticio — con la familia puedes perder algo más valioso.

### Alternativa: el regalo en vez del préstamo

Si tu familiar necesita ayuda y tú puedes darla, considera **regalar** una cantidad menor en vez de **prestar** una mayor. Un regalo de Q 1,000 sin expectativa de retorno es mejor que un préstamo de Q 5,000 que va a generar tensión por meses.
' WHERE slug = 'deuda-informal-familia';

UPDATE capsules SET content_md = '## Préstamo de vehículo: lo que los concesionarios no te dicen

Comprar un carro en cuotas es una de las decisiones financieras más grandes que vas a tomar. Acá está lo que necesitas saber.

### El costo real de un vehículo financiado

**Ejemplo:** Vehículo de Q 180,000, enganche del 20%, financiado a 5 años al 14%.

| Concepto | Monto |
|---|---|
| Precio del vehículo | Q 180,000 |
| Enganche (20%) | Q 36,000 |
| Monto financiado | Q 144,000 |
| Cuota mensual | Q 3,351 |
| Total pagado en 5 años | Q 201,060 |
| **Total real del vehículo** | **Q 237,060** |
| Intereses pagados | Q 57,060 |

El vehículo te costó **Q 57,060 más** que su precio — un 32% extra.

### La depreciación: el costo invisible

Un vehículo nuevo pierde valor así:
- **Año 1:** Pierde 15-20% de su valor
- **Año 3:** Vale 50-60% del precio original
- **Año 5:** Vale 35-45% del precio original

Tu vehículo de Q 180,000:
- Año 1: Vale Q 148,000 (perdiste Q 32,000)
- Año 3: Vale Q 99,000
- Año 5: Vale Q 72,000 — y todavía debes Q 0 porque justo terminaste de pagar Q 237,060 por algo que vale Q 72,000

### Lo que el concesionario no te dice

1. **La tasa "especial" incluye restricciones:** Seguro obligatorio con su aseguradora, GPS obligatorio, etc.
2. **El enganche bajo no es negocio:** Mientras menos enganche, más intereses pagas.
3. **Los accesorios financiados:** Esos Q 15,000 en accesorios se suman al préstamo y pagan intereses por 5 años.
4. **El valor de reventa de la marca importa:** Un Toyota Hilux retiene mucho más valor que otras marcas.

### Cuánto deberías gastar en vehículo

Regla general:
- **Cuota mensual:** No más del 15% de tu ingreso neto
- **Valor total:** No más de 30% de tu ingreso anual si compras de contado
- **Enganche:** Mínimo 20%, idealmente 30-40%
- **Plazo:** Máximo 4 años (5 años = demasiados intereses)

### ¿Nuevo o usado?

Un vehículo de 2-3 años ya absorbió la depreciación más fuerte. Puedes conseguir un vehículo en excelente estado por 30-40% menos que nuevo.

> El mejor negocio en vehículos es comprar uno de 2-3 años, bien cuidado, de contado o con el mayor enganche posible.
' WHERE slug = 'prestamo-vehiculo';

UPDATE capsules SET content_md = '## Préstamo de vivienda en Guatemala

Comprar casa es probablemente la compra más grande de tu vida. Acá está todo lo que necesitas saber sobre préstamos hipotecarios en Guatemala.

### Opciones de financiamiento

#### 1. Bancos comerciales
- **Tasa:** 8% - 14% anual
- **Plazo:** Hasta 20-25 años
- **Enganche:** 10-30% del valor
- **Requisitos:** Ingresos comprobables, historial crediticio, avalúo

#### 2. FHA (Instituto de Fomento de Hipotecas Aseguradas)
- **Tasa:** Generalmente menor que bancos
- **Plazo:** Hasta 25 años
- **Enganche:** Desde 5%
- **Ventaja:** Seguro hipotecario que permite menor enganche
- **Límite:** Viviendas hasta cierto valor

### Los números que importan

**Ejemplo:** Casa de Q 800,000

| Escenario | Enganche 10% | Enganche 20% | Enganche 30% |
|---|---|---|---|
| Monto financiado | Q 720,000 | Q 640,000 | Q 560,000 |
| Cuota mensual (20 años, 10%) | Q 6,948 | Q 6,176 | Q 5,404 |
| Total pagado | Q 1,667,520 | Q 1,482,240 | Q 1,296,960 |
| Intereses totales | Q 947,520 | Q 842,240 | Q 736,960 |

La diferencia entre 10% y 30% de enganche: **Q 210,560 en intereses**.

### Tasa fija vs tasa variable

- **Tasa fija:** Tu cuota no cambia en todo el plazo. Predecible.
- **Tasa variable:** Empieza más baja pero puede subir. Riesgosa.
- **Tasa mixta:** Fija los primeros 3-5 años, luego variable.

**Recomendación:** En Guatemala, donde las tasas pueden variar, prefiere **tasa fija** para tener certeza de tu cuota mensual.

### Costos adicionales que olvidamos

- **Gastos de escrituración:** 1-2% del valor
- **Honorarios del notario:** Q 3,000 - Q 10,000
- **Avalúo:** Q 1,500 - Q 5,000
- **Seguro contra incendio y terremoto:** Obligatorio, Q 1,000 - Q 3,000/año
- **Impuesto de timbres:** 0.5% del monto de la hipoteca

**Total de gastos de cierre:** 3-5% del valor de la propiedad.

### La regla del 28%

Tu cuota hipotecaria no debería superar el **28% de tu ingreso bruto mensual**.

- Ingreso de Q 20,000 → cuota máxima Q 5,600
- Ingreso de Q 30,000 → cuota máxima Q 8,400
- Ingreso de Q 50,000 → cuota máxima Q 14,000

### ¿Conviene prepagar?

Sí, especialmente en los primeros años cuando la mayor parte de tu cuota va a intereses. Un abono extra de Q 2,000/mes en un préstamo de Q 640,000 al 10%:
- Sin abono: 20 años para pagar
- Con Q 2,000 extra/mes: 12 años para pagar
- Ahorro en intereses: **Q 340,000**

> Compra la casa que necesitas, no la que el banco dice que puedes pagar. El banco siempre te aprueba más de lo prudente.
' WHERE slug = 'prestamo-vivienda-guatemala';

UPDATE capsules SET content_md = '## Refinanciamiento: cuándo conviene y cuándo no

Refinanciar significa tomar un nuevo préstamo para pagar uno existente, generalmente con mejores condiciones. Pero no siempre es buen negocio.

### Cuándo SÍ conviene refinanciar

#### 1. La tasa baja significativamente
Si tu préstamo actual es al 14% y puedes refinanciar al 10%, el ahorro puede ser grande:

- Saldo: Q 400,000, plazo restante: 15 años
- Al 14%: cuota Q 5,320, total restante Q 957,600
- Al 10%: cuota Q 4,296, total restante Q 773,280
- **Ahorro: Q 184,320**

#### 2. Consolidación de deudas caras
Si tienes Q 50,000 en tarjetas al 42% y puedes incluirlo en tu hipoteca al 10%, los números funcionan — pero **solo si dejas de usar las tarjetas**.

#### 3. Cambio de tasa variable a fija
Si tu tasa variable subió o temes que suba, fijarla te da tranquilidad.

### Cuándo NO conviene

#### 1. Los costos de cierre se comen el ahorro
Refinanciar tiene costos:
- Gastos de escrituración: 1-2%
- Honorarios del notario
- Penalización por prepago del préstamo actual
- Avalúo nuevo

**Regla rápida:** Si no recuperas los costos de cierre en menos de 3 años de ahorro mensual, no conviene.

#### 2. Extiendes mucho el plazo
Si te faltan 10 años y refinancias a 20, tu cuota baja pero pagas mucho más en intereses totales.

#### 3. Ya estás avanzado en el préstamo
Si ya pagaste 15 de 20 años, la mayoría de tu cuota ya va a capital. Refinanciar te reinicia el reloj de intereses.

### Cómo calcular si conviene

1. **Ahorro mensual** = Cuota actual - Cuota nueva
2. **Costos totales de refinanciamiento** = Todos los gastos de cierre + penalizaciones
3. **Punto de equilibrio** = Costos ÷ Ahorro mensual = meses para recuperar

**Ejemplo:**
- Ahorro mensual: Q 1,024
- Costos de cierre: Q 15,000
- Punto de equilibrio: 15,000 ÷ 1,024 = **14.6 meses**

Si piensas quedarte en la casa más de 15 meses, conviene.

### Checklist para refinanciar

- [ ] La nueva tasa es al menos 2 puntos menor
- [ ] Los costos de cierre se recuperan en menos de 3 años
- [ ] No estoy extendiendo el plazo significativamente
- [ ] No hay penalización excesiva por prepago
- [ ] Mi situación crediticia permite acceder a buena tasa

> Refinanciar es una decisión matemática, no emocional. Haz los números antes de decidir.
' WHERE slug = 'refinanciamiento-cuando-conviene';

-- ══════════════════════════════════════════════
-- CONTENIDO EDUCATIVO: Módulo 3 — Presupuesto y ahorro
-- ══════════════════════════════════════════════

UPDATE capsules SET content_md = '## El método 50/30/20 para Guatemala

El 50/30/20 es la forma más simple de organizar tu dinero. Divides tu ingreso en tres baldes.

### Los 3 baldes

#### 50% — Necesidades
Lo que TIENES que pagar sí o sí:
- Vivienda (alquiler o cuota de casa)
- Alimentación (supermercado, no restaurantes)
- Transporte (gasolina, bus, parqueo)
- Servicios (agua, luz, internet, teléfono)
- Salud (medicinas, seguro médico)
- Educación (colegiaturas, útiles)

#### 30% — Gustos
Lo que quieres pero no necesitas para sobrevivir:
- Restaurantes y salidas
- Entretenimiento (cine, streaming)
- Ropa (más allá de lo básico)
- Suscripciones
- Hobbies

#### 20% — Ahorro y deudas
Tu futuro financiero:
- Fondo de emergencia
- Ahorro para metas
- Pago extra de deudas (más allá del mínimo)
- Inversiones

### Ejemplos reales en Guatemala

#### Ingreso Q 8,000/mes
| Balde | % | Monto |
|---|---|---|
| Necesidades | 50% | Q 4,000 |
| Gustos | 30% | Q 2,400 |
| Ahorro/Deudas | 20% | Q 1,600 |

#### Ingreso Q 15,000/mes
| Balde | % | Monto |
|---|---|---|
| Necesidades | 50% | Q 7,500 |
| Gustos | 30% | Q 4,500 |
| Ahorro/Deudas | 20% | Q 3,000 |

#### Ingreso Q 35,000/mes
| Balde | % | Monto |
|---|---|---|
| Necesidades | 50% | Q 17,500 |
| Gustos | 30% | Q 10,500 |
| Ahorro/Deudas | 20% | Q 7,000 |

### Qué hacer si tus necesidades superan el 50%

En Guatemala, es común que las necesidades consuman más del 50%, especialmente si tienes hijos en colegio privado. En ese caso:

1. **Ajusta los porcentajes:** 60/20/20 o 55/25/20
2. **Nunca bajes del 10% en ahorro** — es el mínimo para avanzar
3. **Revisa si alguna "necesidad" es realmente un gusto** (¿el plan de celular más caro es necesidad?)

### Cómo empezar

1. Abre la sección de Presupuesto en Zafi
2. Ingresa tu ingreso mensual
3. Distribuye tus categorías en los 3 baldes
4. Cada semana, revisa cuánto llevas gastado vs presupuestado

> El 50/30/20 no es una regla rígida. Es un punto de partida. Adáptalo a tu realidad, pero siempre ahorra algo.' WHERE slug = 'metodo-50-30-20-guatemala';

UPDATE capsules SET content_md = '## El fondo de emergencia: cuánto, dónde y cómo armarlo

El fondo de emergencia es la base de tu salud financiera. Sin él, cualquier imprevisto te puede endeudar.

### ¿Cuánto necesitas?

La regla es **3-6 meses de gastos fijos**, no de ingresos.

Si tus gastos fijos mensuales son:
- Vivienda: Q 4,000
- Alimentación: Q 3,000
- Servicios: Q 1,500
- Transporte: Q 1,000
- Salud: Q 500
- **Total: Q 10,000/mes**

Tu fondo de emergencia debería ser:
- **Mínimo (3 meses):** Q 30,000
- **Ideal (6 meses):** Q 60,000

### ¿Por qué gastos fijos y no ingresos?

Porque en una emergencia (pérdida de empleo, enfermedad), vas a recortar gustos. Lo que necesitas cubrir son los gastos que no puedes eliminar.

### ¿Dónde guardarlo?

El fondo de emergencia necesita 3 cosas:
1. **Liquidez:** Poder sacarlo en 24-48 horas
2. **Seguridad:** No puede perder valor
3. **Separación:** No mezclarlo con tu cuenta del día a día

**Mejores opciones en Guatemala:**
| Opción | Liquidez | Rendimiento |
|---|---|---|
| Cuenta de ahorro separada | Inmediata | 1-3% |
| Depósito a plazo 30 días | 30 días | 3-5% |
| Combinación 50/50 | Mixta | 2-4% |

**Lo que NO es fondo de emergencia:**
- Dinero en tu cuenta corriente (lo vas a gastar)
- Inversiones en acciones (pueden bajar de valor)
- Dinero prestado a familiares (no es líquido)

### Cómo armarlo desde cero

Si Q 30,000 suena imposible, empieza pequeño:

**Fase 1 — Semana de emergencia (Q 2,500)**
- Ahorra Q 250/semana durante 10 semanas
- Esto cubre una emergencia menor (reparación, medicamento)

**Fase 2 — Mes de emergencia (Q 10,000)**
- Ahorra Q 500/mes durante 15 meses
- Esto cubre un mes sin ingreso

**Fase 3 — Fondo completo (Q 30,000)**
- Ahorra Q 1,000/mes durante 20 meses más
- Esto te da tranquilidad real

### ¿Cuándo usarlo?

SOLO para emergencias reales:
- Pérdida de empleo
- Emergencia médica
- Reparación urgente del hogar o vehículo

NO es para:
- Vacaciones
- Ofertas "imperdibles"
- Regalos de navidad (eso es predecible, no emergencia)

> El fondo de emergencia no es para hacerte rico. Es para que un imprevisto no te haga pobre.' WHERE slug = 'fondo-emergencia-cuanto-donde';

UPDATE capsules SET content_md = '## Ahorro automático: el truco que realmente funciona

Si intentas ahorrar "lo que sobra al final del mes", ya sabes el resultado: nunca sobra nada. El ahorro automático cambia la ecuación.

### El problema con ahorrar lo que sobra

Tu cerebro está diseñado para gastar lo que tiene disponible. Si ves Q 15,000 en tu cuenta, tu mente dice "tengo Q 15,000 para gastar." No importa cuánta disciplina tengas.

### La solución: pagarte primero

El día que te pagan:
1. **Automáticamente** se transfiere tu ahorro a una cuenta separada
2. Lo que queda es lo que tienes para gastar
3. Tu cerebro se adapta al monto disponible

### Cómo configurarlo

#### Opción 1: Transferencia automática
La mayoría de bancos en Guatemala permiten configurar transferencias automáticas. Programa una transferencia el día de tu cobro:
- De tu cuenta principal → a tu cuenta de ahorro
- Monto: 10-20% de tu ingreso
- Frecuencia: quincenal o mensual

#### Opción 2: Cuenta de planilla separada
Pide a tu empleador que deposite un porcentaje directo en una segunda cuenta. Así ni siquiera ves el dinero.

#### Opción 3: Método del sobre
Si no tienes cuenta separada, el día de cobro saca el monto de ahorro en efectivo y guárdalo en un lugar aparte. No lo toques.

### Cuánto ahorrar

| Tu situación | % mínimo | Meta |
|---|---|---|
| Sin fondo de emergencia | 10% | Armar fondo primero |
| Con deudas caras | 10% | 5% ahorro + 5% extra a deuda |
| Sin deudas, con fondo | 15-20% | Metas + inversión |
| Ingreso alto, sin deudas | 20-30% | Acumulación acelerada |

### El efecto compuesto

Si ahorras Q 1,500/mes desde hoy:
- En 1 año: Q 18,000
- En 3 años: Q 54,000
- En 5 años: Q 90,000 (sin contar intereses)
- En 10 años: Q 180,000+

### Tips para que funcione

1. **Hazlo el día 1.** No esperes a "estar listo."
2. **Empieza con poco.** Q 500/mes es mejor que Q 0.
3. **Aumenta gradualmente.** Cada aumento de sueldo, sube el ahorro.
4. **No toques la cuenta de ahorro.** Elimina la tarjeta de débito de esa cuenta.
5. **Celebra los hitos.** Cuando llegues a Q 10,000, Q 25,000, Q 50,000, reconoce tu logro.

> Lo que no ves, no lo gastas. Automatiza tu ahorro y tu cerebro se adapta solo.' WHERE slug = 'ahorro-automatico';

UPDATE capsules SET content_md = '## El aguinaldo: cómo no desperdiciarlo

En Guatemala, el aguinaldo (Bono 14 en julio y Aguinaldo en diciembre) representa un ingreso extra significativo. La mayoría lo gasta en menos de 2 semanas. Acá te damos un plan para que este año sea diferente.

### El error más común

Recibes el aguinaldo y:
1. Pagas cosas atrasadas
2. Te das un "gustito" grande
3. El resto se esfuma en gastos del día a día
4. En 2 semanas, no queda nada

### El plan del aguinaldo inteligente

Distribuye tu aguinaldo ANTES de recibirlo, usando esta fórmula:

#### 40% — Deudas o fondo de emergencia
- Si tienes deudas caras: todo acá (especialmente tarjetas)
- Si no tienes deudas: al fondo de emergencia
- Si ya tienes fondo completo: a inversión o ahorro para metas

#### 30% — Gastos predecibles del año
Estos gastos **los sabes de antemano**:
- Inscripciones escolares (enero)
- Útiles escolares
- Mantenimiento del vehículo
- Seguros anuales
- Impuestos

Separar este 30% te evita endeudarte para estos gastos.

#### 20% — Disfrute consciente
Sí, puedes disfrutar una parte. Pero con un monto definido:
- Una salida especial
- Un regalo para ti
- Una experiencia con la familia

#### 10% — Ahorro a largo plazo
Aunque sea poco, manda este 10% a una cuenta que no toques:
- Inversión
- Ahorro para una meta grande
- Retiro

### Ejemplo práctico

**Aguinaldo de Q 12,000:**

| Destino | % | Monto |
|---|---|---|
| Pago extra tarjeta de crédito | 40% | Q 4,800 |
| Fondo para inscripción enero | 30% | Q 3,600 |
| Cena familiar + regalo | 20% | Q 2,400 |
| Cuenta de inversión | 10% | Q 1,200 |

### El truco: divídelo ANTES de recibirlo

El día que te depositan el aguinaldo, inmediatamente:
1. Transfiere el 40% al pago de deuda
2. Transfiere el 30% a una cuenta separada para gastos planificados
3. Transfiere el 10% a ahorro/inversión
4. Lo que queda (20%) es tu dinero para disfrutar

### Impacto en tu puntaje Zafi

Un aguinaldo bien usado puede subir tu puntaje Zafi entre 5-15 puntos porque:
- Reduce tu ratio de deuda (debtBurden)
- Aumenta tu tasa de ahorro (savingsRate)
- Fortalece tu fondo de emergencia (emergencyFund)

> El aguinaldo es la oportunidad más grande del año para cambiar tu situación financiera. No la desperdicies.' WHERE slug = 'aguinaldo-como-no-desperdiciarlo';

UPDATE capsules SET content_md = '## Metas financieras que realmente se cumplen

"Quiero ahorrar más" no es una meta. "Quiero ahorrar Q 30,000 para el enganche de un carro antes de diciembre 2027" sí lo es.

### El método SMART para metas financieras

#### S — Específica
❌ "Quiero ahorrar"
✅ "Quiero ahorrar Q 30,000 para el enganche de un vehículo"

#### M — Medible
❌ "Quiero ahorrar bastante"
✅ "Q 30,000 — puedo medir mi progreso cada mes"

#### A — Alcanzable
❌ "Quiero ahorrar Q 200,000 este año" (con ingreso de Q 15,000)
✅ "Q 30,000 en 18 meses = Q 1,667/mes" (11% de mi ingreso — alcanzable)

#### R — Relevante
❌ "Quiero ahorrar porque debería"
✅ "Necesito vehículo propio para llegar al trabajo sin depender del transporte público"

#### T — Temporal
❌ "Algún día voy a ahorrar para un carro"
✅ "Para junio 2027 tengo los Q 30,000"

### Cómo definir tu meta en 5 minutos

1. **¿Qué quieres?** → Un vehículo
2. **¿Cuánto cuesta?** → Q 150,000 (enganche 20% = Q 30,000)
3. **¿Para cuándo?** → Junio 2027 (18 meses)
4. **¿Cuánto al mes?** → Q 30,000 ÷ 18 = Q 1,667/mes
5. **¿Puedes?** → Mi ingreso es Q 15,000, es el 11%. Sí puedo.

### Las 3 metas que todos deberían tener

#### Meta 1: Fondo de emergencia (corto plazo)
- **Cuánto:** 3-6 meses de gastos
- **Cuándo:** En los próximos 12-18 meses
- **Prioridad:** La más alta si no lo tienes

#### Meta 2: Una meta personal (mediano plazo)
- Enganche de casa o carro
- Viaje importante
- Educación
- **Cuándo:** 1-5 años

#### Meta 3: Retiro (largo plazo)
- **Cuánto:** Lo que puedas, desde ya
- **Cuándo:** Empieza hoy aunque sea con Q 500/mes
- **Prioridad:** Baja al inicio, pero nunca la ignores

### Trucos para cumplir tus metas

1. **Visualiza:** Pon una foto de tu meta donde la veas todos los días
2. **Automatiza:** Transferencia automática el día de cobro
3. **Divide en sub-metas:** Q 30,000 suena grande. Q 1,667 al mes suena posible. Q 417 a la semana suena fácil.
4. **Celebra hitos:** Cada Q 5,000, haz algo especial (que no cueste Q 5,000)
5. **No te castigues:** Si un mes no llegas, no abandones. Retoma al siguiente.

> Una meta sin fecha es solo un deseo. Una meta sin plan es solo un sueño. Define ambos y hazlo realidad.' WHERE slug = 'metas-financieras-smart';

-- ══════════════════════════════════════════════
-- CONTENIDO EDUCATIVO: Módulo 4 — Inversiones
-- ══════════════════════════════════════════════

UPDATE capsules SET content_md = '## Por qué el dinero guardado pierde valor

Si tienes Q 50,000 guardados en tu casa o en una cuenta sin intereses, cada año valen menos. Esto se llama **inflación**.

### ¿Qué es la inflación?

Es el aumento general de precios. Si la inflación es del 5% anual:
- Lo que hoy compras con Q 100, el próximo año cuesta Q 105
- Tus Q 50,000 guardados compran un 5% menos cada año

### Inflación real en Guatemala

| Año | Inflación | Q 50,000 compran como si fueran... |
|---|---|---|
| Hoy | — | Q 50,000 |
| En 1 año | ~5% | Q 47,500 |
| En 3 años | ~5%/año | Q 43,188 |
| En 5 años | ~5%/año | Q 39,176 |
| En 10 años | ~5%/año | Q 30,696 |

En 10 años, tus Q 50,000 compran lo que hoy comprarían Q 30,696. Perdiste **Q 19,304 en poder de compra** sin gastar un centavo.

### El costo de no hacer nada

Si tienes dinero guardado sin generar rendimiento, estás **perdiendo dinero** cada día. No es que tengas la misma cantidad — tienes menos valor real.

### ¿Qué hacer?

Como mínimo, tu dinero necesita generar un rendimiento **igual o mayor** que la inflación para mantener su valor:

| Opción | Rendimiento anual | ¿Cubre inflación? |
|---|---|---|
| Debajo del colchón | 0% | ❌ |
| Cuenta de ahorro | 1-3% | ❌ Parcialmente |
| Depósito a plazo | 3-6% | ✅ Apenas |
| Fondo de inversión | 5-10% | ✅ |
| Acciones | 8-15% (variable) | ✅ Con riesgo |

### El orden correcto

1. **Primero:** Fondo de emergencia en cuenta líquida (acepta que pierde un poco de valor — la liquidez vale más)
2. **Segundo:** Dinero para metas de 1-3 años en depósitos a plazo
3. **Tercero:** Dinero para metas de 5+ años en inversiones

> El dinero que no trabaja para ti, trabaja en tu contra. La inflación es un impuesto invisible que pagas todos los días.' WHERE slug = 'inflacion-dinero-colchon';

UPDATE capsules SET content_md = '## Certificados de depósito (CDs) en Guatemala

Los CDs son la forma más segura de hacer crecer tu dinero más allá de una cuenta de ahorro normal.

### ¿Qué es un CD?

Le prestas dinero al banco por un tiempo fijo. A cambio, te paga una tasa de interés mayor que una cuenta de ahorro.

- **Plazo:** 30 días a 5 años
- **Monto mínimo:** Q 1,000 - Q 25,000 (varía por banco)
- **Tasa:** 3% - 7% anual (dependiendo del plazo y monto)
- **Riesgo:** Muy bajo (protegido por el banco)

### Tasas aproximadas en Guatemala

| Plazo | Tasa aproximada |
|---|---|
| 30 días | 2.5% - 3.5% |
| 90 días | 3.0% - 4.5% |
| 180 días | 3.5% - 5.0% |
| 1 año | 4.0% - 6.0% |
| 2+ años | 4.5% - 7.0% |

**Nota:** Las tasas varían por banco y monto. Montos mayores generalmente obtienen mejores tasas.

### ¿Cuánto generas?

**Ejemplo:** Q 50,000 en un CD a 1 año al 5.5%:
- Intereses ganados: Q 2,750
- Al final del año tienes: Q 52,750

**Ejemplo:** Q 100,000 en un CD a 2 años al 6.5%:
- Intereses año 1: Q 6,500
- Intereses año 2: Q 6,923 (si se capitalizan)
- Al final tienes: Q 113,423

### Ventajas

- **Seguridad:** Tu capital no está en riesgo
- **Predecible:** Sabes exactamente cuánto vas a ganar
- **Simple:** No necesitas conocimientos de inversión
- **Disciplina:** No puedes gastarlo impulsivamente

### Desventajas

- **Liquidez limitada:** Si lo sacas antes del plazo, pierdes parte de los intereses
- **Rendimiento modesto:** Apenas cubre la inflación
- **ISR:** Los intereses pagan 10% de impuesto (el banco lo retiene automáticamente)

### La estrategia de escalera

En vez de poner todo en un solo CD, divide tu dinero:
- Q 15,000 a 3 meses
- Q 15,000 a 6 meses
- Q 15,000 a 12 meses

Cada vez que uno vence, renuévalo al plazo más largo. Así siempre tienes liquidez parcial y la mejor tasa.

### ¿Para quién es ideal?

- Fondo de emergencia (porción que no necesitas inmediatamente)
- Ahorro para metas de 6-24 meses
- Personas que quieren cero riesgo
- Primer paso antes de invertir en opciones más agresivas

> Los CDs no te van a hacer rico, pero son el primer paso para que tu dinero trabaje en vez de perder valor.' WHERE slug = 'certificados-deposito-guatemala';

UPDATE capsules SET content_md = '## Cuentas de ahorro: cuál paga más en Guatemala

No todas las cuentas de ahorro son iguales. La diferencia de tasa puede significar Q 500+ al año.

### Comparativa de tasas en Guatemala

| Banco | Tasa ahorro (aprox) | Monto mínimo | Notas |
|---|---|---|---|
| Banco Industrial | 1.5% - 2.5% | Q 500 | Mayor red de agencias |
| BAC Credomatic | 1.0% - 2.0% | Q 1,000 | Buena banca en línea |
| G&T Continental | 1.5% - 3.0% | Q 500 | Tasas competitivas |
| Banrural | 2.0% - 3.5% | Q 200 | Accesible, buenas tasas |
| Bantrab | 2.0% - 3.0% | Q 500 | Para empleados del estado |

**Nota:** Las tasas son aproximadas y cambian. Consulta directamente con cada banco.

### La diferencia importa

**Q 50,000 en ahorro durante 1 año:**
- Al 1.0%: Ganas Q 500
- Al 2.5%: Ganas Q 1,250
- Al 3.5%: Ganas Q 1,750

Diferencia entre la peor y la mejor: **Q 1,250 al año** — solo por elegir mejor banco.

### Tipos de cuentas de ahorro

#### Cuenta de ahorro normal
- Depósitos y retiros ilimitados
- Tasa baja (1-2.5%)
- Máxima liquidez

#### Cuenta de ahorro programado
- Te comprometes a depositar un monto fijo mensual
- Tasa un poco mayor (2-4%)
- Penalización si no cumples el depósito

#### Cuenta monetaria
- Similar a ahorro pero con chequera
- Tasa muy baja (0.5-1.5%)
- Útil para negocios, no para ahorro

### ¿Qué buscar?

1. **Tasa real:** Después del 10% de ISR que retienen sobre intereses
2. **Sin cargos ocultos:** Mantenimiento, inactividad, saldo mínimo
3. **Banca en línea:** Poder mover dinero fácilmente
4. **Cobertura:** Que el banco esté respaldado por la SIB

### El hack: cuenta de ahorro en dólares

Si quieres protegerte de la devaluación del quetzal, algunos bancos ofrecen cuentas en USD:
- Tasa menor (0.5-1.5% en USD)
- Pero si el quetzal se devalúa, tus dólares valen más en quetzales

### Recomendación

- **Fondo de emergencia:** En cuenta de ahorro normal con máxima liquidez
- **Ahorro para metas:** En cuenta de ahorro programado o CD
- **Dinero del día a día:** En cuenta monetaria o corriente

> La cuenta de ahorro es el punto de partida, no el destino final. Úsala para tu fondo de emergencia, pero busca mejores rendimientos para el dinero que no necesitas pronto.' WHERE slug = 'cuentas-ahorro-tasas';

UPDATE capsules SET content_md = '## Fondos de inversión desde Q 500

Los fondos de inversión te permiten acceder a inversiones diversificadas sin necesitar grandes cantidades de dinero.

### ¿Qué es un fondo de inversión?

Imagina que 100 personas ponen Q 5,000 cada una en una "piscina" de Q 500,000. Un administrador profesional invierte ese dinero en diferentes instrumentos. Las ganancias se reparten proporcionalmente.

### Ventajas

- **Diversificación:** Tu dinero se invierte en muchos instrumentos, no solo uno
- **Gestión profesional:** Un experto toma las decisiones de inversión
- **Accesibilidad:** Puedes empezar desde Q 500 en algunos fondos
- **Liquidez:** La mayoría permite retirar en 48-72 horas

### Tipos de fondos en Guatemala

#### Fondos de renta fija
- Invierten en bonos y depósitos
- Rendimiento: 4-7% anual
- Riesgo: Bajo
- Ideal para: Conservadores, metas de 1-3 años

#### Fondos mixtos
- Combinan renta fija con algo de acciones
- Rendimiento: 6-10% anual
- Riesgo: Medio
- Ideal para: Moderados, metas de 3-5 años

#### Fondos de renta variable
- Invierten principalmente en acciones
- Rendimiento: 8-15% anual (pero puede ser negativo)
- Riesgo: Alto
- Ideal para: Agresivos, metas de 5+ años

### Dónde encontrarlos en Guatemala

- **Casas de bolsa:** Renta de Valores, G&T Valores, BAC Valores
- **Bancos:** Varios ofrecen fondos a través de sus divisiones de inversión
- **Monto mínimo:** Desde Q 500 - Q 10,000 según el fondo

### Costos que debes conocer

| Costo | Rango | Qué es |
|---|---|---|
| Comisión de administración | 1-3% anual | Lo que cobra el administrador |
| Comisión de entrada | 0-2% | Al invertir (algunos no cobran) |
| Comisión de salida | 0-1% | Al retirar (algunos no cobran) |
| ISR | 10% sobre ganancias | Impuesto, lo retiene el fondo |

### Ejemplo práctico

Inviertes Q 2,000/mes en un fondo mixto al 8% anual:

| Año | Total invertido | Valor del fondo |
|---|---|---|
| 1 | Q 24,000 | Q 25,056 |
| 3 | Q 72,000 | Q 81,274 |
| 5 | Q 120,000 | Q 147,167 |
| 10 | Q 240,000 | Q 366,102 |

En 10 años, tus Q 240,000 invertidos valen **Q 366,102** — ganaste Q 126,102 extra por poner tu dinero a trabajar.

### Antes de invertir: checklist

- [ ] Tengo fondo de emergencia completo
- [ ] No tengo deudas caras (tarjetas)
- [ ] Entiendo que puedo perder dinero en el corto plazo
- [ ] No voy a necesitar este dinero en al menos 3 años
- [ ] Conozco las comisiones del fondo

> Los fondos de inversión son la forma más fácil de diversificar sin ser experto. Empieza pequeño, pero empieza.' WHERE slug = 'fondos-inversion-guatemala';

UPDATE capsules SET content_md = '## Acciones de empresas: primeros pasos desde Guatemala

Invertir en acciones significa comprar una pequeña parte de una empresa. Si la empresa crece, tu inversión crece.

### ¿Cómo comprar acciones desde Guatemala?

#### Opción 1: Bolsa de Valores Nacional (BVN)
- Acciones de empresas guatemaltecas
- A través de casas de bolsa autorizadas
- Volumen limitado, pocas empresas listadas

#### Opción 2: Plataformas internacionales
- Acceso a miles de empresas globales (Apple, Amazon, Google, etc.)
- Plataformas como Interactive Brokers, Charles Schwab
- Necesitas cuenta en dólares
- Mínimos desde USD $1 con acciones fraccionarias

### Antes de comprar tu primera acción

#### Requisito 1: Fondo de emergencia completo ✅
Sin fondo de emergencia, una caída del mercado te puede forzar a vender con pérdida.

#### Requisito 2: Sin deudas caras ✅
Si tienes tarjeta al 42%, no tiene sentido invertir para ganar 10%. Paga la deuda primero.

#### Requisito 3: Horizonte de tiempo largo ✅
Las acciones suben y bajan en el corto plazo. Necesitas al menos 5 años para que el mercado trabaje a tu favor.

### Conceptos básicos

**Diversificación:** No pongas todo en una sola empresa. Si Apple cae 30%, pierdes 30%. Si tienes 20 empresas y una cae 30%, pierdes 1.5%.

**ETFs:** La forma más fácil de diversificar. Un ETF como el S&P 500 (VOO o SPY) te da exposición a las 500 empresas más grandes de EE.UU. en una sola compra.

**Dollar Cost Averaging (DCA):** Invierte la misma cantidad cada mes, sin importar el precio. Algunos meses compras caro, otros barato. En promedio, te va bien.

### Tu primera inversión: paso a paso

1. **Abre una cuenta** en Interactive Brokers o similar
2. **Financia** con transferencia internacional (Q → USD)
3. **Compra un ETF diversificado:** VOO (S&P 500) o VT (acciones globales)
4. **Invierte mensualmente:** Mismo monto, cada mes
5. **No vendas por pánico:** Las caídas son normales y temporales

### Rendimientos históricos

| Inversión | Rendimiento promedio anual (últimos 20 años) |
|---|---|
| S&P 500 (acciones EE.UU.) | ~10% |
| MSCI World (acciones globales) | ~8% |
| Bonos gobierno EE.UU. | ~3% |
| Inflación Guatemala | ~4-5% |

### Errores comunes

- **Invertir lo que necesitas pronto:** Las acciones son para dinero que no vas a necesitar en 5+ años
- **Vender cuando baja:** Las caídas son temporales. Los que venden con pérdida son los que pierden de verdad.
- **Concentrar en una sola acción:** La diversificación es tu mejor protección
- **Seguir "tips" de inversión:** Nadie sabe qué acción va a subir mañana

> Invertir en acciones es simple (no fácil). Compra un ETF diversificado, invierte mensualmente, y no toques el dinero por años. El tiempo hace el trabajo pesado.' WHERE slug = 'acciones-primer-paso';

UPDATE capsules SET content_md = '## Diversificación: no pongas todos los huevos en una canasta

La diversificación es el único "almuerzo gratis" en las inversiones. Reduce tu riesgo sin necesariamente reducir tu rendimiento.

### ¿Qué es diversificar?

Es repartir tu dinero en diferentes tipos de inversiones para que si una baja, las otras compensen.

### Ejemplo simple

**Sin diversificar:** Todo en acciones de una sola empresa
- Si la empresa sube 20%: ganas 20% ✅
- Si la empresa quiebra: pierdes todo ❌

**Diversificado:** Repartido en 20 empresas, bonos y bienes raíces
- Si una empresa quiebra: pierdes ~5% de esa porción
- Las demás inversiones compensan
- Resultado probable: ganancia moderada y estable ✅

### Los niveles de diversificación

#### Nivel 1: Dentro de acciones
No comprar solo una empresa. Comprar un ETF con cientos de empresas.

#### Nivel 2: Entre tipos de inversión
Combinar acciones + bonos + bienes raíces + efectivo.

#### Nivel 3: Entre países
No solo invertir en Guatemala o EE.UU. Incluir mercados internacionales.

### El portafolio básico según tu perfil

#### Conservador (puntaje Zafi < 50 o meta en < 3 años)
- 70% Renta fija (CDs, bonos)
- 20% Fondos mixtos
- 10% Efectivo/ahorro

#### Moderado (puntaje Zafi 50-70, meta en 3-7 años)
- 40% Renta fija
- 40% Acciones (ETFs diversificados)
- 10% Bienes raíces (fondos)
- 10% Efectivo

#### Agresivo (puntaje Zafi > 70, meta en 7+ años)
- 20% Renta fija
- 60% Acciones globales (ETFs)
- 10% Acciones mercados emergentes
- 10% Bienes raíces/alternativos

### La regla de la edad

Una regla simple: **resta tu edad de 110** para saber qué porcentaje poner en acciones.

- Tienes 30 años: 110 - 30 = 80% en acciones
- Tienes 45 años: 110 - 45 = 65% en acciones
- Tienes 55 años: 110 - 55 = 55% en acciones

### Rebalanceo: mantén tu mezcla

Si tu meta es 60% acciones y 40% bonos, y las acciones suben mucho:
- Ahora tienes 75% acciones y 25% bonos
- Vende parte de las acciones y compra bonos para volver al 60/40
- Haz esto 1-2 veces al año

> Diversificar no significa que nunca vas a perder dinero. Significa que nunca vas a perder TODO tu dinero.' WHERE slug = 'diversificacion-basica';

UPDATE capsules SET content_md = '## Cuándo empezar a invertir según tu puntaje Zafi

Tu puntaje Zafi te dice exactamente en qué enfocarte financieramente. No tiene sentido invertir si tu base no está sólida.

### El semáforo financiero

#### 🔴 Puntaje 0-39: ALTO — Enfócate en sobrevivir
**No es momento de invertir.** Tu prioridad es:
1. Armar un mini fondo de emergencia (1 mes de gastos)
2. Dejar de acumular deuda nueva
3. Negociar tasas con el banco
4. Buscar ingreso extra

**Única "inversión":** Pagar deudas caras. Pagar una tarjeta al 42% es como ganar 42% garantizado.

#### 🟡 Puntaje 40-64: PRECAUCIÓN — Estabilízate primero
**Todavía no.** Pero estás cerca. Tu prioridad:
1. Completar fondo de emergencia (3 meses)
2. Eliminar deudas de tarjeta
3. Establecer presupuesto 50/30/20
4. Ahorrar al menos 10% del ingreso

**Única "inversión":** CDs o cuenta de ahorro con buena tasa para tu fondo de emergencia.

#### 🟢 Puntaje 65-84: ADELANTE — Empieza a invertir
**¡Es tu momento!** Tu base está sólida:
1. Tienes fondo de emergencia ✅
2. Deudas caras eliminadas ✅
3. Presupuesto bajo control ✅

**Empieza con:**
- Fondos de inversión de renta fija o mixtos
- Q 500-2,000/mes
- CDs a plazo para metas de 1-3 años

#### 💚 Puntaje 85-100: ACELERA — Crece tu patrimonio
**Todo el impulso.** Tu situación es sólida:
1. Diversifica entre CDs, fondos y ETFs
2. Considera inversión en bienes raíces
3. Maximiza tu ahorro (20-30% del ingreso)
4. Piensa en planificación de retiro

### El error más caro

**Invertir antes de estar listo:**
- Si inviertes Q 5,000 en acciones pero tienes Q 20,000 en tarjeta al 42%
- La tarjeta te cuesta Q 8,400/año en intereses
- Las acciones te generan Q 500-750/año
- **Resultado neto: pierdes Q 7,650/año**

**La secuencia correcta:**
1. Fondo de emergencia → 2. Eliminar deudas caras → 3. Invertir

### Cuánto invertir según tu puntaje

| Puntaje | % del ingreso para invertir |
|---|---|
| 0-39 | 0% (todo a deudas) |
| 40-64 | 5% (después de fondo de emergencia) |
| 65-84 | 10-15% |
| 85-100 | 15-30% |

> Invertir con deudas caras activas es como llenar un balde con huecos. Primero tapa los huecos, después llena el balde.' WHERE slug = 'cuando-empezar-invertir';

-- ══════════════════════════════════════════════
-- CONTENIDO EDUCATIVO: Módulo 5 — Finanzas familiares
-- ══════════════════════════════════════════════

UPDATE capsules SET content_md = '## Cómo hablar de dinero en pareja sin pelear

El dinero es la causa #1 de conflictos en pareja. No porque el dinero sea el problema — sino porque las **expectativas** son diferentes.

### Por qué peleamos por dinero

No es por los números. Es porque:
- Uno creció en escasez y el otro en abundancia
- Uno es ahorrador natural y el otro gastador
- Las prioridades son diferentes (viajes vs seguridad)
- No hay acuerdos claros sobre quién decide qué

### La reunión mensual de finanzas

El método más efectivo es tener **una reunión mensual** de 30-45 minutos donde hablan de dinero en un ambiente tranquilo.

#### Cuándo: El primer domingo del mes
#### Dónde: En casa, con café, sin distracciones
#### Duración: 30-45 minutos máximo

### Agenda de la reunión

#### 1. Revisión del mes anterior (10 min)
- ¿Cuánto gastamos? ¿En qué?
- ¿Nos pasamos en alguna categoría?
- ¿Hubo gastos inesperados?

#### 2. Plan del mes siguiente (10 min)
- ¿Qué gastos grandes vienen?
- ¿Hay que ajustar algo?
- ¿Cuánto ahorramos?

#### 3. Metas compartidas (10 min)
- ¿Cómo vamos con nuestras metas?
- ¿Alguna meta nueva?
- ¿Prioridades cambiaron?

#### 4. Dinero personal (5 min)
- Cada uno tiene un monto para gastar sin dar explicaciones
- Acordar cuánto es ese monto
- Respetarlo sin juzgar

### Las 5 reglas de oro

#### 1. Sin culpas
"Gastaste mucho en X" → "Este mes X nos costó más de lo esperado. ¿Cómo lo ajustamos?"

#### 2. Escucha primero
Deja que tu pareja termine de hablar antes de responder.

#### 3. Usa "nosotros", no "tú"
"Vos siempre gastas de más" → "Nosotros nos pasamos del presupuesto este mes"

#### 4. Define un monto de "consulta"
Ejemplo: Cualquier compra mayor a Q 1,000 se consulta antes. Bajo ese monto, cada quien decide.

#### 5. Celebren juntos
Cuando lleguen a una meta, celebren. Esto hace que las finanzas sean positivas, no solo restrictivas.

### El presupuesto en pareja con Zafi

Zafi permite que ambos miembros del hogar registren gastos y vean el presupuesto compartido. Usa la función de Familia para invitar a tu pareja.

> Las peleas de dinero en pareja son de expectativas, no de números. Alinear expectativas es el primer paso.' WHERE slug = 'hablar-dinero-pareja';

UPDATE capsules SET content_md = '## Cuentas conjuntas: pros, contras y alternativas

Una de las decisiones financieras más importantes en pareja es cómo manejar las cuentas bancarias.

### Las 3 opciones

#### Opción 1: Todo junto
Una sola cuenta para los dos.

**Pros:**
- Simplicidad total
- Transparencia completa
- Fácil presupuestar

**Contras:**
- Sin autonomía para gastos personales
- Puede generar control excesivo
- Complicado si uno gana mucho más que el otro

#### Opción 2: Todo separado
Cada quien su cuenta. Gastos compartidos se dividen.

**Pros:**
- Total autonomía
- Sin conflictos por gastos personales
- Funciona bien si ambos ganan similar

**Contras:**
- Complicado dividir gastos del hogar
- Puede generar sensación de "no somos equipo"
- Difícil ahorrar para metas conjuntas

#### Opción 3: Sistema mixto (recomendado)
Una cuenta conjunta para gastos del hogar + cuentas individuales para cada uno.

**Pros:**
- Lo mejor de ambos mundos
- Gastos compartidos claros
- Autonomía personal preservada

**Contras:**
- Requiere acordar cuánto aporta cada uno

### El sistema mixto en la práctica

#### Paso 1: Calculen gastos compartidos
- Vivienda: Q 6,000
- Alimentación: Q 4,000
- Servicios: Q 2,000
- Hijos: Q 8,000
- **Total compartido: Q 20,000/mes**

#### Paso 2: Decidan cómo aportar

**Opción A — 50/50:** Cada uno aporta Q 10,000
- Funciona si ambos ganan similar

**Opción B — Proporcional:** Según ingreso de cada uno
- Él gana Q 25,000, ella Q 15,000
- Él aporta 62.5% = Q 12,500
- Ella aporta 37.5% = Q 7,500

**Opción C — Por categoría:** Cada uno paga ciertas categorías
- Él: vivienda + servicios = Q 8,000
- Ella: alimentación + otros = Q 12,000

#### Paso 3: El "dinero personal"
Lo que queda después de aportar a la cuenta conjunta y al ahorro es de cada quien. Sin preguntas, sin juicios.

### Preguntas frecuentes

**¿Qué pasa si uno gana mucho más?**
El sistema proporcional funciona mejor. El que más gana aporta más, pero ambos contribuyen.

**¿Y si uno no trabaja?**
El que trabaja aporta al hogar. Ambos deben tener acceso a dinero personal. Estar en casa con los hijos es un trabajo — el dinero del hogar es de los dos.

**¿Hay que ser transparentes con todo?**
Sobre gastos compartidos y metas: sí. Sobre cómo gastas tu dinero personal: no necesariamente, pero nunca ocultar deudas.

> No existe una respuesta correcta. Existe la que funciona para su pareja. Prueben, ajusten, y revisen cada 6 meses.' WHERE slug = 'cuentas-conjuntas';

UPDATE capsules SET content_md = '## Planificar la educación de los hijos desde que nacen

La educación es probablemente el gasto más grande que vas a enfrentar como padre en Guatemala. Planificarlo temprano te ahorra literalmente cientos de miles de quetzales.

### ¿Cuánto cuesta la educación en Guatemala?

#### Colegio privado (costos anuales aproximados)
| Nivel | Costo anual (rango) |
|---|---|
| Pre-primaria | Q 15,000 - Q 40,000 |
| Primaria | Q 20,000 - Q 60,000 |
| Secundaria | Q 30,000 - Q 80,000 |
| Diversificado | Q 35,000 - Q 90,000 |

#### Costos adicionales anuales
- Inscripción: Q 3,000 - Q 15,000
- Uniformes: Q 1,500 - Q 3,000
- Útiles y libros: Q 2,000 - Q 5,000
- Transporte escolar: Q 10,000 - Q 25,000
- Actividades extracurriculares: Q 6,000 - Q 20,000

#### Costo total estimado (13 años de colegio)
- **Colegio económico:** Q 350,000 - Q 500,000
- **Colegio medio:** Q 500,000 - Q 900,000
- **Colegio premium:** Q 900,000 - Q 1,500,000

Y eso es **por hijo**, sin contar universidad.

### Universidad

| Opción | Costo total (5 años) |
|---|---|
| Universidad pública (USAC) | Q 5,000 - Q 15,000 |
| Universidad privada Guatemala | Q 150,000 - Q 400,000 |
| Universidad en el extranjero | Q 800,000 - Q 2,000,000+ |

### El poder del tiempo

Si tu hijo tiene 0 años y quieres tener Q 300,000 para cuando entre a la universidad (18 años):

| Empiezas a ahorrar | Monto mensual necesario |
|---|---|
| Cuando nace (18 años) | Q 1,000/mes |
| A los 5 años (13 años) | Q 1,500/mes |
| A los 10 años (8 años) | Q 2,600/mes |
| A los 15 años (3 años) | Q 7,500/mes |

**Cada año que esperas te cuesta más del doble.**

### Plan de acción

#### Paso 1: Calcula el costo total
- Elige el tipo de colegio que quieres
- Multiplica por los años restantes
- Suma universidad si aplica

#### Paso 2: Resta lo que ya cubres mes a mes
- Si ya pagas colegiatura mensual, ese flujo ya está cubierto
- Enfócate en los gastos extras: inscripciones, útiles, universidad

#### Paso 3: Crea un fondo educativo
- Cuenta separada solo para educación
- Aporte mensual automático
- Invierte en CDs o fondos de bajo riesgo si el horizonte es 5+ años

#### Paso 4: Aprovecha los aguinaldos
Destina al menos 30% de cada aguinaldo al fondo educativo.

### En Zafi

Usa la categoría "Educación" en tu presupuesto para rastrear todos los gastos educativos. Agrega sub-items para cada hijo si tienes varios.

> Cada año que empiezas antes a ahorrar para la educación es dinero que no tienes que poner después. El tiempo es tu mejor aliado.' WHERE slug = 'educacion-hijos-ahorro';

UPDATE capsules SET content_md = '## El seguro de vida: cuándo necesitas uno y cuánto

El seguro de vida no es un lujo — es una herramienta de protección financiera para tu familia.

### ¿Quién necesita seguro de vida?

**SÍ necesitas si:**
- Tienes hijos que dependen de ti
- Tu pareja depende de tu ingreso
- Tienes deudas significativas (hipoteca, préstamos)
- Sos el principal o único proveedor del hogar

**NO necesitas (todavía) si:**
- Sos soltero sin dependientes
- Tu pareja tiene ingreso suficiente para cubrir todo
- No tienes deudas
- Tus hijos ya son independientes

### ¿Cuánto seguro necesitas?

#### La regla simple
**10 veces tu ingreso anual.**

Si ganas Q 20,000/mes = Q 240,000/año → necesitas Q 2,400,000 de cobertura.

#### El cálculo detallado

Suma:
1. **Deudas pendientes:** Hipoteca + préstamos + tarjetas
2. **Gastos del hogar × años:** Hasta que el menor cumpla 18
3. **Fondo educativo:** Colegiatura restante + universidad
4. **Gastos funerarios:** Q 15,000 - Q 30,000

Resta:
1. **Ahorros e inversiones actuales**
2. **Otros seguros que ya tienes**
3. **Ingreso del cónyuge sobreviviente**

**Ejemplo:**
- Deudas: Q 300,000
- Gastos hogar (10 años × Q 120,000): Q 1,200,000
- Educación hijos: Q 500,000
- Menos ahorros: Q 100,000
- **Cobertura necesaria: Q 1,900,000**

### Tipos de seguro

#### Seguro temporal (Term Life)
- Cobertura por plazo fijo (10, 20, 30 años)
- **Más económico**
- Ideal para: proteger mientras los hijos crecen
- Costo: Q 100 - Q 500/mes (depende de cobertura y edad)

#### Seguro permanente (Whole Life)
- Cobertura de por vida
- Acumula valor en efectivo
- **Mucho más caro**
- Costo: Q 500 - Q 3,000/mes

**Recomendación:** Para la mayoría de familias en Guatemala, un seguro **temporal a 20 años** es la mejor opción por costo-beneficio.

### Opciones en Guatemala

- **Seguros G&T:** Productos de vida individual y familiar
- **MAPFRE:** Cobertura amplia, presencia regional
- **Seguros Universales:** Opciones locales
- **Pan American Life:** Especializado en vida

### Tips antes de contratar

1. **Compara al menos 3 cotizaciones**
2. **Revisa exclusiones** (qué NO cubre)
3. **Declarálo todo** en el cuestionario médico (si mientes, pueden negar el reclamo)
4. **Verifica la solidez de la aseguradora** (que esté regulada por la SIB)
5. **Revisa anualmente** si tu cobertura sigue siendo adecuada

### El seguro de vida y las deudas

Si tienes hipoteca, muchos bancos ofrecen seguro de desgravamen que cubre el saldo si falleces. Verifica si ya tienes este seguro antes de contratar uno adicional.

> Necesitas seguro de vida si alguien depende económicamente de ti. No es un gasto — es la tranquilidad de saber que tu familia está protegida.' WHERE slug = 'seguro-vida-cuando-cuanto';

