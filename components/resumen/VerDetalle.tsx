'use client';

// "Ver detalle" de Cómo te fue (C9): filas que llevan a otra pantalla o se
// despliegan en el lugar.

import { useState } from 'react';
import Link from 'next/link';
import { TEXT_MUTED, TEXT_STRONG } from '@/components/movimientos/ui';
import { CARD, SECTION_TITLE } from './ctf-ui';

const ROW = `flex min-h-[56px] w-full items-center justify-between gap-3 px-4 py-3.5 text-left transition-transform duration-150 active:scale-[0.99] ${CARD}`;

function RowText({ title, value, chevron }: { title: string; value?: string | null; chevron: React.ReactNode }) {
  return (
    <>
      <span className={`text-[15px] font-semibold ${TEXT_STRONG}`}>{title}</span>
      <span className="flex min-w-0 items-center gap-2">
        {value && <span className={`truncate text-[13.5px] ${TEXT_MUTED}`}>{value}</span>}
        {chevron}
      </span>
    </>
  );
}

export function DetalleLink({ href, title, value }: { href: string; title: string; value?: string | null }) {
  return (
    <Link href={href} className={ROW}>
      <RowText title={title} value={value} chevron={<span aria-hidden className="font-bold text-electric">›</span>} />
    </Link>
  );
}

export function DetalleDesplegable({ title, value, children }: { title: string; value?: string | null; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="flex flex-col">
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className={ROW}>
        <RowText
          title={title}
          value={value}
          chevron={<span aria-hidden className={`inline-block font-bold text-electric transition-transform ${open ? 'rotate-90' : ''}`}>›</span>}
        />
      </button>
      {open && <div className="flex flex-col">{children}</div>}
    </div>
  );
}

export function VerDetalle({ children }: { children: React.ReactNode }) {
  return (
    <section aria-label="Ver detalle" className="mt-[22px] flex flex-col gap-2">
      <h2 className={`px-1 ${SECTION_TITLE}`}>Ver detalle</h2>
      {children}
    </section>
  );
}
