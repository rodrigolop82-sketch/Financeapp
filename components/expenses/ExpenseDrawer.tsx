'use client'
import { useState, useEffect, useCallback } from 'react'
import { X, Mic } from 'lucide-react'
import { formatMoney } from '@/lib/format'
import { ExpenseCategoryPicker } from './ExpenseCategoryPicker'
import { useExpenseForm } from './useExpenseForm'
import type { BudgetCategory } from '@/types'

const KEYFRAMES = `
  @keyframes zafiCoinDrop {
    0%   { transform: translateY(-80px) scale(0.6); opacity: 0; }
    60%  { transform: translateY(8px)   scale(1.1); opacity: 1; }
    100% { transform: translateY(0)     scale(1);   opacity: 1; }
  }
  @keyframes zafiCheckPop {
    0%   { transform: scale(0);    opacity: 0; }
    60%  { transform: scale(1.25); opacity: 1; }
    100% { transform: scale(1);    opacity: 1; }
  }
  @keyframes zafiFadeUp {
    0%   { transform: translateY(12px); opacity: 0; }
    100% { transform: translateY(0);    opacity: 1; }
  }
`

interface ExpenseDrawerProps {
  householdId: string
  categories: BudgetCategory[]
  onSuccess: () => void
  onVoiceOverlay: () => void
}

