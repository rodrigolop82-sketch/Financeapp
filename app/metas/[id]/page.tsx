'use client'
import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { AppShell } from '@/components/layout/AppShell'
import { GoalDetailHero } from '@/components/goals/GoalDetailHero'
import { ContributionHistory } from '@/components/goals/ContributionHistory'
import { AddContributionSheet } from '@/components/goals/AddContributionSheet'
import { useGoals, type Goal, type Contribution } from '@/hooks/useGoals'
import { formatMoney } from '@/lib/format'
import { Loader2, ArrowLeft, Pencil, Trash2, Pause, Play, X, Check } from 'lucide-react'

export default function GoalDetailPage() {
  const params = useParams()
  const router = useRouter()
  const goalId = params.id as string
  const { goals, addContribution, updateGoal, deleteGoal, togglePause, getContributionHistory, isLoading } = useGoals()
  const [contributions, setContributions] = useState<Contribution[]>([])
  const [contribLoading, setContribLoading] = useState(true)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [editing, setEditing] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [actionLoading, setActionLoading] = useState(false)

  // Edit form state
  const [editName, setEditName] = useState('')
  const [editEmoji, setEditEmoji] = useState('')
  const [editTarget, setEditTarget] = useState('')
  const [editMonthly, setEditMonthly] = useState('')
  const [editDate, setEditDate] = useState('')

  const goal: Goal | undefined = goals.find((g) => g.id === goalId)

  useEffect(() => {
    if (goal && !editing) {
      setEditName(goal.name)
      setEditEmoji(goal.emoji)
      setEditTarget(String(goal.targetAmount))
      setEditMonthly(goal.monthlyContribution ? String(goal.monthlyContribution) : '')
      setEditDate(goal.targetDate ?? '')
    }
  }, [goal, editing])

  const loadContributions = useCallback(async () => {
    if (!goalId) return
    setContribLoading(true)
    try {
      const data = await getContributionHistory(goalId)
      setContributions(data)
    } catch {
      // silently fail
    } finally {
      setContribLoading(false)
    }
  }, [goalId, getContributionHistory])

  useEffect(() => {
    if (!isLoading && goalId) {
      loadContributions()
    }
  }, [isLoading, goalId, loadContributions])

  if (isLoading) {
    return (
      <AppShell title="Meta" currentPath="/metas">
        <div style={{ display: 'flex', justifyContent: 'center', padding: '60px 0' }}>
          <Loader2 className="w-8 h-8 text-electric animate-spin" />
        </div>
      </AppShell>
    )
  }

  if (!goal) {
    return (
      <AppShell title="Meta" currentPath="/metas">
        <p style={{ textAlign: 'center', color: '#94A3B8', padding: '40px 0' }}>
          Meta no encontrada
        </p>
      </AppShell>
    )
  }

  async function handleSaveEdit() {
    setActionLoading(true)
    try {
      await updateGoal(goalId, {
        name: editName,
        emoji: editEmoji,
        targetAmount: parseFloat(editTarget) || 0,
        monthlyContribution: editMonthly ? parseFloat(editMonthly) : null,
        targetDate: editDate || null,
      })
      setEditing(false)
    } catch {
      // handle error
    } finally {
      setActionLoading(false)
    }
  }

  async function handleDelete() {
    setActionLoading(true)
    try {
      await deleteGoal(goalId)
      router.push('/metas')
    } catch {
      setActionLoading(false)
    }
  }

  async function handleTogglePause() {
    setActionLoading(true)
    try {
      await togglePause(goalId)
    } catch {
      // handle error
    } finally {
      setActionLoading(false)
    }
  }

  const monthlyRate = goal.monthlyContribution ?? 0

  return (
    <AppShell title="Detalle de meta" currentPath="/metas">
      {/* Back button */}
      <button
        onClick={() => router.push('/metas')}
        style={{
          display: 'flex', alignItems: 'center', gap: 6,
          background: 'none', border: 'none', cursor: 'pointer',
          color: '#2563EB', fontSize: 14, fontWeight: 500,
          padding: 0, marginBottom: 16,
        }}
      >
        <ArrowLeft size={18} />
        Mis metas
      </button>

      <GoalDetailHero
        emoji={goal.emoji}
        name={goal.name}
        currentAmount={goal.currentAmount}
        targetAmount={goal.targetAmount}
      />

      {/* Action buttons */}
      <div style={{
        display: 'flex', gap: 8, marginBottom: 16,
      }}>
        <button
          onClick={() => setEditing(!editing)}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            background: editing ? '#EFF6FF' : '#F8FAFC',
            border: `1px solid ${editing ? '#2563EB' : '#E2E8F0'}`,
            borderRadius: 10, padding: '8px 14px',
            fontSize: 13, fontWeight: 600, cursor: 'pointer',
            color: editing ? '#2563EB' : '#64748B',
          }}
        >
          <Pencil size={14} />
          Editar
        </button>
        {goal.status !== 'completed' && (
          <button
            onClick={handleTogglePause}
            disabled={actionLoading}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              background: '#F8FAFC', border: '1px solid #E2E8F0',
              borderRadius: 10, padding: '8px 14px',
              fontSize: 13, fontWeight: 600, cursor: 'pointer',
              color: '#64748B',
            }}
          >
            {goal.status === 'paused' ? <Play size={14} /> : <Pause size={14} />}
            {goal.status === 'paused' ? 'Reanudar' : 'Pausar'}
          </button>
        )}
        <button
          onClick={() => setConfirmDelete(true)}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            background: '#F8FAFC', border: '1px solid #E2E8F0',
            borderRadius: 10, padding: '8px 14px',
            fontSize: 13, fontWeight: 600, cursor: 'pointer',
            color: '#DC2626',
          }}
        >
          <Trash2 size={14} />
          Eliminar
        </button>
      </div>

      {/* Delete confirmation */}
      {confirmDelete && (
        <div style={{
          background: '#FEF2F2', border: '1px solid #FECACA',
          borderRadius: 14, padding: '16px 18px', marginBottom: 16,
        }}>
          <p style={{ fontSize: 14, fontWeight: 600, color: '#991B1B', marginBottom: 12 }}>
            ¿Eliminar &quot;{goal.name}&quot;? Esta acción no se puede deshacer.
          </p>
          <div style={{ display: 'flex', gap: 10 }}>
            <button
              onClick={handleDelete}
              disabled={actionLoading}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                background: '#DC2626', color: '#fff',
                border: 'none', borderRadius: 10, padding: '10px 20px',
                fontSize: 14, fontWeight: 600, cursor: 'pointer',
              }}
            >
              {actionLoading ? 'Eliminando…' : 'Sí, eliminar'}
            </button>
            <button
              onClick={() => setConfirmDelete(false)}
              style={{
                background: '#fff', border: '1px solid #E2E8F0',
                borderRadius: 10, padding: '10px 20px',
                fontSize: 14, fontWeight: 600, cursor: 'pointer',
                color: '#64748B',
              }}
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Edit form */}
      {editing && (
        <div style={{
          background: '#fff', border: '1px solid #E2E8F0',
          borderRadius: 14, padding: '18px 20px', marginBottom: 16,
          boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
        }}>
          <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 6 }}>Emoji</label>
              <input
                value={editEmoji}
                onChange={e => setEditEmoji(e.target.value)}
                style={{
                  width: 56, height: 44, textAlign: 'center', fontSize: 24,
                  border: '1.5px solid #E2E8F0', borderRadius: 10, outline: 'none',
                }}
              />
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: 11, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 6 }}>Nombre</label>
              <input
                value={editName}
                onChange={e => setEditName(e.target.value)}
                style={{
                  width: '100%', height: 44, padding: '0 12px',
                  border: '1.5px solid #E2E8F0', borderRadius: 10,
                  fontSize: 14, color: '#1E3A5F', outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 6 }}>Meta (Q)</label>
              <input
                type="number"
                value={editTarget}
                onChange={e => setEditTarget(e.target.value)}
                style={{
                  width: '100%', height: 44, padding: '0 12px',
                  border: '1.5px solid #E2E8F0', borderRadius: 10,
                  fontSize: 14, color: '#1E3A5F', outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 6 }}>Aporte mensual (Q)</label>
              <input
                type="number"
                value={editMonthly}
                onChange={e => setEditMonthly(e.target.value)}
                placeholder="Opcional"
                style={{
                  width: '100%', height: 44, padding: '0 12px',
                  border: '1.5px solid #E2E8F0', borderRadius: 10,
                  fontSize: 14, color: '#1E3A5F', outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
            </div>
          </div>
          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 11, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 6 }}>Fecha objetivo</label>
            <input
              type="date"
              value={editDate}
              onChange={e => setEditDate(e.target.value)}
              style={{
                width: '100%', height: 44, padding: '0 12px',
                border: '1.5px solid #E2E8F0', borderRadius: 10,
                fontSize: 14, color: '#1E3A5F', outline: 'none',
                boxSizing: 'border-box',
              }}
            />
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button
              onClick={handleSaveEdit}
              disabled={actionLoading || !editName.trim() || !editTarget}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                background: '#2563EB', color: '#fff',
                border: 'none', borderRadius: 10, padding: '10px 20px',
                fontSize: 14, fontWeight: 600, cursor: 'pointer',
                opacity: (!editName.trim() || !editTarget) ? 0.5 : 1,
              }}
            >
              <Check size={16} />
              {actionLoading ? 'Guardando…' : 'Guardar'}
            </button>
            <button
              onClick={() => setEditing(false)}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                background: '#F1F5F9', color: '#64748B',
                border: 'none', borderRadius: 10, padding: '10px 20px',
                fontSize: 14, fontWeight: 600, cursor: 'pointer',
              }}
            >
              <X size={16} />
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Projection banner */}
      {goal.projection.status !== 'completed' && goal.projection.status !== 'no_data' && (
        <div style={{
          background: 'white',
          border: '1px solid #E2E8F0',
          borderRadius: 14,
          padding: '14px 16px',
          marginBottom: 16,
          display: 'flex', gap: 12, alignItems: 'flex-start',
          boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
        }}>
          <span style={{ fontSize: 20 }}>📅</span>
          <div>
            <p style={{ fontSize: 14, fontWeight: 700, color: '#0F172A', marginBottom: 4 }}>
              {goal.projection.status === 'on_track'
                ? `A este ritmo: ${goal.projection.estimatedDate?.toLocaleDateString('es-GT', { month: 'long', year: 'numeric' })}`
                : goal.projection.message
              }
            </p>
            <p style={{ fontSize: 12, color: '#64748B', lineHeight: 1.5 }}>
              {monthlyRate > 0 && goal.projection.monthsRemaining
                ? `Con tu aporte mensual de ${formatMoney(monthlyRate)}, alcanzas tu meta en ${goal.projection.monthsRemaining} meses.`
                : ''}
            </p>
          </div>
        </div>
      )}

      {goal.projection.status === 'no_data' && (
        <div style={{
          background: 'white',
          border: '1px solid #E2E8F0',
          borderRadius: 14,
          padding: '14px 16px',
          marginBottom: 16,
        }}>
          <p style={{ fontSize: 13, color: '#94A3B8' }}>
            {goal.projection.message}
          </p>
        </div>
      )}

      {/* Contribution history */}
      <p style={{
        fontSize: 11, fontWeight: 700, color: '#2563EB',
        textTransform: 'uppercase', letterSpacing: '0.08em',
        marginBottom: 10,
      }}>
        Historial de aportes
      </p>
      <ContributionHistory contributions={contributions} isLoading={contribLoading} />

      <div className="h-24" />

      {/* Floating Abonar FAB */}
      {goal.status === 'active' && (
        <button
          onClick={() => setSheetOpen(true)}
          style={{
            position: 'fixed',
            bottom: 'calc(80px + env(safe-area-inset-bottom))',
            right: 20,
            zIndex: 30,
            padding: '14px 28px',
            background: '#2563EB',
            border: 'none',
            borderRadius: 50,
            color: 'white',
            fontSize: 15,
            fontWeight: 700,
            cursor: 'pointer',
            boxShadow: '0 4px 20px rgba(37,99,235,0.4)',
            display: 'flex', alignItems: 'center', gap: 6,
          }}
        >
          💰 Abonar
        </button>
      )}

      <AddContributionSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        goalName={goal.name}
        goalEmoji={goal.emoji}
        currentAmount={goal.currentAmount}
        targetAmount={goal.targetAmount}
        onConfirm={async (amount, note) => {
          await addContribution(goalId, amount, note)
          await loadContributions()
        }}
        monthlyContribution={goal.monthlyContribution}
      />
    </AppShell>
  )
}
