'use client'
import { useState, useRef } from 'react'
import { VoiceButton } from '@/components/voice/VoiceButton'
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
}

export function QuickAddBar({ onAdd, onVoiceResult }: QuickAddBarProps) {
  const [value, setValue] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const suggestions = getTimeSuggestions()

  function handleSubmit() {
    if (!value.trim()) return
    onAdd(value.trim())
    setValue('')
  }

  return (
    <div style={{
      background: 'white', margin: '12px 16px 0',
      borderRadius: 14, border: '0.5px solid #E2E8F0',
      overflow: 'hidden', boxShadow: '0 1px 4px rgba(30,58,95,.08)'
    }}>
      {/* Input row */}
      <div style={{ display: 'flex', alignItems: 'center' }}>

        {/* Botón + */}
        <button
          onClick={handleSubmit}
          style={{
            width: 44, height: 44, background: '#2563EB',
            border: 'none', display: 'flex', alignItems: 'center',
            justifyContent: 'center', cursor: 'pointer', flexShrink: 0
          }}
        >
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
            <path d="M9 3v12M3 9h12" stroke="white" strokeWidth="1.8" strokeLinecap="round"/>
          </svg>
        </button>

        {/* Input de texto */}
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={e => setValue(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSubmit()}
          placeholder="Q45 Starbucks..."
          style={{
            flex: 1, height: 44, border: 'none', outline: 'none',
            padding: '0 10px', fontSize: 13, color: '#334155',
            background: 'transparent'
          }}
        />

        {/* Botón de voz */}
        <div style={{ borderLeft: '0.5px solid #F1F5F9' }}>
          <VoiceButton
            mode="expense"
            onExtraction={onVoiceResult}
            onError={() => {}}
            className="w-11 h-11"
          />
        </div>
      </div>

      {/* Sugerencias contextuales */}
      <div style={{
        padding: '5px 10px 7px', borderTop: '0.5px solid #F8FAFC',
        background: '#FAFBFF', display: 'flex', gap: 6, flexWrap: 'wrap'
      }}>
        {suggestions.map((s, i) => (
          <button
            key={i}
            onClick={() => { setValue(s); inputRef.current?.focus() }}
            style={{
              background: '#F1F5F9', color: '#64748B', fontSize: 10,
              padding: '2px 8px', borderRadius: 20, border: 'none',
              cursor: 'pointer', fontFamily: 'inherit'
            }}
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  )
}
