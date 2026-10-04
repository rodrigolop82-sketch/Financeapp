'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { BottomSheet } from '@/components/transactions/BottomSheet';
import { SuccessCheck } from '@/components/motion/SuccessCheck';
import { SUPPORT_EMAIL } from '@/lib/cuenta';
import {
  FEEDBACK_TYPES,
  SCREENSHOT_MAX_BYTES,
  canSendFeedback,
  thanksTitle,
  type FeedbackType,
} from '@/lib/feedback';

interface FeedbackSheetProps {
  open: boolean;
  onClose: () => void;
}

type Stage = 'form' | 'sending' | 'done';

const TEXT_STRONG = 'text-ink-900 dark:text-ink-100';
const TEXT_SECONDARY = 'text-[var(--zafi-text-secondary)]';

/** Las fotos grandes del teléfono se reducen antes de subirlas (sin librerías). */
const DOWNSCALE_OVER_BYTES = 1.5 * 1024 * 1024;
const MAX_SIDE = 1600;

async function shrinkImage(file: File): Promise<Blob> {
  if (file.size <= DOWNSCALE_OVER_BYTES && file.type !== 'image/heic' && file.type !== 'image/heif') return file;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext('2d')?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close?.();
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/jpeg', 0.85));
    return blob && blob.size < file.size ? blob : file;
  } catch {
    return file;
  }
}

/**
 * Hoja "Envíanos tu idea": tipo, mensaje y captura opcional. Envía a
 * POST /api/feedback con la ruta desde donde se abrió.
 */
