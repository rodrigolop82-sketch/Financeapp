// Admin › Para reactivar y Usuarios: CSV listo para importar en Mailchimp (fase 12).
// UTF-8 con BOM (Excel lo abre con tildes), CRLF, comillas solo donde hacen
// falta. Columnas con los nombres que Mailchimp reconoce sin mapear a mano.
// Solo entran quienes aceptaron recibir correos (users.marketing_opt_in).

import type { UserRow, UserSituation } from './metrics';

export const MAILCHIMP_COLUMNS = ['Email Address', 'First Name', 'Plan', 'Dias sin entrar', 'Movimientos', 'Tags'] as const;

const BOM = '﻿';
const CRLF = '\r\n';

/** Etiqueta de la situación para Mailchimp: sin tildes ni espacios. */
export function situationTag(s: UserSituation): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, '-');
}

/**
 * Un campo CSV: entre comillas si lleva coma, comillas o salto de línea
 * (las comillas internas se duplican). Un texto que empieza con = + - @ se
 * antepone con ' para que Excel no lo tome como fórmula.
 */
export function csvField(value: string | number): string {
  let s = String(value);
  if (typeof value === 'string' && /^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export type MailchimpRow = Pick<UserRow, 'email' | 'firstName' | 'plan' | 'daysInactive' | 'txCount' | 'situation' | 'marketingOptIn'>;

export interface MailchimpCsv {
  csv: string;
  exported: number;
  /** Quedaron fuera por no haber aceptado correos. */
  skipped: number;
}

/** `listTag`: etiqueta de la lista de origen (reactivar o usuarios). */
export function buildMailchimpCsv(rows: MailchimpRow[], listTag = 'reactivar'): MailchimpCsv {
  const allowed = rows.filter((r) => r.marketingOptIn === true);
  const lines = [
    MAILCHIMP_COLUMNS.map(csvField).join(','),
    ...allowed.map((r) =>
      [r.email, r.firstName, r.plan, r.daysInactive, r.txCount, `${listTag},${situationTag(r.situation)}`].map(csvField).join(','),
    ),
  ];
  return { csv: BOM + lines.join(CRLF) + CRLF, exported: allowed.length, skipped: rows.length - allowed.length };
}

export function csvFileName(now: Date, listTag = 'reactivar'): string {
  return `zafi-${listTag}-${now.toISOString().slice(0, 10)}.csv`;
}
