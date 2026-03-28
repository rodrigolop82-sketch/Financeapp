'use client'

import { useState, useRef, useCallback } from 'react'
import { Mic, Square, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { VoiceState, VoiceExtractionResult } from '@/types'

interface VoiceButtonProps {
  mode?: 'expense' | 'chat'
  onTranscription?: (text: string) => void
  onExtraction?: (result: VoiceExtractionResult) => void
  onError?: (error: string) => void
  className?: string
}

export function VoiceButton({
  mode = 'expense',
  onTranscription,
  onExtraction,
  onError,
  className = '',
}: VoiceButtonProps) {
  const [state, setState] = useState<VoiceState>('idle')
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])

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
      setState('error')
    }
  }, [mode]) // eslint-disable-line react-hooks/exhaustive-deps

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.stop()
      setState('processing')
    }
  }, [])

  const processAudio = async (blob: Blob) => {
    setState('processing')
    const formData = new FormData()
    formData.append('audio', blob, 'recording.webm')
    formData.append('mode', mode)

    try {
      const res = await fetch('/api/voice', { method: 'POST', body: formData })
      const data = await res.json()

      if (!res.ok) {
        onError?.(data.error || 'Error al procesar el audio')
        setState('error')
        setTimeout(() => setState('idle'), 2000)
        return
      }

      if (mode === 'chat') {
        onTranscription?.(data.transcription)
        setState('done')
      } else {
        setState('confirming')
        onExtraction?.(data as VoiceExtractionResult)
      }

      setTimeout(() => setState('idle'), 1500)
    } catch {
      onError?.('Error de conexión. Intentá de nuevo.')
      setState('error')
      setTimeout(() => setState('idle'), 2000)
    }
  }

  const handleClick = () => {
    if (state === 'recording') {
      stopRecording()
    } else if (state === 'idle' || state === 'error' || state === 'done') {
      startRecording()
    }
  }

  const isRecording = state === 'recording'
  const isProcessing = state === 'processing' || state === 'extracting'

  return (
    <Button
      type="button"
      variant={isRecording ? 'destructive' : 'outline'}
      size="icon"
      onClick={handleClick}
      disabled={isProcessing}
      className={`relative ${isRecording ? 'animate-pulse' : ''} ${className}`}
      title={isRecording ? 'Detener grabación' : 'Dictar con voz'}
    >
      {isProcessing ? (
        <Loader2 className="w-5 h-5 animate-spin" />
      ) : isRecording ? (
        <Square className="w-4 h-4" />
      ) : (
        <Mic className="w-5 h-5" />
      )}
      {isRecording && (
        <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full animate-ping" />
      )}
    </Button>
  )
}
