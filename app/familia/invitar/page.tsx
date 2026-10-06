'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase';
import { AppShell } from '@/components/layout/AppShell';
import { getUserHousehold } from '@/lib/household';
import { fetchEffectivePlan } from '@/lib/plan-client';
import { ErrorBox, GroupTitle, HERO, HERO_MUTED, HERO_STYLE, ListCard, PageHeader, PillButton, ROW_DIVIDER, RowBody, Tile } from '@/components/layout/Pantalla';
import { CARD } from '@/components/resumen/ctf-ui';
import { PRIMARY_BUTTON, TEXT_MUTED, TEXT_STRONG } from '@/components/movimientos/ui';
import { PageSkeleton } from '@/components/motion/PageSkeleton';

// Invitar a la pareja con Premium Familiar: link copiable, WhatsApp y qué
// pasa cuando acepta. Sin Familiar, a /planes con Familiar elegido.
export default function InvitarPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [householdId, setHouseholdId] = useState('');
  const [householdName, setHouseholdName] = useState('');
  const [link, setLink] = useState('');
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push('/login'); return; }
      const [plan, hh] = await Promise.all([fetchEffectivePlan(), getUserHousehold(supabase, user.id)]);
      if (!hh) { router.push('/onboarding'); return; }
      if (hh.owner_id !== user.id) { router.replace('/familia'); return; }
      if (plan?.plan !== 'family') { router.replace('/planes?tier=family'); return; }
      setHouseholdId(hh.id);
      setHouseholdName(hh.name ?? '');
      setLoading(false);
    })();
  }, [router]);

  useEffect(() => {
    if (!householdId) return;
    fetch('/api/invite', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ householdId }),
    })
      .then(async (r) => {
        const data = await r.json().catch(() => ({}));
        if (r.ok && data.invite?.invite_code) setLink(`${window.location.origin}/invite/${data.invite.invite_code}`);
        else setError(data.error || 'No se pudo crear el link. Intenta de nuevo.');
      })
      .catch(() => setError('No se pudo crear el link. Revisa tu conexión.'));
  }, [householdId]);

  if (loading) return <PageSkeleton variant="detail" />;

  async function copy() {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError('No se pudo copiar. Mantén presionado el link para copiarlo.');
    }
  }

  const text = `Te invito a nuestro hogar en Zafi para llevar las cuentas de la casa juntos: ${link}`;
  const shortLink = link.replace(/^https?:\/\//, '');

  return (
    <AppShell title="Invitar" currentPath="/familia" hideMobileBar>
      <div className="mx-auto flex max-w-2xl flex-col pb-8 lg:mx-0">
        <PageHeader back={{ href: '/familia', label: 'Familia' }} title="Invitar" />
        <div className="mt-3.5 flex flex-col gap-[18px] zafi-stagger">
          <section className={`flex flex-col gap-2 ${HERO}`} style={{ ...HERO_STYLE, padding: '22px 22px 20px' }}>
            <span className="text-[13px] font-bold uppercase tracking-[0.12em] text-electric-soft">👑 Premium Familiar</span>
            <h2 className="font-serif text-[28px] leading-[1.15]">Invita a tu pareja</h2>
            <p className={`text-[14.5px] leading-[1.45] [text-wrap:pretty] ${HERO_MUTED}`}>Tu plan incluye a una persona más con todo. Mándale este link.</p>
          </section>

          <div className={`flex items-center gap-3 p-3.5 ${CARD}`}>
            <span className="flex min-w-0 flex-1 flex-col">
              <span className={`text-[13px] ${TEXT_MUTED}`}>Link para {householdName || 'tu hogar'}</span>
              <span className={`truncate font-outfit text-[17px] font-bold ${TEXT_STRONG}`}>{shortLink || 'Creando link…'}</span>
            </span>
            <PillButton onClick={() => void copy()} disabled={!link}>{copied ? 'Copiado ✓' : 'Copiar'}</PillButton>
          </div>

          {error && <ErrorBox>{error}</ErrorBox>}

          <a
            href={link ? `https://wa.me/?text=${encodeURIComponent(text)}` : undefined}
            target="_blank"
            rel="noopener noreferrer"
            aria-disabled={!link}
            className={`flex items-center justify-center ${PRIMARY_BUTTON} ${link ? '' : 'pointer-events-none opacity-60'}`}
          >
            Compartir por WhatsApp
          </a>

          <section>
            <GroupTitle className="mb-1.5">Qué pasa cuando acepta</GroupTitle>
            <ListCard>
              {[
                ['🗓️', 'Trae toda su historia', 'Si ya usa Zafi, nada de lo que registró se pierde.'],
                ['💳', 'Deja de pagar su Premium', 'Si tenía uno, lo cancelamos y le devolvemos lo que no usó.'],
                ['🧮', 'Combinan el plan del mes', 'Tú lo propones, tu pareja lo confirma.'],
              ].map(([e, n, h]) => (
                <div key={n} className={`flex items-center gap-3 py-3 ${ROW_DIVIDER}`}>
                  <RowBody tile={<Tile>{e}</Tile>} name={n} help={h} />
                </div>
              ))}
            </ListCard>
          </section>
          <p className={`mx-1 text-[13px] ${TEXT_MUTED}`}>El link vence en 7 días.</p>
        </div>
      </div>
    </AppShell>
  );
}
