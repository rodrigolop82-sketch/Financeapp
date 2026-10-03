'use client';

import { useEffect, useRef, type ReactNode } from 'react';

interface BottomSheetProps {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  /** Nombre accesible del diálogo. */
  label?: string;
  /** Fondo según el tema (oscuro en modo oscuro). Por defecto, blanco. */
  themed?: boolean;
}

export function BottomSheet({ open, onClose, children, label, themed = false }: BottomSheetProps) {
  const sheetRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  useEffect(() => {
    if (open && sheetRef.current) {
      const h = sheetRef.current.querySelector('h2');
      if (h) (h as HTMLElement).focus();
    }
  }, [open]);

  // Mientras está cerrada, la hoja no recibe foco ni la leen los lectores de pantalla.
  const closedProps = open ? {} : { inert: '' as unknown as boolean, 'aria-hidden': true };

  return (
    <>
      <div
        className={`fixed inset-0 z-[45] bg-[rgba(13,31,54,0.45)] transition-opacity duration-[250ms] ${
          open ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        ref={sheetRef}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        {...closedProps}
        className={`fixed inset-x-0 bottom-0 z-50 max-h-[91vh] flex flex-col rounded-t-[28px] shadow-xl lg:max-w-lg lg:mx-auto ${
          open ? 'translate-y-0' : 'translate-y-full'
        }`}
        style={{
          background: themed ? 'var(--zafi-card)' : '#FFFFFF',
          transition: 'transform .3s cubic-bezier(0.32,0.72,0,1)',
        }}
      >
        <div className="w-10 h-[5px] rounded-full bg-ink-200 dark:bg-white/20 mx-auto mt-2.5 mb-1 flex-none" />
        {children}
      </div>
    </>
  );
}
