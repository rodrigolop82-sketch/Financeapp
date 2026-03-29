'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { createClient } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Loader2, Users, CheckCircle2, AlertCircle } from 'lucide-react';
import Link from 'next/link';

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

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#F8F9FF] to-white flex items-center justify-center px-4">
      <Card className="w-full max-w-md">
        <CardContent className="p-8 text-center">
          {/* Logo */}
          <div className="flex items-center justify-center gap-2 mb-6">
            <div className="w-10 h-10 bg-[#2563EB] rounded-xl flex items-center justify-center">
              <span className="text-white text-lg font-bold">Z</span>
            </div>
            <span className="text-2xl font-bold text-[#1E3A5F]">Zafi</span>
          </div>

          {state === 'loading' && (
            <div className="py-8">
              <Loader2 className="w-8 h-8 text-[#3B82F6] animate-spin mx-auto" />
              <p className="text-gray-500 mt-3">Verificando invitación...</p>
            </div>
          )}

          {state === 'invalid' && (
            <div className="py-4">
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <AlertCircle className="w-8 h-8 text-red-500" />
              </div>
              <h2 className="text-xl font-bold text-gray-900 mb-2">Invitación inválida</h2>
              <p className="text-gray-600 mb-6">{errorMsg}</p>
              <Link href="/login">
                <Button variant="outline">Ir al inicio</Button>
              </Link>
            </div>
          )}

          {state === 'needs_auth' && (
            <div className="py-4">
              <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Users className="w-8 h-8 text-[#2563EB]" />
              </div>
              <h2 className="text-xl font-bold text-gray-900 mb-2">Te invitaron a un hogar</h2>
              <p className="text-gray-600 mb-1">
                <strong>{ownerName}</strong> te invita a unirte al hogar
              </p>
              <p className="text-lg font-semibold text-[#1E3A5F] mb-6">
                &ldquo;{householdName}&rdquo;
              </p>
              <p className="text-sm text-gray-500 mb-6">
                Podrán compartir presupuesto, registrar gastos y ver el progreso financiero juntos.
              </p>
              <div className="space-y-3">
                <Link href={`/registro?invite=${code}`} className="block">
                  <Button className="w-full">Crear cuenta y unirme</Button>
                </Link>
                <Link href={`/login?invite=${code}`} className="block">
                  <Button variant="outline" className="w-full">Ya tengo cuenta</Button>
                </Link>
              </div>
            </div>
          )}

          {state === 'valid' && (
            <div className="py-4">
              <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Users className="w-8 h-8 text-[#2563EB]" />
              </div>
              <h2 className="text-xl font-bold text-gray-900 mb-2">Te invitaron a un hogar</h2>
              <p className="text-gray-600 mb-1">
                <strong>{ownerName}</strong> te invita a unirte al hogar
              </p>
              <p className="text-lg font-semibold text-[#1E3A5F] mb-6">
                &ldquo;{householdName}&rdquo;
              </p>
              <p className="text-sm text-gray-500 mb-6">
                Podrán compartir presupuesto, registrar gastos y ver el progreso financiero juntos.
              </p>
              <Button className="w-full" onClick={handleJoin}>
                Unirme al hogar
              </Button>
            </div>
          )}

          {state === 'joining' && (
            <div className="py-8">
              <Loader2 className="w-8 h-8 text-[#3B82F6] animate-spin mx-auto" />
              <p className="text-gray-500 mt-3">Uniéndote al hogar...</p>
            </div>
          )}

          {state === 'joined' && (
            <div className="py-4">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle2 className="w-8 h-8 text-green-600" />
              </div>
              <h2 className="text-xl font-bold text-gray-900 mb-2">¡Te uniste exitosamente!</h2>
              <p className="text-gray-600 mb-2">
                Ahora eres parte del hogar &ldquo;{householdName}&rdquo;
              </p>
              <p className="text-sm text-gray-400">Redirigiendo al dashboard...</p>
            </div>
          )}

          {state === 'already_member' && (
            <div className="py-4">
              <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle2 className="w-8 h-8 text-[#2563EB]" />
              </div>
              <h2 className="text-xl font-bold text-gray-900 mb-2">Ya eres miembro</h2>
              <p className="text-gray-600 mb-6">
                Ya formas parte del hogar &ldquo;{householdName}&rdquo;
              </p>
              <Link href="/dashboard">
                <Button className="w-full">Ir al dashboard</Button>
              </Link>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
