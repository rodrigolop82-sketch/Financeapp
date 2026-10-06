import { redirect } from 'next/navigation';
import { planHref } from '@/lib/navigation';

// Ahora vive en la pestaña Plan.
export default function Page({ searchParams }: { searchParams: Record<string, string | string[] | undefined> }) {
  redirect(planHref('deudas', searchParams));
}
