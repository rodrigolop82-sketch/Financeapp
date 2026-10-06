'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { createClient } from '@/lib/supabase';
import Link from 'next/link';
import { AuthPage, AuthTitle } from '@/components/auth/AuthUI';
import { ErrorBox, ListCard, ROW_DIVIDER } from '@/components/layout/Pantalla';
import { PRIMARY_BUTTON, TEXT_MUTED, TEXT_STRONG } from '@/components/movimientos/ui';
import { SkeletonBlock } from '@/components/motion/PageSkeleton';

const PERKS: [string, string][] = [
  ['📊', 'Ver el plan del mes'],
  ['✍️', 'Registrar gastos e ingresos'],
  ['🎯', 'Aportar a las metas del hogar'],
];

type InviteState = 'loading' | 'valid' | 'invalid' | 'joining' | 'joined' | 'already_member' | 'needs_auth';

export default function InvitePage() {
  const { code } = useParams<{ code: string }>();
  const [state, setState] = useState<InviteState>('loading');
  const [householdName, setHouseholdName] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    async function checkInvite() {
      // First check if user is logged in
      const { data: { user } } = await supabase.auth.getUser();

      // Validate the invite code
      const res = await fetch(`/api/invite?code=${code}`);
      if (!res.ok) {
        const data = await res.json();
        setErrorMsg(data.error || 'Invitación inválida');
        setState('invalid');
        return;
      }

      const data = await res.json();
      setHouseholdName(data.household.name);
      setOwnerName(data.owner.name);

      if (!user) {
        setState('needs_auth');
      } else {
        setState('valid');
      }
    }
    checkInvite();
  }, [code, supabase.auth]);

  async function handleJoin() {
    setState('joining');

    const res = await fetch('/api/invite', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code }),
    });

    const data = await res.json();

    if (res.status === 409) {
      setState('already_member');
      return;
    }

    if (!res.ok) {
      setErrorMsg(data.error || 'Error al unirse');
      setState('invalid');
      return;
    }

    setState('joined');
    setTimeout(() => router.push('/dashboard'), 2000);
  }

  const tile = (emoji: string) => (
    <span aria-hidden className="mt-4 flex h-[72px] w-[72px] items-center justify-center rounded-[22px] bg-electric-ghost text-4xl dark:bg-[#1B2B4D]">{emoji}</span>
  );
  const invitedBy = (
    <><b className={TEXT_STRONG}>{ownerName}</b> te invitó a compartir el presupuesto de <b className={TEXT_STRONG}>{householdName}</b>.</>
  );
  const perks = (
    <ListCard className="w-full text-left">
      {PERKS.map(([emoji, text]) => (
        <div key={text} className={`flex h-[52px] items-center gap-3 ${ROW_DIVIDER}`}>
          <span aria-hidden className="w-6 text-center text-[19px]">{emoji}</span>
          <span className={`text-[15px] font-semibold ${TEXT_STRONG}`}>{text}</span>
        </div>
      ))}
    </ListCard>
  );

  return (
    <AuthPage center>
      {(state === 'loading' || state === 'joining') && (
        <div role="status" className="flex w-full flex-col items-center gap-3">
          <SkeletonBlock className="mt-4 h-[72px] w-[72px] !rounded-[22px]" />
          <SkeletonBlock className="h-8 w-56" />
          <SkeletonBlock className="h-4 w-64" />
          <span className={`text-sm ${TEXT_MUTED}`}>{state === 'loading' ? 'Verificando la invitación…' : 'Uniéndote al hogar…'}</span>
        </div>
      )}

      {state === 'invalid' && (
        <>
          {tile('🔗')}
          <AuthTitle title="Esta invitación no sirve" />
          <div className="w-full text-left"><ErrorBox>{errorMsg}</ErrorBox></div>
          <Link href="/login" className={`w-full ${PRIMARY_BUTTON} flex items-center justify-center`}>Ir a iniciar sesión</Link>
        </>
      )}

      {(state === 'needs_auth' || state === 'valid') && (
        <>
          {tile('👪')}
          <AuthTitle title="Te invitaron a un hogar" sub={invitedBy} />
          {perks}
          <div className="flex w-full flex-col gap-2.5">
            {state === 'needs_auth' ? (
              <>
                <Link href={`/registro?invite=${code}`} className={`${PRIMARY_BUTTON} flex items-center justify-center`}>Crear cuenta y unirme</Link>
                <Link href={`/login?invite=${code}`} className={`flex h-11 items-center justify-center text-[15px] font-semibold ${TEXT_MUTED}`}>Ya tengo cuenta</Link>
              </>
            ) : (
              <button type="button" onClick={handleJoin} className={PRIMARY_BUTTON}>Unirme al hogar</button>
            )}
          </div>
        </>
      )}

      {state === 'joined' && (
        <>
          {tile('🎉')}
          <AuthTitle title="¡Te uniste!" sub={<>Ya compartes el plan de <b className={TEXT_STRONG}>{householdName}</b>.</>} />
          <Link href="/dashboard" className={`w-full ${PRIMARY_BUTTON} flex items-center justify-center`}>Ir a Inicio</Link>
        </>
      )}

      {state === 'already_member' && (
        <>
          {tile('👪')}
          <AuthTitle title="Ya eres miembro" sub={<>Ya formas parte de <b className={TEXT_STRONG}>{householdName}</b>.</>} />
          <Link href="/dashboard" className={`w-full ${PRIMARY_BUTTON} flex items-center justify-center`}>Ir a Inicio</Link>
        </>
      )}
    </AuthPage>
  );
}
