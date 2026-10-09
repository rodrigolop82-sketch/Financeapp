'use client';

import { useCallback, useEffect, useState, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase';
import { AppShell } from '@/components/layout/AppShell';
import { BottomSheet } from '@/components/transactions/BottomSheet';
import {
  AccountGroup,
  AccountRow,
  OptionsSheet,
  PickerPill,
  SavedToast,
  Switch,
} from '@/components/cuenta/AccountUI';
import { useInstallTrigger } from '@/components/install/InstallPromptManager';
import { useAppearance, type Appearance } from '@/hooks/useAppearance';
import { planStatusRow, type Subscription } from '@/lib/planes';
import type { Plan } from '@/lib/plans';
import { logAuditEvent } from '@/lib/audit';
import {
  CURRENCY_OPTIONS,
  INACTIVITY_DAY_OPTIONS,
  MONTH_CLOSE_DAY_OPTIONS,
  accountDeletionMailto,
  currencyOption,
  decimalsHint,
  initialsFrom,
  planPill,
  usageMeter,
  type MeterTone,
} from '@/lib/cuenta';
import { pushHint, type PushStatus } from '@/lib/push-status';
import { getPushStatus } from '@/lib/push-client';
import { getPlatformContext } from '@/lib/platform-detection';
import { saveNotificationPrefs } from '@/lib/notification-prefs';
import { openPushOffer, PUSH_STATUS_EVENT } from '@/components/avisos/PushOfferSheet';
import { PageSkeleton } from '@/components/motion/PageSkeleton';
import { FeedbackSheet } from '@/components/feedback/FeedbackSheet';

export default function CuentaPage() {
  return (
    <Suspense>
      <CuentaContent />
    </Suspense>
  );
}

interface UsageInfo {
  ai: { used: number; limit: number; remaining: number };
  imports: { used: number; limit: number; remaining: number };
}

type Sheet = null | 'currency' | 'inactivity' | 'monthClose' | 'delete';

const TEXT_STRONG = 'text-ink-900 dark:text-ink-100';
const TEXT_SECONDARY = 'text-[var(--zafi-text-secondary)]';

const METER_COLOR: Record<MeterTone, string> = {
  ok: 'bg-electric dark:bg-electric-light',
  warn: 'bg-warning',
  full: 'bg-danger',
};

function CuentaContent() {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<{ email: string; full_name: string; plan: string; trial_ends_at: string; show_decimals: boolean; currency: string; marketing_opt_in?: boolean | null } | null>(null);
  const [planStatus, setPlanStatus] = useState<{
    plan: Plan;
    isOwner: boolean;
    trialActive: boolean;
    trialEndsAt: string | null;
    ownerName: string | null;
    household: { name: string; members: { name: string }[] } | null;
    subscription: Subscription | null;
  } | null>(null);
  const [showDecimals, setShowDecimals] = useState(false);
  const [marketingOptIn, setMarketingOptIn] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [usage, setUsage] = useState<UsageInfo | null>(null);
  const [notifPrefs, setNotifPrefs] = useState({
    inactivity_enabled: true,
    inactivity_threshold_days: 5,
    month_close_enabled: true,
    month_close_day: 2,
    due_enabled: true,
    cap_enabled: true,
    income_enabled: false,
  });
  const [pushStatus, setPushStatus] = useState<PushStatus | null>(null);
  const [sheet, setSheet] = useState<Sheet>(null);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [toast, setToast] = useState<{ text: string; key: number } | null>(null);
  const { appearance, setAppearance } = useAppearance();
  const triggerInstall = useInstallTrigger();
  const router = useRouter();
  const supabase = createClient();

  const showToast = useCallback((text: string) => setToast({ text, key: Date.now() }), []);
  const clearToast = useCallback(() => setToast(null), []);
  const closeSheet = useCallback(() => setSheet(null), []);

  useEffect(() => {
    async function load() {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser) { router.push('/login'); return; }

      const [{ data: profile }, statusRes, { data: nPrefs }] = await Promise.all([
        supabase.from('users').select('*').eq('id', authUser.id).single(),
        fetch('/api/billing/status', { cache: 'no-store' }).catch(() => null),
        supabase.from('notification_preferences').select('*').eq('user_id', authUser.id).single(),
      ]);
      const status = statusRes?.ok ? await statusRes.json() : null;

      setUser(profile as typeof user);
      setShowDecimals(profile?.show_decimals ?? false);
      setMarketingOptIn(profile?.marketing_opt_in === true);
      setPlanStatus(status);
      if (nPrefs) {
        setNotifPrefs({
          inactivity_enabled: nPrefs.inactivity_enabled ?? true,
          inactivity_threshold_days: nPrefs.inactivity_threshold_days ?? 5,
          month_close_enabled: nPrefs.month_close_enabled ?? true,
          month_close_day: nPrefs.month_close_day ?? 2,
          due_enabled: nPrefs.due_enabled ?? true,
          cap_enabled: nPrefs.cap_enabled ?? true,
          income_enabled: nPrefs.income_enabled ?? false,
        });
      }
      setLoading(false);

      if (!status || status.plan === 'free') {
        try {
          const usageRes = await fetch('/api/usage');
          if (usageRes.ok) {
            const usageData = await usageRes.json();
            setUsage({ ai: usageData.ai, imports: usageData.imports });
          }
        } catch { /* best effort */ }
      }
    }
    load();
    getPushStatus().then(setPushStatus).catch(() => setPushStatus('unsupported'));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // La hoja de avisos avisa cuando cambia el estado (y vuelve a leer los switches).
  useEffect(() => {
    async function onStatus(e: Event) {
      const status = (e as CustomEvent<PushStatus>).detail;
      if (status) setPushStatus(status);
      if (status === 'on') showToast('Avisos activados');
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser) return;
      const { data: nPrefs } = await supabase.from('notification_preferences').select('*').eq('user_id', authUser.id).maybeSingle();
      if (nPrefs) {
        setNotifPrefs((prev) => ({
          ...prev,
          inactivity_enabled: nPrefs.inactivity_enabled ?? prev.inactivity_enabled,
          month_close_enabled: nPrefs.month_close_enabled ?? prev.month_close_enabled,
          due_enabled: nPrefs.due_enabled ?? prev.due_enabled,
          cap_enabled: nPrefs.cap_enabled ?? prev.cap_enabled,
          income_enabled: nPrefs.income_enabled ?? prev.income_enabled,
        }));
      }
    }
    window.addEventListener(PUSH_STATUS_EVENT, onStatus);
    return () => window.removeEventListener(PUSH_STATUS_EVENT, onStatus);
  }, [supabase, showToast]);

  async function toggleDecimals(val: boolean) {
    setShowDecimals(val);
    const { data: { user: authUser } } = await supabase.auth.getUser();
    if (authUser) {
      await supabase.from('users').update({ show_decimals: val }).eq('id', authUser.id);
    }
    showToast(val ? 'Mostrando centavos' : 'Sin centavos');
  }

  /** Consentimiento para el CSV de Mailchimp (Admin › Para reactivar). */
  async function toggleMarketing(val: boolean) {
    setMarketingOptIn(val);
    const { data: { user: authUser } } = await supabase.auth.getUser();
    if (authUser) {
      const { error } = await supabase.from('users').update({ marketing_opt_in: val }).eq('id', authUser.id);
      if (error) {
        setMarketingOptIn(!val);
        showToast('No pudimos guardar el cambio');
        return;
      }
    }
    showToast(val ? 'Te mandaremos consejos por correo' : 'Ya no te mandaremos correos');
  }

  async function changeCurrency(val: string) {
    setSheet(null);
    setUser(prev => prev ? { ...prev, currency: val } : prev);
    const { data: { user: authUser } } = await supabase.auth.getUser();
    if (authUser) {
      await supabase.from('users').update({ currency: val }).eq('id', authUser.id);
    }
    showToast(`Moneda: ${currencyOption(val).name}`);
  }

  function changeAppearance(val: Appearance) {
    setAppearance(val);
    showToast(val === 'light' ? 'Apariencia: Claro' : val === 'dark' ? 'Apariencia: Oscuro' : 'Apariencia: Sistema');
  }

  async function handleLogout() {
    const { data: { user: authUser } } = await supabase.auth.getUser();
    if (authUser) {
      await supabase.from('audit_log').insert({
        user_id: authUser.id,
        event_type: 'logout',
        metadata: {},
      }).then(() => {}, () => {});
    }
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  }

  async function handleExport() {
    setExporting(true);
    showToast('Exportando tus datos…');
    try {
      const res = await fetch('/api/user/export');
      if (!res.ok) throw new Error();
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `zafi-export-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      showToast('Listo, revisa tus descargas');
    } catch {
      showToast('No pudimos exportar, intenta de nuevo');
    } finally {
      setExporting(false);
    }
  }

  async function updateNotifPref(updates: Partial<typeof notifPrefs>, message?: string) {
    const next = { ...notifPrefs, ...updates };
    setNotifPrefs(next);
    const { data: { user: authUser } } = await supabase.auth.getUser();
    if (authUser) {
      const { error } = await saveNotificationPrefs(supabase, authUser.id, next);
      if (error) {
        setNotifPrefs(notifPrefs);
        showToast('No pudimos guardar el cambio');
        return;
      }
    }
    if (message) showToast(message);
  }

  /**
   * "Activar" de Avisos en el teléfono: abre la hoja "¿Te avisamos lo
   * importante?" (o, en iPhone sin instalar, "Agrega Zafi a tu pantalla de
   * inicio"). La hoja pide el permiso y avisa con PUSH_STATUS_EVENT.
   */
  function handleEnablePush() {
    if (pushStatus === 'denied') {
      showToast('Actívalos en los ajustes del teléfono');
      return;
    }
    if (pushStatus === 'needs-install' && getPlatformContext().os !== 'ios') {
      triggerInstall();
      showToast('Primero agrega Zafi a tu pantalla de inicio');
      return;
    }
    openPushOffer();
  }

  /** "Envíanos tu idea": abre la hoja de feedback. */
  function openFeedback() {
    setFeedbackOpen(true);
  }

  async function requestAccountDeletion() {
    setSheet(null);
    const { data: { user: authUser } } = await supabase.auth.getUser();
    if (authUser) {
      await logAuditEvent(supabase, authUser.id, 'account_deletion_requested', { via: 'mi_cuenta' });
    }
    window.location.href = accountDeletionMailto(user?.email);
    showToast('Te escribiremos para confirmar');
  }

  if (loading) {
    return <PageSkeleton variant="list" />;
  }

  const isPremium = !!planStatus && planStatus.plan !== 'free';
  const pill = planPill({ isPremium });
  const currency = currencyOption(user?.currency);
  const statusRow = planStatus ? planStatusRow(planStatus) : { title: 'Plan Gratis', hint: 'Conoce lo que incluye Premium', tone: 'normal' as const };
  const statusHintClass = statusRow.tone === 'danger'
    ? 'text-danger-text dark:text-[var(--zafi-error-text)]'
    : statusRow.tone === 'warn' ? 'text-warning-text dark:text-warning' : '';

  const pillClass =
    pill.tone === 'premium' ? 'bg-electric-ghost text-navy' : 'bg-white/15 text-white';

  const appearanceOptions: { value: Appearance; label: string }[] = [
    { value: 'light', label: '☀️ Claro' },
    { value: 'dark', label: '🌙 Oscuro' },
    { value: 'system', label: 'Sistema' },
  ];

  return (
    <AppShell title="Mi cuenta" currentPath="/cuenta" hideMobileBar>
      <div className="mx-auto flex max-w-2xl flex-col pb-6 lg:mx-0 zafi-stagger">
        {/* Encabezado móvil */}
        <div className="-mx-4 flex flex-col items-start gap-0.5 px-5 pt-[env(safe-area-inset-top)] lg:hidden">
          <Link href="/mas" className="flex h-11 items-center text-[15px] font-semibold text-electric-dark dark:text-electric-soft">
            ‹ Más
          </Link>
          <h1 className={`font-serif text-[30px] leading-[1.15] ${TEXT_STRONG}`}>Mi cuenta</h1>
        </div>


        {/* Perfil */}
        <div className="mt-3.5 flex items-center gap-3.5 rounded-[20px] bg-navy p-[18px] text-white">
          <div className="flex h-[54px] w-[54px] flex-none items-center justify-center rounded-full bg-electric text-lg font-bold" aria-hidden>
            {initialsFrom(user?.full_name, user?.email)}
          </div>
          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className="truncate text-[17px] font-bold">{user?.full_name || 'Tu cuenta'}</span>
            <span className="truncate text-[13.5px] text-[#CBD8E8]">{user?.email}</span>
          </div>
          <span className={`flex-none whitespace-nowrap rounded-full px-2.5 py-[5px] text-[12.5px] font-bold ${pillClass}`}>
            {pill.label}
          </span>
        </div>

        {/* Preferencias */}
        <AccountGroup title="Preferencias">
          <AccountRow
            emoji="🪙"
            title="Mostrar centavos"
            hint={decimalsHint(showDecimals, currency.code)}
            right={<Switch checked={showDecimals} onChange={toggleDecimals} label="Mostrar centavos" />}
          />
          <AccountRow
            emoji="💱"
            title="Moneda"
            hint="Para todos los montos de la app"
            onClick={() => setSheet('currency')}
            right={
              <span className={`flex h-8 flex-none items-center gap-1.5 rounded-full border border-[var(--zafi-border)] bg-[var(--zafi-card-alt)] px-3 text-[13.5px] font-semibold ${TEXT_STRONG}`}>
                {currency.symbol} {currency.code} <span aria-hidden className={TEXT_SECONDARY}>▾</span>
              </span>
            }
          />
          <AccountRow
            emoji="🌗"
            title="Apariencia"
            below={
              <div role="radiogroup" aria-label="Apariencia" className="grid grid-cols-3 rounded-xl bg-[var(--zafi-tab-bg)] p-[3px]">
                {appearanceOptions.map((o) => {
                  const active = appearance === o.value;
                  return (
                    <button
                      key={o.value}
                      type="button"
                      role="radio"
                      aria-checked={active}
                      onClick={() => changeAppearance(o.value)}
                      className={`flex h-[34px] items-center justify-center rounded-[9px] text-[13.5px] font-semibold transition-colors ${
                        active
                          ? `bg-[var(--zafi-tab-active)] shadow-[var(--zafi-tab-shadow)] ${TEXT_STRONG}`
                          : TEXT_SECONDARY
                      }`}
                    >
                      {o.label}
                    </button>
                  );
                })}
              </div>
            }
          />
          <AccountRow emoji="🏷️" title="Categorías" hint="Crea y organiza las tuyas" href="/cuenta/categorias" last />
        </AccountGroup>

        {/* Recordatorios */}
        <AccountGroup title="Recordatorios">
          <AccountRow
            emoji="🔔"
            title="Avisos en el teléfono"
            hint={pushStatus ? pushHint(pushStatus) : 'Para recordatorios y alertas de topes'}
            right={
              pushStatus === 'on' ? (
                <span className="flex h-8 flex-none items-center rounded-full bg-success-light px-3.5 text-[13.5px] font-bold text-success-text dark:bg-[var(--zafi-success-bg)] dark:text-[var(--zafi-success-text)]">
                  ✓ Activos
                </span>
              ) : pushStatus === 'unsupported' ? undefined : (
                <button
                  type="button"
                  onClick={handleEnablePush}
                  disabled={pushStatus === null}
                  className="flex h-8 flex-none items-center gap-1.5 rounded-full bg-electric px-3.5 text-[13.5px] font-bold text-white transition-transform active:scale-95 disabled:opacity-60"
                >
                  Activar
                </button>
              )
            }
          />
          <AccountRow
            emoji="📅"
            title="Pagos por vencer"
            hint="Un día antes de cada pago fijo"
            right={
              <Switch
                checked={notifPrefs.due_enabled}
                label="Pagos por vencer"
                onChange={(v) => updateNotifPref({ due_enabled: v }, v ? 'Te avisaremos antes de cada pago fijo' : 'Aviso de pagos apagado')}
              />
            }
          />
          <AccountRow
            emoji="⚠️"
            title="Cerca de mi tope"
            hint="Cuando una categoría llega al 85%"
            right={
              <Switch
                checked={notifPrefs.cap_enabled}
                label="Cerca de mi tope"
                onChange={(v) => updateNotifPref({ cap_enabled: v }, v ? 'Te avisaremos cerca de tus topes' : 'Aviso de topes apagado')}
              />
            }
          />
          <AccountRow
            emoji="⏰"
            title="Si dejo de registrar"
            hint="Avísame cuando pasen días sin gastos"
            right={
              <Switch
                checked={notifPrefs.inactivity_enabled}
                label="Si dejo de registrar"
                onChange={(v) => updateNotifPref({ inactivity_enabled: v }, v ? 'Te avisaremos si dejas de registrar' : 'Aviso de inactividad apagado')}
              />
            }
            below={notifPrefs.inactivity_enabled && (
              <div className={`flex items-center gap-2 pl-12 text-[13.5px] ${TEXT_SECONDARY}`}>
                Después de
                <PickerPill onClick={() => setSheet('inactivity')} label="Cambiar días sin registrar">
                  {notifPrefs.inactivity_threshold_days} días
                </PickerPill>
              </div>
            )}
          />
          <AccountRow
            emoji="✅"
            title="Cierre de mes"
            hint="Tu resumen y dónde ahorrar"
            right={
              <Switch
                checked={notifPrefs.month_close_enabled}
                label="Cierre de mes"
                onChange={(v) => updateNotifPref({ month_close_enabled: v }, v ? 'Te recordaremos cerrar el mes' : 'Recordatorio de cierre apagado')}
              />
            }
            below={notifPrefs.month_close_enabled && (
              <div className={`flex items-center gap-2 pl-12 text-[13.5px] ${TEXT_SECONDARY}`}>
                El día
                <PickerPill onClick={() => setSheet('monthClose')} label="Cambiar día del recordatorio">
                  {notifPrefs.month_close_day}
                </PickerPill>
                de cada mes
              </div>
            )}
          />
          <AccountRow
            emoji="💼"
            title="Ingresos recibidos"
            hint="Cuando registras un ingreso"
            right={
              <Switch
                checked={notifPrefs.income_enabled}
                label="Ingresos recibidos"
                onChange={(v) => updateNotifPref({ income_enabled: v }, v ? 'Te avisaremos de tus ingresos' : 'Aviso de ingresos apagado')}
              />
            }
          />
          <AccountRow
            emoji="📬"
            title="Recibir consejos y novedades por correo"
            hint="Ideas para tu dinero y lo nuevo de Zafi. Sin spam."
            last
            right={<Switch checked={marketingOptIn} onChange={toggleMarketing} label="Recibir consejos y novedades por correo" />}
          />
        </AccountGroup>

        {/* Tu plan */}
        <AccountGroup title="Tu plan">
          <AccountRow
            emoji="👑"
            accentTile
            title={statusRow.title}
            hint={statusHintClass ? <span className={statusHintClass}>{statusRow.hint}</span> : statusRow.hint}
            href="/planes"
            last={!usage}
          />
          {usage && (
            <div className="grid grid-cols-2 gap-2 pb-3.5 pt-1">
              {([
                { label: 'Mensajes a Zafi', u: usage.ai },
                { label: 'Importaciones', u: usage.imports },
              ]).map(({ label, u }) => {
                const m = usageMeter(u.used, u.limit);
                return (
                  <div key={label} className="flex flex-col gap-1.5 rounded-xl bg-[var(--zafi-card-alt)] px-3 py-2.5">
                    <span className={`text-[12.5px] ${TEXT_SECONDARY}`}>{label}</span>
                    <span className={`font-outfit text-base font-bold ${TEXT_STRONG}`}>{u.used} de {u.limit}</span>
                    <div
                      className="h-[5px] overflow-hidden rounded-[3px] bg-[var(--zafi-border-light)]"
                      role="progressbar"
                      aria-label={label}
                      aria-valuenow={m.pct}
                      aria-valuemin={0}
                      aria-valuemax={100}
                    >
                      <div className={`h-full ${METER_COLOR[m.tone]}`} style={{ width: `${m.pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </AccountGroup>

        {/* Ayuda */}
        <AccountGroup title="Ayuda">
          <AccountRow emoji="💡" title="Envíanos tu idea" hint="Sugerencias, errores o lo que quieras" onClick={openFeedback} accentTile />
          <AccountRow emoji="💬" title="Pregúntale a Zafi" hint="Resuelve dudas de tu dinero" href="/chat" last />
        </AccountGroup>

        {/* Privacidad y seguridad */}
        <AccountGroup title="Privacidad y seguridad">
          <AccountRow emoji="🛡️" title="Cómo protegemos tu info" hint="Encriptación y acceso exclusivo" href="/cuenta/privacidad" />
          <AccountRow emoji="🕑" title="Historial de acceso" hint="Últimos inicios de sesión" href="/cuenta/historial-acceso" />
          <AccountRow
            emoji="⬇️"
            title={exporting ? 'Exportando…' : 'Exportar mis datos'}
            hint="Descarga toda tu información"
            onClick={handleExport}
            busy={exporting}
          />
          <AccountRow emoji="📄" title="Política de privacidad" href="/privacidad" />
          <AccountRow emoji="📄" title="Términos de servicio" href="/terminos" last />
        </AccountGroup>

        {/* Al final */}
        <div className="mt-[22px] flex flex-col gap-2.5">
          <button
            type="button"
            onClick={handleLogout}
            className="h-12 rounded-full border border-[var(--zafi-border)] bg-[var(--zafi-card)] text-[15px] font-bold text-[var(--zafi-error-text)] transition-transform active:scale-[0.98]"
          >
            Cerrar sesión
          </button>
          <button
            type="button"
            onClick={() => setSheet('delete')}
            className={`h-11 text-[13.5px] font-semibold ${TEXT_SECONDARY}`}
          >
            Eliminar mi cuenta
          </button>
        </div>
      </div>

      <FeedbackSheet open={feedbackOpen} onClose={() => setFeedbackOpen(false)} />
      <OptionsSheet
        open={sheet === 'currency'}
        title="Moneda principal"
        options={CURRENCY_OPTIONS.map((c) => ({ value: c.code as string, label: `${c.name} (${c.code})`, lead: c.symbol }))}
        value={currency.code}
        onPick={changeCurrency}
        onClose={closeSheet}
      />
      <OptionsSheet
        open={sheet === 'inactivity'}
        title="Avísame después de"
        options={INACTIVITY_DAY_OPTIONS.map((d) => ({ value: d, label: `${d} días sin registrar` }))}
        value={notifPrefs.inactivity_threshold_days}
        onPick={(d) => { setSheet(null); updateNotifPref({ inactivity_threshold_days: d }, `Después de ${d} días`); }}
        onClose={closeSheet}
      />
      <OptionsSheet
        open={sheet === 'monthClose'}
        title="Recordarme el día"
        options={MONTH_CLOSE_DAY_OPTIONS.map((d) => ({ value: d, label: `El día ${d} de cada mes` }))}
        value={notifPrefs.month_close_day}
        onPick={(d) => { setSheet(null); updateNotifPref({ month_close_day: d }, `Cierre de mes: día ${d}`); }}
        onClose={closeSheet}
      />

      <BottomSheet open={sheet === 'delete'} onClose={closeSheet} label="Eliminar mi cuenta" themed>
        <div className="flex flex-col gap-3 px-5 pb-[calc(28px+env(safe-area-inset-bottom))] pt-2">
          <h2 tabIndex={-1} className={`font-serif text-[24px] leading-tight outline-none ${TEXT_STRONG}`}>¿Eliminar tu cuenta?</h2>
          <p className={`text-[15px] leading-normal ${TEXT_SECONDARY}`}>
            Borraremos tu cuenta y todos tus movimientos, planes y metas. No se puede deshacer.
            Te recomendamos exportar tus datos antes.
          </p>
          <p className={`text-[14px] leading-normal ${TEXT_SECONDARY}`}>
            Para confirmar que eres tú, nos escribes desde tu correo a hola@zafiapp.com y la eliminamos en menos de 48 horas.
          </p>
          <button
            type="button"
            onClick={requestAccountDeletion}
            className="mt-1 h-[50px] rounded-full bg-danger-text text-[15px] font-bold text-white transition-transform active:scale-[0.98]"
          >
            Pedir que eliminen mi cuenta
          </button>
          <button type="button" onClick={closeSheet} className={`h-11 text-[15px] font-semibold ${TEXT_STRONG}`}>
            Cancelar
          </button>
        </div>
      </BottomSheet>

      <SavedToast message={toast} onDone={clearToast} />
    </AppShell>
  );
}
