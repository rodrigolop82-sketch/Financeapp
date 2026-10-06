import { createHmac, timingSafeEqual } from 'crypto'

/** Tolerancia de la marca de tiempo (Svix usa 5 minutos). */
const TOLERANCE_SECONDS = 5 * 60

/**
 * Verifica una firma de Svix: HMAC-SHA256 de "{id}.{timestamp}.{body}" con la
 * llave de `whsec_<base64>`, en base64. `svix-signature` trae una o más
 * entradas "v1,<firma>" separadas por espacio.
 */
export function verifySvixSignature(opts: {
  secret: string
  id: string | null
  timestamp: string | null
  signature: string | null
  body: string
  nowSeconds?: number
}): boolean {
  const { secret, id, timestamp, signature, body } = opts
  if (!secret || !id || !timestamp || !signature) return false

  const ts = Number(timestamp)
  if (!Number.isFinite(ts)) return false
  const now = opts.nowSeconds ?? Math.floor(Date.now() / 1000)
  if (Math.abs(now - ts) > TOLERANCE_SECONDS) return false

  const key = Buffer.from(secret.startsWith('whsec_') ? secret.slice(6) : secret, 'base64')
  const expected = createHmac('sha256', key).update(`${id}.${timestamp}.${body}`).digest()

  return signature.split(' ').some((entry) => {
    const [version, sig] = entry.split(',')
    if (version !== 'v1' || !sig) return false
    const given = Buffer.from(sig, 'base64')
    return given.length === expected.length && timingSafeEqual(given, expected)
  })
}

/** Firma de prueba (para tests). */
export function signSvix(secret: string, id: string, timestamp: string, body: string): string {
  const key = Buffer.from(secret.startsWith('whsec_') ? secret.slice(6) : secret, 'base64')
  return 'v1,' + createHmac('sha256', key).update(`${id}.${timestamp}.${body}`).digest('base64')
}
