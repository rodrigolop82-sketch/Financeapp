'use client'
import { AlertTriangle, Check, RotateCw, X } from 'lucide-react'
import type { ImportPhoto } from '@/hooks/useStatementImport'

interface PhotoProcessingScreenProps {
  photos: ImportPhoto[]
  isLoading: boolean
  error: string | null
  onRetry: (id: string) => void
  onRemove: (id: string) => void
  onCancel: () => void
  onContinue: () => void
}

export function PhotoProcessingScreen({
  photos, isLoading, error, onRetry, onRemove, onCancel, onContinue,
}: PhotoProcessingScreenProps) {
  const total = photos.length
  const settled = photos.filter(p => p.status === 'done' || p.status === 'error').length
  const done = photos.filter(p => p.status === 'done').length
  const failed = photos.filter(p => p.status === 'error').length
  const inFlight = settled < total
  const current = Math.min(total, settled + 1)
  const progress = total > 0 ? Math.round((settled / total) * 100) : 0

  const title = inFlight
    ? `Analizando ${current} de ${total}…`
    : failed > 0
      ? (failed === 1 ? '1 foto no se pudo analizar' : `${failed} fotos no se pudieron analizar`)
      : 'Preparando la revisión…'

  return (
    <div style={{ padding: '8px 20px 32px', animation: 'zafiFadeIn 0.3s ease' }}>
      <h3 style={{ fontSize: 17, fontWeight: 700, color: '#1E3A5F', margin: '0 0 12px', fontFamily: 'DM Serif Display, serif' }}>
        {title}
      </h3>

      {/* Global progress */}
      <div
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={settled}
        style={{ height: 8, borderRadius: 4, background: '#E2E8F0', overflow: 'hidden', marginBottom: 6 }}
      >
        <div style={{
          width: `${progress}%`, height: '100%', borderRadius: 4,
          background: 'linear-gradient(90deg, #1E3A5F, #2563EB)',
          transition: 'width 0.3s ease',
        }} />
      </div>
      <p style={{ fontSize: 12, color: '#64748B', margin: '0 0 16px', fontFamily: 'Outfit, sans-serif' }}>
        {settled} de {total} fotos
      </p>

      {/* Per-photo status */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {photos.map((p, i) => (
          <div key={p.id} style={{
            display: 'flex', alignItems: 'center', gap: 12,
            padding: 8, borderRadius: 12,
            border: `1.5px solid ${p.status === 'error' ? '#FECACA' : '#E2E8F0'}`,
            background: p.status === 'error' ? '#FEF2F2' : '#fff',
          }}>
            <div style={{ position: 'relative', width: 44, height: 56, borderRadius: 8, overflow: 'hidden', flexShrink: 0, background: '#F1F5F9' }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.previewUrl} alt={`Foto ${i + 1}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            </div>

            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontSize: 13, fontWeight: 600, color: '#1E3A5F', margin: 0 }}>Foto {i + 1}</p>
              <PhotoStatusLine photo={p} />
              {p.status === 'error' && !isLoading && (
                <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                  <button onClick={() => onRetry(p.id)} style={smallButton('#2563EB', '#EFF6FF')}>
                    <RotateCw size={13} /> Reintentar
                  </button>
                  <button onClick={() => onRemove(p.id)} style={smallButton('#64748B', '#F1F5F9')}>
                    <X size={13} /> Quitar
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {error && (
        <div style={{
          marginTop: 12, padding: '10px 14px',
          background: '#FEF2F2', border: '1px solid #FECACA',
          borderRadius: 10, fontSize: 13, color: '#991B1B',
        }}>
          {error}
        </div>
      )}

      {/* Actions */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 20 }}>
        {!inFlight && failed > 0 && done > 0 && (
          <button
            onClick={onContinue}
            disabled={isLoading}
            style={{
              width: '100%', padding: '14px 20px',
              background: '#2563EB', color: '#fff',
              border: 'none', borderRadius: 12,
              fontSize: 15, fontWeight: 600, cursor: 'pointer',
              boxShadow: '0 4px 14px rgba(37,99,235,0.25)',
            }}
          >
            {isLoading ? 'Preparando…' : `Continuar con ${done} foto${done === 1 ? '' : 's'} →`}
          </button>
        )}
        <button
          onClick={onCancel}
          style={{
            width: '100%', padding: '12px 20px',
            background: 'none', border: '1.5px solid #E2E8F0', borderRadius: 12,
            color: '#64748B', fontSize: 14, fontWeight: 600, cursor: 'pointer',
          }}
        >
          Cancelar
        </button>
      </div>

      <style>{`
        @keyframes zafiSpin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  )
}

function PhotoStatusLine({ photo }: { photo: ImportPhoto }) {
  const base: React.CSSProperties = { fontSize: 12, margin: '2px 0 0', display: 'flex', alignItems: 'center', gap: 6 }
  switch (photo.status) {
    case 'queued':
      return <p style={{ ...base, color: '#94A3B8' }}>En espera</p>
    case 'analyzing':
      return (
        <p style={{ ...base, color: '#2563EB' }}>
          <span style={{
            width: 12, height: 12, borderRadius: '50%',
            border: '2px solid #DBEAFE', borderTopColor: '#2563EB',
            animation: 'zafiSpin 1s linear infinite', display: 'inline-block',
          }} />
          Analizando…
        </p>
      )
    case 'done':
      return (
        <p style={{ ...base, color: '#059669' }}>
          <Check size={13} strokeWidth={3} />
          Listo · <span style={{ fontFamily: 'Outfit, sans-serif' }}>{photo.txCount ?? 0}</span> transacci{photo.txCount === 1 ? 'ón' : 'ones'}
        </p>
      )
    case 'error':
      return (
        <p style={{ ...base, color: '#B91C1C', alignItems: 'flex-start' }}>
          <AlertTriangle size={13} style={{ flexShrink: 0, marginTop: 1 }} />
          <span>{photo.error ?? 'Error al procesar la foto'}</span>
        </p>
      )
  }
}

function smallButton(color: string, background: string): React.CSSProperties {
  return {
    display: 'flex', alignItems: 'center', gap: 4,
    padding: '6px 10px', borderRadius: 8,
    border: 'none', background, color,
    fontSize: 12, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap',
  }
}
