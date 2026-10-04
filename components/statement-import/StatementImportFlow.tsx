'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useStatementImport } from '@/hooks/useStatementImport'
import { UploadScreen } from './UploadScreen'
import { ProcessingScreen } from './ProcessingScreen'
import { PhotoProcessingScreen } from './PhotoProcessingScreen'
import { ReviewScreen } from './ReviewScreen'
import { ImportSuccessScreen } from './ImportSuccessScreen'
import { UndoToast } from '@/components/transactions/UndoToast'
import { DELETE_UNDO_MS } from '@/lib/transactions/undo-delete'
import { importBannerQuery, type ImportBanner } from '@/lib/motion'
import { useIsMobile } from '@/lib/hooks/useIsMobile'

/** Ya en Movimientos: se pide el banner por evento (no cambia la ruta). */
export const IMPORT_BANNER_EVENT = 'zafi:import-banner'

interface StatementImportFlowProps {
  householdId: string
  /** El flujo terminó (se cerró, o venció o se usó el "Deshacer"). */
  onDone: () => void
  /** Se agregaron o revirtieron movimientos: recargar las listas. */
  onChanged?: () => void
}

export function StatementImportFlow({ householdId, onDone, onChanged }: StatementImportFlowProps) {
  const imp = useStatementImport(householdId)
  const router = useRouter()
  // Solo un panel monta el contenido: si no, el éxito vibra y lanza confeti dos veces.
  const isMobile = useIsMobile()

  useEffect(() => {
    if (imp.step === 'idle') imp.startImport()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Al confirmar, las listas se recargan ya; "Deshacer" queda en el éxito y luego en el toast.
  const confirmed = imp.step === 'success' || imp.step === 'done'
  useEffect(() => {
    if (confirmed) onChanged?.()
  }, [confirmed]) // eslint-disable-line react-hooks/exhaustive-deps

  if (imp.step === 'idle') return null

  const handleDone = () => {
    imp.closeImport()
    onDone()
  }

  /** "Ver movimientos": Movimientos con el banner verde de lo importado. */
  const seeMovements = () => {
    const banner: ImportBanner = {
      count: imp.stats?.imported ?? 0,
      bank: imp.bankDetected,
      month: imp.stats?.month ?? null,
    }
    handleDone()
    if (window.location.pathname === '/transacciones') {
      window.dispatchEvent(new CustomEvent<ImportBanner>(IMPORT_BANNER_EVENT, { detail: banner }))
    } else {
      router.push(`/transacciones?${importBannerQuery(banner)}`)
    }
  }

  // Cerrar el panel en la pantalla de éxito deja el toast con "Deshacer".
  const closePanel = imp.step === 'success' ? imp.showUndoToast : imp.closeImport

  if (imp.step === 'done' && imp.outcome) {
    return (
      <UndoToast
        visible
        title={imp.outcome.text}
        duration={DELETE_UNDO_MS}
        onDismiss={handleDone}
        onUndo={async () => {
          await imp.undoImport()
          onChanged?.()
          handleDone()
        }}
      />
    )
  }

  return (
    <>
      {/* Overlay */}
      <div
        onClick={closePanel}
        style={{
          position: 'fixed', inset: 0, zIndex: 52,
          background: 'rgba(15,23,42,0.5)',
          opacity: 1,
          transition: 'opacity 0.28s ease',
        }}
      />

      {/* Panel — mobile bottom sheet */}
      <div className="flex flex-col lg:hidden" style={{
        position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 53,
        background: '#fff', borderRadius: '20px 20px 0 0',
        boxShadow: '0 -8px 40px rgba(15,23,42,0.15)',
        maxHeight: '92vh',
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
      }}>
        <div style={{ width: 36, height: 4, background: '#CBD5E1', borderRadius: 2, margin: '12px auto 8px', flexShrink: 0 }} />
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {isMobile && renderStep()}
        </div>
      </div>

      {/* Panel — desktop right panel */}
      <div className="hidden lg:flex lg:flex-col" style={{
        position: 'fixed', top: 0, right: 0, bottom: 0, width: 420, zIndex: 53,
        background: '#fff', boxShadow: '-8px 0 40px rgba(15,23,42,0.12)',
        overflow: 'hidden',
      }}>
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {!isMobile && renderStep()}
        </div>
      </div>
    </>
  )

  function renderStep() {
    if (imp.limitReached && imp.limitData) {
      return (
        <div style={{ padding: 24 }}>
          <div style={{
            background: 'linear-gradient(135deg, #1E3A5F 0%, #2563EB 100%)',
            borderRadius: 16, padding: '24px', color: '#fff',
          }}>
            <p style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>
              Importa sin límites con Premium
            </p>
            <p style={{ fontSize: 13, opacity: 0.9, lineHeight: 1.5, marginBottom: 8 }}>
              Usaste tus {imp.limitData.limit} importaciones gratis de este mes.
            </p>
            <p style={{ fontSize: 12, opacity: 0.7, marginBottom: 20 }}>
              Se renuevan el {new Date(imp.limitData.resetsAt).toLocaleDateString('es-GT', { day: 'numeric', month: 'long' })}
            </p>
            <button
              onClick={async () => {
                const res = await fetch('/api/stripe/checkout', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ plan: 'monthly' }),
                })
                const { url } = await res.json()
                if (url) window.location.href = url
              }}
              style={{
                background: '#fff', color: '#1E3A5F',
                border: 'none', borderRadius: 10, padding: '12px 24px',
                fontSize: 14, fontWeight: 700, cursor: 'pointer',
                width: '100%',
              }}
            >
              Pasar a Premium
            </button>
          </div>
          <button
            onClick={imp.closeImport}
            style={{
              width: '100%', marginTop: 12, padding: '10px',
              background: 'none', border: 'none', color: '#64748B',
              fontSize: 13, cursor: 'pointer',
            }}
          >
            Cerrar
          </button>
        </div>
      )
    }

    switch (imp.step) {
      case 'upload':
        return (
          <UploadScreen
            file={imp.file}
            filePreview={imp.filePreview}
            error={imp.error}
            onFileSelect={imp.setFile}
            onAnalyze={imp.processFile}
            photos={imp.photos}
            photoNotice={imp.photoNotice}
            onAddPhotos={imp.addPhotos}
            onRemovePhoto={imp.removePhoto}
            onAnalyzePhotos={imp.processPhotos}
            onBack={imp.closeImport}
            importUsage={imp.importUsage}
          />
        )
      case 'processing':
        // One photo keeps the original single-file experience.
        if (imp.importMode === 'photos' && imp.photos.length > 1) {
          return (
            <PhotoProcessingScreen
              photos={imp.photos}
              isLoading={imp.isLoading}
              error={imp.error}
              onRetry={imp.retryPhoto}
              onRemove={imp.removePhoto}
              onCancel={imp.cancelProcessing}
              onContinue={imp.finalizePhotos}
            />
          )
        }
        return (
          <ProcessingScreen
            bankDetected={imp.bankDetected}
            isLoading={imp.isLoading}
            source={imp.importMode === 'photos' ? 'photo' : 'pdf'}
          />
        )
      case 'review':
        return (
          <ReviewScreen
            transactions={imp.transactions}
            accountLabel={imp.accountLabel}
            alreadyImported={imp.alreadyImported}
            review={imp.review}
            isLoading={imp.isLoading}
            error={imp.error}
            onSame={imp.setSame}
            onSetCategory={imp.setCategory}
            batch={imp.importMode === 'photos' ? imp.batch : null}
            onRemove={imp.deselectTransaction}
            onConfirm={imp.confirmImport}
            onBack={() => imp.startImport()}
            onDone={handleDone}
          />
        )
      case 'success':
        return imp.stats ? (
          <ImportSuccessScreen
            stats={imp.stats}
            onSeeMovements={seeMovements}
            onUndo={async () => {
              await imp.undoImport()
              onChanged?.()
              handleDone()
            }}
          />
        ) : null
      default:
        return null
    }
  }
}

export { useStatementImport }
