'use client';

// "Fin de mes" en Cómo te fue (C10): Cerrar el mes salió del menú y vive
// aquí. Aparece en un mes ya terminado que todavía no se cerró.

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase';
import { getMonthCloseChecklist } from '@/lib/month-close';
import { textoCierre } from '@/lib/cierre-ui';
import { longMonth } from '@/lib/como-te-fue';

export function CierreCard({ householdId, month, current }: { householdId: string; month: string; current: string }) {
  const [texto, setTexto] = useState<{ title: string; body: string } | null>(null);

  useEffect(() => {
    setTexto(null);
    if (month >= current) return;
    let cancelled = false;
    (async () => {
      const supabase = createClient();
      const { data: snap } = await supabase.from('monthly_snapshots').select('health_score')
        .eq('household_id', householdId).eq('month', `${month}-01`).maybeSingle();
      if (cancelled || (snap && (snap as { health_score: number | null }).health_score != null)) return;
      const checklist = await getMonthCloseChecklist(householdId, month);
      if (cancelled) return;
      setTexto(textoCierre(longMonth(month), checklist.items.filter((i) => !i.done)));
    })().catch(() => {});
    return () => { cancelled = true; };
  }, [householdId, month, current]);

  if (!texto) return null;
  return (
    <section aria-label="Fin de mes" className="mt-3 flex flex-col gap-2 rounded-[20px] border border-electric/30 p-5 text-white" style={{ background: 'var(--zafi-hero)' }}>
      <span className="text-[12.5px] font-bold uppercase tracking-[0.06em] text-[#9FB3CB]">Fin de mes</span>
      <span className="text-[19px] font-bold leading-tight">{texto.title}</span>
      <span className="text-sm leading-[1.45] text-[#CBD8E8] [text-wrap:pretty]">{texto.body}</span>
      <Link href={`/cierre-mes?month=${month}`} className="btn-primary mt-1 self-start" style={{ borderRadius: 14 }}>
        Continuar
      </Link>
    </section>
  );
}
