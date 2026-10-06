'use client'
import { useRef, useState } from 'react'
import { FileUp, X } from 'lucide-react'
import type { ImportPhoto } from '@/hooks/useStatementImport'
import { MAX_IMPORT_IMAGES } from '@/lib/import/constants'
import {
  BADGE_NEUTRAL, Chevron, ErrorBox, GroupTitle, LINK_TEXT, ListCard, PILL_OUTLINE, PillButton, ROW_DIVIDER, RowBody,
  Segmented, Tile,
} from '@/components/layout/Pantalla'
import { PRIMARY_BUTTON, TEXT_MUTED, TEXT_STRONG } from '@/components/movimientos/ui'
import { Note } from '@/components/plan/ui'

interface UploadScreenProps {
  file: File | null
  filePreview: string | null
  error: string | null
  onFileSelect: (file: File) => void
  onAnalyze: () => void
  photos: ImportPhoto[]
  photoNotice: string | null
  onAddPhotos: (files: File[]) => void
  onRemovePhoto: (id: string) => void
  onAnalyzePhotos: () => void
  onBack: () => void
  importUsage?: { used: number; limit: number } | null
}

const BANKS = ['Banrural', 'BAM', 'Industrial', 'G&T', 'Bantrab', 'BAC Credomatic']

export function UploadScreen({
  file, error, onFileSelect, onAnalyze, onBack, importUsage,
  photos, photoNotice, onAddPhotos, onRemovePhoto, onAnalyzePhotos,
}: UploadScreenProps) {
  const [mode, setMode] = useState<'photo' | 'pdf'>(file && photos.length === 0 ? 'pdf' : 'photo')
  const cameraRef = useRef<HTMLInputElement>(null)
  const galleryRef = useRef<HTMLInputElement>(null)
  const pdfRef = useRef<HTMLInputElement>(null)

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    e.target.value = ''
    if (f) onFileSelect(f)
  }

  function handlePhotosChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    // Reset so picking the same file again still fires onChange.
    e.target.value = ''
    if (files.length > 0) onAddPhotos(files)
  }

  const photoCount = photos.length
  const atMax = photoCount >= MAX_IMPORT_IMAGES
  const canAnalyze = mode === 'photo' ? photoCount > 0 : !!file
  const lowUsage = importUsage ? importUsage.limit - importUsage.used <= 1 : false

  return (
    <div className="flex flex-col px-5 pb-8 [&>*]:shrink-0">
      {/* Encabezado: "‹ Movimientos" cierra el flujo */}
      <div className="flex flex-col items-start gap-0.5">
        <button type="button" onClick={onBack} className={`flex h-11 items-center text-[15px] font-semibold ${LINK_TEXT}`}>‹ Movimientos</button>
        <h1 tabIndex={-1} className={`font-serif text-[30px] leading-[1.15] outline-none ${TEXT_STRONG}`}>Importar estado de cuenta</h1>
        {importUsage && (
          <p className={`mt-1 text-[13px] ${TEXT_MUTED}`}>
            Importaciones gratis este mes:{' '}
            <b className={`font-outfit ${lowUsage ? 'text-danger-text dark:text-[var(--zafi-error-text)]' : TEXT_STRONG}`}>
              {importUsage.used} de {importUsage.limit}
            </b>
          </p>
        )}
      </div>

      <div className="mt-3.5">
        <Segmented
          label="Tipo de archivo"
          options={[{ value: 'photo', label: 'Foto' }, { value: 'pdf', label: 'PDF' }]}
          value={mode}
          onChange={setMode}
        />
      </div>

      {/* Camera: one photo at a time (capture blocks multi-select). Gallery: multi-select. */}
      <input ref={cameraRef} type="file" accept="image/*" capture="environment" onChange={handlePhotosChange} className="hidden" />
      <input ref={galleryRef} type="file" accept="image/*" multiple onChange={handlePhotosChange} className="hidden" />
      <input ref={pdfRef} type="file" accept="application/pdf,.pdf" onChange={handleFileChange} className="hidden" />

      <div className="mt-3.5">
        {mode === 'photo' ? (
          photoCount > 0 ? (
            <PhotoGrid
              photos={photos}
              atMax={atMax}
              onRemove={onRemovePhoto}
              onCamera={() => cameraRef.current?.click()}
              onGallery={() => galleryRef.current?.click()}
            />
          ) : (
            <ListCard>
              <PickRow tile="📷" name="Tomar foto" help="Usa la cámara para capturar el estado de cuenta" onClick={() => cameraRef.current?.click()} />
              <PickRow tile="🖼️" name="Elegir de galería" help={`Hasta ${MAX_IMPORT_IMAGES} capturas o fotos en una sola importación`} onClick={() => galleryRef.current?.click()} />
            </ListCard>
          )
        ) : file ? (
          <ListCard>
            <div className="flex min-h-16 items-center gap-3 py-2.5">
              <RowBody tile={<Tile>📄</Tile>} name={file.name} help={`${(file.size / 1024).toFixed(0)} KB`} />
              <PillButton className={PILL_OUTLINE} onClick={() => pdfRef.current?.click()}>Cambiar</PillButton>
            </div>
          </ListCard>
        ) : (
          <button
            type="button"
            onClick={() => pdfRef.current?.click()}
            className="flex w-full flex-col items-center gap-2 rounded-2xl border-[1.5px] border-dashed border-electric-soft bg-[var(--zafi-card)] py-7 transition duration-150 active:scale-[0.98]"
          >
            <span aria-hidden className="flex h-12 w-12 items-center justify-center rounded-xl bg-electric-ghost text-electric dark:bg-[#1B2B4D] dark:text-electric-soft">
              <FileUp size={22} />
            </span>
            <span className={`text-[15px] font-semibold ${TEXT_STRONG}`}>Seleccionar PDF</span>
            <span className={`text-[13px] ${TEXT_MUTED}`}>Máximo 10 MB</span>
          </button>
        )}
      </div>

      {mode === 'photo' && photoNotice && <Note tone="warn">{photoNotice}</Note>}
      {error && <div className="mt-3"><ErrorBox>{error}</ErrorBox></div>}

      <GroupTitle>Bancos soportados</GroupTitle>
      <div className="flex flex-wrap gap-1.5">
        {BANKS.map((b) => (
          <span key={b} className={`${BADGE_NEUTRAL} !px-2.5 !py-1 !text-[12.5px] !font-semibold`}>{b}</span>
        ))}
      </div>

      <Note tone="info" className="mt-4">
        Para mejores resultados, usa buena luz y que el texto se lea bien. Los PDF suelen funcionar mejor.
      </Note>

      <button
        type="button"
        onClick={mode === 'photo' ? onAnalyzePhotos : onAnalyze}
        disabled={!canAnalyze}
        className={`mt-4 ${PRIMARY_BUTTON}`}
      >
        {mode === 'photo' && photoCount > 1 ? `Analizar ${photoCount} fotos` : 'Analizar'}
      </button>
      {canAnalyze && mode === 'photo' && photoCount > 1 && importUsage && (
        <p className={`mt-2 text-center text-[13px] ${TEXT_MUTED}`}>Todas las fotos cuentan como una sola importación.</p>
      )}
    </div>
  )
}

