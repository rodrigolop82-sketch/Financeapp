'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { Check, Mic, X } from 'lucide-react'
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
      onError?.('No se pudo acceder al micrófono. Verifica los permisos.')
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
      onError?.('Error de conexión. Intenta de nuevo.')
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

  const processing = state === 'processing'

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Dictar por voz"
      className="fixed inset-0 z-[100] flex flex-col bg-navy-deep text-white"
    >
      <div className="flex flex-1 flex-col items-center justify-center gap-[18px] px-8 py-10 text-center" aria-live="polite">
        {processing ? (
          <>
            <span aria-hidden className="h-16 w-16 animate-spin rounded-full border-[3px] border-white/20 border-t-electric-pale" />
            <h2 className="font-serif text-[28px] leading-[1.2]">Entendiendo lo que dijiste…</h2>
          </>
        ) : (
          <>
            <span aria-hidden className="flex h-[92px] w-[92px] animate-breath items-center justify-center rounded-full bg-electric">
              <Mic size={38} color="#FFFFFF" />
            </span>
            <h2 className="mt-3 max-w-[280px] font-serif text-[28px] leading-[1.2]">Cuéntame tu gasto</h2>
            <p className="max-w-[280px] text-[15px] text-[#9FB3CB]">
              Dilo como se lo dirías a alguien. Ej. “gasté 200 en el super y 38 de uber”.
            </p>
            <div aria-hidden className="mt-1.5 flex gap-[7px]">
              {[0, 1, 2].map((i) => (
                <span key={i} className="h-[7px] w-[7px] animate-dot rounded-full bg-electric-pale" style={{ animationDelay: `${i * 0.15}s` }} />
              ))}
            </div>
          </>
        )}
      </div>

      <div className="flex items-center justify-between px-9 pb-[calc(48px+env(safe-area-inset-bottom))]">
        <button
          type="button"
          onClick={handleCancel}
          aria-label="Cancelar"
          className="flex h-14 w-14 items-center justify-center rounded-full border border-white/[0.12] bg-white/[0.08] transition duration-150 active:scale-[0.92]"
        >
          <X size={24} color="#FFFFFF" />
        </button>
        <span className="text-[13px] text-[#9FB3CB]">{processing ? '' : 'Toca ✓ cuando termines'}</span>
        <button
          type="button"
          onClick={handleConfirm}
          disabled={processing}
          aria-label="Listo"
          className="flex h-16 w-16 items-center justify-center rounded-full border-4 border-navy-deep bg-electric shadow-[0_8px_20px_rgba(37,99,235,0.45)] transition duration-150 active:scale-[0.92] disabled:opacity-50"
        >
          <Check size={28} strokeWidth={2.6} color="#FFFFFF" />
        </button>
      </div>
    </div>
  )
}
