import { describe, expect, it } from 'vitest'
import { looseText, namesSimilar } from './name-match'

describe('looseText', () => {
  it('quita mayúsculas, tildes, signos y espacios de más', () => {
    expect(looseText('  Café  LA-Torre #12 ')).toBe('cafe la torre 12')
    expect(looseText(null)).toBe('')
  })
})

describe('namesSimilar', () => {
  it('mismo texto con distinta forma', () => {
    expect(namesSimilar('POLLO CAMPERO 118 VTA HERMOSA', 'Pollo  Campero 118 Vta Hermosa')).toBe(true)
    expect(namesSimilar('TEF A : 974774663', 'Tef A: 974774663')).toBe(true)
  })

  it('una lectura cortada o con letras de más', () => {
    expect(namesSimilar('POLLO CAMPERO 118 VTA HERMOSA', 'POLLO CAMPERO 118 VTA HERMOS')).toBe(true)
    expect(namesSimilar('LA TORRE EXPRESS VH1', 'LA TORRE EXPRESS VH 1')).toBe(true)
  })

  it('un nombre dentro del otro', () => {
    expect(namesSimilar('SUPERMERCADOS LA TORRE Z10', 'LA TORRE Z10')).toBe(true)
  })

  it('comercios distintos no se parecen', () => {
    expect(namesSimilar('OTRA', 'SUPERMERCADOS LA TORRE Z10')).toBe(false)
    expect(namesSimilar('NETFLIX.COM', 'SPOTIFY')).toBe(false)
    expect(namesSimilar('ESTACION DE SERVICIO M', 'IZI MULTISERVICIOS LIAN')).toBe(false)
  })

  it('vacío nunca coincide', () => {
    expect(namesSimilar('', 'UBER')).toBe(false)
    expect(namesSimilar(null, null)).toBe(false)
  })

  it('dos letras sueltas no cuentan como "dentro"', () => {
    expect(namesSimilar('UBER TRIP', 'UB')).toBe(false)
  })
})
