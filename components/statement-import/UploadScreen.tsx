'use client'
import { useRef, useState } from 'react'
import { Upload, Camera, FileText, Image, X, ChevronLeft } from 'lucide-react'
import type { ImportPhoto } from '@/hooks/useStatementImport'
import { MAX_IMPORT_IMAGES } from '@/lib/import/constants'

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
  file, filePreview, error, onFileSelect, onAnalyze, onBack, importUsage,
  photos, photoNotice, onAddPhotos, onRemovePhoto, onAnalyzePhotos,
}: UploadScreenProps) {
  const [mode, setMode] = useState<'photo' | 'pdf'>(file && photos.length === 0 ? 'pdf' : 'photo')
  const cameraRef = useRef<HTMLInputElement>(null)
  const galleryRef = useRef<HTMLInputElement>(null)
  const pdfRef = useRef<HTMLInputElement>(null)

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
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

  return (
    <div style={{ padding: '0 20px 32px', animation: 'zafiFadeIn 0.3s ease' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20 }}>
        <button onClick={onBack} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: '#64748B' }}>
          <ChevronLeft size={20} />
        </button>
        <h2 style={{ fontSize: 17, fontWeight: 700, color: '#1E3A5F', margin: 0, fontFamily: 'DM Serif Display, serif' }}>
          Importar estado de cuenta
        </h2>
      </div>

      {/* Usage counter for free users */}
      {importUsage && (
        <p style={{
          fontSize: 12,
          color: importUsage.limit - importUsage.used <= 1 ? '#EF4444' : '#8B9AAE',
          textAlign: 'center', marginBottom: 12,
        }}>
          Importaciones gratis este mes: {importUsage.used} de {importUsage.limit}
        </p>
      )}

      {/* Mode toggle */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
        {(['photo', 'pdf'] as const).map(key => {
          const label = key === 'photo' ? 'Foto' : 'PDF'
          const Icon = key === 'photo' ? Camera : FileText
          return (
            <button
              key={key}
              onClick={() => setMode(key)}
              style={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                padding: '14px 12px',
                borderRadius: 12,
                border: mode === key ? '2px solid #2563EB' : '1.5px solid #E2E8F0',
                background: mode === key ? '#EFF6FF' : '#fff',
                color: mode === key ? '#2563EB' : '#64748B',
                fontWeight: 600,
                fontSize: 14,
                cursor: 'pointer',
                transition: 'all 0.2s ease',
              }}
            >
              <Icon size={18} />
              {label}
            </button>
          )
        })}
      </div>

      {/* Hidden file inputs */}
      {/* Camera: one photo at a time (capture blocks multi-select). Gallery: multi-select. */}
      <input ref={cameraRef} type="file" accept="image/*" capture="environment" onChange={handlePhotosChange} style={{ display: 'none' }} />
      <input ref={galleryRef} type="file" accept="image/*" multiple onChange={handlePhotosChange} style={{ display: 'none' }} />
      <input ref={pdfRef} type="file" accept="application/pdf,.pdf" onChange={handleFileChange} style={{ display: 'none' }} />

      {mode === 'photo' && photoCount > 0 ? (
        <PhotoGrid
          photos={photos}
          atMax={atMax}
          onRemove={onRemovePhoto}
          onCamera={() => cameraRef.current?.click()}
          onGallery={() => galleryRef.current?.click()}
        />
      ) : mode === 'photo' || !file ? (
        mode === 'photo' ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <button
              onClick={() => cameraRef.current?.click()}
              style={{
                width: '100%',
                padding: '24px 20px',
                border: '2px dashed #CBD5E1',
                borderRadius: 16,
                background: '#F8FAFC',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 14,
                transition: 'border-color 0.2s ease',
              }}
            >
              <div style={{
                width: 48, height: 48, borderRadius: '50%',
                background: '#EFF6FF', display: 'flex',
                alignItems: 'center', justifyContent: 'center',
                flexShrink: 0,
              }}>
                <Camera size={22} color="#2563EB" />
              </div>
              <div style={{ textAlign: 'left' }}>
                <span style={{ fontSize: 14, fontWeight: 600, color: '#1E3A5F', display: 'block' }}>
                  Tomar foto
                </span>
                <span style={{ fontSize: 12, color: '#64748B' }}>
                  Usa la cámara para capturar el estado de cuenta
                </span>
              </div>
            </button>
            <button
              onClick={() => galleryRef.current?.click()}
              style={{
                width: '100%',
                padding: '24px 20px',
                border: '2px dashed #CBD5E1',
                borderRadius: 16,
                background: '#F8FAFC',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 14,
                transition: 'border-color 0.2s ease',
              }}
            >
              <div style={{
                width: 48, height: 48, borderRadius: '50%',
                background: '#F0FDF4', display: 'flex',
                alignItems: 'center', justifyContent: 'center',
                flexShrink: 0,
              }}>
                <Image size={22} color="#059669" />
              </div>
              <div style={{ textAlign: 'left' }}>
                <span style={{ fontSize: 14, fontWeight: 600, color: '#1E3A5F', display: 'block' }}>
                  Elegir de galería
                </span>
                <span style={{ fontSize: 12, color: '#64748B' }}>
                  Hasta {MAX_IMPORT_IMAGES} capturas o fotos en una sola importación
                </span>
              </div>
            </button>
          </div>
        ) : (
          <button
            onClick={() => pdfRef.current?.click()}
            style={{
              width: '100%',
              padding: '40px 20px',
              border: '2px dashed #CBD5E1',
              borderRadius: 16,
              background: '#F8FAFC',
              cursor: 'pointer',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 12,
              transition: 'border-color 0.2s ease',
            }}
          >
            <div style={{
              width: 56, height: 56, borderRadius: '50%',
              background: '#EFF6FF', display: 'flex',
              alignItems: 'center', justifyContent: 'center',
            }}>
              <Upload size={24} color="#2563EB" />
            </div>
            <span style={{ fontSize: 14, fontWeight: 600, color: '#1E3A5F' }}>
              Seleccionar archivo PDF
            </span>
            <span style={{ fontSize: 12, color: '#64748B' }}>
              Máximo 10MB · PDF
            </span>
          </button>
        )
      ) : (
        <div style={{
          padding: 16,
          border: '1.5px solid #2563EB',
          borderRadius: 14,
          background: '#EFF6FF',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
        }}>
          {filePreview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={filePreview}
              alt="Preview"
              style={{ width: 56, height: 56, borderRadius: 8, objectFit: 'cover' }}
            />
          ) : (
            <div style={{
              width: 56, height: 56, borderRadius: 8, background: '#DBEAFE',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <FileText size={24} color="#2563EB" />
            </div>
          )}
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontSize: 13, fontWeight: 600, color: '#1E3A5F', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {file.name}
            </p>
            <p style={{ fontSize: 11, color: '#64748B', margin: '2px 0 0' }}>
              {(file.size / 1024).toFixed(0)} KB
            </p>
          </div>
          <button
            onClick={() => pdfRef.current?.click()}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: '#64748B' }}
          >
            <X size={18} />
          </button>
        </div>
      )}

      {/* Selection notice (e.g. photos over the limit) */}
      {mode === 'photo' && photoNotice && (
        <div style={{
          marginTop: 12, padding: '10px 14px',
          background: '#FFFBEB', border: '1px solid #FDE68A',
          borderRadius: 10, fontSize: 13, color: '#92400E',
        }}>
          {photoNotice}
        </div>
      )}

      {/* Error */}
      {error && (
        <div style={{
          marginTop: 12, padding: '10px 14px',
          background: '#FEF2F2', border: '1px solid #FECACA',
          borderRadius: 10, fontSize: 13, color: '#991B1B',
        }}>
          {error}
        </div>
      )}

      {/* Bank chips */}
      <div style={{ marginTop: 20 }}>
        <p style={{ fontSize: 11, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>
          Bancos soportados
        </p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {BANKS.map(b => (
            <span key={b} style={{
              padding: '4px 10px', borderRadius: 20,
              background: '#F1F5F9', fontSize: 11, color: '#475569', fontWeight: 500,
            }}>
              {b}
            </span>
          ))}
        </div>
      </div>

      {/* Tip */}
      <div style={{
        marginTop: 16, padding: '12px 14px',
        background: '#F0FDF4', borderRadius: 10,
        border: '1px solid #BBF7D0',
      }}>
        <p style={{ fontSize: 12, color: '#065F46', margin: 0, lineHeight: 1.5 }}>
          💡 Para mejores resultados, asegúrate de que la foto esté bien iluminada y el texto sea legible. Los PDFs suelen dar mejores resultados.
        </p>
      </div>

      {/* Analyze button */}
      {canAnalyze && (
        <button
          onClick={mode === 'photo' ? onAnalyzePhotos : onAnalyze}
          style={{
            width: '100%',
            marginTop: 20,
            padding: '14px 20px',
            background: '#2563EB',
            color: '#fff',
            border: 'none',
            borderRadius: 12,
            fontSize: 15,
            fontWeight: 600,
            cursor: 'pointer',
            boxShadow: '0 4px 14px rgba(37,99,235,0.25)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
          }}
        >
          {mode === 'photo' && photoCount > 1 ? `✨ Analizar ${photoCount} fotos` : '✨ Analizar con IA'}
        </button>
      )}
      {canAnalyze && mode === 'photo' && photoCount > 1 && importUsage && (
        <p style={{ fontSize: 11, color: '#8B9AAE', textAlign: 'center', marginTop: 8 }}>
          Todas las fotos cuentan como una sola importación.
        </p>
      )}
    </div>
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
  const addButtonStyle = (disabled: boolean): React.CSSProperties => ({
    flex: 1,
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
    padding: '10px 12px', borderRadius: 10,
    border: '1.5px dashed #CBD5E1',
    background: disabled ? '#F8FAFC' : '#fff',
    color: disabled ? '#94A3B8' : '#1E3A5F',
    fontSize: 13, fontWeight: 600,
    cursor: disabled ? 'not-allowed' : 'pointer',
  })

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 10 }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: '#1E3A5F' }}>Fotos seleccionadas</span>
        <span style={{ fontSize: 12, fontWeight: 600, color: atMax ? '#2563EB' : '#64748B', fontFamily: 'Outfit, sans-serif' }}>
          {photos.length} de {MAX_IMPORT_IMAGES}
        </span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(84px, 1fr))', gap: 8 }}>
        {photos.map((p, i) => (
          <div key={p.id} style={{
            position: 'relative', aspectRatio: '3 / 4', borderRadius: 10, overflow: 'hidden',
            border: '1.5px solid #E2E8F0', background: '#F1F5F9',
          }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={p.previewUrl} alt={`Foto ${i + 1}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            <span style={{
              position: 'absolute', top: 4, left: 4,
              minWidth: 20, height: 20, padding: '0 6px', borderRadius: 10,
              background: '#1E3A5F', color: '#fff',
              fontSize: 11, fontWeight: 700, fontFamily: 'Outfit, sans-serif',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              {i + 1}
            </span>
            <button
              onClick={() => onRemove(p.id)}
              aria-label={`Quitar foto ${i + 1}`}
              style={{
                position: 'absolute', top: 4, right: 4,
                width: 24, height: 24, borderRadius: '50%',
                background: 'rgba(15,23,42,0.65)', border: 'none', color: '#fff',
                display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
              }}
            >
              <X size={14} />
            </button>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
        <button onClick={onCamera} disabled={atMax} style={addButtonStyle(atMax)}>
          <Camera size={16} /> Agregar otra
        </button>
        <button onClick={onGallery} disabled={atMax} style={addButtonStyle(atMax)}>
          <Image size={16} /> Elegir de galería
        </button>
      </div>

      {atMax && (
        <p style={{ fontSize: 12, color: '#64748B', textAlign: 'center', marginTop: 8 }}>
          Máximo {MAX_IMPORT_IMAGES} fotos por importación.
        </p>
      )}
    </div>
  )
}
