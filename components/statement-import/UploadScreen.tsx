'use client'
import { useRef, useState } from 'react'
import { Upload, Camera, FileText, X, ChevronLeft } from 'lucide-react'

interface UploadScreenProps {
  file: File | null
  filePreview: string | null
  error: string | null
  onFileSelect: (file: File) => void
  onAnalyze: () => void
  onBack: () => void
}

const BANKS = ['Banrural', 'BAM', 'Industrial', 'G&T', 'Bantrab']

export function UploadScreen({ file, filePreview, error, onFileSelect, onAnalyze, onBack }: UploadScreenProps) {
  const [mode, setMode] = useState<'photo' | 'pdf'>('photo')
  const inputRef = useRef<HTMLInputElement>(null)

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (f) onFileSelect(f)
  }

  const accept = mode === 'photo' ? 'image/*' : 'application/pdf'
  const capture = mode === 'photo' ? 'environment' : undefined

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

      {/* Dropzone */}
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        capture={capture}
        onChange={handleFileChange}
        style={{ display: 'none' }}
      />

      {!file ? (
        <button
          onClick={() => inputRef.current?.click()}
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
            {mode === 'photo' ? 'Tomar foto o seleccionar imagen' : 'Seleccionar archivo PDF'}
          </span>
          <span style={{ fontSize: 12, color: '#94A3B8' }}>
            Máximo 10MB · {mode === 'photo' ? 'JPG, PNG, WebP' : 'PDF'}
          </span>
        </button>
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
            <p style={{ fontSize: 11, color: '#94A3B8', margin: '2px 0 0' }}>
              {(file.size / 1024).toFixed(0)} KB
            </p>
          </div>
          <button
            onClick={() => { inputRef.current?.click() }}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: '#94A3B8' }}
          >
            <X size={18} />
          </button>
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
        <p style={{ fontSize: 11, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>
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
      {file && (
        <button
          onClick={onAnalyze}
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
          ✨ Analizar con IA
        </button>
      )}
    </div>
  )
}
