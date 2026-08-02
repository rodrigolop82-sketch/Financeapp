'use client'

import React, { useState } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Plus, Trash2, ChevronDown, ChevronUp, X } from 'lucide-react'
import type { BudgetCategory, BudgetSubItem, IncomeEntry } from '@/types'

const INCOME_SUGGESTIONS = ['Salario', 'Bonos', 'Freelance', 'Alquiler', 'Negocio', 'Pensión', 'Remesas', 'Otros']

const FREQUENCY_MULTIPLIER: Record<string, number> = {
  mensual: 1,
  quincenal: 2,
  semanal: 4.33,
  anual: 1 / 12,
}

const BUCKETS: { key: 'needs' | 'wants' | 'savings'; label: string; color: string }[] = [
  { key: 'needs',   label: 'Necesidades (50%)',   color: '#1E3A5F' },
  { key: 'wants',   label: 'Gustos (30%)',         color: '#2563EB' },
  { key: 'savings', label: 'Ahorro/Deudas (20%)',  color: '#8fc1fb' },
]

interface Props {
  level: 0 | 1 | 2
  onSetLevel: (level: 0 | 1 | 2) => void
  income: number
  incomeEntries: IncomeEntry[]
  categories: BudgetCategory[]
  subItems: BudgetSubItem[]
  bucketTotals: { needs: number; wants: number; savings: number }
  totalBudgeted: number
  expandedCats: Set<string>
  onToggleCat: (id: string) => void
  onUpdateAmount: (id: string, amount: number) => void
  onUpdateSubAmount: (id: string, amount: number) => void
  onDeleteCategory: (id: string) => void
  onDeleteSubItem: (id: string) => void
  onToggleSubFixed: (id: string) => void
  onUpdateSubPayment: (id: string, method: BudgetSubItem['payment_method']) => void
  onUpdateSubRecurrence: (id: string, recurrence: BudgetSubItem['recurrence']) => void
  onAddSubItem: (categoryId: string, name: string, amount: number, isFixed: boolean, payment: BudgetSubItem['payment_method'], recurrence: BudgetSubItem['recurrence']) => void
  onAddCategory: (bucket: 'needs' | 'wants' | 'savings', name: string) => void
  onAddIncomeEntry: (source?: string) => void
  onUpdateIncomeEntry: (id: string, field: string, value: string | number) => void
  onDeleteIncomeEntry: (id: string) => void
  getCategoryTotal: (catId: string) => number
  monthlyAmount: (amount: number, freq: string) => number
  fmt: (amount: number) => string
}

