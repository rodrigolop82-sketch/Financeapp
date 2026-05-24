'use client'
import { useState, useEffect, useCallback } from 'react'
import { X, Mic } from 'lucide-react'
import { formatMoney } from '@/lib/format'
import { ExpenseCategoryPicker } from './ExpenseCategoryPicker'
import { useExpenseForm } from './useExpenseForm'
import type { BudgetCategory } from '@/types'

const STYLE_ID = 'zafi-expense-drawer-styles'
const GLOBAL_CSS = `
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
  .zafi-coin   { animation: zafiCoinDrop  550ms cubic-bezier(0.25,0.46,0.45,0.94)  50ms  both; }
  .zafi-check  { animation: zafiCheckPop  350ms cubic-bezier(0.34,1.56,0.64,1)     600ms both; }
  .zafi-amt    { animation: zafiFadeUp    300ms ease                                800ms both; }
  .zafi-cat    { animation: zafiFadeUp    300ms ease                                900ms both; }
  .zafi-ok     { animation: zafiFadeUp    300ms ease                               1000ms both; }
  .zafi-btns   { animation: zafiFadeUp    300ms ease                               1200ms both; }
`

interface ExpenseDrawerProps {
  householdId: string
  categories: BudgetCategory[]
  onSuccess: () => void
  onVoiceOverlay: () => void
}

