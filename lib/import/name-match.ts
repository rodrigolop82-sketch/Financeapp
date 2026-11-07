// Parecido entre dos descripciones de un banco. La extracción de un estado de
// cuenta varía entre una foto y un PDF (o entre corridas): mayúsculas,
// espacios, signos y letras al final. Funciones puras: name-match.test.ts.
import { descriptionSimilarity, normalizeDescription } from './batch-merge'

/** Minúsculas, sin tildes, sin signos: "TEF A : 974" y "Tef A: 974" quedan iguales. */
export function looseText(s: string | null | undefined): string {
  return normalizeDescription(s ?? '')
    .replace(/[^a-z0-9ñ ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

const MIN_CONTAINED_LENGTH = 5
export const NAME_SIMILARITY_THRESHOLD = 0.6

/** ¿Se trata del mismo comercio? Igual, uno dentro del otro, o bigramas parecidos. */
export function namesSimilar(a: string | null | undefined, b: string | null | undefined): boolean {
  const la = looseText(a)
  const lb = looseText(b)
  if (!la || !lb) return false
  if (la === lb) return true
  const ca = la.replace(/ /g, '')
  const cb = lb.replace(/ /g, '')
  if (ca === cb) return true
  const [short, long] = ca.length <= cb.length ? [ca, cb] : [cb, ca]
  if (short.length >= MIN_CONTAINED_LENGTH && long.includes(short)) return true
  return descriptionSimilarity(la, lb) >= NAME_SIMILARITY_THRESHOLD
}
