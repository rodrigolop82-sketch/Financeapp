'use client'
import { AlertTriangle, Check } from 'lucide-react'
import type { ImportPhoto } from '@/hooks/useStatementImport'
import { ErrorBox, ListCard, PILL_OUTLINE, PillButton, ROW_DIVIDER } from '@/components/layout/Pantalla'
import { PRIMARY_BUTTON, TEXT_FAINT, TEXT_MUTED, TEXT_STRONG } from '@/components/movimientos/ui'
import { GREEN_TEXT } from '@/components/resumen/ctf-ui'

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
    <div className="flex flex-col gap-3.5 px-5 pb-8 pt-2" role="status" aria-live="polite">
      <div className="flex flex-col gap-2">
        <h2 tabIndex={-1} className={`font-serif text-[24px] leading-tight outline-none ${TEXT_STRONG}`}>{title}</h2>
        <div
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={total}
          aria-valuenow={settled}
          className="h-2 overflow-hidden rounded-[5px] bg-[var(--zafi-border-light)]"
        >
          <div className="h-full rounded-[5px] bg-electric transition-[width] duration-300" style={{ width: `${progress}%` }} />
        </div>
        <p className={`font-outfit text-[13px] ${TEXT_MUTED}`}>{settled} de {total} fotos</p>
      </div>

      <ListCard>
        {photos.map((p, i) => (
          <div key={p.id} className={`flex items-center gap-3 py-2.5 ${ROW_DIVIDER}`}>
            <div className="relative h-14 w-11 flex-none overflow-hidden rounded-lg bg-[var(--zafi-border)]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.previewUrl} alt={`Foto ${i + 1}`} className="h-full w-full object-cover" />
            </div>
            <div className="flex min-w-0 flex-1 flex-col">
              <span className={`text-[15px] font-semibold ${TEXT_STRONG}`}>Foto {i + 1}</span>
              <PhotoStatusLine photo={p} />
              {p.status === 'error' && !isLoading && (
                <div className="flex gap-1.5">
                  <PillButton onClick={() => onRetry(p.id)}>Reintentar</PillButton>
                  <PillButton className={PILL_OUTLINE} onClick={() => onRemove(p.id)}>Quitar</PillButton>
                </div>
              )}
            </div>
          </div>
        ))}
      </ListCard>

      {error && <ErrorBox>{error}</ErrorBox>}

      <div className="flex flex-col gap-2">
        {!inFlight && failed > 0 && done > 0 && (
          <button type="button" onClick={onContinue} disabled={isLoading} className={PRIMARY_BUTTON}>
            {isLoading ? 'Preparando…' : `Continuar con ${done} foto${done === 1 ? '' : 's'}`}
          </button>
        )}
        <button type="button" onClick={onCancel} className={`h-11 text-[15px] font-semibold ${TEXT_MUTED}`}>
          Cancelar
        </button>
      </div>
    </div>
  )
}

function PhotoStatusLine({ photo }: { photo: ImportPhoto }) {
  const base = 'flex items-center gap-1.5 text-[13px]'
  switch (photo.status) {
    case 'queued':
      return <span className={`${base} ${TEXT_FAINT}`}>En espera</span>
    case 'analyzing':
      return (
        <span className={`${base} text-electric-dark dark:text-electric-soft`}>
          <span aria-hidden className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-electric-ghost border-t-electric" />
          Analizando…
        </span>
      )
    case 'done':
      return (
        <span className={`${base} ${GREEN_TEXT}`}>
          <Check size={13} strokeWidth={3} />
          Listo · <span className="font-outfit">{photo.txCount ?? 0}</span> movimiento{photo.txCount === 1 ? '' : 's'}
        </span>
      )
    case 'error':
      return (
        <span className={`${base} items-start text-danger-text dark:text-[var(--zafi-error-text)]`}>
          <AlertTriangle size={13} className="mt-0.5 flex-none" />
          <span>{photo.error ?? 'No se pudo leer la foto'}</span>
        </span>
      )
  }
}
