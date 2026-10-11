import { afterEach, describe, it, expect, vi } from 'vitest';
import { RESEND_BATCH_ENDPOINT, RESEND_ENDPOINT, sendEmail, sendEmailBatch } from './email';

const env = { ...process.env };
afterEach(() => {
  process.env = { ...env };
  vi.restoreAllMocks();
});

describe('sendEmail', () => {
  it('sin RESEND_API_KEY no envía y avisa', async () => {
    delete process.env.RESEND_API_KEY;
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const f = vi.fn();
    expect(await sendEmail({ to: 'a@b.com', subject: 's', text: 't' }, f as unknown as typeof fetch)).toEqual({ ok: false, skipped: true });
    expect(f).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalled();
  });

  it('llama a Resend con from, reply_to y la llave', async () => {
    process.env.RESEND_API_KEY = 're_test';
    process.env.FEEDBACK_FROM_EMAIL = 'Zafi <ideas@zafiapp.com>';
    const f = vi.fn().mockResolvedValue(new Response(JSON.stringify({ id: 'em_1' }), { status: 200 }));
    const r = await sendEmail({ to: 'hola@zafiapp.com', subject: 'Asunto', text: 'Cuerpo', replyTo: 'r@x.com' }, f as unknown as typeof fetch);
    expect(r).toEqual({ ok: true, id: 'em_1' });
    const [url, init] = f.mock.calls[0];
    expect(url).toBe(RESEND_ENDPOINT);
    expect(init.headers.Authorization).toBe('Bearer re_test');
    expect(JSON.parse(init.body)).toEqual({
      from: 'Zafi <ideas@zafiapp.com>', to: ['hola@zafiapp.com'], subject: 'Asunto', text: 'Cuerpo', reply_to: 'r@x.com',
    });
  });

  it('usa el remitente por defecto y no manda reply_to vacío', async () => {
    process.env.RESEND_API_KEY = 're_test';
    delete process.env.FEEDBACK_FROM_EMAIL;
    const f = vi.fn().mockResolvedValue(new Response('{}', { status: 200 }));
    await sendEmail({ to: ['a@b.com'], subject: 's', text: 't', replyTo: null }, f as unknown as typeof fetch);
    const body = JSON.parse(f.mock.calls[0][1].body);
    expect(body.from).toBe('Zafi <hola@zafiapp.com>');
    expect(body).not.toHaveProperty('reply_to');
  });

  it('devuelve el error de Resend sin lanzar', async () => {
    process.env.RESEND_API_KEY = 're_test';
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const f = vi.fn().mockResolvedValue(new Response(JSON.stringify({ message: 'Dominio sin verificar' }), { status: 403 }));
    expect(await sendEmail({ to: 'a@b.com', subject: 's', text: 't' }, f as unknown as typeof fetch)).toEqual({
      ok: false, skipped: false, error: 'Dominio sin verificar',
    });
    const g = vi.fn().mockRejectedValue(new Error('red'));
    expect(await sendEmail({ to: 'a@b.com', subject: 's', text: 't' }, g as unknown as typeof fetch)).toEqual({
      ok: false, skipped: false, error: 'red',
    });
  });
});

describe('sendEmailBatch', () => {
  it('sin RESEND_API_KEY no envía', async () => {
    delete process.env.RESEND_API_KEY;
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const f = vi.fn();
    expect(await sendEmailBatch([{ to: 'a@b.com', subject: 's', text: 't' }], f as unknown as typeof fetch)).toEqual({ ok: false, skipped: true });
    expect(f).not.toHaveBeenCalled();
  });

  it('manda todos en una sola llamada al endpoint de lotes', async () => {
    process.env.RESEND_API_KEY = 're_test';
    const f = vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: [{ id: '1' }, { id: '2' }] }), { status: 200 }));
    const r = await sendEmailBatch(
      [{ to: 'a@b.com', subject: 's', text: 't', html: '<p>t</p>' }, { to: 'c@d.com', subject: 's', text: 't' }],
      f as unknown as typeof fetch,
    );
    expect(r).toEqual({ ok: true, sent: 2 });
    expect(f).toHaveBeenCalledTimes(1);
    const [url, init] = f.mock.calls[0];
    expect(url).toBe(RESEND_BATCH_ENDPOINT);
    const body = JSON.parse(init.body);
    expect(body).toHaveLength(2);
    expect(body[0]).toMatchObject({ to: ['a@b.com'], html: '<p>t</p>' });
  });

  it('error de Resend', async () => {
    process.env.RESEND_API_KEY = 're_test';
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const f = vi.fn().mockResolvedValue(new Response(JSON.stringify({ message: 'malo' }), { status: 422 }));
    expect(await sendEmailBatch([{ to: 'a@b.com', subject: 's', text: 't' }], f as unknown as typeof fetch))
      .toEqual({ ok: false, skipped: false, error: 'malo' });
  });
});
