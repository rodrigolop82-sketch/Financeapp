'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { AppShell } from '@/components/layout/AppShell'
import { GT_BANKS } from '@/lib/sources'
import type { UserSource, SourceType } from '@/types'
import {
  Landmark, CreditCard, Banknote, Wallet, Plus,
  Pencil, X, Check, Loader2, Sparkles,
} from 'lucide-react'

const TYPE_LABELS: Record<SourceType, string> = {
  tarjeta_credito: 'Tarjeta de crédito',
  cuenta_bancaria: 'Cuenta bancaria',
  efectivo: 'Efectivo',
}

const TYPE_ICONS: Record<SourceType, typeof CreditCard> = {
  tarjeta_credito: CreditCard,
  cuenta_bancaria: Landmark,
  efectivo: Banknote,
}

type AddStep = 'idle' | 'pick_bank' | 'form'

interface AddForm {
  bank_name: string
  type: SourceType
  nickname: string
}

export default function MisFuentesPage() {
  const [sources, setSources] = useState<UserSource[]>([])
  const [loading, setLoading] = useState(true)
  const [addStep, setAddStep] = useState<AddStep>('idle')
  const [form, setForm] = useState<AddForm>({ bank_name: '', type: 'tarjeta_credito', nickname: '' })
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<AddForm>({ bank_name: '', type: 'tarjeta_credito', nickname: '' })
  const [saving, setSaving] = useState(false)
  const [customBank, setCustomBank] = useState('')
  const router = useRouter()
  const supabase = createClient()

  const loadSources = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }

    const { data } = await supabase
      .from('user_sources')
      .select('*')
      .eq('user_id', user.id)
      .eq('active', true)
      .order('created_at', { ascending: true })

    setSources((data ?? []) as UserSource[])
    setLoading(false)
  }, [supabase, router])

  useEffect(() => { loadSources() }, [loadSources])

  function handleBankPick(bank: string) {
    if (bank === 'Otro') {
      setCustomBank('')
      setForm(f => ({ ...f, bank_name: '' }))
    } else {
      setForm(f => ({ ...f, bank_name: bank }))
    }
    setAddStep('form')
  }

  async function handleAdd() {
    const bankName = form.bank_name || customBank.trim()
    if (!bankName) return

    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    await supabase.from('user_sources').insert({
      user_id: user.id,
      type: form.type,
      bank_name: bankName,
      nickname: form.nickname.trim() || null,
      detection_method: 'manual',
    })

    setAddStep('idle')
    setForm({ bank_name: '', type: 'tarjeta_credito', nickname: '' })
    setCustomBank('')
    setSaving(false)
    loadSources()
  }

  function startEdit(source: UserSource) {
    setEditingId(source.id)
    setEditForm({
      bank_name: source.bank_name,
      type: source.type,
      nickname: source.nickname ?? '',
    })
  }

  async function handleSaveEdit() {
    if (!editingId) return
    setSaving(true)

    await supabase.from('user_sources').update({
      type: editForm.type,
      nickname: editForm.nickname.trim() || null,
    }).eq('id', editingId)

    setEditingId(null)
    setSaving(false)
    loadSources()
  }

  async function handleDeactivate(id: string) {
    await supabase.from('user_sources').update({ active: false }).eq('id', id)
    loadSources()
  }

  if (loading) {
    return (
      <AppShell title="Mis Fuentes" currentPath="/mis-fuentes">
        <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
          <Loader2 className="w-6 h-6 animate-spin" style={{ color: '#2563EB' }} />
        </div>
      </AppShell>
    )
  }

  return (
    <AppShell title="Mis Fuentes" currentPath="/mis-fuentes">
      <p style={{
        fontSize: 14, color: '#64748B', margin: '0 0 20px', lineHeight: 1.6,
      }}>
        Declarar tus fuentes le permite a Zafi verificar que cada mes tengas toda tu información financiera al día.
      </p>

      {/* Source list */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 20 }}>
        {sources.map(source => {
          const Icon = TYPE_ICONS[source.type]
          const isEditing = editingId === source.id

          if (isEditing) {
            return (
              <div key={source.id} style={{
                background: '#fff', borderRadius: 14, padding: 16,
                border: '2px solid #2563EB',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                  <span style={{ fontSize: 15, fontWeight: 700, color: '#1E3A5F' }}>
                    {source.bank_name}
                  </span>
                  <button
                    onClick={() => setEditingId(null)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}
                  >
                    <X size={18} color="#94A3B8" />
                  </button>
                </div>

                <TypeSelector value={editForm.type} onChange={t => setEditForm(f => ({ ...f, type: t }))} />

                <input
                  type="text"
                  placeholder="Apodo (opcional)"
                  value={editForm.nickname}
                  onChange={e => setEditForm(f => ({ ...f, nickname: e.target.value }))}
                  style={{
                    width: '100%', padding: '10px 14px', borderRadius: 10,
                    border: '1px solid #E2E8F0', fontSize: 14, marginTop: 12,
                    outline: 'none', boxSizing: 'border-box',
                  }}
                />

                <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
                  <button
                    onClick={handleSaveEdit}
                    disabled={saving}
                    style={{
                      flex: 1, padding: '10px 16px', borderRadius: 10,
                      background: '#2563EB', color: '#fff', border: 'none',
                      fontWeight: 700, fontSize: 14, cursor: 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                    }}
                  >
                    {saving ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
                    Guardar
                  </button>
                  <button
                    onClick={() => handleDeactivate(source.id)}
                    style={{
                      padding: '10px 16px', borderRadius: 10,
                      background: '#FEF2F2', color: '#DC2626', border: 'none',
                      fontWeight: 600, fontSize: 13, cursor: 'pointer',
                    }}
                  >
                    Desactivar
                  </button>
                </div>
              </div>
            )
          }

          return (
            <div key={source.id} style={{
              background: '#fff', borderRadius: 14, padding: '14px 16px',
              border: '1px solid #E2E8F0',
              display: 'flex', alignItems: 'center', gap: 12,
            }}>
              <div style={{
                width: 40, height: 40, borderRadius: 10,
                background: '#EFF6FF', display: 'flex',
                alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              }}>
                <Icon size={20} color="#2563EB" />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 15, fontWeight: 600, color: '#1E3A5F' }}>
                    {source.bank_name}
                  </span>
                  {source.detection_method === 'auto' && (
                    <span style={{
                      display: 'inline-flex', alignItems: 'center', gap: 3,
                      fontSize: 11, fontWeight: 600, color: '#7C3AED',
                      background: '#F5F3FF', padding: '2px 8px', borderRadius: 20,
                    }}>
                      <Sparkles size={10} />
                      Auto
                    </span>
                  )}
                </div>
                <span style={{ fontSize: 12, color: '#94A3B8' }}>
                  {TYPE_LABELS[source.type]}
                  {source.nickname ? ` · ${source.nickname}` : ''}
                </span>
              </div>
              <button
                onClick={() => startEdit(source)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 6 }}
              >
                <Pencil size={16} color="#94A3B8" />
              </button>
            </div>
          )
        })}
      </div>

      {/* Add source */}
      {addStep === 'idle' && (
        <button
          onClick={() => setAddStep('pick_bank')}
          style={{
            width: '100%', padding: '14px 16px', borderRadius: 14,
            border: '2px dashed #CBD5E1', background: 'transparent',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            cursor: 'pointer', color: '#64748B', fontSize: 14, fontWeight: 600,
          }}
        >
          <Plus size={18} />
          Agregar otra fuente
        </button>
      )}

      {addStep === 'pick_bank' && (
        <div style={{
          background: '#fff', borderRadius: 14, padding: 16,
          border: '2px solid #2563EB',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <span style={{ fontSize: 15, fontWeight: 700, color: '#1E3A5F' }}>
              Selecciona tu banco
            </span>
            <button
              onClick={() => setAddStep('idle')}
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}
            >
              <X size={18} color="#94A3B8" />
            </button>
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {GT_BANKS.map(bank => {
              const alreadyAdded = sources.some(s => s.bank_name === bank)
              return (
                <button
                  key={bank}
                  onClick={() => !alreadyAdded && handleBankPick(bank)}
                  disabled={alreadyAdded}
                  style={{
                    padding: '8px 16px', borderRadius: 20,
                    border: alreadyAdded ? '1px solid #E2E8F0' : '1px solid #BFDBFE',
                    background: alreadyAdded ? '#F8FAFC' : '#EFF6FF',
                    color: alreadyAdded ? '#CBD5E1' : '#1E3A5F',
                    fontSize: 13, fontWeight: 600, cursor: alreadyAdded ? 'default' : 'pointer',
                  }}
                >
                  {bank}
                  {alreadyAdded && ' ✓'}
                </button>
              )
            })}
            <button
              onClick={() => handleBankPick('Otro')}
              style={{
                padding: '8px 16px', borderRadius: 20,
                border: '1px dashed #CBD5E1', background: 'transparent',
                color: '#64748B', fontSize: 13, fontWeight: 600, cursor: 'pointer',
              }}
            >
              Otro banco
            </button>
          </div>
        </div>
      )}

      {addStep === 'form' && (
        <div style={{
          background: '#fff', borderRadius: 14, padding: 16,
          border: '2px solid #2563EB',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <span style={{ fontSize: 15, fontWeight: 700, color: '#1E3A5F' }}>
              {form.bank_name || 'Nuevo banco'}
            </span>
            <button
              onClick={() => { setAddStep('idle'); setCustomBank('') }}
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}
            >
              <X size={18} color="#94A3B8" />
            </button>
          </div>

          {!form.bank_name && (
            <input
              type="text"
              placeholder="Nombre del banco"
              value={customBank}
              onChange={e => setCustomBank(e.target.value)}
              autoFocus
              style={{
                width: '100%', padding: '10px 14px', borderRadius: 10,
                border: '1px solid #E2E8F0', fontSize: 14, marginBottom: 12,
                outline: 'none', boxSizing: 'border-box',
              }}
            />
          )}

          <TypeSelector value={form.type} onChange={t => setForm(f => ({ ...f, type: t }))} />

          <input
            type="text"
            placeholder="Apodo (opcional, ej. 'Tarjeta principal')"
            value={form.nickname}
            onChange={e => setForm(f => ({ ...f, nickname: e.target.value }))}
            style={{
              width: '100%', padding: '10px 14px', borderRadius: 10,
              border: '1px solid #E2E8F0', fontSize: 14, marginTop: 12,
              outline: 'none', boxSizing: 'border-box',
            }}
          />

          <button
            onClick={handleAdd}
            disabled={saving || (!form.bank_name && !customBank.trim())}
            style={{
              width: '100%', marginTop: 14, padding: '12px 16px', borderRadius: 10,
              background: (!form.bank_name && !customBank.trim()) ? '#CBD5E1' : '#2563EB',
              color: '#fff', border: 'none',
              fontWeight: 700, fontSize: 14, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            }}
          >
            {saving ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
            Agregar fuente
          </button>
        </div>
      )}

      {sources.length === 0 && addStep === 'idle' && (
        <div style={{
          textAlign: 'center', padding: '32px 20px', color: '#94A3B8', fontSize: 14,
          lineHeight: 1.6,
        }}>
          <Wallet size={32} style={{ margin: '0 auto 12px', opacity: 0.4 }} />
          <p style={{ margin: 0 }}>
            Aún no tienes fuentes registradas. Al importar un estado de cuenta, Zafi las detecta automáticamente.
          </p>
        </div>
      )}

      <div className="h-24" />
    </AppShell>
  )
}

function TypeSelector({ value, onChange }: { value: SourceType; onChange: (t: SourceType) => void }) {
  const types: SourceType[] = ['tarjeta_credito', 'cuenta_bancaria', 'efectivo']

  return (
    <div style={{ display: 'flex', gap: 8 }}>
      {types.map(t => {
        const Icon = TYPE_ICONS[t]
        const active = value === t
        return (
          <button
            key={t}
            onClick={() => onChange(t)}
            style={{
              flex: 1, padding: '8px 4px', borderRadius: 10,
              border: active ? '2px solid #2563EB' : '1px solid #E2E8F0',
              background: active ? '#EFF6FF' : '#fff',
              cursor: 'pointer',
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
            }}
          >
            <Icon size={18} color={active ? '#2563EB' : '#94A3B8'} />
            <span style={{
              fontSize: 11, fontWeight: 600,
              color: active ? '#2563EB' : '#94A3B8',
            }}>
              {t === 'tarjeta_credito' ? 'Tarjeta' : t === 'cuenta_bancaria' ? 'Cuenta' : 'Efectivo'}
            </span>
          </button>
        )
      })}
    </div>
  )
}
