import { redirect } from 'next/navigation'

// La importación vive en Movimientos (foto o PDF del estado de cuenta).
export default function Page() {
  redirect('/transacciones?importar=1')
}