export function ExpenseDrawer({ householdId, categories, onSuccess, onVoiceOverlay }: ExpenseDrawerProps) {
  const [open, setOpen]       = useState(false)
  const [closing, setClosing] = useState(false)
  const form = useExpenseForm({ householdId, categories, onSuccess })

  useEffect(() => {
    if (document.getElementById(STYLE_ID)) return
    const el = document.createElement('style')
    el.id = STYLE_ID
    el.textContent = GLOBAL_CSS
    document.head.appendChild(el)
  }, [])

  const handleClose = useCallback(() => {
    setClosing(true)
    setTimeout(() => { setOpen(false); setClosing(false); form.reset() }, 280)
  }, [form])

  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') handleClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, handleClose])

  const amountNum = parseFloat(form.amount) || 0
  const canSubmit = amountNum > 0 && !form.isSubmitting

  const successScreen = (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 24px', textAlign: 'center' }}>
      <div style={{ position: 'relative', height: 72, width: 72, marginBottom: 20 }}>
        <span className="zafi-coin" style={{ fontSize: 52, position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>💰</span>
        <span className="zafi-check" style={{ fontSize: 52, position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✅</span>
      </div>
      <p className="zafi-amt" style={{ fontSize: 30, fontWeight: 700, color: '#1E3A5F', margin: '0 0 4px', fontFamily: 'Outfit, sans-serif' }}>{formatMoney(amountNum)}</p>
      {form.selectedCategory && <p className="zafi-cat" style={{ fontSize: 14, color: '#2563EB', margin: '0 0 16px' }}>{form.selectedCategory.name}</p>}
      <p className="zafi-ok" style={{ fontSize: 17, fontWeight: 600, color: '#059669', margin: '0 0 32px' }}>¡Gasto registrado!</p>
      <div className="zafi-btns" style={{ display: 'flex', gap: 12 }}>
        <button onClick={handleClose} style={{ padding: '12px 28px', borderRadius: 12, background: '#2563EB', color: '#fff', border: 'none', fontWeight: 600, cursor: 'pointer', fontSize: 14, boxShadow: '0 4px 12px rgba(37,99,235,0.25)' }}>Listo</button>
        <button onClick={form.reset} style={{ padding: '12px 28px', borderRadius: 12, background: '#F1F5F9', color: '#1E3A5F', border: 'none', fontWeight: 600, cursor: 'pointer', fontSize: 14 }}>Agregar otro</button>
      </div>
    </div>
  )

  const formScreen = (
    <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 20px 0', flexShrink: 0 }}>
        <h2 style={{ fontSize: 17, fontWeight: 700, color: '#1E3A5F', margin: 0, fontFamily: 'DM Serif Display, serif' }}>Agregar gasto</h2>
        <button onClick={handleClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8', padding: 4, lineHeight: 1 }}><X size={20} /></button>
      </div>
      <div style={{ padding: '18px 20px 32px', flex: 1 }}>
        <div style={{ marginBottom: 20 }}>
          <label style={{ fontSize: 11, fontWeight: 700, color: '#94A3B8', display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Monto</label>
          <div style={{ display: 'flex', alignItems: 'center', border: '2px solid #2563EB', borderRadius: 12, background: '#fff', overflow: 'hidden' }}>
            <span style={{ padding: '0 14px', fontSize: 22, fontWeight: 700, color: '#1E3A5F', fontFamily: 'Outfit, sans-serif', borderRight: '1.5px solid #EFF6FF', userSelect: 'none', flexShrink: 0 }}>Q</span>
            <input type="number" inputMode="decimal" placeholder="0" value={form.amount} onChange={e => form.setAmount(e.target.value.replace(/[^\d.]/g, ''))}
              // eslint-disable-next-line jsx-a11y/no-autofocus
              autoFocus
              style={{ flex: 1, padding: '13px 12px', fontSize: 28, fontWeight: 700, border: 'none', outline: 'none', color: '#1E3A5F', fontFamily: 'Outfit, sans-serif', minWidth: 0 }} />
            <button onClick={onVoiceOverlay} title="Agregar por voz" style={{ padding: '0 14px', background: 'none', border: 'none', cursor: 'pointer', color: '#2563EB', flexShrink: 0 }}><Mic size={20} /></button>
          </div>
        </div>
        <div style={{ marginBottom: 20 }}>
          <label style={{ fontSize: 11, fontWeight: 700, color: '#94A3B8', display: 'block', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Categoría</label>
          <ExpenseCategoryPicker recentCategories={form.recentCategories} allCategories={form.allCategories} selected={form.selectedCategory} onSelect={form.setSelectedCategory} />
        </div>
        <div style={{ marginBottom: 24 }}>
          <label style={{ fontSize: 11, fontWeight: 700, color: '#94A3B8', display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Nota (opcional)</label>
          <textarea value={form.note} onChange={e => form.setNote(e.target.value.slice(0, 200))} placeholder="ej. almuerzo con mamá, bus zona 1…" rows={2}
            style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: '1.5px solid #E2E8F0', fontSize: 14, color: '#374151', resize: 'none', outline: 'none', boxSizing: 'border-box', fontFamily: 'DM Sans, sans-serif', lineHeight: 1.5 }} />
          <span style={{ fontSize: 11, color: '#94A3B8', display: 'block', textAlign: 'right', marginTop: 2 }}>{form.note.length}/200</span>
        </div>
        <button onClick={form.submit} disabled={!canSubmit} style={{ width: '100%', padding: '14px 20px', background: canSubmit ? '#2563EB' : '#CBD5E1', color: '#fff', border: 'none', borderRadius: 12, fontSize: 15, fontWeight: 600, cursor: canSubmit ? 'pointer' : 'not-allowed', transition: 'background 0.2s ease', boxShadow: canSubmit ? '0 4px 14px rgba(37,99,235,0.25)' : 'none' }}>
          {form.isSubmitting ? 'Guardando…' : 'Registrar gasto'}
        </button>
      </div>
    </div>
  )

  const panelContent = form.isSuccess ? successScreen : formScreen

  return (
    <>
      <div style={{ padding: '8px 16px' }}>
        <button onClick={() => setOpen(true)} style={{ width: '100%', padding: '14px 20px', background: '#2563EB', color: '#fff', border: 'none', borderRadius: 14, fontSize: 15, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, boxShadow: '0 4px 14px rgba(37,99,235,0.3)' }}>
          <span style={{ fontSize: 18, lineHeight: 1 }}>＋</span>
          Agregar gasto
        </button>
      </div>
      {open && (
        <>
          <div className="md:hidden">
            <div onClick={handleClose} style={{ position: 'fixed', inset: 0, zIndex: 50, background: 'rgba(15,23,42,0.5)', opacity: closing ? 0 : 1, transition: 'opacity 0.28s ease' }} />
            <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 51, background: '#fff', borderRadius: '20px 20px 0 0', boxShadow: '0 -8px 40px rgba(15,23,42,0.15)', maxHeight: '88vh', display: 'flex', flexDirection: 'column', paddingBottom: 'env(safe-area-inset-bottom, 0px)', transform: closing ? 'translateY(100%)' : 'translateY(0)', transition: 'transform 0.28s cubic-bezier(0.32,0,0,1)', willChange: 'transform' }}>
              <div style={{ width: 36, height: 4, background: '#CBD5E1', borderRadius: 2, margin: '12px auto 4px', flexShrink: 0 }} />
              {panelContent}
            </div>
          </div>
          <div className="hidden md:block">
            <div onClick={handleClose} style={{ position: 'fixed', inset: 0, zIndex: 50, background: 'rgba(15,23,42,0.25)', opacity: closing ? 0 : 1, transition: 'opacity 0.28s ease' }} />
            <div style={{ position: 'fixed', top: 0, right: 0, bottom: 0, width: 360, zIndex: 51, background: '#fff', boxShadow: '-8px 0 40px rgba(15,23,42,0.12)', display: 'flex', flexDirection: 'column', overflow: 'hidden', transform: closing ? 'translateX(100%)' : 'translateX(0)', transition: 'transform 0.28s cubic-bezier(0.32,0,0,1)', willChange: 'transform' }}>
              {panelContent}
            </div>
          </div>
        </>
      )}
    </>
  )
}
