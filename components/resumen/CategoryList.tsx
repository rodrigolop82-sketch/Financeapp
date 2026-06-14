'use client'
import { formatMoney } from '@/lib/format'
import type { CategoryExecution } from '@/hooks/useMonthExecution'

const CATEGORY_ICONS: Record<string, string> = {
  'Vivienda/alquiler': '🏠', 'Alimentación': '🛒', 'Transporte': '🚗',
  'Salud/medicinas': '💊', 'Servicios': '⚡', 'Educación': '📚',
  'Restaurantes y salidas': '🍽️', 'Ropa': '👕', 'Entretenimiento': '🎬',
  'Suscripciones': '📱', 'Varios personales': '💼', 'Fondo de emergencia': '🛡️',
  'Ahorro para metas': '🎯', 'Pago extra de deudas': '💳',
}

interface CategoryListProps {
  categories: CategoryExecution[]
}

const STATUS_LABELS: Record<string, string> = { ok: 'OK', near: 'Atención', over: 'Excedido', savings_over: '¡Superado!' }
const STATUS_COLORS: Record<string, string> = { ok: '#10B981', near: '#F59E0B', over: '#EF4444', savings_over: '#10B981' }
const BAR_COLORS: Record<string, string> = { ok: '#2563EB', near: '#F59E0B', over: '#EF4444', savings_over: '#10B981' }

export function CategoryList({ categories }: CategoryListProps) {
  const visible = categories.filter((c) => c.budgeted_amount > 0 || c.spentAmount > 0)

  if (visible.length === 0) {
    return (
      <div style={{ margin: '0 16px 16px', padding: '20px', textAlign: 'center', color: '#94A3B8', fontSize: 14 }}>
        No hay categorías con actividad este mes
      </div>
    )
  }

  return (
    <div style={{ margin: '0 16px 16px' }}>
      <p style={{ fontSize: 13, fontWeight: 700, color: '#64748B', margin: '0 0 10px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
        Categorías
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {visible.map((cat) => (
          <div key={cat.id} style={{ background: '#F8FAFC', borderRadius: 12, padding: '12px 14px', border: '1px solid #E2E8F0' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: cat.budgeted_amount > 0 ? 8 : 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                <span style={{ fontSize: 16 }}>{CATEGORY_ICONS[cat.name] ?? '📋'}</span>
                <span style={{ fontSize: 13, fontWeight: 600, color: '#1E3A5F', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {cat.name}
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0, marginLeft: 8 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: '#1E3A5F', fontFamily: 'Outfit, sans-serif' }}>
                  {formatMoney(cat.spentAmount)}
                </span>
                {cat.budgeted_amount > 0 && (
                  <span style={{
                    fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20,
                    background: STATUS_COLORS[cat.status] + '18',
                    color: STATUS_COLORS[cat.status],
                  }}>
                    {STATUS_LABELS[cat.status]}
                  </span>
                )}
              </div>
            </div>
            {cat.budgeted_amount > 0 && (
              <>
                <div style={{ height: 4, background: '#E2E8F0', borderRadius: 2, overflow: 'hidden' }}>
                  <div style={{
                    height: '100%', borderRadius: 2,
                    width: `${Math.min(cat.percentage, 100)}%`,
                    background: BAR_COLORS[cat.status],
                    transition: 'width 0.3s ease',
                  }} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 4 }}>
                  <span style={{ fontSize: 11, color: '#94A3B8' }}>
                    {formatMoney(cat.spentAmount)} / {formatMoney(cat.budgeted_amount)}
                  </span>
                </div>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
