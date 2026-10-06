'use client'
import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { getUserHousehold } from '@/lib/household'
import { localMonth } from '@/lib/dates'
import { calculateScore } from '@/lib/score-calculator'
import { loadScoreInput } from '@/lib/health-data'
import {
  readLastScore, rememberScore, scoreChangeText, SCORE_INPUTS_CHANGED, SCORE_TOAST_DELAY_MS,
} from '@/lib/score-feedback'
import { TRANSACTIONS_CHANGED_EVENT } from '@/components/add/AddSheet'
import { StatusToast, type StatusMessage } from '@/components/movimientos/StatusToast'

/** Recalcula el puntaje tras una acción y avisa si cambió (después del toast de la acción). */
export function ScoreWatcher() {
  const [message, setMessage] = useState<StatusMessage | null>(null)
  const timers = useRef<ReturnType<typeof setTimeout>[]>([])

  useEffect(() => {
    let running = false
    async function check() {
      if (running) return
      running = true
      try {
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return
        const hh = await getUserHousehold(supabase, user.id)
        if (!hh) return
        const { input } = await loadScoreInput(supabase, { householdId: hh.id, userId: user.id, month: localMonth() })
        const next = calculateScore(input)
        if (next.components.length === 0) return
        const prev = readLastScore(hh.id)
        rememberScore(hh.id, next.total)
        const text = prev === null ? null : scoreChangeText(prev, next.total)
        if (text) timers.current.push(setTimeout(() => setMessage({ text, tone: 'ok' }), SCORE_TOAST_DELAY_MS))
      } finally {
        running = false
      }
    }
    function onChange() {
      // Deja que la acción termine de guardar antes de leer.
      timers.current.push(setTimeout(() => void check(), 400))
    }
    window.addEventListener(SCORE_INPUTS_CHANGED, onChange)
    window.addEventListener(TRANSACTIONS_CHANGED_EVENT, onChange)
    const pending = timers.current
    return () => {
      window.removeEventListener(SCORE_INPUTS_CHANGED, onChange)
      window.removeEventListener(TRANSACTIONS_CHANGED_EVENT, onChange)
      pending.forEach(clearTimeout)
    }
  }, [])

  return <StatusToast message={message} onDone={() => setMessage(null)} />
}
