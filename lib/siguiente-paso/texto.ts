// Textos de "Tu siguiente mejor paso" (F1). Sin jerga financiera.

import type { Paso } from './index'

export function pasoTitulo(p: Paso, fmt: (n: number) => string): string {
  switch (p.key) {
    case 'emergency': return `Aporta ${fmt(p.amount)} a tu fondo de emergencia`
    case 'savings': return `Aparta ${fmt(p.amount)} más para tus metas`
    case 'debt': return `Paga extra a ${p.name} hasta terminarla`
    case 'spending': return `Mantén ${p.name} en su tope`
  }
}

export function pasoAyuda(p: Paso, fmt: (n: number) => string): string {
  switch (p.key) {
    case 'emergency': return 'Te cubre si algo sale mal y también cuenta como ahorro.'
    case 'savings': return 'Lo sano es guardar 20% de lo que recibes.'
    case 'debt': return `Es la que más interés te cobra. Te faltan ${fmt(p.amount)}.`
    case 'spending': return `Este mes va ${fmt(p.amount)} arriba de lo que planeaste.`
  }
}

export function pasoAccion(p: Paso): string {
  switch (p.key) {
    case 'emergency': return 'Aportar al fondo'
    case 'savings': return 'Aportar a una meta'
    case 'debt': return 'Ver plan de pago'
    case 'spending': return 'Ver en mi plan'
  }
}

export function pasoEfecto(p: Paso): string {
  return `Sube tu puntaje de ${p.from} a ${p.to}`
}

export const VAS_MUY_BIEN = 'Vas muy bien. Mantén tu ritmo.'
