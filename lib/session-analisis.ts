export interface AnalisisData {
  ingresos: number
  tipoIngreso: 'fijo' | 'variable' | 'mixto'
  gastos: number
  deudas: number
  ahorros: number
  meta: string
  score?: number
  scoreLabel?: string
  completadoEn?: string
}

const KEY = 'zafi_analisis_temp'

export const sessionAnalisis = {
  guardar: (data: Partial<AnalisisData>) => {
    const existing = sessionAnalisis.leer() || {}
    sessionStorage.setItem(KEY, JSON.stringify({ ...existing, ...data }))
  },

  leer: (): AnalisisData | null => {
    const raw = sessionStorage.getItem(KEY)
    if (!raw) return null
    try { return JSON.parse(raw) } catch { return null }
  },

  limpiar: () => sessionStorage.removeItem(KEY),

  migrarASupabase: async () => {
    const data = sessionAnalisis.leer()
    if (!data) return

    const incomeTypeMap: Record<string, string> = {
      fijo: 'fixed',
      variable: 'variable',
      mixto: 'mixed',
    }

    const gastos = data.gastos || 1

    await fetch('/api/onboarding', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        householdName: 'Mi hogar',
        householdType: 'individual',
        totalIncome: data.ingresos,
        incomeType: incomeTypeMap[data.tipoIngreso] || 'fixed',
        fixedExpenses: {
          vivienda: Math.round(gastos * 0.35),
          transporte: Math.round(gastos * 0.15),
          servicios: Math.round(gastos * 0.1),
          alimentacion: Math.round(gastos * 0.25),
          salud: Math.round(gastos * 0.1),
          educacion: Math.round(gastos * 0.05),
        },
        debts: data.deudas > 0
          ? [{ name: 'Deudas existentes', type: 'loan', balance: data.deudas, interestRate: 0, minPayment: 0 }]
          : [],
        totalSavings: data.ahorros,
        savingsCash: data.ahorros,
        savingsInvestments: 0,
        hasEmergencyFund: data.ahorros >= gastos * 3,
      }),
    })

    sessionAnalisis.limpiar()
  },
}
