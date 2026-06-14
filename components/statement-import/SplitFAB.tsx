'use client'
import { useState, useEffect, useCallback } from 'react'
import { X, FileText } from 'lucide-react'

interface SplitFABProps {
  onManualExpense: () => void
  onImportStatement: () => void
}

export function SplitFAB({ onManualExpense, onImportStatement }: SplitFABProps) {
  const [expanded, setExpanded] = useState(false)

  const close = useCallback(() => setExpanded(false), [])

  useEffect(() => {
    if (!expanded) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') close() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [expanded, close])

  return (
    <>
      {/* Overlay */}
      {expanded && (
        <div
          onClick={close}
          style={{
            position: 'fixed', inset: 0, zIndex: 44,
            background: 'rgba(0,0,0,0.4)',
            animation: 'zafiFadeIn 0.2s ease',
          }}
        />
      )}

      {/* FAB group */}
      <div style={{ position: 'fixed', bottom: 88, right: 78, zIndex: 46 }}>
        {/* Mini FABs */}
        {expanded && (
          <div style={{ position: 'absolute', bottom: 62, right: 0, display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'flex-end' }}>
            {/* Import statement */}
            <button
              onClick={() => { close(); onImportStatement() }}
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                animation: 'zafiFabSlideIn 0.25s ease 0.05s both',
              }}
            >
              <span style={{
                padding: '7px 14px', borderRadius: 20,
                background: '#1E3A5F', border: '1px solid rgba(37,99,235,0.3)',
                color: '#C8DFF0', fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap',
              }}>
                Importar estado
              </span>
              <div style={{
                width: 38, height: 38, borderRadius: '50%',
                background: 'linear-gradient(145deg, #2563EB, #1D4ED8)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: '0 2px 10px rgba(37,99,235,0.3)',
              }}>
                <FileText size={17} color="white" />
              </div>
            </button>

            {/* Manual expense */}
            <button
              onClick={() => { close(); onManualExpense() }}
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                animation: 'zafiFabSlideIn 0.25s ease both',
              }}
            >
              <span style={{
                padding: '7px 14px', borderRadius: 20,
                background: '#1E3A5F', border: '1px solid rgba(37,99,235,0.3)',
                color: '#C8DFF0', fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap',
              }}>
                Gasto manual
              </span>
              <div style={{
                width: 38, height: 38, borderRadius: '50%',
                background: 'linear-gradient(145deg, #2563EB, #1D4ED8)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: '0 2px 10px rgba(37,99,235,0.3)',
              }}>
                <svg width="17" height="17" viewBox="0 0 22 22" fill="none">
                  <path d="M11 5v12M5 11h12" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
                </svg>
              </div>
            </button>
          </div>
        )}

        {/* Main FAB */}
        <button
          onClick={() => setExpanded(e => !e)}
          style={{
            width: 52, height: 52, borderRadius: '50%',
            background: 'linear-gradient(145deg, #2563EB, #1D4ED8)',
            border: 'none', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 4px 16px rgba(37,99,235,0.35)',
            transition: 'transform 0.2s ease',
            transform: expanded ? 'rotate(45deg)' : 'rotate(0deg)',
          }}
        >
          {expanded ? (
            <X size={22} color="white" />
          ) : (
            <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
              <path d="M11 5v12M5 11h12" stroke="white" strokeWidth="2" strokeLinecap="round" />
            </svg>
          )}
        </button>
      </div>

      <style>{`
        @keyframes zafiFadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes zafiFabSlideIn {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </>
  )
}
