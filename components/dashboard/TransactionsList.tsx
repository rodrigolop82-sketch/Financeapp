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

// Mapeo de categorías a SVG icons con colores de fondo
const CATEGORY_ICONS: Record<string, { bg: string; icon: string }> = {
  'Restaurantes y salidas': { bg: '#FEF3C7', icon: 'restaurant' },
  'Alimentación':           { bg: '#DBEAFE', icon: 'cart' },
  'Transporte':             { bg: '#FEE2E2', icon: 'car' },
  'Salud/medicinas':        { bg: '#FCE7F3', icon: 'health' },
  'Servicios':              { bg: '#E0E7FF', icon: 'bolt' },
  'Educación':              { bg: '#EDE9FE', icon: 'book' },
  'Ropa':                   { bg: '#F3E8FF', icon: 'shirt' },
  'Entretenimiento':        { bg: '#FEF9C3', icon: 'film' },
  'Suscripciones':          { bg: '#E0F2FE', icon: 'phone' },
  'Varios personales':      { bg: '#F1F5F9', icon: 'bag' },
  'Vivienda/alquiler':      { bg: '#ECFDF5', icon: 'home' },
  'Fondo de emergencia':    { bg: '#F0FDF4', icon: 'shield' },
  'Ahorro para metas':      { bg: '#EFF6FF', icon: 'target' },
  'Ahorro metas':           { bg: '#EFF6FF', icon: 'target' },
  'Pago extra de deudas':   { bg: '#FFF7ED', icon: 'card' },
  'Pago de deudas extra':   { bg: '#FFF7ED', icon: 'card' },
}

function CategoryIcon({ category }: { category: string }) {
  const config = CATEGORY_ICONS[category] ?? { bg: '#F1F5F9', icon: 'card' }
  const color = '#475569'

  const icons: Record<string, React.ReactNode> = {
    restaurant: <path d="M5 3v5a2 2 0 002 2h0a2 2 0 002-2V3M6 3v2M9 13v4M5 10h4l-1 3H6l-1-3z" stroke={color} strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" fill="none"/>,
    cart: <path d="M3 3h1l1.5 7h7L14 5H5.5M7 13a1 1 0 100 2 1 1 0 000-2zM12 13a1 1 0 100 2 1 1 0 000-2z" stroke={color} strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" fill="none"/>,
    car: <path d="M3 10l1.5-4h7L13 10M3 10v3h2v-1h6v1h2v-3M3 10h10M5.5 12a.5.5 0 100-1 .5.5 0 000 1zM10.5 12a.5.5 0 100-1 .5.5 0 000 1z" stroke={color} strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" fill="none"/>,
    health: <path d="M8 3C5.5 3 4 5 4 7c0 4 4 7 4 7s4-3 4-7c0-2-1.5-4-4-4z" stroke={color} strokeWidth="1.2" fill="none"/>,
    bolt: <path d="M7 2l-3 6h4l-1 6 5-7H8l2-5z" stroke={color} strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" fill="none"/>,
    book: <path d="M4 3h8v11H4zM4 3c1 0 4 .5 4 2M4 14c1 0 4-.5 4-2M8 5v7" stroke={color} strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" fill="none"/>,
    shirt: <path d="M5 3L3 5l2 1V14h6V6l2-1-2-2-2 1.5h-2L5 3z" stroke={color} strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" fill="none"/>,
    film: <path d="M3 4h10v9H3zM6 4v9M10 4v9M3 7h10M3 10h10" stroke={color} strokeWidth="1.2" strokeLinecap="round" fill="none"/>,
    phone: <rect x="4" y="2" width="8" height="12" rx="1.5" stroke={color} strokeWidth="1.2" fill="none"/>,
    bag: <path d="M4 6h8v8H4zM6 6V4a2 2 0 014 0v2" stroke={color} strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" fill="none"/>,
    home: <path d="M3 8l5-4 5 4v6H3V8zM6 14v-3h4v3" stroke={color} strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" fill="none"/>,
    shield: <path d="M8 2L3 5v3c0 3.5 2.5 6 5 7 2.5-1 5-3.5 5-7V5L8 2z" stroke={color} strokeWidth="1.2" fill="none"/>,
    target: <circle cx="8" cy="8" r="5" stroke={color} strokeWidth="1.2" fill="none"/>,
    card: <rect x="2" y="4" width="12" height="8" rx="1.5" stroke={color} strokeWidth="1.2" fill="none"/>,
  }

  return (
    <div style={{
      width: 36, height: 36, borderRadius: 10,
      background: config.bg, display: 'flex',
      alignItems: 'center', justifyContent: 'center',
      flexShrink: 0,
    }}>
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        {icons[config.icon] ?? icons.card}
      </svg>
    </div>
  )
}

function formatRelativeDate(dateStr: string): string {
  const now = new Date()
  const todayStr = now.toISOString().split('T')[0]
  const yesterdayDate = new Date(now)
  yesterdayDate.setDate(now.getDate() - 1)
  const yesterdayStr = yesterdayDate.toISOString().split('T')[0]

  if (dateStr === todayStr) return 'hoy'
  if (dateStr === yesterdayStr) return 'ayer'
  const date = new Date(dateStr + 'T12:00:00')
  const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24))
  if (diffDays < 7) return `hace ${diffDays} dias`
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
        <span style={{ fontSize: 12, fontWeight: 600, color: '#64748B', letterSpacing: '.05em' }}>
          ÚLTIMOS MOVIMIENTOS
        </span>
        <button
          onClick={onSeeAll}
          style={{ fontSize: 12, color: '#2563EB', fontWeight: 500, background: 'none', border: 'none', cursor: 'pointer' }}
        >
          Ver todos &rarr;
        </button>
      </div>

      <div style={{ background: 'white', border: '0.5px solid #E2E8F0', borderRadius: 12, overflow: 'hidden' }}>
        {recent.length === 0 ? (
          <div style={{ padding: '20px 16px', textAlign: 'center', color: '#94A3B8', fontSize: 14 }}>
            No hay gastos registrados. ¡Agregá el primero!
          </div>
        ) : (
          recent.map((tx, i) => (
            <div key={tx.id} style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '10px 12px',
              borderBottom: i < recent.length - 1 ? '0.5px solid #F1F5F9' : 'none'
            }}>
              <CategoryIcon category={tx.category} />

              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontSize: 14, fontWeight: 500, color: '#1E3A5F',
                  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'
                }}>
                  {tx.description || tx.category}
                </div>
                <div style={{ fontSize: 12, color: '#94A3B8', marginTop: 1 }}>
                  {tx.category} &middot; {formatRelativeDate(tx.date)}
                </div>
              </div>

              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 500, color: '#1E3A5F' }}>
                  {money(tx.amount)}
                </div>
                {tx.source === 'voice' && (
                  <span style={{
                    fontSize: 10, fontWeight: 500, padding: '1px 5px',
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
