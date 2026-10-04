'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { getUserHousehold } from '@/lib/household'
import { useFormatMoney } from '@/lib/hooks/useFormatMoney'
import { AppShell } from '@/components/layout/AppShell'
import { CategorySheet } from '@/components/categories/CategorySheet'
import { BottomSheet } from '@/components/transactions/BottomSheet'
import { StatusToast, type StatusMessage } from '@/components/movimientos/StatusToast'
import { PageSkeleton } from '@/components/motion/PageSkeleton'
import { Switch } from '@/components/cuenta/AccountUI'
import { PRIMARY_BUTTON, TEXT_MUTED, TEXT_STRONG } from '@/components/movimientos/ui'
import { CARD } from '@/components/resumen/ctf-ui'
import {
  BADGE_INFO, BADGE_NEUTRAL, BADGE_OK, BADGE_WARN, Chevron, FieldLabel, GroupTitle, INPUT_48, ListCard, PageHeader,
  PILL_OUTLINE, PillButton, ROW_DIVIDER, RowBody, SheetHeader, Tile,
} from '@/components/layout/Pantalla'
import { BUCKET_GROUPS, getEmoji } from '@/lib/categories-ui'
import {
  MAX_CUSTOM_CATEGORIES,
  MIN_VISIBLE_DEFAULTS,
} from '@/lib/categories'

interface CategoryItem {
  id: string
  name: string
  bucket: string
  icon?: string | null
  color?: string | null
  is_default: boolean
  is_custom?: boolean
  parent_category_id?: string | null
  pace_mode?: string
  expected_day?: number | null
  budgeted_amount?: number
  archived_at?: string | null
}

/** Pill del grupo: Lo básico (gris), Gustos (azul), Ahorro y deudas (verde), Ingresos (ámbar). */
const GROUP_BADGE: Record<string, string> = {
  needs: BADGE_NEUTRAL,
  wants: BADGE_INFO,
  savings: BADGE_OK,
  income: BADGE_WARN,
}

function groupTitle(bucket: string): string {
  return BUCKET_GROUPS.find(g => g.bucket === bucket)?.title ?? 'Lo básico'
}

