import { describe, expect, it } from 'vitest'
import { destinoDe, interesDelPago, metricasMes, resumirMovimientos, type MetricasCategoria, type MetricasTx } from './metricas-mes'

const cats: MetricasCategoria[] = [
  { id: 'viv', bucket: 'needs' },
  { id: 'res', bucket: 'wants' },
  { id: 'aho', bucket: 'savings' },
  { id: 'deu', bucket: 'savings', name: 'Pago de deudas extra' },
  { id: 'sal', bucket: 'income' },
]
const tx = (id: string, category_id: string | null, amount: number, type: 'expense' | 'income' = 'expense', extra: Partial<MetricasTx> = {}): MetricasTx =>
  ({ id, category_id, amount, type, date: '2026-09-10', ...extra })

describe('destinoDe', () => {
  const bucketOf = new Map(cats.map((c) => [c.id, c.bucket]))
  it('clasifica cada movimiento', () => {
    expect(destinoDe(tx('a', 'sal', 1, 'income'), bucketOf)).toBe('ingreso')
    expect(destinoDe(tx('a', null, 1, 'income'), bucketOf)).toBe('ingreso')
    expect(destinoDe(tx('a', 'viv', 1), bucketOf)).toBe('basico')
    expect(destinoDe(tx('a', 'res', 1), bucketOf)).toBe('gustos')
    expect(destinoDe(tx('a', 'aho', 1), bucketOf)).toBe('apartado')
    expect(destinoDe(tx('a', null, 1), bucketOf)).toBe('basico')
    expect(destinoDe(tx('a', 'borrada', 1), bucketOf)).toBe('basico')
  })
  it('un pago a deuda desde Pagos (sin categoría, "ahorro") no es consumo', () => {
    expect(destinoDe(tx('a', null, 1, 'expense', { transaction_type: 'ahorro' }), bucketOf)).toBe('deuda')
    expect(destinoDe(tx('a', null, 1), bucketOf, new Map([['a', 0]]))).toBe('deuda')
  })
})

describe('resumirMovimientos', () => {
  it('ahorro = ingresos − gastaste; lo apartado y los abonos van dentro, no se suman', () => {
    const m = resumirMovimientos([
      tx('i', 'sal', 15000, 'income'),
      tx('v', 'viv', 6000),
      tx('r', 'res', 1500),
      tx('a', 'aho', 2000),
      tx('e', 'deu', 500),
      tx('d', null, 1000, 'expense', { transaction_type: 'ahorro' }),
    ], cats, new Map([['d', 200]]))
    expect(m.ingresos).toBe(15000)
    expect(m.intereses).toBe(200)
    expect(m.basico).toBe(6200)
    expect(m.gustos).toBe(1500)
    expect(m.consumo).toBe(7700)
    expect(m.apartado).toBe(2500)
    expect(m.abonosDeuda).toBe(800)
    expect(m.ahorro).toBe(7300)
    expect(m.sinApartar).toBe(7300 - 2500 - 800)
    expect(m.ahorroPct).toBe(49)
  })

  it('sin ingresos registrados: no hay ahorro (Falta registrar)', () => {
    const m = resumirMovimientos([tx('v', 'viv', 6000), tx('a', 'aho', 3000)], cats)
    expect(m.tieneIngresos).toBe(false)
    expect(m.ingresos).toBe(0)
    expect(m.consumo).toBe(6000)
    expect(m.apartado).toBe(3000)
    expect(m.ahorro).toBeNull()
    expect(m.sinApartar).toBeNull()
    expect(m.ahorroPct).toBeNull()
  })

  it('gastar más de lo que entró da ahorro negativo', () => {
    const m = resumirMovimientos([tx('i', null, 1000, 'income'), tx('v', 'viv', 1500)], cats)
    expect(m.ahorro).toBe(-500)
    expect(m.ahorroPct).toBe(-50)
  })

  it('un gasto en una categoría de ingreso no cuenta', () => {
    expect(resumirMovimientos([tx('x', 'sal', 99)], cats).consumo).toBe(0)
  })
})

describe('metricasMes', () => {
  it('solo cuenta el mes pedido', () => {
    const m = metricasMes([
      tx('a', 'viv', 100, 'expense', { date: '2026-08-31' }),
      tx('b', 'viv', 200, 'expense', { date: '2026-09-01' }),
    ], '2026-09', cats)
    expect(m.consumo).toBe(200)
    expect(m.hayMovimientos).toBe(true)
  })
})

describe('interesDelPago', () => {
  it('saldo × tasa ÷ 12, sin pasar del pago', () => {
    expect(interesDelPago(1000, { balance: 12000, interest_rate: 36 })).toBe(360)
    expect(interesDelPago(100, { balance: 12000, interest_rate: 36 })).toBe(100)
    expect(interesDelPago(1000, { balance: 0, interest_rate: 36 })).toBe(0)
  })
})
