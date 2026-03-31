'use client'
import { useState, useRef } from 'react'
import type { VoiceExtractionResult } from '@/types'

// Sugerencias contextuales según la hora del día
function getTimeSuggestions(): string[] {
  const h = new Date().getHours()
  if (h >= 6 && h < 10)  return ['Q15 café', 'Q25 desayuno', 'Q30 bus']
  if (h >= 10 && h < 14) return ['Q85 almuerzo', 'Q45 Starbucks', 'Q50 gasolina']
  if (h >= 14 && h < 19) return ['Q30 taxi', 'Q120 super', 'Q60 farmacia']
  return ['Q200 cena', 'Q45 Netflix', 'Q30 Uber']
}

interface QuickAddBarProps {
  onAdd: (text: string) => void
  onVoiceResult: (result: VoiceExtractionResult) => void
  onVoiceOverlay?: () => void
}

export function QuickAddBar({ onAdd, onVoiceResult, onVoiceOverlay }: QuickAddBarProps) {
  const [value, setValue] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const suggestions = getTimeSuggestions()

  function handleSubmit() {
    if (!value.trim()) return
    onAdd(value.trim())
    setValue('')
  }

  return (
    <div style={{ margin: '12px 16px 0' }}>
      {/* Label */}
      <p style={{
        fontSize: 12, fontWeight: 600, letterSpacing: '0.05em',
        textTransform: 'uppercase', color: '#64748B', marginBottom: 6
      }}>
        Registrar gasto
      </p>

      <div style={{
        background: 'white',
        borderRadius: 14, border: '0.5px solid #E2E8F0',
        overflow: 'hidden', boxShadow: '0 1px 4px rgba(30,58,95,.08)'
      }}>
        {/* Input row */}
        <div style={{ display: 'flex', alignItems: 'center' }}>

          {/* Botón Agregar */}
          <button
            onClick={handleSubmit}
            style={{
              width: 52, height: 48, background: '#2563EB',
              border: 'none', display: 'flex', alignItems: 'center',
              justifyContent: 'center', cursor: 'pointer', flexShrink: 0,
              gap: 2, flexDirection: 'column'
            }}
          >
            <svg width="20" height="20" viewBox="0 0 18 18" fill="none">
              <path d="M9 3v12M3 9h12" stroke="white" strokeWidth="2" strokeLinecap="round"/>
            </svg>
            <span style={{ fontSize: 8, color: 'white', fontWeight: 600, letterSpacing: '0.02em' }}>Agregar</span>
          </button>

          {/* Input de texto */}
          <input
            ref={inputRef}
            type="text"
            value={value}
            onChange={e => setValue(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSubmit()}
            placeholder="Ej: Q45 Starbucks, Q200 super..."
            style={{
              flex: 1, height: 48, border: 'none', outline: 'none',
              padding: '0 10px', fontSize: 14, color: '#334155',
              background: 'transparent'
            }}
          />

          {/* Botón de voz */}
          <button
            onClick={onVoiceOverlay}
            style={{
              width: 48, height: 48, border: 'none',
              borderLeft: '0.5px solid #F1F5F9',
              background: 'transparent', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" fill="#2563EB"/>
              <path d="M19 10v2a7 7 0 0 1-14 0v-2" stroke="#2563EB" strokeWidth="2" strokeLinecap="round"/>
              <line x1="12" y1="19" x2="12" y2="23" stroke="#2563EB" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          </button>
        </div>

        {/* Sugerencias contextuales */}
        <div style={{
          padding: '5px 10px 4px', borderTop: '0.5px solid #F8FAFC',
          background: '#FAFBFF', display: 'flex', gap: 6, flexWrap: 'wrap'
        }}>
          {suggestions.map((s, i) => (
            <button
              key={i}
              onClick={() => { setValue(s); inputRef.current?.focus() }}
              style={{
                background: '#F1F5F9', color: '#64748B', fontSize: 12,
                padding: '2px 8px', borderRadius: 20, border: 'none',
                cursor: 'pointer', fontFamily: 'inherit'
              }}
            >
              {s}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
