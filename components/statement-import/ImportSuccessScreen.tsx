'use client'
import { formatMoney } from '@/lib/format'
import type { ImportStats } from '@/hooks/useStatementImport'

interface ImportSuccessScreenProps {
  stats: ImportStats
  onDone: () => void
}

export function ImportSuccessScreen({ stats, onDone }: ImportSuccessScreenProps) {
  return (
    <div style={{
      padding: '48px 24px',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      textAlign: 'center',
      animation: 'zafiFadeIn 0.4s ease',
    }}>
      {/* Success icon */}
      <div style={{
        width: 88, height: 88, borderRadius: '50%',
        background: 'linear-gradient(145deg, #10B981, #059669)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        marginBottom: 24,
        boxShadow: '0 8px 24px rgba(16,185,129,0.3)',
      }}>
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20 6L9 17l-5-5" />
        </svg>
      </div>

      <h2 style={{ fontSize: 22, fontWeight: 700, color: '#1E3A5F', margin: '0 0 8px', fontFamily: 'DM Serif Display, serif' }}>
        ¡Importación exitosa!
      </h2>
      <p style={{ fontSize: 14, color: '#64748B', margin: '0 0 28px' }}>
        Tu análisis financiero es ahora más preciso.
      </p>

      {/* Stats grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr 1fr',
        gap: 12,
        width: '100%',
        maxWidth: 340,
        marginBottom: 32,
      }}>
        <div style={{ padding: 14, background: '#EFF6FF', borderRadius: 12, textAlign: 'center' }}>
          <span style={{ fontSize: 24, fontWeight: 800, color: '#2563EB', fontFamily: 'Outfit, sans-serif', display: 'block' }}>
            {stats.imported}
          </span>
          <span style={{ fontSize: 11, color: '#64748B', fontWeight: 500 }}>importadas</span>
        </div>
        <div style={{ padding: 14, background: '#F0FDF4', borderRadius: 12, textAlign: 'center' }}>
          <span style={{ fontSize: 24, fontWeight: 800, color: '#059669', fontFamily: 'Outfit, sans-serif', display: 'block' }}>
            {formatMoney(stats.totalAmount)}
          </span>
          <span style={{ fontSize: 11, color: '#64748B', fontWeight: 500 }}>en gastos</span>
        </div>
        <div style={{ padding: 14, background: '#FFFBEB', borderRadius: 12, textAlign: 'center' }}>
          <span style={{ fontSize: 24, fontWeight: 800, color: '#D97706', fontFamily: 'Outfit, sans-serif', display: 'block' }}>
            {stats.duplicatesSkipped}
          </span>
          <span style={{ fontSize: 11, color: '#64748B', fontWeight: 500 }}>omitidos</span>
        </div>
      </div>

      <button
        onClick={onDone}
        style={{
          padding: '14px 40px',
          background: '#2563EB',
          color: '#fff',
          border: 'none',
          borderRadius: 12,
          fontSize: 15,
          fontWeight: 600,
          cursor: 'pointer',
          boxShadow: '0 4px 14px rgba(37,99,235,0.25)',
        }}
      >
        Ver mi dashboard →
      </button>

      <style>{`
        @keyframes zafiFadeIn {
          from { opacity: 0; transform: translateY(12px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  )
}
