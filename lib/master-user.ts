// Master user — full access to all admin features and content
export const MASTER_EMAIL = 'rodrigolop82@gmail.com'

export function isMasterUser(email: string | null | undefined): boolean {
  return email === MASTER_EMAIL
}
