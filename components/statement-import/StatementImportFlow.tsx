'use client'
import { useEffect } from 'react'
import { useStatementImport } from '@/hooks/useStatementImport'
import { UploadScreen } from './UploadScreen'
import { ProcessingScreen } from './ProcessingScreen'
import { PhotoProcessingScreen } from './PhotoProcessingScreen'
import { ReviewScreen } from './ReviewScreen'
import { ImportSuccessScreen } from './ImportSuccessScreen'

interface StatementImportFlowProps {
  householdId: string
  onDone: () => void
}

export function StatementImportFlow({ householdId, onDone }: StatementImportFlowProps) {
  const imp = useStatementImport(householdId)

  useEffect(() => {
    if (imp.step === 'idle') imp.startImport()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  if (imp.step === 'idle') return null

  const handleDone = () => {
    imp.closeImport()
    onDone()
  }

  return (
    <>
      {/* Overlay */}
      <div
        onClick={imp.closeImport}
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
          {renderStep()}
        </div>
      </div>

      {/* Panel — desktop right panel */}
      <div className="hidden lg:flex lg:flex-col" style={{
        position: 'fixed', top: 0, right: 0, bottom: 0, width: 420, zIndex: 53,
        background: '#fff', boxShadow: '-8px 0 40px rgba(15,23,42,0.12)',
        overflow: 'hidden',
      }}>
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {renderStep()}
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
          />
        )
      case 'review':
        return (
          <ReviewScreen
            transactions={imp.transactions}
            bankDetected={imp.bankDetected}
            isLoading={imp.isLoading}
            error={imp.error}
            onToggle={imp.toggleTransaction}
            batch={imp.importMode === 'photos' ? imp.batch : null}
            onRemove={imp.deselectTransaction}
            onConfirm={imp.confirmImport}
            onBack={() => imp.startImport()}
          />
        )
      case 'success':
        return imp.stats ? (
          <ImportSuccessScreen stats={imp.stats} onDone={handleDone} />
        ) : null
      default:
        return null
    }
  }
}

export { useStatementImport }
