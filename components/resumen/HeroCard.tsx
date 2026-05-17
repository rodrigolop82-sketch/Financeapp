'use client'
import { formatMoney } from '@/lib/format'

interface HeroCardProps {
  spent: number
  budget: number
  daysLeft: number
  daysInMonth: number
}

export function HeroCard({ spent, budget, daysLeft, daysInMonth }: HeroCardProps) {
  const pct = budget > 0 ? Math.min(spent / budget * 100, 100) : 0
  const remaining = budget - spent
  const isOver = remaining < 0
  const statusLabel = isOver ? 'Excedido' : pct >= 90 ? 'Crítico' : pct >= 70 ? 'Atención' : 'En control'
  const statusColor = isOver ? '#EF4444' : pct >= 90 ? '#F59E0B' : pct >= 70 ? '#F59E0B' : '#10B981'
  const barColor = isOver ? '#EF4444' : pct >= 90 ? '#F59E0B' : pct >= 70 ? '#F59E0B' : '#34D399'

  return (
    <div style={{
      margin: '0 16px 16px',
      background: 'linear-gradient(135deg, #0F1F36 0%, #1E3A5F 100%)',
      borderRadius: 20,
      padding: '20px 20px 22px',
      color: '#fff',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
        <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.55)', fontWeight: 500 }}>
          Gasto del mes
        </span>
        <span style={{
          fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20,
          background: statusColor + '22', color: statusColor, border: `1px solid ${statusColor}44`,
        }}>
          {statusLabel}
        </span>
      </div>

      <p style={{ fontSize: 36, fontWeight: 800, margin: '0 0 2px', fontFamily: 'Outfit, sans-serif', letterSpacing: '-0.5px' }}>
        {formatMoney(spent)}
      </p>
      <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.45)', margin: '0 0 16px' }}>
        de {formatMoney(budget)} presupuestado
      </p>

      {/* Progress bar */}
      <div style={{ height: 6, background: 'rgba(255,255,255,0.12)', borderRadius: 3, overflow: 'hidden', marginBottom: 12 }}>
        <div style={{ height: '100%', width: `${pct}%`, background: barColor, borderRadius: 3, transition: 'width 0.4s ease' }} />
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)' }}>
          {isOver ? `Excedido ${formatMoney(Math.abs(remaining))}` : `Disponible ${formatMoney(remaining)}`}
        </span>
        <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)' }}>
          {daysLeft} días restantes
        </span>
      </div>
    </div>
  )
}
