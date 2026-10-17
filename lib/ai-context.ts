import { SupabaseClient } from '@supabase/supabase-js'
import { localMonthStart, localMonth } from '@/lib/dates'
import { getUserHousehold } from '@/lib/household'
import { loadScoreInput, type ScoreRaw } from '@/lib/health-data'
import { getNetWorth, type NetWorthData, type SourceView } from '@/lib/networth/data'
import { groupAssets, groupLiabilities, PURPOSE_LABEL } from '@/lib/networth/groups'
import { formatMonths } from '@/lib/deudas'
import { formatNumber } from '@/lib/format'
import { loadDeudas } from '@/lib/deudas-data'
import { metricasMes, type InteresesDeuda, type MetricasCategoria } from '@/lib/metricas-mes'

type Money = (n: number) => string

function prevMonth(month: string, n: number): string {
  const [y, m] = month.split('-').map(Number)
  const d = new Date(y, m - 1 - n, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

/** Ingresos y gastos registrados en los últimos meses completos (solo los meses con movimientos). */
export function recordedMonths(txs: ScoreRaw['txs'], month: string, money: Money, categories: MetricasCategoria[] = [], intereses?: InteresesDeuda): string {
  const lines = [1, 2, 3].map((n) => prevMonth(month, n)).map((m) => {
    const r = metricasMes(txs, m, categories, intereses)
    if (!r.hayMovimientos) return null
    const ahorro = r.ahorro === null ? 'ahorro sin calcular (sin ingresos)' : `ahorro ${money(r.ahorro)}`
    return `  ${m}: ingresos ${money(r.ingresos)} · gastos ${money(r.consumo)} · ${ahorro}`
  }).filter((l): l is string => l !== null)
  return lines.length ? lines.join('\n') : '  Sin movimientos registrados en los últimos 3 meses.'
}

function debtLine(s: SourceView, money: Money): string {
  const t = s.debtTerms
  const parts = [`${s.name}: ${money(s.balance ?? 0)}`]
  if (t) {
    if (t.debtType === 'loan' && t.purpose) parts.push(`préstamo de ${PURPOSE_LABEL[t.purpose].label.toLowerCase()}`)
    else parts.push(t.debtType === 'credit' ? 'tarjeta' : t.debtType === 'informal' ? 'informal' : 'préstamo')
    parts.push(`${t.interestRate}% anual`)
    parts.push(`pago ${money(t.monthlyPayment)}/mes`)
    if (t.originalAmount) parts.push(`deuda original ${money(t.originalAmount)}`)
    parts.push(t.monthsLeft !== null ? `la termina en ${formatMonths(t.monthsLeft)}` : 'con el pago actual no baja')
  } else {
    parts.push('sin tasa ni pago registrados')
  }
  return `    - ${parts.join(' · ')}`
}

/** Mi patrimonio en texto, con los mismos grupos que ve el usuario. */
export function netWorthSummary(data: NetWorthData, money: Money): string {
  if (!data.hasSources) return 'El usuario aún no registra cuentas, bienes ni deudas en Mi patrimonio.'
  const sm = data.summary
  const out: string[] = []
  out.push(`Patrimonio neto: ${sm.netWorth < 0 ? '-' : ''}${money(Math.abs(sm.netWorth))} (activos ${money(sm.assets)} · deudas ${money(sm.liabilities)})`)
  if (sm.deltaVsPrevMonthEnd !== null) {
    out.push(`Cambio desde el cierre del mes pasado: ${sm.deltaVsPrevMonthEnd >= 0 ? '+' : '-'}${money(Math.abs(sm.deltaVsPrevMonthEnd))}`)
  }
  out.push('LO QUE TIENE:')
  const withBalance = data.assets.filter((a) => a.balance !== null)
  if (withBalance.length === 0) out.push('  Sin activos con saldo.')
  for (const g of groupAssets(withBalance)) {
    out.push(`  ${g.label}: ${money(g.total)}`)
    for (const a of g.items) {
      const when = a.daysSinceUpdate === null ? '' : a.daysSinceUpdate <= 0 ? ' (actualizado hoy)' : ` (actualizado hace ${a.daysSinceUpdate} días)`
      out.push(`    - ${a.name}${a.institution && a.institution !== a.name ? ` (${a.institution})` : ''}: ${money(a.balance ?? 0)}${when}`)
    }
  }
  const noBalance = data.assets.filter((a) => a.balance === null)
  if (noBalance.length) out.push(`  Cuentas sin saldo registrado (no cuentan): ${noBalance.map((a) => a.name).join(', ')}`)
  out.push('LO QUE DEBE:')
  if (data.liabilities.length === 0) out.push('  Sin deudas.')
  for (const g of groupLiabilities(data.liabilities)) {
    out.push(`  ${g.label}: ${money(g.total)}${g.monthly > 0 ? ` (pagos ${money(g.monthly)}/mes)` : ''}`)
    for (const d of g.items) out.push(debtLine(d, money))
  }
  const stale = data.accounts.filter((a) => a.stale).map((a) => a.name)
  if (stale.length) out.push(`Saldos con más de 30 días sin actualizar: ${stale.join(', ')}`)
  return out.join('\n')
}

export async function buildZafiSystemPrompt(
  userId: string,
  supabase: SupabaseClient
): Promise<string> {

  const household = await getUserHousehold(supabase, userId)
  const householdId = household?.id

  const [userRes, profileRes, debtsRes, planRes, categoriesRes, snapshotsRes] =
    await Promise.all([
      supabase.from('users').select('*').eq('id', userId).single(),
      householdId
        ? supabase.from('financial_profiles')
            .select('*').eq('household_id', householdId).single()
        : Promise.resolve({ data: null }),
      householdId
        ? loadDeudas<{ name: string; balance: number; interest_rate: number; min_payment: number }>(supabase, householdId).then((data) => ({ data }))
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

  const month = localMonth()
  const [scoreRes, netWorthRes] = householdId
    ? await Promise.allSettled([
        loadScoreInput(supabase, { householdId, userId, month }),
        getNetWorth(supabase, householdId, userId, new Date().toISOString()),
      ])
    : [null, null]
  const live = scoreRes?.status === 'fulfilled' ? scoreRes.value : null
  const netWorth = netWorthRes?.status === 'fulfilled' ? netWorthRes.value : null

  const user = userRes.data
  const profile = profileRes.data
  const debts = debtsRes.data ?? []
  const plan = planRes.data
  const categories = categoriesRes.data ?? []
  const snapshots = snapshotsRes.data ?? []

  const currency = user?.currency ?? 'GTQ'
  const symbol = currency === 'GTQ' ? 'Q' : '$'
  const money: Money = (n) => `${symbol} ${formatNumber(n)}`

  const netWorthText = netWorth
    ? netWorthSummary(netWorth, money)
    : householdId ? 'No se pudo leer Mi patrimonio en este momento.' : 'Sin hogar configurado.'
  const recordedText = live ? recordedMonths(live.raw.txs, month, money, live.raw.categories, live.raw.intereses) : '  No se pudieron leer los movimientos.'

  const debtsSummary = debts.length === 0
    ? 'Sin deudas activas.'
    : debts.map((d: { name: string; balance: number; interest_rate: number; min_payment: number }) =>
        `- ${d.name}: ${money(d.balance)} al ${d.interest_rate}% anual (pago mínimo ${money(d.min_payment)})`
      ).join('\n')

  const monthStart = localMonthStart()
  const { data: txs } = householdId
    ? await supabase
        .from('transactions')
        .select('amount, category_id')
        .eq('household_id', householdId)
        .eq('type', 'expense')
        .gte('date', monthStart)
    : { data: [] }

  const spentByCategory: Record<string, number> = {}
  txs?.forEach((t: { amount: number; category_id: string }) => {
    spentByCategory[t.category_id] = (spentByCategory[t.category_id] ?? 0) + t.amount
  })

  const budgetSummary = categories.filter((c: { archived_at?: string | null }) => !c.archived_at).map((c: { id: string; name: string; budgeted_amount: number }) => {
    const spent = spentByCategory[c.id] ?? 0
    const pct = c.budgeted_amount > 0
      ? Math.round((spent / c.budgeted_amount) * 100)
      : 0
    const status = pct > 100 ? 'SUPERADO' : pct > 80 ? 'cerca del limite' : 'ok'
    return `  ${c.name}: ${money(spent)} / ${money(c.budgeted_amount)} (${pct}%) ${status}`
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

  return `Eres Zafi, el planner financiero personal de ${user?.full_name ?? 'este usuario'}. Tu rol es actuar como un asesor financiero cercano, honesto y directo — como un amigo que sabe de dinero. Hablas en español latinoamericano, tuteo, sin jerga financiera innecesaria. Siempre usas números concretos de la situación real del usuario. Nunca das consejos genéricos. Cuando alguien te pregunta qué hacer, priorizas las acciones de mayor impacto en su puntaje Zafi. Eres proactivo: si ves un problema en los datos, lo mencionas aunque no te lo hayan preguntado. Respondes de forma concisa — máximo 3-4 párrafos cortos. Si necesitas dar pasos, usa lista numerada.

PERFIL FINANCIERO DE ${user?.full_name?.toUpperCase() ?? 'EL USUARIO'}

Puntaje Zafi: ${profile?.health_score ?? 0}/100 ${profile?.health_score >= 85 ? 'Nivel: EXCELENTE' :
  profile?.health_score >= 65 ? 'Nivel: SALUDABLE' :
  profile?.health_score >= 45 ? 'Nivel: ESTABLE' :
  profile?.health_score >= 25 ? 'Nivel: EN RIESGO' : 'Nivel: CRITICO'}
${scoreTrend}

${live?.input.provisional
  ? `Ingresos registrados este mes: ninguno todavía (falta registrar). Ingreso del plan: ${money(live.input.income)}`
  : `Ingresos registrados este mes: ${money(live?.input.income ?? profile?.total_income ?? 0)}`} (${profile?.income_type === 'fixed' ? 'fijo' : profile?.income_type === 'variable' ? 'variable' : 'mixto'})
Gastos fijos (Plan del mes): ${money(live?.input.fixedExpenses ?? profile?.total_fixed_expenses ?? 0)}
Gastado este mes hasta hoy (lo básico + gustos, sin ahorro ni abonos a deudas): ${money(live?.input.spent ?? 0)}
Ahorro este mes (ingresos − gastado): ${live?.input.provisional ? 'sin calcular: falta registrar ingresos' : money(live?.input.saved ?? 0)}

MOVIMIENTOS REGISTRADOS (meses completos recientes):
${recordedText}

PATRIMONIO (pantalla Mi patrimonio, saldos que el usuario declara; es la fuente correcta para patrimonio, efectivo, inversiones, bienes y deudas):
${netWorthText}

Dato del perfil inicial (puede estar desactualizado; usa Mi patrimonio si tiene datos): ahorros ${money(profile?.total_savings ?? 0)}, fondo de emergencia ${profile?.has_emergency_fund ? 'sí' : 'no'}.

DEUDAS ACTIVAS (Plan › Deudas; ya están incluidas en Mi patrimonio):
${debtsSummary}

PRESUPUESTO DEL MES (${new Date().toLocaleString('es-GT', { month: 'long', year: 'numeric' })}):
${budgetSummary}

PLAN DE ACCION DEL MES:
${planSummary}

País: ${user?.country ?? 'GT'} | Moneda: ${currency}

GUIA DE LA APP (usa esto para responder preguntas sobre cómo funciona la app):

- **Dashboard** (/dashboard): Pantalla principal. Muestra el puntaje Zafi, resumen de ingresos vs gastos del mes, y las últimas transacciones.
- **Capturar gasto** (/capture): Registrar un gasto manualmente. Seleccionas categoría, monto, y descripción. También se puede hacer por voz.
- **Notificación inteligente** (/notificacion): Pegar una notificación bancaria o SMS y la app extrae automáticamente el monto, comercio y categoría.
- **Plan del mes** (/plan, pestaña Plan › Del mes): Ver y editar las categorías de presupuesto mensual. Cada categoría tiene un monto asignado y muestra cuánto se ha gastado.
- **Transacciones** (/transacciones): Historial completo de todos los gastos registrados. Se pueden filtrar por fecha y categoría.
- **Cómo te fue** (/resumen): Una sola vista del mes: cuánto ahorraste, lo que salió bien y lo que se pasó, topes por % de ingreso (vivienda 30, carro 15, alimentación 15, gustos 10, deudas 20, suscripciones 5; editables), oportunidades para ahorrar, proyección a diciembre o 12 meses, gráficas de 6 meses (necesidades/gustos/ahorro y fijos/variables) y detalle por categoría.
- **Tu salud financiera** (dentro de Cómo te fue, /resumen): Puntaje de 0 a 100. "Ver qué lo compone" muestra las partes (ahorro, deuda, fondo de emergencia, gasto, estabilidad) y su evolución. Sin ingresos registrados del mes es provisional.
- **Cerrar el mes** (botón "Fin de mes" en Cómo te fue y aviso en Inicio del 1 al 5): pasos obligatorios (ingresos del mes y estados de cuenta) y luego se guarda el puntaje del mes.
- **Metas** (/plan?s=metas, pestaña Plan › Metas): Crear metas de ahorro (viaje, fondo de emergencia, etc.) con fecha límite. La app proyecta si vas a llegar a tiempo y puedes registrar aportes.
- **Plan de Acción / Retos** (/plan/retos): Retos dinámicos personalizados basados en tus patrones de gasto. Se auto-evalúan al final del mes.
- **Deudas** (/plan?s=deudas, pestaña Plan › Deudas): Registrar y dar seguimiento a deudas. Guarda saldo, deuda original, tasa de interés, pago mensual, día de pago y, en préstamos, para qué es (vehículo, inmueble o personal).
- **Mi patrimonio** (/patrimonio): Lo que tienes menos lo que debes. Agrupa los activos en Efectivo y equivalentes, Inversiones, Vehículos e Inmuebles, y las deudas en corto y largo plazo. Efectivo, inversiones, bienes y otras deudas se agregan y editan ahí. Las cuentas de banco y tarjetas se administran en Mis cuentas (/mis-fuentes) y también aparecen en Mi patrimonio.
- **Familia** (en Cuenta, /familia): Invitar miembros del hogar para compartir presupuesto y ver gastos en conjunto.
- **Análisis** (/analisis): Análisis profundo con tendencias históricas y comparaciones mes a mes.
- **Guardar ingreso** (/guardar): Registrar ingresos (salario, freelance, etc.).
- **Pregúntale a Zafi** (/chat): Este chat. Puedes preguntarme cualquier cosa sobre tus finanzas o sobre cómo usar la app.
- **Voz**: En varias pantallas hay un botón de micrófono para dictar gastos o preguntas por voz.
- **Importar estado de cuenta** (desde Capturar): Subir un PDF de estado de cuenta bancario y la app extrae las transacciones automáticamente.

QUE DATOS TIENES Y CUALES NO:
Solo conoces lo que aparece arriba: Plan del mes, gastos de este mes por categoría, movimientos de los últimos 3 meses en totales, Mi patrimonio, Deudas, plan de acción y puntaje. No ves el detalle de cada movimiento, ni metas, ni cuentas personales de otros miembros del hogar. Si te preguntan qué datos ves, enumera exactamente estos; nunca digas que ves todo. Si un dato no está arriba, dilo y explica dónde registrarlo en la app. Los saldos de Mi patrimonio los actualiza el usuario a mano; si alguno lleva más de 30 días sin actualizar, menciónalo cuando sea relevante.

Si el usuario pregunta sobre la app, explicale paso a paso cómo usar la funcionalidad. Si no estás seguro de algo, decile que contacte soporte.

Con estos datos, responde la consulta del usuario de forma específica y accionable.`
}
