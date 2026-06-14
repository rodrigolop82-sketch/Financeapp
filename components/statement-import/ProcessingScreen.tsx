'use client'
import { useState, useEffect } from 'react'

interface ProcessingScreenProps {
  bankDetected: string | null
  isLoading: boolean
}

const STEPS = [
  { id: 1, label: 'Imagen recibida y validada' },
  { id: 2, label: 'Detectando banco...' },
  { id: 3, label: 'Extrayendo transacciones...' },
  { id: 4, label: 'Detectando duplicados' },
  { id: 5, label: 'Categorizando automáticamente' },
]

export function ProcessingScreen({ bankDetected, isLoading }: ProcessingScreenProps) {
  const [activeStep, setActiveStep] = useState(1)

  useEffect(() => {
    if (!isLoading) {
      setActiveStep(6)
      return
    }

    const timers: ReturnType<typeof setTimeout>[] = []
    for (let i = 2; i <= 5; i++) {
      timers.push(setTimeout(() => setActiveStep(i), (i - 1) * 800))
    }
    return () => timers.forEach(clearTimeout)
  }, [isLoading])

  return (
    <div style={{ padding: '40px 24px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      {/* Spinner */}
      {isLoading && (
        <div style={{
          width: 80, height: 80, borderRadius: '50%',
          border: '4px solid #E2E8F0',
          borderTopColor: '#2563EB',
          animation: 'zafiSpin 1s linear infinite',
          marginBottom: 28,
        }} />
      )}

      {!isLoading && (
        <div style={{
          width: 80, height: 80, borderRadius: '50%',
          background: '#10B981',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          marginBottom: 28,
        }}>
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 6L9 17l-5-5" />
          </svg>
        </div>
      )}

      <h3 style={{ fontSize: 17, fontWeight: 700, color: '#1E3A5F', marginBottom: 24, fontFamily: 'DM Serif Display, serif' }}>
        {isLoading ? 'Analizando estado de cuenta...' : '¡Análisis completo!'}
      </h3>

      {/* Steps */}
      <div style={{ width: '100%', maxWidth: 320 }}>
        {STEPS.map(step => {
          const isDone = step.id < activeStep
          const isActive = step.id === activeStep && isLoading
          const isPending = step.id > activeStep

          let label = step.label
          if (step.id === 2 && isDone && bankDetected) {
            label = `Banco detectado: ${bankDetected}`
          }

          return (
            <div key={step.id} style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '10px 0',
              opacity: isPending ? 0.4 : 1,
              transition: 'opacity 0.3s ease',
            }}>
              {isDone && (
                <div style={{
                  width: 24, height: 24, borderRadius: '50%',
                  background: '#10B981', display: 'flex',
                  alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round">
                    <path d="M20 6L9 17l-5-5" />
                  </svg>
                </div>
              )}
              {isActive && (
                <div style={{
                  width: 24, height: 24, borderRadius: '50%',
                  border: '2.5px solid #E2E8F0',
                  borderTopColor: '#2563EB',
                  animation: 'zafiSpin 1s linear infinite',
                  flexShrink: 0,
                }} />
              )}
              {isPending && (
                <div style={{
                  width: 24, height: 24, borderRadius: '50%',
                  background: '#E2E8F0', display: 'flex',
                  alignItems: 'center', justifyContent: 'center',
                  fontSize: 11, fontWeight: 700, color: '#94A3B8', flexShrink: 0,
                }}>
                  {step.id}
                </div>
              )}
              <span style={{
                fontSize: 13, fontWeight: isDone ? 600 : 400,
                color: isDone ? '#1E3A5F' : '#64748B',
              }}>
                {label}
              </span>
            </div>
          )
        })}
      </div>

      <style>{`
        @keyframes zafiSpin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  )
}
