import { describe, it, expect } from 'vitest';
import { MAILCHIMP_COLUMNS, buildMailchimpCsv, csvField, csvFileName, situationTag, type MailchimpRow } from './csv';

const row = (extra: Partial<MailchimpRow> = {}): MailchimpRow => ({
  email: 'maria.gonzalez@gmail.com',
  firstName: 'María',
  plan: 'Prueba',
  daysInactive: 9,
  txCount: 0,
  situation: 'Nunca capturó',
  marketingOptIn: true,
  ...extra,
});

describe('csvField', () => {
  it('solo entrecomilla cuando hace falta y duplica comillas', () => {
    expect(csvField('hola')).toBe('hola');
    expect(csvField(12)).toBe('12');
    expect(csvField('a,b')).toBe('"a,b"');
    expect(csvField('dice "hola"')).toBe('"dice ""hola"""');
    expect(csvField('línea\nnueva')).toBe('"línea\nnueva"');
  });
  it('neutraliza fórmulas de Excel', () => {
    expect(csvField('=HYPERLINK("x")')).toBe('"\'=HYPERLINK(""x"")"');
    expect(csvField('+502')).toBe("'+502");
    expect(csvField('@x')).toBe("'@x");
  });
});

describe('situationTag', () => {
  it('sin tildes ni espacios', () => {
    expect(situationTag('Nunca capturó')).toBe('nunca-capturo');
    expect(situationTag('Se enfrió')).toBe('se-enfrio');
    expect(situationTag('Dejó de usar')).toBe('dejo-de-usar');
  });
});

describe('buildMailchimpCsv', () => {
  it('BOM, columnas exactas, CRLF y Tags entre comillas', () => {
    const { csv, exported, skipped } = buildMailchimpCsv([
      row(),
      row({ email: 'jc@outlook.com', firstName: '', plan: 'Gratis', daysInactive: 31, txCount: 14, situation: 'Dejó de usar' }),
    ]);
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    const lines = csv.slice(1).split('\r\n');
    expect(lines[0]).toBe('Email Address,First Name,Plan,Dias sin entrar,Movimientos,Tags');
    expect(lines[0].split(',')).toEqual([...MAILCHIMP_COLUMNS]);
    expect(lines[1]).toBe('maria.gonzalez@gmail.com,María,Prueba,9,0,"reactivar,nunca-capturo"');
    expect(lines[2]).toBe('jc@outlook.com,,Gratis,31,14,"reactivar,dejo-de-usar"');
    expect(lines[3]).toBe('');
    expect(csv).not.toMatch(/[^\r]\n/);
    expect(exported).toBe(2);
    expect(skipped).toBe(0);
  });
  it('quien no aceptó correos no sale', () => {
    const { csv, exported, skipped } = buildMailchimpCsv([
      row({ email: 'si@correo.com' }),
      row({ email: 'no@correo.com', marketingOptIn: false }),
    ]);
    expect(csv).toContain('si@correo.com');
    expect(csv).not.toContain('no@correo.com');
    expect(exported).toBe(1);
    expect(skipped).toBe(1);
  });
  it('sin filas: solo encabezado', () => {
    const { csv, exported } = buildMailchimpCsv([]);
    expect(csv).toBe('﻿Email Address,First Name,Plan,Dias sin entrar,Movimientos,Tags\r\n');
    expect(exported).toBe(0);
  });
  it('nombre del archivo', () => {
    expect(csvFileName(new Date('2026-10-04T12:00:00Z'))).toBe('zafi-reactivar-2026-10-04.csv');
  });
});
