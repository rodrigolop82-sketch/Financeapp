'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import type { VoiceExtractionResult } from '@/types'

interface VoiceOverlayProps {
  open: boolean
  onClose: () => void
  onResult: (result: VoiceExtractionResult) => void
  onError?: (error: string) => void
}

export function VoiceOverlay({ open, onClose, onResult, onError }: VoiceOverlayProps) {
  const [state, setState] = useState<'idle' | 'recording' | 'processing'>('idle')
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])

  // Auto-start recording when opened
  useEffect(() => {
    if (open && state === 'idle') {
      startRecording()
    }
    return () => {
      // Cleanup on unmount
      if (mediaRecorderRef.current?.state === 'recording') {
        mediaRecorderRef.current.stream.getTracks().forEach(t => t.stop())
        mediaRecorderRef.current.stop()
      }
    }
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/mp4',
      })
      mediaRecorderRef.current = mediaRecorder
      chunksRef.current = []

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data)
      }

      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach(t => t.stop())
        const blob = new Blob(chunksRef.current, { type: mediaRecorder.mimeType })
        await processAudio(blob)
      }

      mediaRecorder.start()
      setState('recording')
    } catch {
      onError?.('No se pudo acceder al micrófono. Verificá los permisos.')
      onClose()
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function processAudio(blob: Blob) {
    setState('processing')
    const formData = new FormData()
    formData.append('audio', blob, 'recording.webm')
    formData.append('mode', 'expense')

    try {
      const res = await fetch('/api/voice', { method: 'POST', body: formData })
      const data = await res.json()

      if (!res.ok) {
        onError?.(data.error || 'Error al procesar el audio')
        setState('idle')
        onClose()
        return
      }

      onResult(data as VoiceExtractionResult)
      setState('idle')
      onClose()
    } catch {
      onError?.('Error de conexión. Intentá de nuevo.')
      setState('idle')
      onClose()
    }
  }

  function handleConfirm() {
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.stop()
    }
  }

  function handleCancel() {
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.stream.getTracks().forEach(t => t.stop())
      mediaRecorderRef.current.stop()
      // Don't process - just close
      mediaRecorderRef.current.onstop = () => {
        mediaRecorderRef.current?.stream.getTracks().forEach(t => t.stop())
      }
    }
    setState('idle')
    onClose()
  }

  if (!open) return null

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 100,
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      background: 'linear-gradient(160deg, #E8D5B7 0%, #E8A87C 25%, #E07A6A 50%, #D4687A 75%, #B8A9C9 100%)',
    }}>
      {/* Content */}
      <div style={{
        flex: 1, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        padding: '40px 32px', textAlign: 'center',
      }}>
        {state === 'processing' ? (
          <>
            <div style={{
              width: 64, height: 64, borderRadius: '50%',
              border: '3px solid rgba(255,255,255,.4)',
              borderTopColor: 'white',
              animation: 'spin 1s linear infinite',
              marginBottom: 32,
            }} />
            <p style={{
              fontSize: 24, fontWeight: 300, color: 'rgba(255,255,255,.85)',
              lineHeight: 1.4,
            }}>
              Procesando...
            </p>
          </>
        ) : (
          <>
            {/* Animated pulse ring */}
            <div style={{
              width: 80, height: 80, borderRadius: '50%',
              background: 'rgba(255,255,255,.15)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              marginBottom: 40,
              animation: 'pulse 2s ease-in-out infinite',
            }}>
              <div style={{
                width: 48, height: 48, borderRadius: '50%',
                background: 'rgba(255,255,255,.25)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                  <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" fill="rgba(255,255,255,.9)"/>
                  <path d="M19 10v2a7 7 0 0 1-14 0v-2" stroke="rgba(255,255,255,.7)" strokeWidth="2" strokeLinecap="round"/>
                  <line x1="12" y1="19" x2="12" y2="23" stroke="rgba(255,255,255,.7)" strokeWidth="2" strokeLinecap="round"/>
                </svg>
              </div>
            </div>

            <p style={{
              fontSize: 26, fontWeight: 300, color: 'rgba(255,255,255,.85)',
              lineHeight: 1.4, maxWidth: 280,
            }}>
              Contame todos los detalles de tu gasto
            </p>

            <p style={{
              fontSize: 14, color: 'rgba(255,255,255,.5)',
              marginTop: 16,
            }}>
              Ej: &ldquo;Gasté 200 quetzales en el super&rdquo;
            </p>
          </>
        )}
      </div>

      {/* Bottom buttons */}
      <div style={{
        display: 'flex', justifyContent: 'space-between',
        alignItems: 'center', width: '100%',
        padding: '0 32px 48px',
        paddingBottom: 'max(48px, calc(env(safe-area-inset-bottom) + 24px))',
      }}>
        {/* Cancel */}
        <button
          onClick={handleCancel}
          style={{
            width: 56, height: 56, borderRadius: '50%',
            background: 'rgba(255,255,255,.2)',
            border: 'none', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <path d="M18 6L6 18M6 6l12 12" stroke="rgba(255,255,255,.8)" strokeWidth="2" strokeLinecap="round"/>
          </svg>
        </button>

        {/* Confirm / Stop recording */}
        <button
          onClick={handleConfirm}
          disabled={state === 'processing'}
          style={{
            width: 64, height: 64, borderRadius: '50%',
            background: state === 'processing' ? 'rgba(255,255,255,.2)' : 'rgba(255,255,255,.3)',
            border: 'none', cursor: state === 'processing' ? 'default' : 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            opacity: state === 'processing' ? 0.5 : 1,
          }}
        >
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
            <path d="M20 6L9 17l-5-5" stroke="rgba(255,255,255,.9)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg) } }
        @keyframes pulse { 0%, 100% { transform: scale(1); opacity: 1 } 50% { transform: scale(1.15); opacity: .7 } }
      `}</style>
    </div>
  )
}
