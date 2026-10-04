'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import {
  CATEGORY_EMOJIS,
  CATEGORY_COLORS,
  createCategorySchema,
  updateCategorySchema,
} from '@/lib/categories'
import { BottomSheet } from '@/components/transactions/BottomSheet'
import { PRIMARY_BUTTON, TEXT_MUTED, TEXT_STRONG, TILE_BG } from '@/components/movimientos/ui'
import {
  DANGER_TEXT_BUTTON, ErrorBox, FieldLabel, INPUT_48, Segmented, SheetHeader,
} from '@/components/layout/Pantalla'
import { BUCKET_GROUPS, type Bucket } from '@/lib/categories-ui'

interface CategorySheetProps {
  open: boolean
  onClose: () => void
  onCreated: (category: Record<string, unknown>) => void
  householdId: string
  defaults: Array<{ id: string; name: string; bucket: string }>
  existingNames: string[]
  editCategory?: Record<string, unknown> | null
  /** Al editar: muestra "Archivar categoría" al final. */
  onArchive?: () => void
}

const CHIP = 'h-11 rounded-full border px-3.5 text-sm font-semibold transition-transform duration-150 active:scale-[0.96]'
const CHIP_ON = 'border-electric bg-electric-ghost text-electric-dark dark:bg-[#1B2B4D] dark:text-electric-soft'
const CHIP_OFF = `border-[var(--zafi-border)] bg-[var(--zafi-card)] ${TEXT_STRONG}`

