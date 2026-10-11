// Admin › correo de recordatorio (Usuarios y Para reactivar). Plantilla HTML
// con la marca de Zafi: tablas y estilos en línea para que se vea igual en
// Gmail, Outlook y Apple Mail, sin imágenes externas (el logo es texto).
// Lógica pura: lib/admin/reminder-email.test.ts.

import type { UserRow } from './metrics';

/** empezar: nunca capturó un movimiento. volver: ya usó Zafi y se enfrió. */
export type ReminderKind = 'empezar' | 'volver';

export const REMINDER_KINDS: ReminderKind[] = ['empezar', 'volver'];

export function reminderKindFor(r: Pick<UserRow, 'txCount'>): ReminderKind {
  return r.txCount === 0 ? 'empezar' : 'volver';
}

export function parseReminderKind(raw: unknown): ReminderKind {
  return raw === 'volver' ? 'volver' : 'empezar';
}

export interface ReminderEmailInput {
  kind: ReminderKind;
  firstName: string;
  /** Sin barra al final, p. ej. https://zafiapp.com */
  appUrl: string;
}

export interface ReminderEmail {
  subject: string;
  text: string;
  html: string;
}

const C = {
  navy: '#1E3A5F',
  navyDeep: '#0D1F36',
  electric: '#2563EB',
  ghost: '#DBEAFE',
  bg: '#F3F5F9',
  ink: '#0F172A',
  ink700: '#334155',
  ink500: '#64748B',
  border: '#E2E8F0',
  success: '#22C55E',
  successLight: '#D1FAE5',
  successText: '#065F46',
};

const SANS = "'DM Sans', -apple-system, 'Segoe UI', Helvetica, Arial, sans-serif";
const SERIF = "'DM Serif Display', Georgia, 'Times New Roman', serif";

export function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

interface Copy {
  subject: (name: string) => string;
  preheader: string;
  eyebrow: string;
  title: string;
  intro: string;
  steps: { icon: string; title: string; body: string }[];
  cta: string;
  ctaPath: string;
  closing: string;
}

const COPY: Record<ReminderKind, Copy> = {
  empezar: {
    subject: (n) => (n ? `${n}, tu primer paso con Zafi toma 1 minuto` : 'Tu primer paso con Zafi toma 1 minuto'),
    preheader: 'Registra tu primer gasto y mira cuánto puedes gastar hoy, sin hojas de cálculo.',
    eyebrow: 'Empieza hoy',
    title: 'Mira a dónde va tu dinero, sin complicarte',
    intro: 'Ya tienes tu cuenta en Zafi. Solo falta tu primer movimiento para que la app empiece a trabajar por ti.',
    steps: [
      { icon: '✍️', title: 'Registra un gasto', body: 'Escríbelo o díctalo por voz: «almuerzo 45». Listo.' },
      { icon: '📄', title: 'O importa tu estado de cuenta', body: 'Sube el PDF de tu banco y Zafi ordena todo por ti.' },
      { icon: '🎯', title: 'Mira cuánto puedes gastar hoy', body: 'Tu presupuesto del mes, convertido en un número diario.' },
    ],
    cta: 'Registrar mi primer gasto',
    ctaPath: '/dashboard',
    closing: 'Te toma menos que hacer cola en el súper. 😉',
  },
  volver: {
    subject: (n) => (n ? `${n}, ¿cómo vas este mes?` : '¿Cómo vas este mes?'),
    preheader: 'Pon al día tus gastos en un minuto y vuelve a saber cuánto puedes gastar hoy.',
    eyebrow: 'Tu mes te espera',
    title: 'Ponte al día en un minuto',
    intro: 'Hace unos días que no pasas por Zafi. Tus categorías y tu plan siguen ahí, listos para cuando quieras.',
    steps: [
      { icon: '📄', title: 'Importa tu estado de cuenta', body: 'La forma más rápida de ponerte al día: todo el mes de una vez.' },
      { icon: '✍️', title: 'O registra lo de hoy', body: 'Escríbelo o díctalo por voz. Un gasto a la vez también suma.' },
      { icon: '🎯', title: 'Vuelve a tener tu número', body: 'Cuánto puedes gastar hoy sin salirte de tu plan.' },
    ],
    cta: 'Ver mi mes',
    ctaPath: '/dashboard',
    closing: 'Un minuto hoy te ahorra sorpresas a fin de mes.',
  },
};

function stepRow(step: Copy['steps'][number], last: boolean): string {
  return `
              <tr>
                <td valign="top" width="52" style="padding:0 0 ${last ? 0 : 18}px 0;">
                  <div style="width:40px;height:40px;line-height:40px;border-radius:12px;background:${C.ghost};text-align:center;font-size:20px;">${step.icon}</div>
                </td>
                <td valign="top" style="padding:0 0 ${last ? 0 : 18}px 0;font-family:${SANS};">
                  <div style="font-size:16px;font-weight:700;color:${C.ink};line-height:1.35;">${escapeHtml(step.title)}</div>
                  <div style="font-size:14.5px;color:${C.ink500};line-height:1.5;padding-top:2px;">${escapeHtml(step.body)}</div>
                </td>
              </tr>`;
}