export function BudgetDefinition({
  level, onSetLevel, income, incomeEntries, categories, subItems,
  bucketTotals, totalBudgeted, expandedCats,
  onToggleCat, onUpdateAmount, onUpdateSubAmount,
  onDeleteCategory, onDeleteSubItem, onToggleSubFixed,
  onUpdateSubPayment, onUpdateSubRecurrence,
  onAddSubItem, onAddCategory,
  onAddIncomeEntry, onUpdateIncomeEntry, onDeleteIncomeEntry,
  getCategoryTotal, monthlyAmount, fmt,
}: Props) {
  const [addingSubItem, setAddingSubItem] = useState<string | null>(null)
  const [newSubName, setNewSubName] = useState('')
  const [newSubAmount, setNewSubAmount] = useState(0)
  const [newSubFixed, setNewSubFixed] = useState(false)
  const [newSubPayment, setNewSubPayment] = useState<BudgetSubItem['payment_method']>('efectivo')
  const [newSubRecurrence, setNewSubRecurrence] = useState<BudgetSubItem['recurrence']>('mensual')
  const [addingCatBucket, setAddingCatBucket] = useState<'needs' | 'wants' | 'savings' | null>(null)
  const [newCatName, setNewCatName] = useState('')

  function handleAddSub(categoryId: string) {
    if (!newSubName.trim()) return
    onAddSubItem(categoryId, newSubName.trim(), newSubAmount, newSubFixed, newSubPayment, newSubRecurrence)
    setNewSubName('')
    setNewSubAmount(0)
    setNewSubFixed(false)
    setNewSubPayment('efectivo')
    setNewSubRecurrence('mensual')
    setAddingSubItem(null)
  }

  function handleAddCat(bucket: 'needs' | 'wants' | 'savings') {
    if (!newCatName.trim()) return
    onAddCategory(bucket, newCatName.trim())
    setNewCatName('')
    setAddingCatBucket(null)
  }

  const nextLevel = level === 0 ? 1 : level === 1 ? 2 : 0
  const levelLabels = ['Ver desglose por grupo ▾', 'Ver detalle por categoría ▾', 'Mostrar menos ▴']

  return (
    <div style={{
      background: '#fff', border: '1px solid #E5E7EB', borderRadius: 18,
      padding: '24px 28px', marginBottom: 20,
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: level > 0 ? 16 : 0 }}>
        <div>
          <h2 style={{
            fontFamily: "'DM Serif Display', serif", fontSize: 20, fontWeight: 700,
            color: '#1E3A5F', margin: '0 0 4px',
          }}>
            Definición del presupuesto
          </h2>
          <p style={{ fontSize: 12, color: '#94A3B8', margin: 0 }}>
            Ingresos: {fmt(income)} &middot; {categories.length} categorías &middot; Total asignado: {fmt(totalBudgeted)}
          </p>
        </div>
        <button
          onClick={() => onSetLevel(nextLevel)}
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            fontSize: 12, fontWeight: 600, color: '#2563EB', whiteSpace: 'nowrap',
          }}
        >
          {levelLabels[level]}
        </button>
      </div>

      {/* Level 1: Group summary */}
      {level >= 1 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: level === 2 ? 16 : 0 }}>
          {BUCKETS.map(({ key, label, color }) => {
            const bucketCats = categories.filter(c => c.bucket === key)
            return (
              <div key={key} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '10px 14px', borderRadius: 10,
                background: '#F8FAFC', border: '1px solid #F1F5F9',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: color }} />
                  <span style={{ fontSize: 13, fontWeight: 600, color: '#1E3A5F' }}>{label}</span>
                </div>
                <span style={{ fontSize: 12, color: '#64748B' }}>
                  {bucketCats.length} categorías &middot; {fmt(bucketTotals[key])}
                </span>
              </div>
            )
          })}
        </div>
      )}

      {/* Level 2: Full editable detail */}
      {level === 2 && (
        <div>
          {/* Income section */}
          <div style={{
            border: '1px solid #E5E7EB', borderRadius: 12, padding: '16px 18px',
            marginBottom: 16, background: '#F0FDF4',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <span style={{ fontSize: 14, fontWeight: 700, color: '#166534' }}>Ingresos</span>
              <span style={{ fontSize: 14, fontWeight: 700, color: '#166534' }}>{fmt(income)}/mes</span>
            </div>

            {/* Quick-add chips */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
              {INCOME_SUGGESTIONS.filter(s => !incomeEntries.some(e => e.source === s)).map((s) => (
                <button
                  key={s}
                  onClick={() => onAddIncomeEntry(s)}
                  style={{
                    padding: '4px 10px', fontSize: 11, borderRadius: 20,
                    border: '1px solid #BBD4F1', background: '#fff',
                    color: '#2563EB', cursor: 'pointer', fontWeight: 500,
                  }}
                >
                  + {s}
                </button>
              ))}
            </div>

            {/* Income entries */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {incomeEntries.map((entry) => (
                <div key={entry.id} style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  background: '#fff', border: '1px solid #E5E7EB', borderRadius: 8,
                  padding: '6px 10px',
                }}>
                  <div style={{ width: 4, height: 24, borderRadius: 4, background: '#10B981', flexShrink: 0 }} />
                  <Input
                    className="flex-1 h-7 text-sm min-w-0"
                    placeholder="Fuente"
                    value={entry.source}
                    onChange={(e) => onUpdateIncomeEntry(entry.id, 'source', e.target.value)}
                  />
                  <select
                    className="text-xs border rounded px-1.5 py-1 bg-white text-gray-600 flex-shrink-0"
                    value={entry.member}
                    onChange={(e) => onUpdateIncomeEntry(entry.id, 'member', e.target.value)}
                  >
                    <option value="Persona 1">Persona 1</option>
                    <option value="Persona 2">Persona 2</option>
                    <option value="Persona 3">Persona 3</option>
                    <option value="Hogar">Hogar</option>
                  </select>
                  <select
                    className="text-xs border rounded px-1.5 py-1 bg-white text-gray-600 flex-shrink-0"
                    value={entry.frequency}
                    onChange={(e) => onUpdateIncomeEntry(entry.id, 'frequency', e.target.value)}
                  >
                    <option value="mensual">Mensual</option>
                    <option value="quincenal">Quincenal</option>
                    <option value="semanal">Semanal</option>
                    <option value="anual">Anual</option>
                  </select>
                  <div style={{ position: 'relative', width: 100, flexShrink: 0 }}>
                    <span style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', fontSize: 11, color: '#94A3B8' }}>Q</span>
                    <Input
                      type="number"
                      className="pl-6 h-7 text-xs text-right"
                      placeholder="0"
                      value={entry.amount || ''}
                      onChange={(e) => onUpdateIncomeEntry(entry.id, 'amount', parseFloat(e.target.value) || 0)}
                    />
                  </div>
                  {entry.frequency !== 'mensual' && entry.amount > 0 && (
                    <span style={{ fontSize: 10, color: '#94A3B8', flexShrink: 0, width: 60, textAlign: 'right' }}>
                      {fmt(Math.round(entry.amount * (FREQUENCY_MULTIPLIER[entry.frequency] || 1) * 100) / 100)}/mes
                    </span>
                  )}
                  <button
                    onClick={() => onDeleteIncomeEntry(entry.id)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, color: '#CBD5E1' }}
                  >
                    <Trash2 style={{ width: 14, height: 14 }} />
                  </button>
                </div>
              ))}
            </div>

            <button
              onClick={() => onAddIncomeEntry()}
              style={{
                marginTop: 10, background: 'none', border: 'none', cursor: 'pointer',
                fontSize: 12, fontWeight: 600, color: '#2563EB',
                display: 'flex', alignItems: 'center', gap: 4,
              }}
            >
              <Plus style={{ width: 14, height: 14 }} /> Agregar ingreso
            </button>

            {incomeEntries.length > 0 && (
              <div style={{
                marginTop: 12, paddingTop: 10, borderTop: '1px solid #D1FAE5',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              }}>
                <span style={{ fontSize: 13, fontWeight: 500, color: '#334155' }}>Ingreso mensual total</span>
                <span style={{ fontSize: 13, fontWeight: 700, color: '#1E3A5F' }}>{fmt(income)}</span>
              </div>
            )}
          </div>

          {/* Category editing per bucket */}
          {BUCKETS.map(({ key, label, color }) => {
            const bucketCats = categories.filter(c => c.bucket === key)
            return (
              <div key={key} style={{
                border: '1px solid #E5E7EB', borderRadius: 12, padding: '16px 18px',
                marginBottom: 12,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: color }} />
                  <span style={{ fontSize: 14, fontWeight: 700, color: '#1E3A5F' }}>{label}</span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {bucketCats.map((cat) => {
                    const catSubs = subItems.filter(s => s.category_id === cat.id)
                    const hasSubs = catSubs.length > 0
                    const isExpanded = expandedCats.has(cat.id)
                    const catTotal = getCategoryTotal(cat.id)
                    const catTipo = hasSubs
                      ? (catSubs.every(s => s.is_fixed) ? 'Gasto fijo' : catSubs.every(s => !s.is_fixed) ? 'Gasto variable' : 'Mixto')
                      : 'Gasto variable'

                    return (
                      <div key={cat.id} style={{
                        border: '1px solid #F1F5F9', borderRadius: 8, overflow: 'hidden',
                      }}>
                        {/* Category row */}
                        <div style={{
                          display: 'flex', alignItems: 'center', gap: 8,
                          padding: '8px 12px', background: '#FAFBFC',
                        }}>
                          <div style={{ width: 4, height: 24, borderRadius: 4, background: color, flexShrink: 0 }} />
                          <span style={{ fontSize: 13, fontWeight: 500, color: '#1E3A5F', flex: 1, minWidth: 0 }}>{cat.name}</span>
                          <span style={{
                            fontSize: 11, padding: '2px 8px', borderRadius: 6,
                            background: catTipo === 'Gasto fijo' ? '#EFF6FF' : '#F8FAFC',
                            color: catTipo === 'Gasto fijo' ? '#2563EB' : '#64748B',
                          }}>{catTipo}</span>
                          <span style={{ fontSize: 11, color: '#94A3B8' }}>Mensual</span>
                          {hasSubs ? (
                            <span style={{ fontSize: 13, fontWeight: 700, color: '#334155', width: 90, textAlign: 'right', flexShrink: 0 }}>
                              {fmt(catTotal)}
                            </span>
                          ) : (
                            <div style={{ position: 'relative', width: 90, flexShrink: 0 }}>
                              <span style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', fontSize: 11, color: '#94A3B8' }}>Q</span>
                              <Input
                                type="number"
                                className="pl-6 h-7 text-xs text-right"
                                value={cat.budgeted_amount || ''}
                                onChange={(e) => onUpdateAmount(cat.id, parseFloat(e.target.value) || 0)}
                              />
                            </div>
                          )}
                          <button
                            onClick={() => onToggleCat(cat.id)}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, color: '#94A3B8' }}
                          >
                            {isExpanded ? <ChevronUp style={{ width: 16, height: 16 }} /> : <ChevronDown style={{ width: 16, height: 16 }} />}
                          </button>
                          {cat.is_custom && (
                            <button
                              onClick={() => onDeleteCategory(cat.id)}
                              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, color: '#CBD5E1' }}
                            >
                              <Trash2 style={{ width: 14, height: 14 }} />
                            </button>
                          )}
                        </div>

                        {/* Expanded sub-items */}
                        {isExpanded && (
                          <div style={{ borderTop: '1px solid #F1F5F9', padding: '8px 12px', background: '#fff' }}>
                            {catSubs.map((sub) => (
                              <div key={sub.id} style={{
                                display: 'flex', alignItems: 'center', gap: 6,
                                padding: '5px 0', fontSize: 12,
                              }}>
                                <span style={{ flex: 1, minWidth: 0, color: '#334155' }}>{sub.name}</span>
                                <span style={{
                                  fontSize: 10, padding: '1px 6px', borderRadius: 4,
                                  background: sub.is_fixed ? '#EFF6FF' : '#F8FAFC',
                                  color: sub.is_fixed ? '#2563EB' : '#94A3B8',
                                  cursor: 'pointer',
                                }} onClick={() => onToggleSubFixed(sub.id)}>
                                  {sub.is_fixed ? 'fijo' : 'variable'}
                                </span>
                                <select
                                  style={{ fontSize: 10, border: '1px solid #E5E7EB', borderRadius: 4, padding: '1px 4px', background: '#fff', color: '#64748B' }}
                                  value={sub.payment_method || 'efectivo'}
                                  onChange={(e) => onUpdateSubPayment(sub.id, e.target.value as BudgetSubItem['payment_method'])}
                                >
                                  <option value="efectivo">Efectivo</option>
                                  <option value="tarjeta">Tarjeta</option>
                                  <option value="cheque">Cheque</option>
                                  <option value="transferencia">Transfer.</option>
                                </select>
                                <select
                                  style={{ fontSize: 10, border: '1px solid #E5E7EB', borderRadius: 4, padding: '1px 4px', background: '#fff', color: '#64748B' }}
                                  value={sub.recurrence || 'mensual'}
                                  onChange={(e) => onUpdateSubRecurrence(sub.id, e.target.value as BudgetSubItem['recurrence'])}
                                >
                                  <option value="mensual">Mensual</option>
                                  <option value="trimestral">Trimestral</option>
                                  <option value="anual">Anual</option>
                                </select>
                                <div style={{ position: 'relative', width: 80, flexShrink: 0 }}>
                                  <span style={{ position: 'absolute', left: 6, top: '50%', transform: 'translateY(-50%)', fontSize: 10, color: '#94A3B8' }}>Q</span>
                                  <Input
                                    type="number"
                                    className="pl-5 h-6 text-[11px] text-right"
                                    value={sub.amount || ''}
                                    onChange={(e) => onUpdateSubAmount(sub.id, parseFloat(e.target.value) || 0)}
                                  />
                                </div>
                                {(sub.recurrence || 'mensual') !== 'mensual' && sub.amount > 0 && (
                                  <span style={{ fontSize: 10, color: '#94A3B8', flexShrink: 0, whiteSpace: 'nowrap' }}>
                                    {fmt(Math.round(monthlyAmount(sub.amount, sub.recurrence || 'mensual')))}/m
                                  </span>
                                )}
                                <button
                                  onClick={() => onDeleteSubItem(sub.id)}
                                  style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, color: '#CBD5E1' }}
                                >
                                  <X style={{ width: 12, height: 12 }} />
                                </button>
                              </div>
                            ))}

                            {/* Add sub-item */}
                            {addingSubItem === cat.id ? (
                              <div style={{
                                marginTop: 8, padding: 10, border: '1px solid #BBD4F1',
                                borderRadius: 8, background: '#F8FAFC',
                              }}>
                                <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
                                  <Input
                                    placeholder="Nombre"
                                    className="flex-1 h-7 text-xs"
                                    value={newSubName}
                                    onChange={(e) => setNewSubName(e.target.value)}
                                    autoFocus
                                  />
                                  <div style={{ position: 'relative', width: 80 }}>
                                    <span style={{ position: 'absolute', left: 6, top: '50%', transform: 'translateY(-50%)', fontSize: 10, color: '#94A3B8' }}>Q</span>
                                    <Input
                                      type="number"
                                      className="pl-5 h-7 text-xs text-right"
                                      placeholder="0"
                                      value={newSubAmount || ''}
                                      onChange={(e) => setNewSubAmount(parseFloat(e.target.value) || 0)}
                                    />
                                  </div>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                                  <label style={{ fontSize: 11, display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer' }}>
                                    <input type="checkbox" checked={newSubFixed} onChange={(e) => setNewSubFixed(e.target.checked)} />
                                    Fijo
                                  </label>
                                  <select
                                    style={{ fontSize: 10, border: '1px solid #E5E7EB', borderRadius: 4, padding: '2px 4px', background: '#fff' }}
                                    value={newSubPayment}
                                    onChange={(e) => setNewSubPayment(e.target.value as BudgetSubItem['payment_method'])}
                                  >
                                    <option value="efectivo">Efectivo</option>
                                    <option value="tarjeta">Tarjeta</option>
                                    <option value="cheque">Cheque</option>
                                    <option value="transferencia">Transfer.</option>
                                  </select>
                                  <select
                                    style={{ fontSize: 10, border: '1px solid #E5E7EB', borderRadius: 4, padding: '2px 4px', background: '#fff' }}
                                    value={newSubRecurrence}
                                    onChange={(e) => setNewSubRecurrence(e.target.value as BudgetSubItem['recurrence'])}
                                  >
                                    <option value="mensual">Mensual</option>
                                    <option value="trimestral">Trimestral</option>
                                    <option value="anual">Anual</option>
                                  </select>
                                  <div style={{ marginLeft: 'auto', display: 'flex', gap: 4 }}>
                                    <Button size="sm" className="h-6 text-xs px-3" onClick={() => handleAddSub(cat.id)} disabled={!newSubName.trim()}>
                                      Agregar
                                    </Button>
                                    <Button size="sm" variant="ghost" className="h-6 text-xs px-2" onClick={() => { setAddingSubItem(null); setNewSubName(''); setNewSubAmount(0); }}>
                                      <X style={{ width: 12, height: 12 }} />
                                    </Button>
                                  </div>
                                </div>
                              </div>
                            ) : (
                              <button
                                onClick={() => { setAddingSubItem(cat.id); setNewSubName(''); setNewSubAmount(0); setNewSubFixed(false); }}
                                style={{
                                  marginTop: 6, background: 'none', border: 'none', cursor: 'pointer',
                                  fontSize: 11, fontWeight: 600, color: '#2563EB',
                                  display: 'flex', alignItems: 'center', gap: 4,
                                }}
                              >
                                <Plus style={{ width: 12, height: 12 }} /> Agregar línea
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>

                {/* Add category */}
                {addingCatBucket === key ? (
                  <div style={{ marginTop: 10, display: 'flex', gap: 6, alignItems: 'center' }}>
                    <Input
                      placeholder="Nombre de la categoría"
                      className="flex-1 h-7 text-xs"
                      value={newCatName}
                      onChange={(e) => setNewCatName(e.target.value)}
                      autoFocus
                      onKeyDown={(e) => { if (e.key === 'Enter') handleAddCat(key) }}
                    />
                    <Button size="sm" className="h-7 text-xs" onClick={() => handleAddCat(key)} disabled={!newCatName.trim()}>
                      <Plus style={{ width: 12, height: 12, marginRight: 2 }} /> Agregar
                    </Button>
                    <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => { setAddingCatBucket(null); setNewCatName(''); }}>
                      <X style={{ width: 12, height: 12 }} />
                    </Button>
                  </div>
                ) : (
                  <button
                    onClick={() => { setAddingCatBucket(key); setNewCatName(''); }}
                    style={{
                      marginTop: 10, background: 'none', border: 'none', cursor: 'pointer',
                      fontSize: 11, fontWeight: 600, color: '#2563EB',
                      display: 'flex', alignItems: 'center', gap: 4,
                    }}
                  >
                    <Plus style={{ width: 12, height: 12 }} /> Agregar categoría
                  </button>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
