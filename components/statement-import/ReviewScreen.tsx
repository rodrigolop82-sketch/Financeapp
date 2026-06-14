'use client'
import { useState } from 'react'
import { ChevronLeft, AlertTriangle, Check } from 'lucide-react'
import { formatMoney } from '@/lib/format'
import type { ExtractedTransaction } from '@/hooks/useStatementImport'

type Filter = 'all' | 'duplicates' | 'expenses' | 'income'

interface ReviewScreenProps {
  transactions: ExtractedTransaction[]
  bankDetected: string | null
  isLoading: boolean
  onToggle: (id: string) => void
  onConfirm: () => void
  onBack: () => void
}

export function ReviewScreen({
  transactions, bankDetected, isLoading,
  onToggle, onConfirm, onBack,
}: ReviewScreenProps) {
  const [filter, setFilter] = useState<Filter>('all')

  const duplicateCount = transactions.filter(t => t.isDuplicate).length
  const selectedCount = transactions.filter(t => t.selected).length
  const totalAmount = transactions.filter(t => t.selected && t.type === 'expense').reduce((s, t) => s + t.amount, 0)

  const filtered = transactions.filter(t => {
    if (filter === 'duplicates') return t.isDuplicate
    if (filter === 'expenses') return t.type === 'expense'
    if (filter === 'income') return t.type === 'income'
    return true
  })

  if (transactions.length === 0) {
    return (
      <div style={{ padding: '40px 24px', textAlign: 'center' }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>📭</div>
        <h3 style={{ fontSize: 17, fontWeight: 700, color: '#1E3A5F', marginBottom: 8 }}>
          No encontramos transacciones
        </h3>
        <p style={{ fontSize: 13, color: '#64748B', marginBottom: 24 }}>
          ¿El archivo es un estado de cuenta bancario?
        </p>
        <button onClick={onBack} style={{
          padding: '12px 28px', borderRadius: 12,
          background: '#2563EB', color: '#fff',
          border: 'none', fontWeight: 600, cursor: 'pointer', fontSize: 14,
        }}>
          Subir otro archivo
        </button>
      </div>
    )
  }

  const filters: { key: Filter; label: string }[] = [
    { key: 'all', label: `Todas (${transactions.length})` },
    { key: 'duplicates', label: `⚠️ Duplicados (${duplicateCount})` },
    { key: 'expenses', label: 'Gastos' },
    { key: 'income', label: 'Ingresos' },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Header */}
      <div style={{ padding: '0 20px', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <button onClick={onBack} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: '#64748B' }}>
            <ChevronLeft size={20} />
          </button>
          <h2 style={{ fontSize: 17, fontWeight: 700, color: '#1E3A5F', margin: 0, fontFamily: 'DM Serif Display, serif' }}>
            Revisar transacciones
          </h2>
        </div>

        {bankDetected && (
          <p style={{ fontSize: 12, color: '#64748B', marginBottom: 12 }}>
            Banco: <strong>{bankDetected}</strong>
          </p>
        )}

        {/* Summary pills */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
          <span style={{ padding: '4px 10px', borderRadius: 20, background: '#EFF6FF', fontSize: 12, color: '#1E40AF', fontWeight: 600 }}>
            {transactions.length} encontradas
          </span>
          {duplicateCount > 0 && (
            <span style={{ padding: '4px 10px', borderRadius: 20, background: '#FFFBEB', fontSize: 12, color: '#92400E', fontWeight: 600 }}>
              {duplicateCount} duplicados
            </span>
          )}
          <span style={{ padding: '4px 10px', borderRadius: 20, background: '#F0FDF4', fontSize: 12, color: '#065F46', fontWeight: 600 }}>
            {formatMoney(totalAmount)} total
          </span>
        </div>

        {/* Filters */}
        <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 12 }}>
          {filters.map(f => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              style={{
                padding: '6px 12px', borderRadius: 20,
                border: filter === f.key ? '1.5px solid #2563EB' : '1.5px solid #E2E8F0',
                background: filter === f.key ? '#EFF6FF' : '#fff',
                fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap',
                color: filter === f.key ? '#2563EB' : '#64748B',
                cursor: 'pointer', transition: 'all 0.15s ease',
              }}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Transaction list */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '0 20px' }}>
        {filtered.map(tx => (
          <button
            key={tx.id}
            onClick={() => onToggle(tx.id)}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '12px 0',
              borderBottom: '1px solid #F1F5F9',
              background: 'none',
              border: 'none',
              borderBottomStyle: 'solid',
              borderBottomWidth: 1,
              borderBottomColor: tx.isDuplicate ? '#FDE68A' : '#F1F5F9',
              opacity: tx.selected ? 1 : 0.45,
              cursor: 'pointer',
              textAlign: 'left',
              transition: 'opacity 0.15s ease',
            }}
          >
            {/* Checkbox */}
            <div style={{
              width: 22, height: 22, borderRadius: 6, flexShrink: 0,
              border: tx.selected ? 'none' : '1.5px solid #CBD5E1',
              background: tx.selected ? '#2563EB' : 'transparent',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              {tx.selected && <Check size={14} color="white" strokeWidth={3} />}
            </div>

            {/* Info */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{
                  fontSize: 13, fontWeight: 600, color: '#1E3A5F',
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                  {tx.description}
                </span>
                {tx.isDuplicate && (
                  <span style={{
                    padding: '1px 6px', borderRadius: 4,
                    background: '#FEF3C7', fontSize: 9, fontWeight: 700,
                    color: '#92400E', flexShrink: 0,
                    display: 'flex', alignItems: 'center', gap: 2,
                  }}>
                    <AlertTriangle size={9} />
                    DUPLICADO
                  </span>
                )}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
                <span style={{ fontSize: 11, color: '#94A3B8' }}>{tx.date}</span>
                <span style={{
                  padding: '1px 6px', borderRadius: 4,
                  background: '#F1F5F9', fontSize: 10, color: '#64748B',
                }}>
                  {tx.suggested_category}
                </span>
              </div>
            </div>

            {/* Amount */}
            <span style={{
              fontSize: 14, fontWeight: 700, flexShrink: 0,
              fontFamily: 'Outfit, sans-serif',
              color: tx.type === 'income' ? '#059669' : '#1E3A5F',
            }}>
              {tx.type === 'income' ? '+' : ''}{formatMoney(tx.amount)}
            </span>
          </button>
        ))}
      </div>

      {/* Confirm button */}
      <div style={{ padding: '16px 20px', flexShrink: 0, borderTop: '1px solid #F1F5F9' }}>
        <button
          onClick={onConfirm}
          disabled={selectedCount === 0 || isLoading}
          style={{
            width: '100%',
            padding: '14px 20px',
            background: selectedCount > 0 ? '#2563EB' : '#CBD5E1',
            color: '#fff',
            border: 'none',
            borderRadius: 12,
            fontSize: 15,
            fontWeight: 600,
            cursor: selectedCount > 0 ? 'pointer' : 'not-allowed',
            boxShadow: selectedCount > 0 ? '0 4px 14px rgba(37,99,235,0.25)' : 'none',
          }}
        >
          {isLoading ? 'Guardando...' : `Importar ${selectedCount} transacciones →`}
        </button>
      </div>
    </div>
  )
}
