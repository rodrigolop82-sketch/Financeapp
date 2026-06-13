'use client'
import { useStatementImport } from '@/hooks/useStatementImport'
import { UploadScreen } from './UploadScreen'
import { ProcessingScreen } from './ProcessingScreen'
import { ReviewScreen } from './ReviewScreen'
import { ImportSuccessScreen } from './ImportSuccessScreen'

interface StatementImportFlowProps {
  householdId: string
  onDone: () => void
}

export function StatementImportFlow({ householdId, onDone }: StatementImportFlowProps) {
  const imp = useStatementImport(householdId)

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

      {/* Panel — mobile bottom sheet, desktop right panel */}
      <div className="md:hidden" style={{
        position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 53,
        background: '#fff', borderRadius: '20px 20px 0 0',
        boxShadow: '0 -8px 40px rgba(15,23,42,0.15)',
        maxHeight: '92vh', display: 'flex', flexDirection: 'column',
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
        transform: 'translateY(0)',
        transition: 'transform 0.28s cubic-bezier(0.32,0,0,1)',
      }}>
        <div style={{ width: 36, height: 4, background: '#CBD5E1', borderRadius: 2, margin: '12px auto 8px', flexShrink: 0 }} />
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {renderStep()}
        </div>
      </div>

      <div className="hidden md:block" style={{
        position: 'fixed', top: 0, right: 0, bottom: 0, width: 420, zIndex: 53,
        background: '#fff', boxShadow: '-8px 0 40px rgba(15,23,42,0.12)',
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
      }}>
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {renderStep()}
        </div>
      </div>
    </>
  )

  function renderStep() {
    switch (imp.step) {
      case 'upload':
        return (
          <UploadScreen
            file={imp.file}
            filePreview={imp.filePreview}
            error={imp.error}
            onFileSelect={imp.setFile}
            onAnalyze={imp.processFile}
            onBack={imp.closeImport}
          />
        )
      case 'processing':
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
            onToggle={imp.toggleTransaction}
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
