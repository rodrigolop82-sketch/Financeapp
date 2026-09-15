'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import {
  CATEGORY_EMOJIS,
  CATEGORY_COLORS,
  createCategorySchema,
  updateCategorySchema,
} from '@/lib/categories'

interface CategorySheetProps {
  open: boolean
  onClose: () => void
  onCreated: (category: Record<string, unknown>) => void
  householdId: string
  defaults: Array<{ id: string; name: string; bucket: string }>
  existingNames: string[]
  editCategory?: Record<string, unknown> | null
}

export function CategorySheet({
  open,
  onClose,
  onCreated,
  householdId,
  defaults,
  existingNames,
  editCategory,
}: CategorySheetProps) {
  const isEdit = !!editCategory
  const [visible, setVisible] = useState(false)
  const [animating, setAnimating] = useState(false)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState('')

  const [name, setName] = useState('')
  const [icon, setIcon] = useState('')
  const [color, setColor] = useState<string>(CATEGORY_COLORS[0])
  const [parentId, setParentId] = useState('')
  const [paceMode, setPaceMode] = useState<'linear' | 'fixed'>('linear')
  const [expectedDay, setExpectedDay] = useState<number | null>(null)
  const [budget, setBudget] = useState(0)

  useEffect(() => {
    if (open) {
      if (editCategory) {
        setName((editCategory.name as string) || '')
        setIcon((editCategory.icon as string) || '')
        setColor((editCategory.color as string) || CATEGORY_COLORS[0])
        setParentId((editCategory.parent_category_id as string) || '')
        setPaceMode((editCategory.pace_mode as 'linear' | 'fixed') || 'linear')
        setExpectedDay((editCategory.expected_day as number) || null)
        setBudget((editCategory.budgeted_amount as number) || 0)
      } else {
        setName('')
        setIcon('')
        setColor(CATEGORY_COLORS[0])
        setParentId(defaults[0]?.id || '')
        setPaceMode('linear')
        setExpectedDay(null)
        setBudget(0)
      }
      setVisible(true)
      requestAnimationFrame(() => {
        requestAnimationFrame(() => setAnimating(true))
      })
    } else {
      setAnimating(false)
      const timer = setTimeout(() => setVisible(false), 300)
      return () => clearTimeout(timer)
    }
  }, [open, editCategory, defaults])

  if (!visible) return null

  const nameLower = name.trim().toLowerCase()
  const isDuplicate = existingNames.some(
    n => n.toLowerCase() === nameLower && (!isEdit || (editCategory?.name as string)?.toLowerCase() !== nameLower)
  )
  const nameValid = name.trim().length >= 2 && name.trim().length <= 30 && !isDuplicate
  const formValid = nameValid && icon && parentId

  async function handleSave() {
    if (!formValid || saving) return
    setSaving(true)

    const supabase = createClient()
    const input = {
      name: name.trim(),
      icon,
      color,
      parent_category_id: parentId,
      pace_mode: paceMode,
      expected_day: paceMode === 'fixed' ? expectedDay : null,
      budgeted_amount: budget,
    }

    if (isEdit) {
      const parsed = updateCategorySchema.safeParse(input)
      if (!parsed.success) { setSaving(false); return }

      const parent = defaults.find(d => d.id === parentId)
      const { data, error } = await supabase
        .from('budget_categories')
        .update({
          ...input,
          bucket: parent?.bucket || 'needs',
        })
        .eq('id', editCategory!.id as string)
        .select()
        .single()

      if (error) { setSaving(false); return }
      setToast('Categoría actualizada')
      setTimeout(() => { onCreated(data); onClose(); setToast('') }, 800)
    } else {
      const parsed = createCategorySchema.safeParse(input)
      if (!parsed.success) { setSaving(false); return }

      const parent = defaults.find(d => d.id === parentId)
      const { data, error } = await supabase
        .from('budget_categories')
        .insert({
          household_id: householdId,
          ...input,
          bucket: parent?.bucket || 'needs',
          is_default: false,
          is_custom: true,
        })
        .select()
        .single()

      if (error) { setSaving(false); return }
      setToast('Categoría creada')
      setTimeout(() => { onCreated(data); onClose(); setToast('') }, 800)
    }
    setSaving(false)
  }

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 60,
        background: animating ? 'rgba(0,0,0,0.4)' : 'rgba(0,0,0,0)',
        transition: 'background 300ms ease',
        overflowY: 'auto',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          position: 'absolute', bottom: 0, left: 0, right: 0,
          background: '#fff',
          borderRadius: '20px 20px 0 0',
          paddingBottom: 'env(safe-area-inset-bottom, 20px)',
          transform: animating ? 'translateY(0)' : 'translateY(100%)',
          transition: 'transform 300ms cubic-bezier(0.32, 0.72, 0, 1)',
          maxHeight: '92vh',
          overflowY: 'auto',
        }}
      >
        {/* Drag handle */}
        <div style={{ display: 'flex', justifyContent: 'center', padding: '12px 0 4px' }}>
          <div style={{ width: 36, height: 4, borderRadius: 2, background: '#D1D5DB' }} />
        </div>

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 24px 16px' }}>
          <h2 style={{ fontSize: 20, fontWeight: 700, color: '#1E3A5F', margin: 0 }}>
            {isEdit ? 'Editar categoría' : 'Nueva categoría'}
          </h2>
          <button
            onClick={onClose}
            style={{
              width: 32, height: 32, borderRadius: '50%',
              background: '#F1F5F9', border: 'none', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M4 4l8 8M12 4l-8 8" stroke="#64748B" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </button>
        </div>

        <div style={{ padding: '0 24px 24px', display: 'flex', flexDirection: 'column', gap: 18 }}>
          {/* Live preview */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 12, padding: 16,
            background: '#F8F9FC', borderRadius: 14,
          }}>
            <div style={{
              width: 48, height: 48, borderRadius: 14,
              background: color ? `${color}18` : '#F1F5F9',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 24,
            }}>
              {icon || '❓'}
            </div>
            <div>
              <p style={{ fontSize: 16, fontWeight: 700, color: '#1E3A5F', margin: 0 }}>
                {name.trim() || 'Nombre de categoría'}
              </p>
              <p style={{ fontSize: 12, color: '#94A3B8', margin: 0 }}>
                {defaults.find(d => d.id === parentId)?.name || 'Grupo padre'}
              </p>
            </div>
          </div>

          {/* Name */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#64748B' }}>Nombre</label>
              <span style={{ fontSize: 11, color: name.trim().length > 30 ? '#EF4444' : '#94A3B8' }}>
                {name.trim().length}/30
              </span>
            </div>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Ej: Tuk-tuk, Cuota mamá"
              maxLength={30}
              style={{
                width: '100%', padding: '11px 13px', fontSize: 14,
                border: `1px solid ${isDuplicate ? '#EF4444' : '#E2E8F0'}`,
                borderRadius: 11, background: 'white', color: '#1E3A5F',
                fontFamily: 'inherit', outline: 'none',
              }}
            />
            {isDuplicate && (
              <p style={{ fontSize: 11, color: '#EF4444', marginTop: 4 }}>
                Ya existe una categoría con ese nombre
              </p>
            )}
          </div>

          {/* Emoji */}
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#64748B', display: 'block', marginBottom: 8 }}>
              Emoji
            </label>
            <div style={{
              display: 'grid', gridTemplateColumns: 'repeat(8, 1fr)', gap: 6,
            }}>
              {CATEGORY_EMOJIS.map(e => (
                <button
                  key={e}
                  onClick={() => setIcon(e)}
                  style={{
                    width: '100%', aspectRatio: '1', fontSize: 20,
                    border: icon === e ? '2px solid #2563EB' : '1px solid #E2E8F0',
                    borderRadius: 10, background: icon === e ? '#EFF6FF' : 'white',
                    cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}
                >
                  {e}
                </button>
              ))}
            </div>
          </div>

          {/* Color */}
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#64748B', display: 'block', marginBottom: 8 }}>
              Color
            </label>
            <div style={{ display: 'flex', gap: 8 }}>
              {CATEGORY_COLORS.map(c => (
                <button
                  key={c}
                  onClick={() => setColor(c)}
                  style={{
                    width: 36, height: 36, borderRadius: '50%',
                    background: c, border: color === c ? '3px solid #1E3A5F' : '2px solid transparent',
                    cursor: 'pointer', outline: color === c ? '2px solid white' : 'none',
                    outlineOffset: -4,
                  }}
                />
              ))}
            </div>
          </div>

          {/* Parent group */}
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#64748B', display: 'block', marginBottom: 4 }}>
              Grupo
            </label>
            <p style={{ fontSize: 11, color: '#94A3B8', margin: '0 0 8px' }}>
              El grupo decide cómo cuenta en tu Health Score y en Aprende
            </p>
            <select
              value={parentId}
              onChange={e => setParentId(e.target.value)}
              style={{
                width: '100%', padding: '11px 13px', fontSize: 14,
                border: '1px solid #E2E8F0', borderRadius: 11,
                background: 'white', color: '#1E3A5F',
                fontFamily: 'inherit', outline: 'none',
              }}
            >
              <option value="">Selecciona un grupo</option>
              {defaults.map(d => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          </div>

          {/* Pace mode: Variable / Fijo */}
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#64748B', display: 'block', marginBottom: 8 }}>
              Tipo
            </label>
            <div style={{ display: 'flex', gap: 0, borderRadius: 10, overflow: 'hidden', border: '1px solid #E2E8F0' }}>
              {(['linear', 'fixed'] as const).map(mode => (
                <button
                  key={mode}
                  onClick={() => { setPaceMode(mode); if (mode === 'linear') setExpectedDay(null) }}
                  style={{
                    flex: 1, padding: '10px 0', fontSize: 14, fontWeight: 600,
                    border: 'none', cursor: 'pointer', fontFamily: 'inherit',
                    background: paceMode === mode ? '#1E3A5F' : 'white',
                    color: paceMode === mode ? 'white' : '#64748B',
                    transition: 'all 150ms',
                  }}
                >
                  {mode === 'linear' ? 'Variable' : 'Fijo'}
                </button>
              ))}
            </div>
            {paceMode === 'fixed' && (
              <div style={{ marginTop: 10 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#64748B', display: 'block', marginBottom: 6 }}>
                  Día de pago
                </label>
                <input
                  type="number"
                  min={1}
                  max={31}
                  value={expectedDay || ''}
                  onChange={e => setExpectedDay(parseInt(e.target.value) || null)}
                  placeholder="1-31"
                  style={{
                    width: 100, padding: '9px 13px', fontSize: 14,
                    border: '1px solid #E2E8F0', borderRadius: 11,
                    background: 'white', color: '#1E3A5F',
                    fontFamily: 'inherit', outline: 'none',
                  }}
                />
              </div>
            )}
          </div>

          {/* Budget */}
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#64748B', display: 'block', marginBottom: 6 }}>
              Presupuesto mensual (opcional)
            </label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 15, color: '#64748B', fontWeight: 600 }}>Q</span>
              <input
                type="number"
                min={0}
                value={budget || ''}
                onChange={e => setBudget(parseFloat(e.target.value) || 0)}
                placeholder="0"
                style={{
                  width: 140, padding: '9px 13px', fontSize: 14,
                  border: '1px solid #E2E8F0', borderRadius: 11,
                  background: 'white', color: '#1E3A5F',
                  fontFamily: 'inherit', outline: 'none',
                  textAlign: 'right',
                }}
              />
            </div>
          </div>

          {/* Save button */}
          <button
            onClick={handleSave}
            disabled={!formValid || saving}
            style={{
              width: '100%', padding: 15, fontSize: 15, fontWeight: 700,
              background: formValid && !saving ? '#1E3A5F' : '#CBD5E1',
              color: 'white', border: 'none', borderRadius: 13,
              cursor: formValid && !saving ? 'pointer' : 'not-allowed',
              fontFamily: 'inherit', transition: 'background 200ms',
              marginTop: 4,
            }}
          >
            {saving ? 'Guardando...' : isEdit ? 'Guardar cambios' : 'Crear categoría'}
          </button>
        </div>

        {/* Toast */}
        {toast && (
          <div style={{
            position: 'fixed', bottom: 100, left: '50%', transform: 'translateX(-50%)',
            background: '#1E3A5F', color: 'white', padding: '10px 20px',
            borderRadius: 12, fontSize: 14, fontWeight: 600, zIndex: 70,
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
          }}>
            {toast}
          </div>
        )}
      </div>
    </div>
  )
}