function PickRow({ tile, name, help, onClick }: { tile: string; name: string; help: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className={`flex min-h-16 w-full items-center gap-3 py-2.5 transition duration-150 active:scale-[0.98] ${ROW_DIVIDER}`}>
      <RowBody tile={<Tile>{tile}</Tile>} name={name} help={help} />
      <Chevron />
    </button>
  )
}

interface PhotoGridProps {
  photos: ImportPhoto[]
  atMax: boolean
  onRemove: (id: string) => void
  onCamera: () => void
  onGallery: () => void
}

function PhotoGrid({ photos, atMax, onRemove, onCamera, onGallery }: PhotoGridProps) {
  return (
    <section className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between pr-1">
        <GroupTitle className="">Fotos seleccionadas</GroupTitle>
        <span className={`font-outfit text-[13px] font-bold ${TEXT_MUTED}`}>{photos.length} de {MAX_IMPORT_IMAGES}</span>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {photos.map((p, i) => (
          <div key={p.id} className="relative aspect-[3/4] overflow-hidden rounded-xl border border-navy/[0.08] bg-[var(--zafi-border)] dark:border-white/[0.06]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={p.previewUrl} alt={`Foto ${i + 1}`} className="h-full w-full object-cover" />
            <span className="absolute left-1.5 top-1.5 flex h-[22px] min-w-[22px] items-center justify-center rounded-full bg-navy px-1.5 font-outfit text-xs font-bold text-white">
              {i + 1}
            </span>
            <button
              type="button"
              onClick={() => onRemove(p.id)}
              aria-label={`Quitar foto ${i + 1}`}
              className="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-navy-deep/70 text-white"
            >
              <X size={14} />
            </button>
          </div>
        ))}
      </div>
      <div className="flex gap-1.5">
        <PillButton className={PILL_OUTLINE} onClick={onCamera} disabled={atMax}>+ Tomar otra</PillButton>
        <PillButton className={PILL_OUTLINE} onClick={onGallery} disabled={atMax}>Elegir de galería</PillButton>
      </div>
      {atMax && <p className={`text-center text-[13px] ${TEXT_MUTED}`}>Máximo {MAX_IMPORT_IMAGES} fotos por importación.</p>}
    </section>
  )
}
