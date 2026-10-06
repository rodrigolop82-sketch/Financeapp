'use client'

// Aviso de Premium dentro de una pantalla: tarjeta azul suave con 👑 y
// "Ver Premium ›" (no ámbar: no es un error, es una invitación).

export function PremiumInline({ children, action = 'Ver Premium ›', onClick, className = '' }: {
  children: React.ReactNode
  action?: string
  onClick?: () => void
  className?: string
}) {
  return (
    <div className={`flex items-center gap-3 rounded-2xl bg-electric-ghost px-4 py-3.5 dark:bg-[#1B2B4D] ${className}`}>
      <span aria-hidden className="text-[22px] leading-none">👑</span>
      <span className="flex-1 text-sm leading-[1.45] text-electric-dark [text-wrap:pretty] dark:text-electric-soft">{children}</span>
      {onClick && (
        <button type="button" onClick={onClick} className="flex-none text-sm font-semibold text-electric-dark dark:text-electric-soft">
          {action}
        </button>
      )}
    </div>
  )
}
