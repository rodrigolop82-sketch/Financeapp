// Claves personales del atajo de Apple Pay (solo servidor). El token es
// aleatorio (32 bytes, base64url) con el prefijo "zafi_"; en la base solo se
// guarda su SHA-256, así que solo se puede mostrar una vez.
import { createHash, randomBytes } from 'crypto';
import { TOKEN_PREFIX } from './apple-pay';

export function hashShortcutToken(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex');
}

export function generateShortcutToken(): { token: string; hash: string } {
  const token = TOKEN_PREFIX + randomBytes(32).toString('base64url');
  return { token, hash: hashShortcutToken(token) };
}
