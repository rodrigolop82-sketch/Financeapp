'use client'
import { useEffect, useState } from 'react'
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
import { PremiumSheet } from '@/components/premium/PremiumSheet'
import { CardOwnerSheet } from '@/components/hogar/CardOwnerSheet'
import { useHouseholdPeople } from '@/lib/hooks/useHouseholdPeople'
import { createClient } from '@/lib/supabase'

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

  // Hogares de 2: de quién es la tarjeta (se pregunta una vez y se recuerda).
  const household = useHouseholdPeople()
  const [askCard, setAskCard] = useState<string | null>(null)
  const last4 = imp.step === 'review' && household.shared ? imp.accountLast4 : null
  useEffect(() => {
    if (!last4) return
    let alive = true
    createClient()
      .from('card_owners')
      .select('owner_id')
      .eq('household_id', householdId)
      .eq('last4', last4)
      .maybeSingle()
      .then(({ data, error }) => {
        if (!alive || error) return
        if (data) imp.setPaidBy(data.owner_id ?? null)
        else setAskCard(last4)
      })
    return () => { alive = false }
  }, [last4, householdId]) // eslint-disable-line react-hooks/exhaustive-deps

  async function saveCardOwner(ownerId: string | null) {
    const card = askCard
    setAskCard(null)
    imp.setPaidBy(ownerId)
    if (!card) return
    await createClient().from('card_owners').upsert(
      { household_id: householdId, last4: card, owner_id: ownerId, updated_at: new Date().toISOString() },
      { onConflict: 'household_id,last4' },
    )
  }

  // Al confirmar, las listas se recargan ya; "Deshacer" queda en el éxito y luego en el toast.
  const confirmed = imp.step === 'success' || imp.step === 'done'
  useEffect(() => {
    if (confirmed) onChanged?.()
  }, [confirmed]) // eslint-disable-line react-hooks/exhaustive-deps

  if (imp.step === 'idle') return null

  if (imp.limitReached && imp.limitData) {
    return (
      <PremiumSheet
        reason="import"
        open
        onClose={() => { imp.closeImport(); onDone() }}
        used={imp.limitData.used}
        limit={imp.limitData.limit}
      />
    )
  }

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
          background: 'rgba(13,31,54,0.45)',
          opacity: 1,
          transition: 'opacity 0.28s ease',
        }}
      />

      {/* Panel — mobile bottom sheet */}
      <div className="flex flex-col lg:hidden" style={{
        position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 53,
        background: 'var(--zafi-card)', borderRadius: '28px 28px 0 0',
        boxShadow: '0 -8px 40px rgba(15,23,42,0.15)',
        maxHeight: '92vh',
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
      }}>
        <div className="mx-auto mb-1 mt-2.5 h-[5px] w-10 flex-none rounded-full bg-ink-200 dark:bg-white/20" />
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {isMobile && renderStep()}
        </div>
      </div>

      {/* Panel — desktop right panel */}
      <div className="hidden lg:flex lg:flex-col" style={{
        position: 'fixed', top: 0, right: 0, bottom: 0, width: 420, zIndex: 53,
        background: 'var(--zafi-card)', boxShadow: '-8px 0 40px rgba(15,23,42,0.12)',
        overflow: 'hidden',
      }}>
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {!isMobile && renderStep()}
        </div>
      </div>

      {askCard && (
        <div className="relative z-[60]">
          <CardOwnerSheet
            open
            last4={askCard}
            subtitle={[imp.bankDetected, `${imp.transactions.length} movimientos encontrados`].filter(Boolean).join(' · ')}
            count={imp.transactions.filter((t) => t.type === 'expense').length}
            people={household.people}
            defaultId={household.me}
            onDone={(id) => void saveCardOwner(id)}
          />
        </div>
      )}
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
            onToggle={imp.toggleTransaction}
            onSetAllNew={imp.setAllNew}
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
