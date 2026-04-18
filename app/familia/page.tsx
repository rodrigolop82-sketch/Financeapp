'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { AppShell } from '@/components/layout/AppShell';
import {
  Loader2,
  Users,
  UserPlus,
  Crown,
  User,
  Trash2,
  Mail,
  AlertCircle,
  CheckCircle2,
  Link2,
  Copy,
  Check,
  Share2,
  Receipt,
} from 'lucide-react';
import { useFormatMoney } from '@/lib/hooks/useFormatMoney';

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
  const [inviteLink, setInviteLink] = useState('');
  const [generatingLink, setGeneratingLink] = useState(false);
  const [copied, setCopied] = useState(false);
  const [spendingByMember, setSpendingByMember] = useState<Record<string, number>>({});
  const [txCountByMember, setTxCountByMember] = useState<Record<string, number>>({});
  const [unattributedSpending, setUnattributedSpending] = useState(0);
  const router = useRouter();
  const supabase = createClient();
  const fmt = useFormatMoney();

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
        const [membersRes, { data: txData }] = await Promise.all([
          fetch(`/api/familia?householdId=${hhId}`),
          supabase
            .from('transactions')
            .select('created_by, amount')
            .eq('household_id', hhId),
        ]);

        if (membersRes.ok) {
          const data = await membersRes.json();
          setMembers(data.members);
        }

        const byMember: Record<string, number> = {};
        const countByMember: Record<string, number> = {};
        let unattributed = 0;
        (txData || []).forEach((tx: { created_by: string | null; amount: number }) => {
          if (tx.created_by) {
            byMember[tx.created_by] = (byMember[tx.created_by] || 0) + Number(tx.amount);
            countByMember[tx.created_by] = (countByMember[tx.created_by] || 0) + 1;
          } else {
            unattributed += Number(tx.amount);
          }
        });
        setSpendingByMember(byMember);
        setTxCountByMember(countByMember);
        setUnattributedSpending(unattributed);
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

  async function generateInviteLink() {
    setGeneratingLink(true);
    setMessage(null);

    const res = await fetch('/api/invite', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ householdId }),
    });

    if (res.ok) {
      const data = await res.json();
      const link = `${window.location.origin}/invite/${data.invite.invite_code}`;
      setInviteLink(link);
    } else {
      setMessage({ type: 'error', text: 'Error al generar el link de invitación' });
    }
    setGeneratingLink(false);
  }

  async function copyLink() {
    await navigator.clipboard.writeText(inviteLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function shareLink() {
    if (navigator.share) {
      await navigator.share({
        title: 'Únete a mi hogar en Zafi',
        text: 'Te invito a compartir el presupuesto familiar en Zafi',
        url: inviteLink,
      });
    } else {
      copyLink();
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-surface-bg flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-electric-light animate-spin" />
      </div>
    );
  }

  return (
    <AppShell title="Familia" currentPath="/familia">
        {isOwner && (
          <div className="flex justify-end mb-6">
            <Button onClick={() => { setShowInvite(true); setMessage(null); }}>
              <UserPlus className="w-4 h-4 mr-2" />
              Invitar
            </Button>
          </div>
        )}

        {/* Status message */}
        {message && (
          <div className={`mb-4 p-3 rounded-lg flex items-center gap-2 ${
            message.type === 'success' ? 'bg-surface-tint text-electric-dark' : 'bg-red-50 text-red-700'
          }`}>
            {message.type === 'success'
              ? <CheckCircle2 className="w-4 h-4" />
              : <AlertCircle className="w-4 h-4" />
            }
            <p className="text-sm">{message.text}</p>
          </div>
        )}

        {/* Invite section */}
        {showInvite && isOwner && (
          <Card className="mb-6 border-electric-soft">
            <CardHeader>
              <CardTitle className="text-base">Invitar miembro</CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              {/* Option 1: Invite link */}
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Link2 className="w-4 h-4 text-electric" />
                  <span className="text-sm font-medium text-gray-700">Compartir link de invitación</span>
                </div>
                <p className="text-sm text-gray-500 mb-3">
                  Generá un link y compartilo por WhatsApp o cualquier medio. La persona puede registrarse y unirse directamente.
                </p>
                {!inviteLink ? (
                  <Button onClick={generateInviteLink} disabled={generatingLink} variant="outline" className="w-full">
                    {generatingLink
                      ? <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      : <Link2 className="w-4 h-4 mr-2" />
                    }
                    Generar link de invitación
                  </Button>
                ) : (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 p-2.5 bg-gray-50 rounded-lg border">
                      <input
                        readOnly
                        value={inviteLink}
                        className="flex-1 text-sm bg-transparent border-none outline-none text-gray-700 truncate"
                      />
                    </div>
                    <div className="flex gap-2">
                      <Button onClick={copyLink} variant="outline" size="sm" className="flex-1">
                        {copied ? <Check className="w-4 h-4 mr-1.5 text-green-600" /> : <Copy className="w-4 h-4 mr-1.5" />}
                        {copied ? 'Copiado' : 'Copiar'}
                      </Button>
                      <Button onClick={shareLink} size="sm" className="flex-1">
                        <Share2 className="w-4 h-4 mr-1.5" />
                        Compartir
                      </Button>
                    </div>
                    <p className="text-xs text-gray-400 text-center">
                      Este link es válido por 7 días
                    </p>
                  </div>
                )}
              </div>

              <div className="relative">
                <div className="absolute inset-0 flex items-center"><span className="w-full border-t" /></div>
                <div className="relative flex justify-center">
                  <span className="bg-white px-2 text-xs text-gray-400">o agregar directamente</span>
                </div>
              </div>

              {/* Option 2: Direct email */}
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Mail className="w-4 h-4 text-gray-400" />
                  <span className="text-sm font-medium text-gray-700">Por correo electrónico</span>
                </div>
                <p className="text-xs text-gray-500 mb-2">
                  Solo funciona si la persona ya tiene cuenta en Zafi.
                </p>
                <div className="flex gap-2">
                  <Input
                    type="email"
                    placeholder="correo@ejemplo.com"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') inviteMember(); }}
                  />
                  <Button onClick={inviteMember} disabled={inviting || !inviteEmail.trim()} size="sm">
                    {inviting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Agregar'}
                  </Button>
                </div>
              </div>

              <Button variant="ghost" size="sm" className="w-full text-gray-400" onClick={() => { setShowInvite(false); setInviteLink(''); }}>
                Cerrar
              </Button>
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

        {/* Spending breakdown by member */}
        {members.length > 0 && (() => {
          const totalSpending = Object.values(spendingByMember).reduce((s, v) => s + v, 0) + unattributedSpending;
          if (totalSpending === 0) return null;
          return (
            <Card className="mt-4">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Receipt className="w-5 h-5 text-gray-500" />
                  <CardTitle className="text-base">Gastos por miembro</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between text-sm border-b pb-3">
                  <span className="text-gray-500">Total del hogar</span>
                  <span className="font-bold text-navy">{fmt(totalSpending)}</span>
                </div>
                {members.map(member => {
                  const amount = spendingByMember[member.user_id] || 0;
                  const pct = totalSpending > 0 ? Math.round((amount / totalSpending) * 100) : 0;
                  const count = txCountByMember[member.user_id] || 0;
                  const name = member.users?.display_name || member.users?.email?.split('@')[0] || 'Usuario';
                  return (
                    <div key={member.user_id}>
                      <div className="flex items-center justify-between text-sm mb-1.5">
                        <div className="flex items-center gap-2">
                          <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                            member.role === 'owner' ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-600'
                          }`}>
                            {name[0]?.toUpperCase()}
                          </div>
                          <div>
                            <span className="font-medium">{name}</span>
                            <span className="text-xs text-gray-400 ml-1.5">{count} tx</span>
                          </div>
                        </div>
                        <div className="text-right">
                          <span className="font-semibold">{fmt(amount)}</span>
                          <span className="text-gray-400 text-xs ml-1.5">{pct}%</span>
                        </div>
                      </div>
                      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full bg-electric"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
                {unattributedSpending > 0 && (
                  <div>
                    <div className="flex items-center justify-between text-sm mb-1.5">
                      <span className="text-gray-400 italic">Sin atribuir</span>
                      <div className="text-right">
                        <span className="text-gray-500">{fmt(unattributedSpending)}</span>
                        <span className="text-gray-400 text-xs ml-1.5">
                          {Math.round((unattributedSpending / totalSpending) * 100)}%
                        </span>
                      </div>
                    </div>
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full bg-gray-300"
                        style={{ width: `${Math.round((unattributedSpending / totalSpending) * 100)}%` }}
                      />
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })()}
    </AppShell>
  );
}
