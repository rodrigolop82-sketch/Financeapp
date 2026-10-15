// F7: correo "Así cerró tu {mes}". Plantilla HTML con la marca de Zafi:
// tablas y estilos en línea (Gmail, Outlook, Apple Mail). Las fuentes de
// marca no cargan de forma fiable en correo: el wordmark "zafi" va como texto
// con fuentes de respaldo (no hay imagen del wordmark en el repo).
// Puro: lib/resumen-mensual/plantilla.test.ts.

import { escapeHtml } from '../admin/reminder-email'

export interface ResumenMensualInput {
  firstName: string
  /** 'septiembre'. */
  monthName: string
  /** Sin barra al final, p. ej. https://zafiapp.com */
  appUrl: string
  fmt: (n: number) => string
  score: { total: number; prev: number | null } | null
  budget: { inLine: number; total: number; over: string[] } | null
  goal: { name: string; emoji: string; pct: number; contributed: number } | null
  /** Siguiente paso de F1; null lo omite. */
  step: { title: string; effect: string } | null
}

export interface ResumenMensualEmail {
  subject: string
  text: string
  html: string
}

const C = {
  navy: '#1E3A5F',
  electric: '#2563EB',
  bg: '#F3F5F9',
  ink: '#0F172A',
  ink700: '#334155',
  ink500: '#64748B',
  border: '#E2E8F0',
  green: '#15803D',
  amber: '#92400E',
}
const SANS = "'DM Sans', -apple-system, 'Segoe UI', Helvetica, Arial, sans-serif"
const SERIF = "'DM Serif Display', Georgia, 'Times New Roman', serif"
const NUM = "'Outfit', -apple-system, 'Segoe UI', Helvetica, Arial, sans-serif"

export function resumenSubject(monthName: string): string {
  return `Así cerró tu ${monthName}`
}

function scoreChange(s: { total: number; prev: number | null }): string {
  if (s.prev === null) return 'Es tu primer mes con puntaje.'
  const d = s.total - s.prev
  if (d === 0) return 'Igual que el mes anterior.'
  return d > 0 ? `Subió ${d} ${d === 1 ? 'punto' : 'puntos'} frente al mes anterior.` : `Bajó ${-d} ${d === -1 ? 'punto' : 'puntos'} frente al mes anterior.`
}

function budgetLine(b: { inLine: number; total: number; over: string[] }): string {
  const base = `${b.inLine} de ${b.total} ${b.total === 1 ? 'categoría cerró' : 'categorías cerraron'} en línea.`
  return b.over.length ? `${base} Se pasaron: ${b.over.join(', ')}.` : `${base} Ninguna se pasó.`
}

function goalLine(g: NonNullable<ResumenMensualInput['goal']>, fmt: (n: number) => string): string {
  return `${g.emoji} ${g.name}: vas en ${g.pct}%.${g.contributed > 0 ? ` Este mes le aportaste ${fmt(g.contributed)}.` : ' Este mes no le aportaste.'}`
}

function block(title: string, body: string, big?: { text: string; color?: string }): string {
  return `
              <tr>
                <td style="padding:18px 0;border-top:1px solid ${C.border};">
                  <div style="font-family:${SANS};font-size:12.5px;letter-spacing:0.06em;text-transform:uppercase;font-weight:700;color:${C.ink500};">${escapeHtml(title)}</div>
                  ${big ? `<div style="margin-top:6px;font-family:${NUM};font-size:34px;font-weight:800;line-height:1;color:${big.color ?? C.ink};">${escapeHtml(big.text)}</div>` : ''}
                  <div style="margin-top:6px;font-family:${SANS};font-size:15.5px;line-height:1.5;color:${C.ink700};">${escapeHtml(body)}</div>
                </td>
              </tr>`
}

export function resumenMensualEmail(i: ResumenMensualInput): ResumenMensualEmail {
  const subject = resumenSubject(i.monthName)
  const greeting = i.firstName ? `Hola, ${i.firstName}:` : 'Hola:'
  const intro = 'Aquí va el resumen de tu mes.'
  const prefsUrl = `${i.appUrl}/cuenta#recordatorios`
  const planUrl = `${i.appUrl}/plan/siguiente-paso`

  const sections: { title: string; body: string; big?: { text: string; color?: string } }[] = []
  if (i.score) {
    const d = i.score.prev === null ? 0 : i.score.total - i.score.prev
    sections.push({ title: 'Salud financiera', body: scoreChange(i.score), big: { text: `${i.score.total}`, color: d < 0 ? C.amber : d > 0 ? C.green : C.ink } })
  }
  if (i.budget) sections.push({ title: 'Tu presupuesto', body: budgetLine(i.budget) })
  if (i.goal) sections.push({ title: 'Tu meta principal', body: goalLine(i.goal, i.fmt) })
  if (i.step) sections.push({ title: 'Tu siguiente paso', body: `${i.step.title}. ${i.step.effect}.` })

  const text = [
    greeting,
    '',
    intro,
    '',
    ...sections.flatMap((s) => [`${s.title}${s.big ? `: ${s.big.text}` : ''}`, s.body, '']),
    ...(i.step ? [`Ver mi plan: ${planUrl}`, ''] : []),
    '— Zafi',
    '',
    `Recibes este correo porque activaste el resumen mensual. Cámbialo en Cuenta › Recordatorios: ${prefsUrl}`,
  ].join('\n')

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
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${escapeHtml(intro)}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${C.bg};">
    <tr>
      <td align="center" style="padding:24px 12px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;">
          <!-- Encabezado navy con el wordmark -->
          <tr>
            <td style="background:${C.navy};border-radius:22px 22px 0 0;padding:22px 28px;">
              <span style="font-family:${SERIF};font-size:28px;line-height:1;color:#FFFFFF;">zafi</span>
            </td>
          </tr>
          <tr>
            <td style="background:#FFFFFF;border:1px solid ${C.border};border-top:0;border-radius:0 0 22px 22px;padding:26px 28px 10px 28px;">
              <h1 style="margin:0;font-family:${SERIF};font-weight:400;font-size:28px;line-height:1.2;color:${C.ink};">${escapeHtml(subject)}</h1>
              <p style="margin:12px 0 8px 0;font-family:${SANS};font-size:16px;line-height:1.55;color:${C.ink700};">${escapeHtml(greeting)} ${escapeHtml(intro)}</p>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${sections.map((s) => block(s.title, s.body, s.big)).join('')}
              </table>${i.step ? `
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:4px 0 22px 0;">
                <tr>
                  <td align="center" style="border-radius:14px;background:${C.electric};">
                    <a href="${escapeHtml(planUrl)}" target="_blank" style="display:block;padding:15px 24px;font-family:${SANS};font-size:16px;font-weight:700;color:#FFFFFF;text-decoration:none;border-radius:14px;">Ver mi plan</a>
                  </td>
                </tr>
              </table>` : ''}
            </td>
          </tr>
          <tr>
            <td style="padding:20px 12px 0 12px;font-family:${SANS};font-size:12.5px;line-height:1.6;color:${C.ink500};text-align:center;">
              Recibes este correo porque activaste el resumen mensual.
              <a href="${escapeHtml(prefsUrl)}" target="_blank" style="color:${C.ink500};">Cámbialo en Cuenta › Recordatorios</a>.
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`

  return { subject, text, html }
}