export default function CategoriasPage() {
  const [loading, setLoading] = useState(true)
  const [categories, setCategories] = useState<CategoryItem[]>([])
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(new Set())
  const [householdId, setHouseholdId] = useState('')
  const [sheetOpen, setSheetOpen] = useState(false)
  const [editCategory, setEditCategory] = useState<CategoryItem | null>(null)
  const [archiveTarget, setArchiveTarget] = useState<CategoryItem | null>(null)
  const [reassignId, setReassignId] = useState('')
  const [archiving, setArchiving] = useState(false)
  const [message, setMessage] = useState<StatusMessage | null>(null)
  const router = useRouter()
  const fmt = useFormatMoney()

  const supabase = createClient()

  const loadCategories = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }

    // Igual que Cerrar el mes: los miembros invitados también ven las categorías del hogar.
    const hh = await getUserHousehold(supabase, user.id)
    if (!hh) { router.push('/dashboard'); return }
    setHouseholdId(hh.id)

    const [catResult, hiddenResult] = await Promise.all([
      supabase
        .from('budget_categories')
        .select('id, name, bucket, icon, color, is_default, is_custom, parent_category_id, pace_mode, expected_day, budgeted_amount, archived_at')
        .eq('household_id', hh.id)
        .order('created_at', { ascending: true }),
      supabase
        .from('household_hidden_categories')
        .select('category_id')
        .eq('household_id', hh.id),
    ])

    setCategories((catResult.data || []) as CategoryItem[])
    setHiddenIds(new Set((hiddenResult.data || []).map(h => h.category_id)))
    setLoading(false)
  }, [supabase, router])

  useEffect(() => {
    loadCategories()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const custom = categories.filter(c => !c.is_default && !c.archived_at)
  const archived = categories.filter(c => !c.is_default && c.archived_at)
  const defaults = categories.filter(c => c.is_default)
  const visibleDefaults = defaults.filter(d => !hiddenIds.has(d.id))

  const defaultsForSheet = defaults.map(c => ({ id: c.id, name: c.name, bucket: c.bucket }))
  const existingNames = categories.filter(c => !c.archived_at).map(c => c.name)

  function showToast(text: string, tone: StatusMessage['tone'] = 'ok') {
    setMessage({ text, tone })
  }

  const closeSheet = useCallback(() => { setSheetOpen(false); setEditCategory(null) }, [])
  const closeArchive = useCallback(() => { setArchiveTarget(null); setReassignId('') }, [])
  const clearMessage = useCallback(() => setMessage(null), [])

  function handleEdit(cat: CategoryItem) {
    setEditCategory(cat)
    setSheetOpen(true)
  }

  function handleCreate() {
    setEditCategory(null)
    setSheetOpen(true)
  }

  function handleSheetCreated() {
    showToast(editCategory ? 'Guardado' : 'Categoría creada')
    setSheetOpen(false)
    setEditCategory(null)
    loadCategories()
  }

  function openArchive() {
    if (!editCategory) return
    setSheetOpen(false)
    setArchiveTarget(editCategory)
    setReassignId('')
  }

  async function handleArchive() {
    if (!archiveTarget || archiving) return
    setArchiving(true)

    const { count: txCount } = await supabase
      .from('transactions')
      .select('id', { count: 'exact', head: true })
      .eq('category_id', archiveTarget.id)

    if ((txCount ?? 0) > 0 && !reassignId) {
      setArchiving(false)
      showToast('Elige a dónde mover sus movimientos', 'error')
      return
    }

    if (reassignId) {
      await supabase
        .from('transactions')
        .update({ category_id: reassignId })
        .eq('category_id', archiveTarget.id)
    }

    await supabase
      .from('budget_categories')
      .update({ archived_at: new Date().toISOString() })
      .eq('id', archiveTarget.id)

    setArchiving(false)
    setArchiveTarget(null)
    setReassignId('')
    showToast(`${archiveTarget.name} archivada`)
    loadCategories()
  }

  async function handleRestore(cat: CategoryItem) {
    if (custom.length >= MAX_CUSTOM_CATEGORIES) {
      showToast(`Máximo ${MAX_CUSTOM_CATEGORIES} categorías activas`, 'error')
      return
    }

    const nameLower = cat.name.toLowerCase()
    const dup = categories.find(c => !c.archived_at && c.name.toLowerCase() === nameLower && c.id !== cat.id)
    if (dup) {
      showToast('Ya existe una categoría activa con ese nombre', 'error')
      return
    }

    await supabase
      .from('budget_categories')
      .update({ archived_at: null })
      .eq('id', cat.id)

    showToast(`${cat.name} restaurada`)
    loadCategories()
  }

  async function toggleDefaultVisibility(catId: string, currentlyVisible: boolean) {
    if (currentlyVisible && visibleDefaults.length <= MIN_VISIBLE_DEFAULTS) {
      showToast(`Deja al menos ${MIN_VISIBLE_DEFAULTS} visibles`, 'error')
      return
    }

    if (currentlyVisible) {
      await supabase
        .from('household_hidden_categories')
        .upsert({ household_id: householdId, category_id: catId })
      setHiddenIds(prev => { const next = new Set(Array.from(prev)); next.add(catId); return next })
    } else {
      await supabase
        .from('household_hidden_categories')
        .delete()
        .eq('household_id', householdId)
        .eq('category_id', catId)
      setHiddenIds(prev => {
        const next = new Set(prev)
        next.delete(catId)
        return next
      })
    }
  }

  if (loading) {
    return <PageSkeleton variant="list" />
  }

  const atMax = custom.length >= MAX_CUSTOM_CATEGORIES
  const help = (cat: CategoryItem) => [
    cat.pace_mode === 'fixed' ? `Fijo${cat.expected_day ? ` · día ${cat.expected_day}` : ''}` : 'Variable',
    cat.budgeted_amount ? fmt(cat.budgeted_amount) : null,
  ].filter(Boolean).join(' · ')
  const newButton = (
    <PillButton
      onClick={handleCreate}
      disabled={atMax}
      className="flex h-9 items-center rounded-full bg-electric px-3.5 text-sm font-bold text-white transition duration-150 group-active:scale-[0.96]"
    >
      + Nueva
    </PillButton>
  )
  const counter = `Tienes ${custom.length} de ${MAX_CUSTOM_CATEGORIES} categorías tuyas.`

  return (
    <AppShell title="Categorías" currentPath="/cuenta" hideMobileBar headerRight={newButton}>
      <div className="mx-auto flex max-w-2xl flex-col lg:mx-0">
        <PageHeader back={{ href: '/cuenta', label: 'Cuenta' }} title="Categorías" subtitle={counter} right={newButton} />
        <p className={`hidden text-sm lg:block ${TEXT_MUTED}`}>{counter}</p>

        <GroupTitle>Tus categorías</GroupTitle>
        {custom.length === 0 ? (
          <div className={`flex flex-col items-start gap-1.5 p-5 ${CARD}`}>
            <span className={`text-[15px] font-semibold ${TEXT_STRONG}`}>Aún no tienes categorías tuyas</span>
            <span className={`text-sm leading-[1.45] ${TEXT_MUTED}`}>Crea una para ordenar tus gastos a tu manera.</span>
            <button
              type="button"
              onClick={handleCreate}
              className="mt-2 flex h-11 items-center rounded-full bg-electric px-5 text-[15px] font-bold text-white transition-transform duration-150 active:scale-[0.97]"
            >
              Crear mi primera categoría
            </button>
          </div>
        ) : (
          <ListCard>
            {custom.map(cat => (
              <button
                key={cat.id}
                type="button"
                onClick={() => handleEdit(cat)}
                className={`flex w-full items-center gap-3 py-3 ${ROW_DIVIDER}`}
              >
                <RowBody tile={<Tile>{getEmoji(cat)}</Tile>} name={cat.name} help={help(cat)} />
                <span className={`${GROUP_BADGE[cat.bucket] ?? BADGE_NEUTRAL} !text-xs`}>{groupTitle(cat.bucket)}</span>
                <Chevron />
              </button>
            ))}
          </ListCard>
        )}

        {archived.length > 0 && (
          <>
            <GroupTitle>Archivadas</GroupTitle>
            <ListCard>
              {archived.map(cat => (
                <div key={cat.id} className={`flex items-center gap-3 py-3 ${ROW_DIVIDER}`}>
                  <RowBody tile={<Tile>{getEmoji(cat)}</Tile>} name={cat.name} help="Ya no aparece al agregar" />
                  <PillButton onClick={() => handleRestore(cat)} className={PILL_OUTLINE}>Restaurar</PillButton>
                </div>
              ))}
            </ListCard>
          </>
        )}

        <GroupTitle className="mb-0.5 mt-[22px]">Categorías de Zafi</GroupTitle>
        <p className={`mx-1 mb-1.5 text-[13px] ${TEXT_MUTED}`}>Oculta las que no uses. Deja al menos {MIN_VISIBLE_DEFAULTS}.</p>
        <ListCard>
          {defaults.map(cat => {
            const isVisible = !hiddenIds.has(cat.id)
            return (
              <div key={cat.id} className={`flex items-center gap-3 py-2.5 ${ROW_DIVIDER}`}>
                <Tile>{getEmoji(cat)}</Tile>
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className={`truncate text-[15px] font-semibold ${isVisible ? TEXT_STRONG : TEXT_MUTED}`}>{cat.name}</span>
                  <span className={`text-[13px] ${TEXT_MUTED}`}>{isVisible ? groupTitle(cat.bucket) : `Oculta · ${groupTitle(cat.bucket)}`}</span>
                </span>
                <Switch
                  checked={isVisible}
                  onChange={() => toggleDefaultVisibility(cat.id, isVisible)}
                  label={`Mostrar ${cat.name}`}
                />
              </div>
            )
          })}
        </ListCard>
      </div>

      {/* Archivar */}
      <BottomSheet themed open={!!archiveTarget} onClose={closeArchive} label="Archivar categoría">
        {archiveTarget && (
          <div className="flex flex-col gap-3.5 px-5 pb-[calc(30px+env(safe-area-inset-bottom))] pt-2.5">
            <SheetHeader emoji={getEmoji(archiveTarget)} title={`Archivar ${archiveTarget.name}`} subtitle="Ya no aparecerá al agregar un gasto" />
            <div className="flex flex-col gap-1.5">
              <FieldLabel htmlFor="reassign">Mover sus movimientos a</FieldLabel>
              <select
                id="reassign"
                value={reassignId}
                onChange={e => setReassignId(e.target.value)}
                className={INPUT_48}
              >
                <option value="">No mover</option>
                {categories
                  .filter(c => !c.archived_at && c.id !== archiveTarget.id)
                  .map(c => (
                    <option key={c.id} value={c.id}>{getEmoji(c)} {c.name}</option>
                  ))}
              </select>
              <span className={`text-[13px] leading-[1.4] ${TEXT_MUTED}`}>Si tiene movimientos, elige a dónde moverlos.</span>
            </div>
            <button
              type="button"
              onClick={handleArchive}
              disabled={archiving}
              className={`${PRIMARY_BUTTON} !bg-danger-text hover:!bg-danger-text`}
            >
              {archiving ? 'Archivando…' : 'Archivar'}
            </button>
          </div>
        )}
      </BottomSheet>

      <CategorySheet
        open={sheetOpen}
        onClose={closeSheet}
        onCreated={handleSheetCreated}
        householdId={householdId}
        defaults={defaultsForSheet}
        existingNames={existingNames}
        editCategory={editCategory as Record<string, unknown> | null}
        onArchive={openArchive}
      />

      <StatusToast message={message} onDone={clearMessage} />
    </AppShell>
  )
}
