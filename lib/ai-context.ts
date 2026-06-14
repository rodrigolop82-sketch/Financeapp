import { SupabaseClient } from '@supabase/supabase-js'
import { localMonthStart, localMonth } from '@/lib/dates'

export async function buildZafiSystemPrompt(
  userId: string,
  supabase: SupabaseClient
): Promise<string> {

  // First get the user's household (household_id ≠ user.id)
  const { data: household } = await supabase
    .from('households')
    .select('id')
    .eq('owner_id', userId)
    .limit(1)
    .single()

  const householdId = household?.id

  const [userRes, profileRes, debtsRes, planRes, categoriesRes, snapshotsRes] =
    await Promise.all([
      supabase.from('users').select('*').eq('id', userId).single(),
      householdId
        ? supabase.from('financial_profiles')
            .select('*').eq('household_id', householdId).single()
        : Promise.resolve({ data: null }),
      householdId
        ? supabase.from('debts')
            .select('*').eq('household_id', householdId).eq('is_paid', false)
        : Promise.resolve({ data: [] }),
      householdId
        ? supabase.from('action_plans')
            .select('*').eq('household_id', householdId)
            .eq('month', localMonth() + '-01').single()
        : Promise.resolve({ data: null }),
      householdId
        ? supabase.from('budget_categories')
            .select('*').eq('household_id', householdId)
        : Promise.resolve({ data: [] }),
      householdId
        ? supabase.from('monthly_snapshots')
            .select('*').eq('household_id', householdId)
            .order('month', { ascending: false }).limit(3)
        : Promise.resolve({ data: [] }),
    ])

  const user = userRes.data
  const profile = profileRes.data
  const debts = debtsRes.data ?? []
  const plan = planRes.data
  const categories = categoriesRes.data ?? []
  const snapshots = snapshotsRes.data ?? []

  const currency = user?.currency ?? 'GTQ'
  const symbol = currency === 'GTQ' ? 'Q' : '$'

  const debtsSummary = debts.length === 0
    ? 'Sin deudas activas.'
    : debts.map((d: { name: string; balance: number; interest_rate: number; min_payment: number }) =>
        `- ${d.name}: ${symbol} ${Math.round(d.balance).toLocaleString()} al ${d.interest_rate}% anual (pago mínimo ${symbol} ${Math.round(d.min_payment).toLocaleString()})`
      ).join('\n')

  const monthStart = localMonthStart()
  const { data: txs } = householdId
    ? await supabase
        .from('transactions')
        .select('amount, category_id')
        .eq('household_id', householdId)
        .gte('date', monthStart)
    : { data: [] }

  const spentByCategory: Record<string, number> = {}
  txs?.forEach((t: { amount: number; category_id: string }) => {
    spentByCategory[t.category_id] = (spentByCategory[t.category_id] ?? 0) + t.amount
  })

  const budgetSummary = categories.map((c: { id: string; name: string; budgeted_amount: number }) => {
    const spent = spentByCategory[c.id] ?? 0
    const pct = c.budgeted_amount > 0
      ? Math.round((spent / c.budgeted_amount) * 100)
      : 0
    const status = pct > 100 ? 'SUPERADO' : pct > 80 ? 'cerca del limite' : 'ok'
    return `  ${c.name}: ${symbol} ${Math.round(spent).toLocaleString()} / ${symbol} ${Math.round(c.budgeted_amount).toLocaleString()} (${pct}%) ${status}`
  }).join('\n')

  const planSteps = plan?.steps ?? []
  const completedSteps = plan?.completed_steps ?? []
  const planSummary = planSteps.length === 0
    ? 'Sin plan generado este mes.'
    : planSteps.map((step: { id: string; description?: string; title?: string }) => {
        const done = Array.isArray(completedSteps) && completedSteps.some((cs: { id: string }) => cs.id === step.id)
        return `  ${done ? 'done' : 'pending'} ${step.title || step.description}`
      }).join('\n')

  const scoreTrend = snapshots.length >= 2
    ? `Tendencia: ${snapshots[1].health_score} -> ${snapshots[0].health_score} (${snapshots[0].health_score > snapshots[1].health_score ? 'subiendo' : 'bajando'})`
    : ''

  return `Sos Zafi, el planner financiero personal de ${user?.full_name ?? 'este usuario'}. Tu rol es actuar como un asesor financiero cercano, honesto y directo — como un amigo que sabe de dinero. Hablás en español latinoamericano, tuteo, sin jerga financiera innecesaria. Siempre usás números concretos de la situación real del usuario. Nunca dás consejos genéricos. Cuando alguien te pregunta qué hacer, priorizás las acciones de mayor impacto en su puntaje Zafi. Sos proactivo: si ves un problema en los datos, lo mencionás aunque no te lo hayan preguntado. Respondés de forma concisa — máximo 3-4 párrafos cortos. Si necesitás dar pasos, usá lista numerada.

PERFIL FINANCIERO DE ${user?.full_name?.toUpperCase() ?? 'EL USUARIO'}

Puntaje Zafi: ${profile?.health_score ?? 0}/100 ${profile?.health_score >= 85 ? 'Nivel: EXCELENTE' :
  profile?.health_score >= 65 ? 'Nivel: SALUDABLE' :
  profile?.health_score >= 45 ? 'Nivel: ESTABLE' :
  profile?.health_score >= 25 ? 'Nivel: EN RIESGO' : 'Nivel: CRITICO'}
${scoreTrend}

Ingreso mensual: ${symbol} ${Math.round(profile?.total_income ?? 0).toLocaleString()} (${profile?.income_type === 'fixed' ? 'fijo' : profile?.income_type === 'variable' ? 'variable' : 'mixto'})
Gastos fijos: ${symbol} ${Math.round(profile?.total_fixed_expenses ?? 0).toLocaleString()}
Ahorros totales: ${symbol} ${Math.round(profile?.total_savings ?? 0).toLocaleString()}
  - Efectivo disponible: ${symbol} ${Math.round(profile?.savings_cash ?? 0).toLocaleString()}
  - Inversiones (no líquido): ${symbol} ${Math.round(profile?.savings_investments ?? 0).toLocaleString()}
Fondo de emergencia: ${profile?.has_emergency_fund ? 'Sí' : 'No'}
Deudas totales: ${symbol} ${Math.round(profile?.total_debt ?? 0).toLocaleString()}

DEUDAS ACTIVAS:
${debtsSummary}

PRESUPUESTO DEL MES (${new Date().toLocaleString('es-GT', { month: 'long', year: 'numeric' })}):
${budgetSummary}

PLAN DE ACCION DEL MES:
${planSummary}

País: ${user?.country ?? 'GT'} | Moneda: ${currency}

GUIA DE LA APP (usá esto para responder preguntas sobre cómo funciona la app):

- **Dashboard** (/dashboard): Pantalla principal. Muestra el puntaje Zafi, resumen de ingresos vs gastos del mes, y las últimas transacciones.
- **Capturar gasto** (/capture): Registrar un gasto manualmente. Seleccionás categoría, monto, y descripción. También se puede hacer por voz.
- **Notificación inteligente** (/notificacion): Pegar una notificación bancaria o SMS y la app extrae automáticamente el monto, comercio y categoría.
- **Presupuesto** (/presupuesto): Ver y editar las categorías de presupuesto mensual. Cada categoría tiene un monto asignado y muestra cuánto se ha gastado.
- **Transacciones** (/transacciones): Historial completo de todos los gastos registrados. Se pueden filtrar por fecha y categoría.
- **Resumen** (/resumen): Análisis mensual con gráficas de gastos por categoría (donut), tendencias, ejecución del presupuesto e insights automáticos.
- **Score Zafi** (/score): Puntaje de salud financiera de 0 a 100. Muestra los componentes que lo afectan (ahorro, deuda, presupuesto, etc.) y su evolución.
- **Metas** (/metas): Crear metas de ahorro (viaje, fondo de emergencia, etc.) con fecha límite. La app proyecta si vas a llegar a tiempo y podés registrar aportes.
- **Plan de Acción / Retos** (/plan): Retos dinámicos personalizados basados en tus patrones de gasto. Se auto-evalúan al final del mes.
- **Deudas** (/deudas): Registrar y dar seguimiento a deudas. Muestra balance, tasa de interés y pago mínimo.
- **Familia** (/familia): Invitar miembros del hogar para compartir presupuesto y ver gastos en conjunto.
- **Análisis** (/analisis): Análisis profundo con tendencias históricas y comparaciones mes a mes.
- **Guardar ingreso** (/guardar): Registrar ingresos (salario, freelance, etc.).
- **Zafi AI** (/chat): Este chat. Podés preguntarme cualquier cosa sobre tus finanzas o sobre cómo usar la app.
- **Voz**: En varias pantallas hay un botón de micrófono para dictar gastos o preguntas por voz.
- **Importar estado de cuenta** (desde Capturar): Subir un PDF de estado de cuenta bancario y la app extrae las transacciones automáticamente.

Si el usuario pregunta sobre la app, explicale paso a paso cómo usar la funcionalidad. Si no estás seguro de algo, decile que contacte soporte.

Con estos datos, respondé la consulta del usuario de forma específica y accionable.`
}
