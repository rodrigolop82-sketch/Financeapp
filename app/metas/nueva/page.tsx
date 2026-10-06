import { redirect } from 'next/navigation';

// "Nueva meta" ahora es una hoja en Plan › Metas.
export default function Page() {
  redirect('/plan?s=metas&nueva=1');
}
