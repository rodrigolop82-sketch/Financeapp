'use client'
import { useMoneyFormat } from '@/lib/format'

interface Transaction {
  id: string
  description: string | null
  category: string
  amount: number
  date: string
  source: 'manual' | 'voice' | 'ocr' | 'csv'
}

// Mapeo de categorías a emojis
const CATEGORY_EMOJIS: Record<string, string> = {
  'Restaurantes y salidas': '🍽️',
  'Alimentación': '🛒',
  'Transporte': '🚗',
  'Salud/medicinas': '💊',
  'Servicios': '⚡',
  'Educación': '📚',
  'Ropa': '👕',
  'Entretenimiento': '🎬',
  'Suscripciones': '📱',
  'Varios personales': '🛍️',
  'Vivienda/alquiler': '🏠',
  'Fondo de emergencia': '🛡️',
  'Ahorro para metas': '🎯',
  'Pago extra de deudas': '💳',
}

function formatRelativeDate(dateStr: string): string {
  const date = new Date(dateStr + 'T12:00:00')
  const now = new Date()
  const todayStr = now.toISOString().split('T')[0]
  const yesterdayDate = new Date(now)
  yesterdayDate.setDate(now.getDate() - 1)
  const yesterdayStr = yesterdayDate.toISOString().split('T')[0]

  if (dateStr === todayStr) return 'hoy'
  if (dateStr === yesterdayStr) return 'ayer'
  const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24))
  if (diffDays < 7) return `hace ${diffDays} días`
  return date.toLocaleDateString('es-GT', { day: 'numeric', month: 'short' })
}

interface TransactionsListProps {
  transactions: Transaction[]
  onSeeAll: () => void
}

export function TransactionsList({ transactions, onSeeAll }: TransactionsListProps) {
  const { money } = useMoneyFormat()
  const recent = transactions.slice(0, 5)

  return (
    <div style={{ padding: '10px 16px 0' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <span style={{ fontSize: 11, fontWeight: 500, color: '#64748B', letterSpacing: '.05em' }}>
          ÚLTIMOS MOVIMIENTOS
        </span>
        <button
          onClick={onSeeAll}
          style={{ fontSize: 11, color: '#2563EB', fontWeight: 500, background: 'none', border: 'none', cursor: 'pointer' }}
        >
          Ver todos →
        </button>
      </div>

      <div style={{ background: 'white', border: '0.5px solid #E2E8F0', borderRadius: 12, overflow: 'hidden' }}>
        {recent.length === 0 ? (
          <div style={{ padding: '20px 16px', textAlign: 'center', color: '#94A3B8', fontSize: 12 }}>
            No hay gastos registrados hoy. ¡Agregá el primero!
          </div>
        ) : (
          recent.map((tx, i) => (
            <div key={tx.id} style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '10px 12px',
              borderBottom: i < recent.length - 1 ? '0.5px solid #F8FAFC' : 'none'
            }}>
              {/* Ícono de categoría */}
              <div style={{
                width: 32, height: 32, borderRadius: 8,
                background: '#F8FAFC', display: 'flex',
                alignItems: 'center', justifyContent: 'center',
                flexShrink: 0, fontSize: 14
              }}>
                {CATEGORY_EMOJIS[tx.category] ?? '💳'}
              </div>

              {/* Info */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontSize: 13, fontWeight: 500, color: '#1E3A5F',
                  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'
                }}>
                  {tx.description || tx.category}
                </div>
                <div style={{ fontSize: 10, color: '#94A3B8', marginTop: 1 }}>
                  {tx.category} · {formatRelativeDate(tx.date)}
                </div>
              </div>

              {/* Monto + badge de voz */}
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 500, color: '#1E3A5F' }}>
                  {money(tx.amount)}
                </div>
                {tx.source === 'voice' && (
                  <span style={{
                    fontSize: 9, fontWeight: 500, padding: '1px 5px',
                    borderRadius: 4, background: '#DBEAFE', color: '#1E40AF'
                  }}>
                    voz
                  </span>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
