// Aviso "Salud financiera: 61 (+3)" después de una acción que mueve el
// puntaje. Las pantallas avisan con notifyScoreInputsChanged(); ScoreWatcher
// (en AppShell) recalcula y compara con el último puntaje conocido.

export const SCORE_INPUTS_CHANGED = 'zafi:score-inputs-changed'
const LAST_KEY = 'zafi:score-last'
/** El aviso del puntaje sale después del toast de la acción, no en paralelo. */
export const SCORE_TOAST_DELAY_MS = 3000

export function notifyScoreInputsChanged() {
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent(SCORE_INPUTS_CHANGED))
}

export function readLastScore(householdId: string): number | null {
  try {
    const raw = sessionStorage.getItem(LAST_KEY)
    if (!raw) return null
    const v = JSON.parse(raw) as { householdId: string; total: number }
    return v.householdId === householdId ? v.total : null
  } catch {
    return null
  }
}

export function rememberScore(householdId: string, total: number) {
  try { sessionStorage.setItem(LAST_KEY, JSON.stringify({ householdId, total })) } catch { /* sin almacenamiento */ }
}

/** "Salud financiera: 61 (+3)" o con "Bajó por lo que acabas de hacer". */
export function scoreChangeText(prev: number, next: number): string | null {
  const d = next - prev
  if (d === 0) return null
  return d > 0
    ? `Salud financiera: ${next} (+${d})`
    : `Salud financiera: ${next} (−${-d}) · Bajó por lo que acabas de hacer`
}