export function CategorySheet({
  open,
  onClose,
  onCreated,
  householdId,
  defaults,
  existingNames,
  editCategory,
  onArchive,
}: CategorySheetProps) {
  const isEdit = !!editCategory
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [name, setName] = useState('')
  const [icon, setIcon] = useState('')
  const [color, setColor] = useState<string>(CATEGORY_COLORS[0])
  const [parentId, setParentId] = useState('')
  const [bucket, setBucket] = useState<Bucket>('needs')
  const [paceMode, setPaceMode] = useState<'linear' | 'fixed'>('linear')
  const [expectedDay, setExpectedDay] = useState<number | null>(null)
  const [budget, setBudget] = useState(0)

  useEffect(() => {
    if (!open) return
    setError(null)
    if (editCategory) {
      const parent = defaults.find(d => d.id === editCategory.parent_category_id)
      setName((editCategory.name as string) || '')
      setIcon((editCategory.icon as string) || '')
      setColor((editCategory.color as string) || CATEGORY_COLORS[0])
      setParentId((editCategory.parent_category_id as string) || '')
      setBucket(((parent?.bucket ?? editCategory.bucket) as Bucket) || 'needs')
      setPaceMode((editCategory.pace_mode as 'linear' | 'fixed') || 'linear')
      setExpectedDay((editCategory.expected_day as number) || null)
      setBudget((editCategory.budgeted_amount as number) || 0)
    } else {
      // Por defecto un grupo de gasto: las categorías tuyas casi siempre son gastos.
      const first = defaults.find(d => d.bucket === 'needs') ?? defaults.find(d => d.bucket !== 'income') ?? defaults[0]
      setName('')
      setIcon('')
      setColor(CATEGORY_COLORS[0])
      setParentId(first?.id || '')
      setBucket((first?.bucket as Bucket) || 'needs')
      setPaceMode('linear')
      setExpectedDay(null)
      setBudget(0)
    }
  }, [open, editCategory, defaults])

  const nameLower = name.trim().toLowerCase()
  const isDuplicate = existingNames.some(
    n => n.toLowerCase() === nameLower && (!isEdit || (editCategory?.name as string)?.toLowerCase() !== nameLower)
  )
  const nameValid = name.trim().length >= 2 && name.trim().length <= 30 && !isDuplicate
  const formValid = nameValid && icon && parentId

  // Ingresos solo aparece si la categoría ya está ahí.
  const buckets: Bucket[] = bucket === 'income' ? ['needs', 'wants', 'savings', 'income'] : ['needs', 'wants', 'savings']
  const bucketOptions = buckets
    .filter(b => defaults.some(d => d.bucket === b))
    .map(b => ({ value: b, label: b === 'savings' ? 'Ahorro' : BUCKET_GROUPS.find(g => g.bucket === b)!.title }))
  const parents = defaults.filter(d => d.bucket === bucket)

  function pickBucket(b: Bucket) {
    setBucket(b)
    const first = defaults.find(d => d.bucket === b)
    if (first && !parents.some(p => p.id === parentId && p.bucket === b)) setParentId(first.id)
  }

  async function handleSave() {
    if (!formValid || saving) return
    setSaving(true)
    setError(null)

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
      if (!parsed.success) { setSaving(false); setError('Revisa el nombre y el emoji.'); return }

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

      setSaving(false)
      if (error) { setError('No se pudo guardar. Intenta de nuevo.'); return }
      onCreated(data)
      onClose()
    } else {
      const parsed = createCategorySchema.safeParse(input)
      if (!parsed.success) { setSaving(false); setError('Revisa el nombre y el emoji.'); return }

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

      setSaving(false)
      if (error) { setError('No se pudo crear la categoría. Intenta de nuevo.'); return }
      onCreated(data)
      onClose()
    }
  }

  return (
    <BottomSheet themed open={open} onClose={onClose} label={isEdit ? 'Editar categoría' : 'Nueva categoría'}>
      <div className="flex flex-col gap-4 overflow-y-auto px-5 pb-[calc(30px+env(safe-area-inset-bottom))] pt-2.5">
        <SheetHeader
          emoji={icon || '📌'}
          title={isEdit ? (name.trim() || 'Categoría') : 'Nueva categoría'}
          subtitle={isEdit ? 'Cambia su nombre o su grupo' : 'Para ordenar tus gastos a tu manera'}
        />

        {/* Nombre */}
        <div className="flex flex-col gap-1.5">
          <div className="flex items-baseline justify-between">
            <FieldLabel htmlFor="cat-name">Nombre</FieldLabel>
            <span className={`text-xs ${TEXT_MUTED}`}>{name.trim().length}/30</span>
          </div>
          <input
            id="cat-name"
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Ej. Mascota"
            maxLength={30}
            aria-invalid={isDuplicate}
            className={`${INPUT_48} ${isDuplicate ? '!border-danger' : ''}`}
          />
          {isDuplicate && (
            <span className="text-[13px] text-danger-text dark:text-[var(--zafi-error-text)]">Ya existe una categoría con ese nombre</span>
          )}
        </div>

        {/* Grupo */}
        <div className="flex flex-col gap-1.5">
          <span className={`text-[13px] font-bold uppercase tracking-[0.04em] ${TEXT_MUTED}`}>¿En qué grupo va?</span>
          <Segmented label="Grupo" options={bucketOptions} value={bucket} onChange={pickBucket} />
          {parents.length > 1 && (
            <div className="mt-1 flex flex-wrap gap-2" role="radiogroup" aria-label="Dentro de">
              {parents.map(d => (
                <button
                  key={d.id}
                  type="button"
                  role="radio"
                  aria-checked={parentId === d.id}
                  onClick={() => setParentId(d.id)}
                  className={`${CHIP} ${parentId === d.id ? CHIP_ON : CHIP_OFF}`}
                >
                  {d.name}
                </button>
              ))}
            </div>
          )}
          <span className={`text-[13px] leading-[1.4] ${TEXT_MUTED}`}>
            El grupo decide cómo cuenta en Cómo te fue y en tu plan.
          </span>
        </div>

        {/* Emoji */}
        <div className="flex flex-col gap-1.5">
          <span className={`text-[13px] font-bold uppercase tracking-[0.04em] ${TEXT_MUTED}`}>Emoji</span>
          <div className="grid grid-cols-8 gap-1.5" role="radiogroup" aria-label="Emoji">
            {CATEGORY_EMOJIS.map(e => (
              <button
                key={e}
                type="button"
                role="radio"
                aria-checked={icon === e}
                onClick={() => setIcon(e)}
                className={`flex aspect-square min-h-[40px] items-center justify-center rounded-xl border text-xl ${
                  icon === e ? 'border-electric bg-electric-ghost dark:bg-[#1B2B4D]' : `border-transparent ${TILE_BG}`
                }`}
              >
                {e}
              </button>
            ))}
          </div>
        </div>

        {/* Fijo / variable */}
        <div className="flex flex-col gap-1.5">
          <span className={`text-[13px] font-bold uppercase tracking-[0.04em] ${TEXT_MUTED}`}>Tipo</span>
          <Segmented
            label="Tipo"
            options={[{ value: 'linear', label: 'Variable' }, { value: 'fixed', label: 'Fijo' }]}
            value={paceMode}
            onChange={mode => { setPaceMode(mode); if (mode === 'linear') setExpectedDay(null) }}
          />
          {paceMode === 'fixed' && (
            <div className="mt-1 flex items-center gap-3">
              <FieldLabel htmlFor="cat-day">Día de pago</FieldLabel>
              <input
                id="cat-day"
                type="number"
                inputMode="numeric"
                min={1}
                max={31}
                value={expectedDay || ''}
                onChange={e => setExpectedDay(parseInt(e.target.value) || null)}
                placeholder="1-31"
                className={`${INPUT_48} !w-24`}
              />
            </div>
          )}
        </div>

        {/* Presupuesto */}
        <div className="flex flex-col gap-1.5">
          <FieldLabel htmlFor="cat-budget">Plan mensual (opcional)</FieldLabel>
          <input
            id="cat-budget"
            type="number"
            inputMode="decimal"
            min={0}
            value={budget || ''}
            onChange={e => setBudget(parseFloat(e.target.value) || 0)}
            placeholder="0"
            className={`${INPUT_48} !w-40 text-right font-outfit`}
          />
        </div>

        {error && <ErrorBox>{error}</ErrorBox>}

        <button type="button" onClick={handleSave} disabled={!formValid || saving} className={PRIMARY_BUTTON}>
          {saving ? 'Guardando…' : isEdit ? 'Guardar' : 'Crear categoría'}
        </button>
        {isEdit && onArchive && (
          <button type="button" onClick={onArchive} className={DANGER_TEXT_BUTTON}>Archivar categoría</button>
        )}
      </div>
    </BottomSheet>
  )
}
