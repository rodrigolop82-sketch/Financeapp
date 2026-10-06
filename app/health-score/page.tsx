import { redirect } from 'next/navigation';

// Una sola pantalla de salud financiera: /score.
export default function Page() {
  redirect('/score?from=resumen');
}
