'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  ArrowLeft,
  Loader2,
  Users,
  UserPlus,
  Crown,
  User,
  Trash2,
  Mail,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react';
import Link from 'next/link';

interface Member {
  user_id: string;
  role: string;
  joined_at: string;
  users: { email: string; display_name: string | null } | null;
}

export default function FamiliaPage() {
  const [loading, setLoading] = useState(true);
  const [members, setMembers] = useState<Member[]>([]);
  const [householdId, setHouseholdId] = useState('');
  const [isOwner, setIsOwner] = useState(false);
  const [showInvite, setShowInvite] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviting, setInviting] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push('/login'); return; }

      const { data: hh } = await supabase
        .from('households').select('id, owner_id').eq('owner_id', user.id).limit(1).single();

      if (!hh) {
        // Try as member
        const { data: membership } = await supabase
          .from('household_members')
          .select('household_id, households(id, owner_id)')
          .eq('user_id', user.id)
          .limit(1)
          .single();

        if (!membership) { router.push('/onboarding'); return; }
        const household = membership.households as unknown as { id: string; owner_id: string };
        setHouseholdId(household.id);
        setIsOwner(household.owner_id === user.id);
      } else {
        setHouseholdId(hh.id);
        setIsOwner(true);
      }

      const hhId = hh?.id || '';
      if (hhId) {
        const res = await fetch(`/api/familia?householdId=${hhId}`);
        if (res.ok) {
          const data = await res.json();
          setMembers(data.members);
        }
      }
      setLoading(false);
    }
    load();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function inviteMember() {
    if (!inviteEmail.trim()) return;
    setInviting(true);
    setMessage(null);

    const res = await fetch('/api/familia', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ householdId, email: inviteEmail }),
    });

    const data = await res.json();

    if (res.ok) {
      setMessage({ type: 'success', text: 'Miembro agregado exitosamente' });
      setInviteEmail('');
      setShowInvite(false);
      // Reload members
      const listRes = await fetch(`/api/familia?householdId=${householdId}`);
      if (listRes.ok) {
        const listData = await listRes.json();
        setMembers(listData.members);
      }
    } else {
      setMessage({ type: 'error', text: data.error || 'Error al invitar' });
    }
    setInviting(false);
  }

  async function removeMember(userId: string) {
    const res = await fetch('/api/familia', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ householdId, userId }),
    });

    if (res.ok) {
      setMembers(members.filter(m => m.user_id !== userId));
      setMessage({ type: 'success', text: 'Miembro eliminado' });
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-purple-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 lg:p-8">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Link href="/dashboard">
              <Button variant="ghost" size="icon">
                <ArrowLeft className="w-5 h-5" />
              </Button>
            </Link>
            <div>
              <h1 className="text-2xl font-bold">Familia</h1>
              <p className="text-sm text-gray-500">{members.length} miembro{members.length !== 1 ? 's' : ''}</p>
            </div>
          </div>
          {isOwner && (
            <Button onClick={() => { setShowInvite(true); setMessage(null); }}>
              <UserPlus className="w-4 h-4 mr-2" />
              Invitar
            </Button>
          )}
        </div>

        {/* Status message */}
        {message && (
          <div className={`mb-4 p-3 rounded-lg flex items-center gap-2 ${
            message.type === 'success' ? 'bg-purple-50 text-purple-700' : 'bg-red-50 text-red-700'
          }`}>
            {message.type === 'success'
              ? <CheckCircle2 className="w-4 h-4" />
              : <AlertCircle className="w-4 h-4" />
            }
            <p className="text-sm">{message.text}</p>
          </div>
        )}

        {/* Invite form */}
        {showInvite && isOwner && (
          <Card className="mb-6 border-purple-200">
            <CardHeader>
              <CardTitle className="text-base">Invitar miembro</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-gray-500">
                Ingresa el correo electrónico de la persona que deseas agregar a tu hogar.
                Debe tener una cuenta registrada.
              </p>
              <div>
                <Label>Correo electrónico</Label>
                <Input
                  type="email"
                  className="mt-1"
                  placeholder="ejemplo@correo.com"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') inviteMember(); }}
                />
              </div>
              <div className="flex gap-3">
                <Button onClick={inviteMember} disabled={inviting || !inviteEmail.trim()}>
                  {inviting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Mail className="w-4 h-4 mr-2" />}
                  Agregar miembro
                </Button>
                <Button variant="outline" onClick={() => setShowInvite(false)}>Cancelar</Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Members list */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-gray-500" />
              <CardTitle className="text-base">Miembros del hogar</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="p-0 divide-y">
            {members.map((member) => (
              <div key={member.user_id} className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 group">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                  member.role === 'owner' ? 'bg-amber-100' : 'bg-gray-100'
                }`}>
                  {member.role === 'owner'
                    ? <Crown className="w-5 h-5 text-amber-600" />
                    : <User className="w-5 h-5 text-gray-400" />
                  }
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">
                    {member.users?.display_name || member.users?.email || 'Usuario'}
                  </p>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-500">{member.users?.email}</span>
                    <span className={`text-xs px-1.5 py-0.5 rounded ${
                      member.role === 'owner' ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-600'
                    }`}>
                      {member.role === 'owner' ? 'Dueño' : 'Miembro'}
                    </span>
                  </div>
                </div>
                {isOwner && member.role !== 'owner' && (
                  <button
                    onClick={() => removeMember(member.user_id)}
                    className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-500 transition-all"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))}
            {members.length === 0 && (
              <div className="p-8 text-center">
                <Users className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="font-medium text-gray-700">Sin miembros</p>
                <p className="text-sm text-gray-500 mt-1">
                  {isOwner ? 'Invita a familiares para compartir el presupuesto.' : 'No hay otros miembros en este hogar.'}
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Info card */}
        {isOwner && members.length > 0 && (
          <Card className="mt-4 bg-blue-50 border-blue-200">
            <CardContent className="p-4">
              <p className="text-sm text-blue-700">
                Los miembros de tu hogar pueden ver el presupuesto, registrar transacciones y consultar el progreso financiero compartido.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
