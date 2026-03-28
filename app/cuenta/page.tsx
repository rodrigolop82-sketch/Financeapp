'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import {
  ArrowLeft,
  Loader2,
  Crown,
  CheckCircle2,
  LogOut,
  User,
  CreditCard,
  Shield,
  Eye,
  Coins,
} from 'lucide-react';
import Link from 'next/link';

export default function CuentaPage() {
  return (
    <Suspense>
      <CuentaContent />
    </Suspense>
  );
}

function CuentaContent() {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<{ email: string; full_name: string; plan: string; trial_ends_at: string; show_decimals: boolean; currency: string } | null>(null);
  const [subscription, setSubscription] = useState<{ plan: string; status: string; current_period_end: string } | null>(null);
  const [upgrading, setUpgrading] = useState(false);
  const [showDecimals, setShowDecimals] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();
  const justUpgraded = searchParams.get('success') === 'true';

  useEffect(() => {
    async function load() {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser) { router.push('/login'); return; }

      const [{ data: profile }, { data: sub }] = await Promise.all([
        supabase.from('users').select('*').eq('id', authUser.id).single(),
        supabase.from('subscriptions').select('*').eq('user_id', authUser.id).limit(1).single(),
      ]);

      setUser(profile as typeof user);
      setShowDecimals(profile?.show_decimals ?? false);
      setSubscription(sub as typeof subscription);
      setLoading(false);
    }
    load();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleUpgrade(plan: 'monthly' | 'annual') {
    setUpgrading(true);
    const res = await fetch('/api/stripe/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ plan }),
    });
    const { url } = await res.json();
    if (url) window.location.href = url;
    else setUpgrading(false);
  }

  async function toggleDecimals(val: boolean) {
    setShowDecimals(val);
    const { data: { user: authUser } } = await supabase.auth.getUser();
    if (authUser) {
      await supabase.from('users').update({ show_decimals: val }).eq('id', authUser.id);
    }
  }

  async function changeCurrency(val: string) {
    setUser(prev => prev ? { ...prev, currency: val } : prev);
    const { data: { user: authUser } } = await supabase.auth.getUser();
    if (authUser) {
      await supabase.from('users').update({ currency: val }).eq('id', authUser.id);
    }
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-[#3B82F6] animate-spin" />
      </div>
    );
  }

  const isPremium = user?.plan === 'premium';
  const isTrialing = subscription?.status === 'trialing';
  const trialEnd = user?.trial_ends_at ? new Date(user.trial_ends_at) : null;
  const trialDaysLeft = trialEnd ? Math.max(0, Math.ceil((trialEnd.getTime() - Date.now()) / (1000 * 60 * 60 * 24))) : 0;

  return (
    <div className="min-h-screen bg-gray-50 p-4 lg:p-8">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <Link href="/dashboard">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="w-5 h-5" />
            </Button>
          </Link>
          <h1 className="text-2xl font-bold">Mi cuenta</h1>
        </div>

        {justUpgraded && (
          <div className="mb-4 p-4 bg-[#F8F9FF] border border-[#BFDBFE] rounded-lg flex gap-2">
            <CheckCircle2 className="w-5 h-5 text-[#2563EB] flex-shrink-0" />
            <p className="text-sm text-[#1E40AF]">Tu plan Premium se ha activado correctamente.</p>
          </div>
        )}

        {/* Profile */}
        <Card className="mb-4">
          <CardHeader>
            <div className="flex items-center gap-3">
              <User className="w-5 h-5 text-gray-500" />
              <CardTitle className="text-base">Perfil</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between">
              <span className="text-sm text-gray-500">Nombre</span>
              <span className="text-sm font-medium">{user?.full_name || '-'}</span>
            </div>
            <Separator />
            <div className="flex justify-between">
              <span className="text-sm text-gray-500">Correo</span>
              <span className="text-sm font-medium">{user?.email}</span>
            </div>
          </CardContent>
        </Card>

        {/* Display preferences */}
        <Card className="mb-4">
          <CardHeader>
            <div className="flex items-center gap-3">
              <Eye className="w-5 h-5 text-gray-500" />
              <CardTitle className="text-base">Preferencias de visualización</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Mostrar centavos</p>
                <p className="text-xs text-muted-foreground">
                  {showDecimals ? 'Q 8,500.75 — precisión total' : 'Q 8,501 — más limpio y fácil de leer'}
                </p>
              </div>
              <button
                onClick={() => toggleDecimals(!showDecimals)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  showDecimals ? 'bg-[#2563EB]' : 'bg-gray-200'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    showDecimals ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
          </CardContent>
        </Card>

        {/* Currency */}
        <Card className="mb-4">
          <CardHeader>
            <div className="flex items-center gap-3">
              <Coins className="w-5 h-5 text-gray-500" />
              <CardTitle className="text-base">Moneda</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Moneda principal</p>
                <p className="text-xs text-muted-foreground">
                  Se usa para mostrar todos los montos en la app
                </p>
              </div>
              <select
                value={user?.currency || 'GTQ'}
                onChange={(e) => changeCurrency(e.target.value)}
                className="border rounded-md px-3 py-2 text-sm bg-white"
              >
                <option value="GTQ">Q - Quetzal (GTQ)</option>
                <option value="USD">$ - Dólar (USD)</option>
                <option value="MXN">$ - Peso MX (MXN)</option>
                <option value="COP">$ - Peso CO (COP)</option>
                <option value="HNL">L - Lempira (HNL)</option>
                <option value="NIO">C$ - Córdoba (NIO)</option>
                <option value="CRC">₡ - Colón (CRC)</option>
              </select>
            </div>
          </CardContent>
        </Card>

        {/* Subscription */}
        <Card className="mb-4">
          <CardHeader>
            <div className="flex items-center gap-3">
              <CreditCard className="w-5 h-5 text-gray-500" />
              <CardTitle className="text-base">Plan y facturación</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between mb-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold">
                    {isPremium ? 'Premium' : 'Gratis'}
                  </span>
                  {isPremium && <Crown className="w-4 h-4 text-yellow-500" />}
                  {isTrialing && (
                    <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full">
                      Prueba
                    </span>
                  )}
                </div>
                {isTrialing && trialDaysLeft > 0 && (
                  <p className="text-xs text-gray-500 mt-1">
                    Tu prueba termina en {trialDaysLeft} día{trialDaysLeft !== 1 ? 's' : ''}
                  </p>
                )}
                {subscription?.current_period_end && (
                  <p className="text-xs text-gray-500 mt-1">
                    Próximo cobro: {new Date(subscription.current_period_end).toLocaleDateString('es-GT')}
                  </p>
                )}
              </div>
            </div>

            {!isPremium && (
              <div className="space-y-3">
                <Separator />
                <p className="text-sm text-gray-600">Mejora tu plan para desbloquear todas las funciones:</p>
                <div className="grid grid-cols-2 gap-3">
                  <Button variant="outline" onClick={() => handleUpgrade('monthly')} disabled={upgrading}>
                    $4.99/mes
                  </Button>
                  <Button onClick={() => handleUpgrade('annual')} disabled={upgrading}>
                    {upgrading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                    $39.99/año (ahorra 33%)
                  </Button>
                </div>
                <ul className="text-xs text-gray-500 space-y-1">
                  <li>&#10003; Deudas ilimitadas</li>
                  <li>&#10003; Modo familia</li>
                  <li>&#10003; Zafi AI — planner personal</li>
                  <li>&#10003; Historial completo</li>
                </ul>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Security */}
        <Card className="mb-4">
          <CardHeader>
            <div className="flex items-center gap-3">
              <Shield className="w-5 h-5 text-gray-500" />
              <CardTitle className="text-base">Seguridad</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <Button variant="destructive" className="w-full" onClick={handleLogout}>
              <LogOut className="w-4 h-4 mr-2" />
              Cerrar sesión
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
