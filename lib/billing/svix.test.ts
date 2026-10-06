import { describe, it, expect } from 'vitest'
import { signSvix, verifySvixSignature } from './svix'

const SECRET = 'whsec_' + Buffer.from('llave-de-prueba-123').toString('base64')
const body = '{"event_type":"intent.succeeded","id":"in_1"}'
const ts = '1760000000'

describe('verifySvixSignature', () => {
  it('acepta una firma válida (también entre varias)', () => {
    const sig = signSvix(SECRET, 'msg_1', ts, body)
    expect(verifySvixSignature({ secret: SECRET, id: 'msg_1', timestamp: ts, signature: sig, body, nowSeconds: 1760000010 })).toBe(true)
    expect(verifySvixSignature({ secret: SECRET, id: 'msg_1', timestamp: ts, signature: `v1,AAAA ${sig}`, body, nowSeconds: 1760000010 })).toBe(true)
  })
  it('rechaza cuerpo cambiado, otra llave, sin encabezados o fuera de tiempo', () => {
    const sig = signSvix(SECRET, 'msg_1', ts, body)
    expect(verifySvixSignature({ secret: SECRET, id: 'msg_1', timestamp: ts, signature: sig, body: body + ' ', nowSeconds: 1760000010 })).toBe(false)
    expect(verifySvixSignature({ secret: 'whsec_' + Buffer.from('otra').toString('base64'), id: 'msg_1', timestamp: ts, signature: sig, body, nowSeconds: 1760000010 })).toBe(false)
    expect(verifySvixSignature({ secret: SECRET, id: null, timestamp: ts, signature: sig, body })).toBe(false)
    expect(verifySvixSignature({ secret: SECRET, id: 'msg_1', timestamp: ts, signature: sig, body, nowSeconds: 1760000000 + 600 })).toBe(false)
  })
})