export function FeedbackSheet({ open, onClose }: FeedbackSheetProps) {
  const pathname = usePathname();
  const [type, setType] = useState<FeedbackType>('idea');
  const [message, setMessage] = useState('');
  const [shot, setShot] = useState<File | null>(null);
  const [stage, setStage] = useState<Stage>('form');
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Cada vez que se abre empieza en limpio (el tipo elegido se recuerda).
  useEffect(() => {
    if (!open) return;
    setStage('form');
    setMessage('');
    setShot(null);
    setError(null);
  }, [open]);

  const option = FEEDBACK_TYPES.find((t) => t.value === type) ?? FEEDBACK_TYPES[0];
  const canSend = canSendFeedback(message) && stage === 'form';
  const sending = stage === 'sending';

  function toggleShot() {
    if (shot) {
      setShot(null);
      return;
    }
    fileRef.current?.click();
  }

  function onPickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] ?? null;
    e.target.value = '';
    if (!f) return;
    if (!f.type.startsWith('image/')) {
      setError('La captura tiene que ser una imagen.');
      return;
    }
    setError(null);
    setShot(f);
  }

  async function send() {
    if (!canSend) return;
    setStage('sending');
    setError(null);
    try {
      const body = new FormData();
      body.set('type', type);
      body.set('message', message);
      if (pathname) body.set('screen', pathname);
      if (shot) {
        const img = await shrinkImage(shot);
        if (img.size > SCREENSHOT_MAX_BYTES) {
          setError('La captura pesa más de 5 MB. Prueba con otra.');
          setStage('form');
          return;
        }
        const filename = img === shot ? shot.name : 'captura.jpg';
        body.set('screenshot', img, filename);
      }
      const res = await fetch('/api/feedback', { method: 'POST', body });
      const data = (await res.json().catch(() => ({}))) as { name?: string | null; error?: string };
      if (!res.ok) {
        setError(data.error || 'No pudimos enviar tu mensaje. Intenta de nuevo.');
        setStage('form');
        return;
      }
      setName(data.name ?? null);
      setStage('done');
    } catch {
      setError('Sin conexión. Revisa tu internet e intenta de nuevo.');
      setStage('form');
    }
  }

  return (
    <BottomSheet open={open} onClose={onClose} label="Envíanos tu idea" themed>
      <div className="flex min-h-[440px] flex-col overflow-y-auto px-5 pb-[calc(28px+env(safe-area-inset-bottom))] pt-1.5">
        {stage === 'done' ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-2 px-2.5 py-[30px]">
            <SuccessCheck
              size={92}
              title={thanksTitle(name)}
              titleClassName={`text-[21px] font-bold ${TEXT_STRONG}`}
              subtitle={`Recibimos tu mensaje en ${SUPPORT_EMAIL}. Si hace falta, te respondemos en 48 horas.`}
              subtitleClassName={`max-w-[280px] text-[15px] leading-[1.45] ${TEXT_SECONDARY}`}
            />
            <button
              type="button"
              onClick={onClose}
              className="mt-2 h-[46px] animate-fade-up rounded-full bg-electric px-7 text-[15px] font-bold text-white transition-transform active:scale-[0.96]"
              style={{ animationDelay: '0.5s' }}
            >
              Listo
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-3.5">
            <div className="flex flex-col gap-0.5">
              <h2 tabIndex={-1} className={`font-serif text-2xl leading-tight outline-none ${TEXT_STRONG}`}>Envíanos tu idea</h2>
              <p className={`text-sm ${TEXT_SECONDARY}`}>Lo lee el equipo de Zafi, no un robot.</p>
            </div>

            <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Tipo de mensaje">
              {FEEDBACK_TYPES.map((t) => {
                const on = t.value === type;
                return (
                  <button
                    key={t.value}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    onClick={() => setType(t.value)}
                    className={`h-9 rounded-full border-[1.5px] px-3.5 text-sm font-semibold transition-all duration-200 active:scale-[0.94] ${TEXT_STRONG} ${
                      on ? 'border-electric bg-electric-ghost dark:border-electric-light dark:bg-electric/20' : 'border-[var(--zafi-border)] bg-transparent'
                    }`}
                  >
                    {t.label}
                  </button>
                );
              })}
            </div>

            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder={option.placeholder}
              aria-label="Tu mensaje"
              maxLength={5000}
              className={`h-[130px] resize-none rounded-[14px] border border-[var(--zafi-border)] bg-[var(--zafi-input-bg)] px-3.5 py-3 text-[15px] leading-[1.45] outline-none placeholder:text-[var(--zafi-text-muted)] focus:border-electric ${TEXT_STRONG}`}
            />

            <button
              type="button"
              role="checkbox"
              aria-checked={!!shot}
              onClick={toggleShot}
              className="flex min-h-[44px] items-center gap-2.5 text-left"
            >
              <span
                aria-hidden
                className={`flex h-[22px] w-[22px] flex-none items-center justify-center rounded-[7px] border-[1.5px] text-[13px] font-extrabold text-white transition-all duration-200 ${
                  shot ? 'border-electric bg-electric' : 'border-[var(--zafi-text-muted)] bg-transparent'
                }`}
              >
                {shot ? '✓' : ''}
              </span>
              <span className="flex min-w-0 flex-col">
                <span className={`text-sm ${TEXT_STRONG}`}>Adjuntar captura de esta pantalla</span>
                {shot && <span className={`truncate text-[12.5px] ${TEXT_SECONDARY}`}>{shot.name} · toca para quitarla</span>}
              </span>
            </button>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onPickFile} tabIndex={-1} aria-hidden />

            {error && (
              <p role="alert" className="rounded-xl bg-[var(--zafi-error-bg)] px-3.5 py-2.5 text-sm text-[var(--zafi-error-text)]">
                {error}
              </p>
            )}

            <button
              type="button"
              onClick={send}
              disabled={!canSend}
              aria-busy={sending}
              className={`flex h-[50px] items-center justify-center gap-2 rounded-full text-[15.5px] font-bold text-white transition-all duration-200 active:scale-[0.97] ${
                canSend || sending ? 'bg-electric' : 'bg-ink-200 dark:bg-ink-700'
              }`}
            >
              {sending ? (
                <span className="inline-block h-5 w-5 rounded-full border-[2.5px] border-white/40 border-t-white animate-spin" role="status" aria-label="Enviando" />
              ) : (
                'Enviar'
              )}
            </button>
            <p className={`text-center text-[12.5px] ${TEXT_SECONDARY}`}>Llega a {SUPPORT_EMAIL} con tu correo para responderte.</p>
          </div>
        )}
      </div>
    </BottomSheet>
  );
}
