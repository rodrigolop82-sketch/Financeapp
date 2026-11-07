import { describe, expect, it } from 'vitest'
import { API_MAX_LIMIT, MAX_RELOAD_CALLS, appendUnique, filterKey, nextReloadLimit } from './movimientos-paging'

describe('nextReloadLimit', () => {
  it('pide todo lo que falta si cabe en una llamada', () => {
    expect(nextReloadLimit(80, 0, 0)).toBe(80)
    expect(nextReloadLimit(40, 0, 0)).toBe(40)
  })

  it('no pide más que el máximo del API', () => {
    expect(nextReloadLimit(250, 0, 0)).toBe(API_MAX_LIMIT)
    expect(nextReloadLimit(250, 100, 1)).toBe(API_MAX_LIMIT)
    expect(nextReloadLimit(250, 200, 2)).toBe(50)
  })

  it('termina cuando ya se cubrió lo desplegado', () => {
    expect(nextReloadLimit(120, 120, 2)).toBe(0)
    expect(nextReloadLimit(120, 130, 2)).toBe(0)
    expect(nextReloadLimit(0, 0, 0)).toBe(0)
  })

  it('se detiene en el tope de llamadas', () => {
    expect(nextReloadLimit(5000, 800, MAX_RELOAD_CALLS)).toBe(0)
    expect(nextReloadLimit(5000, 700, MAX_RELOAD_CALLS - 1)).toBe(API_MAX_LIMIT)
  })
})

describe('appendUnique', () => {
  const r = (id: string) => ({ id })

  it('agrega al final en orden', () => {
    expect(appendUnique([r('a'), r('b')], [r('c'), r('d')])).toEqual([r('a'), r('b'), r('c'), r('d')])
  })

  it('no repite ids ni dentro de la misma página', () => {
    expect(appendUnique([r('a')], [r('a'), r('b'), r('b')])).toEqual([r('a'), r('b')])
  })

  it('omite la fila con borrado pendiente', () => {
    expect(appendUnique([r('a')], [r('b'), r('c')], 'b')).toEqual([r('a'), r('c')])
  })

  it('no modifica la lista original', () => {
    const prev = [r('a')]
    appendUnique(prev, [r('b')])
    expect(prev).toEqual([r('a')])
  })
})

describe('filterKey', () => {
  it('es igual con los mismos filtros y distinta si cambia uno', () => {
    const base = filterKey(['', '2026-10-01', '2026-10-31', 'all', 'all'])
    expect(filterKey(['', '2026-10-01', '2026-10-31', 'all', 'all'])).toBe(base)
    expect(filterKey(['uber', '2026-10-01', '2026-10-31', 'all', 'all'])).not.toBe(base)
    expect(filterKey(['', '2026-09-01', '2026-09-30', 'all', 'all'])).not.toBe(base)
  })

  it('trata null y undefined como vacío', () => {
    expect(filterKey([null, undefined, 'x'])).toBe('||x')
  })
})
