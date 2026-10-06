import { describe, it, expect } from 'vitest'
import { cardOwnerNote, firstName, isSharedHousehold, scopeHelp, type Person } from './hogar'

const ana: Person = { id: 'a', name: 'Ana', fullName: 'Ana Pérez', owner: true, access: 'full' }
const luis: Person = { id: 'l', name: 'Luis', fullName: 'Luis Pérez', owner: false, access: 'full' }

describe('hogar', () => {
  it('solo con 2+ personas completas se pregunta quién pagó', () => {
    expect(isSharedHousehold([ana])).toBe(false)
    expect(isSharedHousehold([ana, { ...luis, access: 'view' }])).toBe(false)
    expect(isSharedHousehold([ana, luis])).toBe(true)
  })
  it('primer nombre', () => {
    expect(firstName('Ana María Pérez')).toBe('Ana')
    expect(firstName(null, 'luis.p@x.com')).toBe('luis.p')
  })
  it('textos', () => {
    expect(scopeHelp('shared')).toBe('Cuenta para el plan del hogar y para repartir.')
    expect(scopeHelp('personal')).toBe('Se ve en el hogar, pero no entra en la cuenta entre ustedes.')
    expect(cardOwnerNote(luis, 38)).toBe('Los 38 movimientos quedan como pagados por Luis. Lo recordamos para la próxima vez.')
    expect(cardOwnerNote(null, 38)).toBe('La anotamos como de los dos. Puedes cambiar quién pagó en cada movimiento.')
  })
})
