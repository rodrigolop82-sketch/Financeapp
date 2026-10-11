import { redirect } from 'next/navigation'

// Mis Fuentes se unió con Mis bancos: ahora todo vive en Mis cuentas.
export default function FuentesRedirect() {
  redirect('/mis-fuentes')
}
