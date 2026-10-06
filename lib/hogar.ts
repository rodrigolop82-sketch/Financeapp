// Personas del hogar y reglas de "quién pagó". Sin React.

export interface Person {
  id: string
  name: string
  fullName: string
  owner: boolean
  access: 'full' | 'view'
  monthlyIncome?: number | null
  email?: string | null
}

/** La UI de quién pagó / compartido solo aparece con 2+ personas con acceso completo. */
export function isSharedHousehold(people: Person[]): boolean {
  return people.filter((p) => p.access === 'full').length >= 2
}

export function firstName(fullName: string | null | undefined, email?: string | null): string {
  return (fullName || email?.split('@')[0] || 'Usuario').trim().split(/\s+/)[0]
}

export function initialOf(name: string): string {
  return (name.trim()[0] || '?').toUpperCase()
}

/** Ayuda bajo "Es para". */
export function scopeHelp(scope: 'shared' | 'personal'): string {
  return scope === 'shared'
    ? 'Cuenta para el plan del hogar y para repartir.'
    : 'Se ve en el hogar, pero no entra en la cuenta entre ustedes.'
}

/** Texto de la hoja "¿De quién es la tarjeta?". */
export function cardOwnerNote(owner: Person | null, count: number): string {
  return owner
    ? `${count === 1 ? 'El movimiento queda' : `Los ${count} movimientos quedan`} como ${count === 1 ? 'pagado' : 'pagados'} por ${owner.name}. Lo recordamos para la próxima vez.`
    : 'La anotamos como de los dos. Puedes cambiar quién pagó en cada movimiento.'
}
