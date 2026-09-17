'use client'

import { useState } from 'react'
import { CategorySheet } from './CategorySheet'
import { MAX_CUSTOM_CATEGORIES } from '@/lib/categories'

interface CategoryItem {
  id: string
  name: string
  bucket: string
  icon?: string | null
  color?: string | null
  is_default: boolean
  parent_category_id?: string | null
  pace_mode?: string
  expected_day?: number | null
  budgeted_amount?: number
  archived_at?: string | null
}

interface CategoryGridProps {
  categories: CategoryItem[]
  hiddenIds: Set<string>
  selectedId: string
  onSelect: (id: string) => void
  householdId: string
  onCategoryCreated?: (category: Record<string, unknown>) => void
}

export function CategoryGrid({
  categories,
  hiddenIds,
  selectedId,
  onSelect,
  householdId,
  onCategoryCreated,
}: CategoryGridProps) {
  const [sheetOpen, setSheetOpen] = useState(false)
  const [capMessage, setCapMessage] = useState(false)

  const custom = categories.filter(c => !c.is_default && !c.archived_at)
  const defaults = categories.filter(c => c.is_default && !hiddenIds.has(c.id))
  const activeCustomCount = custom.length
  const atCap = activeCustomCount >= MAX_CUSTOM_CATEGORIES

  const defaultsForSheet = categories
    .filter(c => c.is_default)
    .map(c => ({ id: c.id, name: c.name, bucket: c.bucket }))

  const existingNames = categories
    .filter(c => !c.archived_at)
    .map(c => c.name)

  function handleCreateClick() {
    if (atCap) {
      setCapMessage(true)
      setTimeout(() => setCapMessage(false), 3000)
    } else {
      setSheetOpen(true)
    }
  }

  function handleCreated(cat: Record<string, unknown>) {
    onSelect(cat.id as string)
    onCategoryCreated?.(cat)
  }

  const cardStyle = (isSelected: boolean, bg: string) => ({
    display: 'flex', flexDirection: 'column' as const,
    alignItems: 'center', justifyContent: 'center',
    gap: 6, padding: '14px 6px',
    borderRadius: 14,
    border: isSelected ? '2px solid #2563EB' : '1.5px solid #E2E8F0',
    background: isSelected ? '#EFF6FF' : bg,
    cursor: 'pointer',
    transition: 'all 150ms',
    minHeight: 80,
  })

  return (
    <>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {/* Custom categories */}
        {custom.length > 0 && (
          <div>
            <p style={{ fontSize: 11, fontWeight: 700, color: '#94A3B8', letterSpacing: '.06em', marginBottom: 8 }}>
              TUS CATEGORÍAS
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
              {custom.map(cat => (
                <button
                  key={cat.id}
                  onClick={() => onSelect(cat.id)}
                  title={cat.name}
                  style={cardStyle(selectedId === cat.id, 'white')}
                >
                  <span style={{ fontSize: 22 }}>{cat.icon || '📌'}</span>
                  <span style={{
                    fontSize: 11, fontWeight: 600, color: '#1E3A5F',
                    textAlign: 'center', width: '100%',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    padding: '0 2px',
                  }}>
                    {cat.name}
                  </span>
                </button>
              ))}
              {/* Create button inside custom section */}
              <button
                onClick={handleCreateClick}
                style={{
                  ...cardStyle(false, 'white'),
                  border: '1.5px dashed #93C5FD',
                }}
              >
                <span style={{ fontSize: 22, color: '#93C5FD' }}>+</span>
                <span style={{
                  fontSize: 10, fontWeight: 600, color: '#93C5FD',
                  textAlign: 'center',
                }}>
                  Crear
                </span>
              </button>
            </div>
          </div>
        )}

        {/* Default categories */}
        <div>
          <p style={{ fontSize: 11, fontWeight: 700, color: '#94A3B8', letterSpacing: '.06em', marginBottom: 8 }}>
            CATEGORÍAS DE ZAFI
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
            {defaults.map(cat => (
              <button
                key={cat.id}
                onClick={() => onSelect(cat.id)}
                title={cat.name}
                style={cardStyle(selectedId === cat.id, 'white')}
              >
                <span style={{ fontSize: 22 }}>{cat.icon || '📂'}</span>
                <span style={{
                  fontSize: 11, fontWeight: 600, color: '#1E3A5F',
                  textAlign: 'center', width: '100%',
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  padding: '0 2px',
                }}>
                  {cat.name}
                </span>
              </button>
            ))}
            {/* Create button if no custom cats yet */}
            {custom.length === 0 && (
              <button
                onClick={handleCreateClick}
                style={{
                  ...cardStyle(false, 'white'),
                  border: '1.5px dashed #93C5FD',
                }}
              >
                <span style={{ fontSize: 22, color: '#93C5FD' }}>+</span>
                <span style={{
                  fontSize: 10, fontWeight: 600, color: '#93C5FD',
                  textAlign: 'center',
                }}>
                  Crear
                </span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Cap reached message */}
      {capMessage && (
        <div style={{
          marginTop: 10, padding: '10px 14px',
          background: '#FEF3C7', borderRadius: 10,
          fontSize: 13, color: '#92400E', lineHeight: 1.5,
        }}>
          Llegaste al tope de {MAX_CUSTOM_CATEGORIES} categorías. Archiva alguna desde Ajustes.
        </div>
      )}

      <CategorySheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        onCreated={handleCreated}
        householdId={householdId}
        defaults={defaultsForSheet}
        existingNames={existingNames}
      />
    </>
  )
}
