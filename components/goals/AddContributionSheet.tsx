'use client'
import { useState } from 'react'
import { formatMoney } from '@/lib/format'
import { ErrorBox, FieldLabel, INPUT_48, SheetHeader } from '@/components/layout/Pantalla'
import { BORDER, PRIMARY_BUTTON, TEXT_BODY, TEXT_STRONG } from '@/components/movimientos/ui'
import { BottomSheet } from '@/components/transactions/BottomSheet'

interface AddContributionSheetProps {
  open: boolean
  onClose: () => void
  goalName: string
  goalEmoji: string
  currentAmount: number
  targetAmount: number
  /** Si falla, la hoja queda abierta y muestra el error. */
  onConfirm: (amount: number, note: string) => Promise<void>
  monthlyContribution: number | null
}

/** Hoja "Aportar a {meta}": monto grande, montos rápidos y nota. */
export function AddContributionSheet(props: AddContributionSheetProps) {
  return (
    <BottomSheet themed open={props.open} onClose={props.onClose} label={`Aportar a ${props.goalName}`}>
      {props.open && <ContributionForm {...props} />}
    </BottomSheet>
  )
}

function ContributionForm({
  onClose, goalName, goalEmoji, currentAmount, targetAmount, onConfirm, monthlyContribution,
}: AddContributionSheetProps) {
  const [amount, setAmount] = useState('')
  const [note, setNote] = useState('')
  const [other, setOther] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const quick = [200, 500]
  if (monthlyContribution && monthlyContribution > 0 && !quick.includes(monthlyContribution)) quick.push(monthlyContribution)
  const n = parseFloat(amount) || 0

  async function save() {
    if (n <= 0) return
    setSaving(true)
    setError('')
    try {
      await onConfirm(n, note.trim())
      onClose()
    } catch {
      setError('No se pudo guardar el aporte. Intenta de nuevo.')
      setSaving(false)
    }
  }

  const choice = (selected: boolean) =>
    `h-11 flex-1 rounded-xl text-[15px] transition duration-150 active:scale-[0.96] ${
      selected
        ? 'border-2 border-electric bg-electric-ghost text-electric-dark dark:bg-[#1B2B4D] dark:text-electric-soft'
        : `border-[1.5px] bg-[var(--zafi-card)] ${BORDER} ${TEXT_BODY}`
    }`

  return (
    <div className="flex flex-col gap-4 overflow-y-auto px-5 pb-[calc(24px+env(safe-area-inset-bottom))] pt-2 [&>*]:shrink-0">
      <SheetHeader emoji={goalEmoji} title={`Aportar a ${goalName}`} subtitle={`${formatMoney(currentAmount)} de ${formatMoney(targetAmount)}`} />

      <label className="flex items-center justify-center gap-1">
        <span aria-hidden className="font-outfit text-[40px] font-extrabold text-ink-400">Q</span>
        <input
          value={amount}
          onChange={(e) => { setOther(true); setAmount(e.target.value.replace(/[^0-9.]/g, '')) }}
          inputMode="decimal"
          placeholder="0"
          aria-label="Monto"
          style={{ width: `${Math.max(1, amount.length) + 0.6}ch` }}
          className={`max-w-[240px] bg-transparent font-outfit text-[46px] font-extrabold tracking-[-0.03em] outline-none placeholder:text-ink-200 dark:placeholder:text-white/20 ${TEXT_STRONG}`}
        />
      </label>

      <div className="flex gap-2">
        {quick.map((q) => (
          <button key={q} type="button" onClick={() => { setOther(false); setAmount(String(q)) }} className={`font-outfit font-bold ${choice(!other && n === q)}`}>
            {formatMoney(q)}
          </button>
        ))}
        <button type="button" onClick={() => { setOther(true); setAmount('') }} className={`font-semibold ${choice(other && !quick.includes(n))}`}>
          Otro
        </button>
      </div>

      <div className="flex flex-col gap-1.5">
        <FieldLabel htmlFor="aporte-nota">Nota (opcional)</FieldLabel>
        <input id="aporte-nota" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Aporte de este mes" className={INPUT_48} />
      </div>

      {error && <ErrorBox>{error}</ErrorBox>}
      <button type="button" onClick={() => void save()} disabled={n <= 0 || saving} className={PRIMARY_BUTTON}>
        {saving ? 'Guardando…' : 'Guardar aporte'}
      </button>
    </div>
  )
}
