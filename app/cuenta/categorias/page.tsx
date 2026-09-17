'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { AppShell } from '@/components/layout/AppShell'
import { CategorySheet } from '@/components/categories/CategorySheet'
import {
  MAX_CUSTOM_CATEGORIES,
  MIN_VISIBLE_DEFAULTS,
  COUNTER_VISIBLE_FROM,
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
  const [toast, setToast] = useState('')
  const [debugError, setDebugError] = useState('')
  const router = useRouter()

  const supabase = createClient()

  const loadCategories = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }

    const { data: hh } = await supabase
      .from('households').select('id').eq('owner_id', user.id).limit(1).single()
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

    console.log('[DEBUG Categorias] catResult:', { data: catResult.data?.length ?? 0, error: catResult.error })
    console.log('[DEBUG Categorias] hiddenResult:', { data: hiddenResult.data?.length ?? 0, error: hiddenResult.error })
    if (catResult.error) {
      console.error('[DEBUG Categorias] Query error:', catResult.error.message, catResult.error.details)
      setDebugError(`Cat error: ${catResult.error.message}`)
    }
    if (hiddenResult.error) {
      setDebugError(prev => prev + ` | Hidden error: ${hiddenResult.error!.message}`)
    }

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

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(''), 2500)
  }

  function handleEdit(cat: CategoryItem) {
    setEditCategory(cat)
    setSheetOpen(true)
  }

  function handleCreate() {
    setEditCategory(null)
    setSheetOpen(true)
  }

  function handleSheetCreated() {
    setSheetOpen(false)
    setEditCategory(null)
    loadCategories()
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
      showToast('Elige a dónde mover los gastos')
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
    showToast('Categoría archivada')
    loadCategories()
  }

  async function handleRestore(cat: CategoryItem) {
    if (custom.length >= MAX_CUSTOM_CATEGORIES) {
      showToast(`Máximo ${MAX_CUSTOM_CATEGORIES} categorías activas`)
      return
    }

    const nameLower = cat.name.toLowerCase()
    const dup = categories.find(c => !c.archived_at && c.name.toLowerCase() === nameLower && c.id !== cat.id)
    if (dup) {
      showToast('Ya existe una categoría activa con ese nombre')
      return
    }

    await supabase
      .from('budget_categories')
      .update({ archived_at: null })
      .eq('id', cat.id)

    showToast('Categoría restaurada')
    loadCategories()
  }

  async function toggleDefaultVisibility(catId: string, currentlyVisible: boolean) {
    if (currentlyVisible && visibleDefaults.length <= MIN_VISIBLE_DEFAULTS) {
      showToast(`Deja al menos ${MIN_VISIBLE_DEFAULTS} categorías visibles`)
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
    return (
      <AppShell title="Categorías" currentPath="/cuenta">
        <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
          <div style={{
            width: 32, height: 32, borderRadius: '50%',
            border: '3px solid #DBEAFE', borderTopColor: '#2563EB',
            animation: 'spin 0.8s linear infinite',
          }}/>
          <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
        </div>
      </AppShell>
    )
  }

  const showCounter = custom.length >= COUNTER_VISIBLE_FROM

  return (
    <AppShell title="Categorías" currentPath="/cuenta">
      <div style={{ maxWidth: 600, margin: '0 auto' }}>

        {debugError && (
          <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 10, padding: 12, marginBottom: 16, fontSize: 12, color: '#DC2626', wordBreak: 'break-all' }}>
            <strong>DEBUG:</strong> {debugError}
          </div>
        )}

        {/* Counter + Create button */}
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          marginBottom: 20,
        }}>
          <div>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: '#1E3A5F', margin: 0 }}>
              Tus categorías
            </h2>
            {showCounter && (
              <p style={{ fontSize: 12, color: '#94A3B8', margin: '4px 0 0' }}>
                {custom.length} de {MAX_CUSTOM_CATEGORIES} activas
              </p>
            )}
          </div>
          <button
            onClick={handleCreate}
            disabled={custom.length >= MAX_CUSTOM_CATEGORIES}
            style={{
              padding: '9px 18px', fontSize: 13, fontWeight: 600,
              background: custom.length >= MAX_CUSTOM_CATEGORIES ? '#CBD5E1' : '#1E3A5F',
              color: 'white', border: 'none', borderRadius: 10,
              cursor: custom.length >= MAX_CUSTOM_CATEGORIES ? 'not-allowed' : 'pointer',
              fontFamily: 'inherit',
            }}
          >
            + Nueva categoría
          </button>
        </div>

        {/* Custom categories list */}
        {custom.length === 0 ? (
          <div style={{
            padding: '40px 20px', textAlign: 'center',
            background: 'white', borderRadius: 16,
            border: '1px solid #E2E8F0', marginBottom: 24,
          }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>📂</div>
            <p style={{ fontSize: 15, fontWeight: 600, color: '#1E3A5F', margin: '0 0 6px' }}>
              Sin categorías personalizadas
            </p>
            <p style={{ fontSize: 13, color: '#94A3B8', margin: '0 0 16px', lineHeight: 1.5 }}>
              Crea categorías para organizar tus gastos a tu manera.
            </p>
            <button
              onClick={handleCreate}
              style={{
                padding: '10px 22px', fontSize: 13, fontWeight: 600,
                background: '#1E3A5F', color: 'white', border: 'none',
                borderRadius: 10, cursor: 'pointer', fontFamily: 'inherit',
              }}
            >
              Crear primera categoría
            </button>
          </div>
        ) : (
          <div style={{
            background: 'white', borderRadius: 16,
            border: '1px solid #E2E8F0', overflow: 'hidden',
            marginBottom: 24,
          }}>
            {custom.map((cat, i) => (
              <div
                key={cat.id}
                style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '14px 16px',
                  borderBottom: i < custom.length - 1 ? '1px solid #F1F5F9' : 'none',
                }}
              >
                <div style={{
                  width: 40, height: 40, borderRadius: 12,
                  background: cat.color ? `${cat.color}18` : '#F1F5F9',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 20, flexShrink: 0,
                }}>
                  {cat.icon || '📌'}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{
                    fontSize: 14, fontWeight: 600, color: '#1E3A5F', margin: 0,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {cat.name}
                  </p>
                  <p style={{ fontSize: 11, color: '#94A3B8', margin: 0 }}>
                    {defaults.find(d => d.id === cat.parent_category_id)?.name || cat.bucket}
                    {cat.pace_mode === 'fixed' && cat.expected_day ? ` · Día ${cat.expected_day}` : ''}
                    {cat.budgeted_amount ? ` · Q${cat.budgeted_amount}` : ''}
                  </p>
                </div>
                <button
                  onClick={() => handleEdit(cat)}
                  style={{
                    padding: '6px 12px', fontSize: 12, fontWeight: 600,
                    background: '#F1F5F9', color: '#64748B', border: 'none',
                    borderRadius: 8, cursor: 'pointer', fontFamily: 'inherit',
                  }}
                >
                  Editar
                </button>
                <button
                  onClick={() => { setArchiveTarget(cat); setReassignId('') }}
                  style={{
                    padding: '6px 12px', fontSize: 12, fontWeight: 600,
                    background: '#FEF2F2', color: '#DC2626', border: 'none',
                    borderRadius: 8, cursor: 'pointer', fontFamily: 'inherit',
                  }}
                >
                  Archivar
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Archived categories */}
        {archived.length > 0 && (
          <div style={{ marginBottom: 24 }}>
            <h3 style={{ fontSize: 14, fontWeight: 700, color: '#94A3B8', marginBottom: 10 }}>
              Archivadas ({archived.length})
            </h3>
            <div style={{
              background: 'white', borderRadius: 16,
              border: '1px solid #E2E8F0', overflow: 'hidden',
            }}>
              {archived.map((cat, i) => (
                <div
                  key={cat.id}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    padding: '12px 16px',
                    borderBottom: i < archived.length - 1 ? '1px solid #F1F5F9' : 'none',
                    opacity: 0.7,
                  }}
                >
                  <div style={{
                    width: 36, height: 36, borderRadius: 10,
                    background: '#F1F5F9',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 18, flexShrink: 0,
                  }}>
                    {cat.icon || '📌'}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{
                      fontSize: 13, fontWeight: 600, color: '#64748B', margin: 0,
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>
                      {cat.name}
                    </p>
                  </div>
                  <button
                    onClick={() => handleRestore(cat)}
                    style={{
                      padding: '6px 14px', fontSize: 12, fontWeight: 600,
                      background: '#F0FDF4', color: '#16A34A', border: 'none',
                      borderRadius: 8, cursor: 'pointer', fontFamily: 'inherit',
                    }}
                  >
                    Restaurar
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Default categories visibility */}
        <div style={{ marginBottom: 24 }}>
          <h3 style={{ fontSize: 14, fontWeight: 700, color: '#94A3B8', marginBottom: 4 }}>
            Categorías de Zafi
          </h3>
          <p style={{ fontSize: 12, color: '#94A3B8', margin: '0 0 12px' }}>
            Oculta las que no uses. Mínimo {MIN_VISIBLE_DEFAULTS} visibles.
          </p>
          <div style={{
            background: 'white', borderRadius: 16,
            border: '1px solid #E2E8F0', overflow: 'hidden',
          }}>
            {defaults.map((cat, i) => {
              const isVisible = !hiddenIds.has(cat.id)
              return (
                <div
                  key={cat.id}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    padding: '12px 16px',
                    borderBottom: i < defaults.length - 1 ? '1px solid #F1F5F9' : 'none',
                    opacity: isVisible ? 1 : 0.5,
                  }}
                >
                  <div style={{
                    width: 36, height: 36, borderRadius: 10,
                    background: '#F1F5F9',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 18, flexShrink: 0,
                  }}>
                    {cat.icon || '📂'}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{
                      fontSize: 13, fontWeight: 600, color: '#1E3A5F', margin: 0,
                    }}>
                      {cat.name}
                    </p>
                    <p style={{ fontSize: 11, color: '#94A3B8', margin: 0 }}>
                      {cat.bucket === 'needs' ? 'Necesidades' : cat.bucket === 'wants' ? 'Gustos' : 'Ahorro/Deudas'}
                    </p>
                  </div>
                  <button
                    onClick={() => toggleDefaultVisibility(cat.id, isVisible)}
                    style={{
                      position: 'relative',
                      width: 44, height: 24, borderRadius: 12,
                      background: isVisible ? '#2563EB' : '#E2E8F0',
                      border: 'none', cursor: 'pointer',
                      transition: 'background 200ms',
                      flexShrink: 0,
                    }}
                  >
                    <div style={{
                      position: 'absolute', top: 2, left: isVisible ? 22 : 2,
                      width: 20, height: 20, borderRadius: '50%',
                      background: 'white',
                      transition: 'left 200ms',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                    }} />
                  </button>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Archive confirmation dialog */}
      {archiveTarget && (
        <div
          onClick={() => { setArchiveTarget(null); setReassignId('') }}
          style={{
            position: 'fixed', inset: 0, zIndex: 60,
            background: 'rgba(0,0,0,0.4)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: 20,
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: 'white', borderRadius: 20, padding: 24,
              maxWidth: 380, width: '100%',
              boxShadow: '0 8px 30px rgba(0,0,0,0.12)',
            }}
          >
            <h3 style={{ fontSize: 17, fontWeight: 700, color: '#1E3A5F', margin: '0 0 8px' }}>
              Archivar &quot;{archiveTarget.name}&quot;
            </h3>
            <p style={{ fontSize: 13, color: '#64748B', margin: '0 0 16px', lineHeight: 1.5 }}>
              La categoría dejará de aparecer en la captura. Los gastos existentes se pueden mover a otra categoría.
            </p>

            <label style={{ fontSize: 12, fontWeight: 600, color: '#64748B', display: 'block', marginBottom: 6 }}>
              Mover gastos a (opcional)
            </label>
            <select
              value={reassignId}
              onChange={e => setReassignId(e.target.value)}
              style={{
                width: '100%', padding: '10px 12px', fontSize: 13,
                border: '1px solid #E2E8F0', borderRadius: 10,
                background: 'white', color: '#1E3A5F',
                fontFamily: 'inherit', outline: 'none',
                marginBottom: 18,
              }}
            >
              <option value="">No mover (eliminar asignación)</option>
              {categories
                .filter(c => !c.archived_at && c.id !== archiveTarget.id)
                .map(c => (
                  <option key={c.id} value={c.id}>{c.icon} {c.name}</option>
                ))
              }
            </select>

            <div style={{ display: 'flex', gap: 10 }}>
              <button
                onClick={() => { setArchiveTarget(null); setReassignId('') }}
                style={{
                  flex: 1, padding: 12, fontSize: 13, fontWeight: 600,
                  background: '#F1F5F9', color: '#64748B', border: 'none',
                  borderRadius: 10, cursor: 'pointer', fontFamily: 'inherit',
                }}
              >
                Cancelar
              </button>
              <button
                onClick={handleArchive}
                disabled={archiving}
                style={{
                  flex: 1, padding: 12, fontSize: 13, fontWeight: 600,
                  background: archiving ? '#FCA5A5' : '#DC2626', color: 'white',
                  border: 'none', borderRadius: 10,
                  cursor: archiving ? 'wait' : 'pointer', fontFamily: 'inherit',
                }}
              >
                {archiving ? 'Archivando...' : 'Archivar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Category create/edit sheet */}
      <CategorySheet
        open={sheetOpen}
        onClose={() => { setSheetOpen(false); setEditCategory(null) }}
        onCreated={handleSheetCreated}
        householdId={householdId}
        defaults={defaultsForSheet}
        existingNames={existingNames}
        editCategory={editCategory as Record<string, unknown> | null}
      />

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
    </AppShell>
  )
}