export function ExpenseDrawer({
  householdId,
  categories,
  onSuccess,
  onVoiceOverlay,
}: ExpenseDrawerProps) {
  const [open, setOpen]       = useState(false)
  const [closing, setClosing] = useState(false)
  const [stage, setStage]     = useState(0)

  const form = useExpenseForm({ householdId, categories, onSuccess })

  const handleClose = useCallback(() => {
    setClosing(true)
    setTimeout(() => {
      setOpen(false)
      setClosing(false)
      form.reset()
    }, 280)
  }, [form])

  // Escape key to close
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') handleClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, handleClose])

  // Success animation staging
  useEffect(() => {
    if (!form.isSuccess) { setStage(0); return }
    const timers = [
      setTimeout(() => setStage(1), 50),
      setTimeout(() => setStage(2), 600),
      setTimeout(() => setStage(3), 800),
      setTimeout(() => setStage(4), 900),
      setTimeout(() => setStage(5), 1000),
      setTimeout(() => setStage(6), 1200),
    ]
    return () => timers.forEach(clearTimeout)
  }, [form.isSuccess])

  const amountNum  = parseFloat(form.amount) || 0
  const canSubmit  = amountNum > 0 && !form.isSubmitting

  /* ── Success screen ──────────────────────────────────────── */
  const successScreen = (
    <div style={{
      flex: 1, display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      padding: '40px 24px', textAlign: 'center',
    }}>
      <style dangerouslySetInnerHTML={{ __html: KEYFRAMES }} />

      {/* Coin → checkmark */}
      <div style={{ height: 72, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 20 }}>
        {stage === 1 && (
          <span style={{
            fontSize: 52, display: 'block',
            animation: 'zafiCoinDrop 550ms cubic-bezier(0.25, 0.46, 0.45, 0.94) forwards',
          }}>💰</span>
        )}
        {stage >= 2 && (
          <span style={{
            fontSize: 52, display: 'block',
            animation: 'zafiCheckPop 350ms cubic-bezier(0.34, 1.56, 0.64, 1) forwards',
          }}>✅</span>
        )}
      </div>

      {stage >= 3 && (
        <p style={{
          fontSize: 30, fontWeight: 700, color: '#1E3A5F',
          margin: '0 0 4px', fontFamily: 'Outfit, sans-serif',
          animation: 'zafiFadeUp 300ms ease forwards',
        }}>
          {formatMoney(amountNum)}
        </p>
      )}

      {stage >= 4 && form.selectedCategory && (
        <p style={{
          fontSize: 14, color: '#2563EB', margin: '0 0 16px',
          animation: 'zafiFadeUp 300ms ease forwards',
        }}>
          {form.selectedCategory.name}
        </p>
      )}

      {stage >= 5 && (
        <p style={{
          fontSize: 17, fontWeight: 600, color: '#059669', margin: '0 0 32px',
          animation: 'zafiFadeUp 300ms ease forwards',
        }}>
          ¡Gasto registrado!
        </p>
      )}

      {stage >= 6 && (
        <div style={{ display: 'flex', gap: 12, animation: 'zafiFadeUp 300ms ease forwards' }}>
          <button
            onClick={handleClose}
            style={{
              padding: '12px 28px', borderRadius: 12,
              background: '#2563EB', color: '#fff',
              border: 'none', fontWeight: 600, cursor: 'pointer', fontSize: 14,
              boxShadow: '0 4px 12px rgba(37,99,235,0.25)',
            }}
          >
            Listo
          </button>
          <button
            onClick={() => { form.reset(); setStage(0) }}
            style={{
              padding: '12px 28px', borderRadius: 12,
              background: '#F1F5F9', color: '#1E3A5F',
              border: 'none', fontWeight: 600, cursor: 'pointer', fontSize: 14,
            }}
          >
            Agregar otro
          </button>
        </div>
      )}
    </div>
  )

  /* ── Form screen ─────────────────────────────────────────── */
  const formScreen = (
    <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '20px 20px 0', flexShrink: 0,
      }}>
        <h2 style={{
          fontSize: 17, fontWeight: 700, color: '#1E3A5F', margin: 0,
          fontFamily: 'DM Serif Display, serif',
        }}>
          Agregar gasto
        </h2>
        <button
          onClick={handleClose}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8', padding: 4, lineHeight: 1 }}
        >
          <X size={20} />
        </button>
      </div>

      <div style={{ padding: '18px 20px 32px', flex: 1 }}>
        {/* Monto */}
        <div style={{ marginBottom: 20 }}>
          <label style={{
            fontSize: 11, fontWeight: 700, color: '#94A3B8',
            display: 'block', marginBottom: 6,
            textTransform: 'uppercase', letterSpacing: '0.06em',
          }}>
            Monto
          </label>
          <div style={{
            display: 'flex', alignItems: 'center',
            border: '2px solid #2563EB', borderRadius: 12,
            background: '#fff', overflow: 'hidden',
          }}>
            <span style={{
              padding: '0 14px', fontSize: 22, fontWeight: 700,
              color: '#1E3A5F', fontFamily: 'Outfit, sans-serif',
              borderRight: '1.5px solid #EFF6FF', userSelect: 'none', flexShrink: 0,
            }}>Q</span>
            <input
              type="number"
              inputMode="decimal"
              placeholder="0"
              value={form.amount}
              onChange={e => form.setAmount(e.target.value.replace(/[^\d.]/g, ''))}
              // eslint-disable-next-line jsx-a11y/no-autofocus
              autoFocus
              style={{
                flex: 1, padding: '13px 12px', fontSize: 28, fontWeight: 700,
                border: 'none', outline: 'none', color: '#1E3A5F',
                fontFamily: 'Outfit, sans-serif', minWidth: 0,
              }}
            />
            <button
              onClick={onVoiceOverlay}
              title="Agregar por voz"
              style={{
                padding: '0 14px', background: 'none', border: 'none',
                cursor: 'pointer', color: '#2563EB', flexShrink: 0,
              }}
            >
              <Mic size={20} />
            </button>
          </div>
        </div>

        {/* Categoría */}
        <div style={{ marginBottom: 20 }}>
          <label style={{
            fontSize: 11, fontWeight: 700, color: '#94A3B8',
            display: 'block', marginBottom: 8,
            textTransform: 'uppercase', letterSpacing: '0.06em',
          }}>
            Categoría
          </label>
          <ExpenseCategoryPicker
            recentCategories={form.recentCategories}
            allCategories={form.allCategories}
            selected={form.selectedCategory}
            onSelect={form.setSelectedCategory}
          />
        </div>

        {/* Nota */}
        <div style={{ marginBottom: 24 }}>
          <label style={{
            fontSize: 11, fontWeight: 700, color: '#94A3B8',
            display: 'block', marginBottom: 6,
            textTransform: 'uppercase', letterSpacing: '0.06em',
          }}>
            Nota (opcional)
          </label>
          <textarea
            value={form.note}
            onChange={e => form.setNote(e.target.value.slice(0, 200))}
            placeholder="ej. almuerzo con mamá, bus zona 1…"
            rows={2}
            style={{
              width: '100%', padding: '10px 12px', borderRadius: 10,
              border: '1.5px solid #E2E8F0', fontSize: 14, color: '#374151',
              resize: 'none', outline: 'none', boxSizing: 'border-box',
              fontFamily: 'DM Sans, sans-serif', lineHeight: 1.5,
            }}
          />
          <span style={{ fontSize: 11, color: '#94A3B8', display: 'block', textAlign: 'right', marginTop: 2 }}>
            {form.note.length}/200
          </span>
        </div>

        {/* Submit */}
        <button
          onClick={form.submit}
          disabled={!canSubmit}
          style={{
            width: '100%', padding: '14px 20px',
            background: canSubmit ? '#2563EB' : '#CBD5E1',
            color: '#fff', border: 'none', borderRadius: 12,
            fontSize: 15, fontWeight: 600,
            cursor: canSubmit ? 'pointer' : 'not-allowed',
            transition: 'background 0.2s ease',
            boxShadow: canSubmit ? '0 4px 14px rgba(37,99,235,0.25)' : 'none',
          }}
        >
          {form.isSubmitting ? 'Guardando…' : 'Registrar gasto'}
        </button>
      </div>
    </div>
  )

  const panelContent = form.isSuccess ? successScreen : formScreen

  /* ── Render ──────────────────────────────────────────────── */
  return (
    <>
      {/* Trigger */}
      <div style={{ padding: '8px 16px' }}>
        <button
          onClick={() => setOpen(true)}
          style={{
            width: '100%', padding: '14px 20px',
            background: '#2563EB', color: '#fff',
            border: 'none', borderRadius: 14,
            fontSize: 15, fontWeight: 600, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            boxShadow: '0 4px 14px rgba(37,99,235,0.3)',
          }}
        >
          <span style={{ fontSize: 18, lineHeight: 1 }}>＋</span>
          Agregar gasto
        </button>
      </div>

      {open && (
        <>
          {/* ── Mobile: bottom sheet ── */}
          <div className="md:hidden">
            {/* Backdrop */}
            <div
              onClick={handleClose}
              style={{
                position: 'fixed', inset: 0, zIndex: 50,
                background: 'rgba(15,23,42,0.5)',
                opacity: closing ? 0 : 1,
                transition: 'opacity 0.28s ease',
              }}
            />
            {/* Sheet */}
            <div style={{
              position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 51,
              background: '#fff',
              borderRadius: '20px 20px 0 0',
              boxShadow: '0 -8px 40px rgba(15,23,42,0.15)',
              maxHeight: '88vh',
              display: 'flex', flexDirection: 'column',
              paddingBottom: 'env(safe-area-inset-bottom, 0px)',
              transform: closing ? 'translateY(100%)' : 'translateY(0)',
              transition: 'transform 0.28s cubic-bezier(0.32,0,0,1)',
            }}>
              {/* Drag handle */}
              <div style={{ width: 36, height: 4, background: '#CBD5E1', borderRadius: 2, margin: '12px auto 4px', flexShrink: 0 }} />
              {panelContent}
            </div>
          </div>

          {/* ── Desktop: side panel ── */}
          <div className="hidden md:block">
            {/* Backdrop */}
            <div
              onClick={handleClose}
              style={{
                position: 'fixed', inset: 0, zIndex: 50,
                background: 'rgba(15,23,42,0.25)',
                opacity: closing ? 0 : 1,
                transition: 'opacity 0.28s ease',
              }}
            />
            {/* Panel */}
            <div style={{
              position: 'fixed', top: 0, right: 0, bottom: 0, width: 360, zIndex: 51,
              background: '#fff',
              boxShadow: '-8px 0 40px rgba(15,23,42,0.12)',
              display: 'flex', flexDirection: 'column',
              overflow: 'hidden',
              transform: closing ? 'translateX(100%)' : 'translateX(0)',
              transition: 'transform 0.28s cubic-bezier(0.32,0,0,1)',
            }}>
              {panelContent}
            </div>
          </div>
        </>
      )}
    </>
  )
}