/** Tarjeta de ejemplo: así se ve "cuánto puedes gastar hoy" en la app. */
function previewCard(): string {
  return `
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${C.navy};border-radius:18px;">
            <tr>
              <td style="padding:22px 24px;font-family:${SANS};">
                <div style="font-size:12px;letter-spacing:0.08em;text-transform:uppercase;color:#93C5FD;font-weight:700;">Así se ve tu día en Zafi</div>
                <div style="font-size:15px;color:#CBD8E8;padding-top:12px;">Hoy puedes gastar</div>
                <div style="font-family:${SERIF};font-size:40px;line-height:1.1;color:#FFFFFF;padding-top:2px;">Q 245</div>
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:16px;">
                  <tr>
                    <td width="62%" style="height:8px;background:${C.success};border-radius:8px 0 0 8px;font-size:0;line-height:0;">&nbsp;</td>
                    <td style="height:8px;background:#315899;border-radius:0 8px 8px 0;font-size:0;line-height:0;">&nbsp;</td>
                  </tr>
                </table>
                <div style="font-size:13px;color:#CBD8E8;padding-top:10px;">Vas bien: llevas el 62&nbsp;% de tu plan del mes · <span style="color:#93C5FD;">ejemplo</span></div>
              </td>
            </tr>
          </table>`;
}

export function reminderEmail({ kind, firstName, appUrl }: ReminderEmailInput): ReminderEmail {
  const copy = COPY[kind];
  const name = firstName.trim();
  const base = appUrl.replace(/\/+$/, '');
  const ctaUrl = `${base}${copy.ctaPath}`;
  const prefsUrl = `${base}/cuenta`;
  const greeting = name ? `Hola, ${name}:` : 'Hola:';
  const subject = copy.subject(name);

  const text = [
    greeting,
    '',
    copy.intro,
    '',
    ...copy.steps.map((s, i) => `${i + 1}. ${s.title}: ${s.body}`),
    '',
    `${copy.cta}: ${ctaUrl}`,
    '',
    copy.closing,
    '',
    '— El equipo de Zafi',
    'hola@zafiapp.com',
    '',
    `Recibes este correo porque aceptaste recibir noticias de Zafi. Puedes dejar de recibirlas en Tu cuenta: ${prefsUrl}`,
  ].join('\n');

  const html = `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
<title>${escapeHtml(subject)}</title>
</head>
<body style="margin:0;padding:0;background:${C.bg};-webkit-text-size-adjust:100%;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${escapeHtml(copy.preheader)}&#8199;&#65279;&#847;&#8199;&#65279;&#847;&#8199;&#65279;&#847;</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${C.bg};">
    <tr>
      <td align="center" style="padding:28px 12px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;">
          <!-- Logo -->
          <tr>
            <td style="padding:0 4px 18px 4px;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td width="36" height="36" align="center" valign="middle" style="width:36px;height:36px;background:${C.navy};border-radius:10px;font-family:${SANS};font-size:19px;font-weight:800;color:#FFFFFF;">Z</td>
                  <td style="padding-left:10px;font-family:${SANS};font-size:18px;font-weight:700;color:${C.navy};">Zafi</td>
                </tr>
              </table>
            </td>
          </tr>
          <!-- Tarjeta -->
          <tr>
            <td style="background:#FFFFFF;border:1px solid ${C.border};border-radius:22px;padding:32px 28px;">
              <div style="font-family:${SANS};font-size:12.5px;letter-spacing:0.08em;text-transform:uppercase;font-weight:700;color:${C.electric};">${escapeHtml(copy.eyebrow)}</div>
              <h1 style="margin:8px 0 0 0;font-family:${SERIF};font-weight:400;font-size:30px;line-height:1.15;color:${C.ink};">${escapeHtml(copy.title)}</h1>
              <p style="margin:16px 0 0 0;font-family:${SANS};font-size:16px;line-height:1.55;color:${C.ink700};">${escapeHtml(greeting)} ${escapeHtml(copy.intro)}</p>
              <div style="height:24px;line-height:24px;font-size:0;">&nbsp;</div>
${previewCard()}
              <div style="height:26px;line-height:26px;font-size:0;">&nbsp;</div>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${copy.steps.map((s, i) => stepRow(s, i === copy.steps.length - 1)).join('')}
              </table>
              <div style="height:28px;line-height:28px;font-size:0;">&nbsp;</div>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td align="center" style="border-radius:14px;background:${C.electric};">
                    <a href="${escapeHtml(ctaUrl)}" target="_blank" style="display:block;padding:16px 24px;font-family:${SANS};font-size:16.5px;font-weight:700;color:#FFFFFF;text-decoration:none;border-radius:14px;">${escapeHtml(copy.cta)} →</a>
                  </td>
                </tr>
              </table>
              <p style="margin:18px 0 0 0;font-family:${SANS};font-size:14.5px;line-height:1.5;color:${C.ink500};text-align:center;">${escapeHtml(copy.closing)}</p>
            </td>
          </tr>
          <!-- Pie -->
          <tr>
            <td style="padding:22px 12px 0 12px;font-family:${SANS};font-size:12.5px;line-height:1.6;color:${C.ink500};text-align:center;">
              ¿Dudas? Responde este correo o escríbenos a <a href="mailto:hola@zafiapp.com" style="color:${C.ink500};">hola@zafiapp.com</a>.<br>
              Recibes este correo porque aceptaste recibir noticias de Zafi.
              <a href="${escapeHtml(prefsUrl)}" target="_blank" style="color:${C.ink500};">Deja de recibirlas en Tu cuenta</a>.
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  return { subject, text, html };
}
