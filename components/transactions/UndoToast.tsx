'use client';

import { useEffect, useRef } from 'react';

interface UndoToastProps {
  visible: boolean;
  title: string;
  subtitle?: string;
  onUndo: () => void;
  onDismiss: () => void;
}

const TOAST_DURATION = 9000;

export function UndoToast({
  visible,
  title,
  subtitle,
  onUndo,
  onDismiss,
}: UndoToastProps) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!visible) return;
    timerRef.current = setTimeout(onDismiss, TOAST_DURATION);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [visible, onDismiss]);

  if (!visible) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-6 left-4 right-4 z-[60] mx-auto max-w-md animate-in slide-in-from-bottom-4 fade-in duration-300"
    >
      <div className="flex items-center justify-between gap-3 px-4 py-3 bg-navy-darker rounded-2xl shadow-lg">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-white truncate">{title}</p>
          {subtitle && (
            <p className="text-xs text-white/60 truncate mt-0.5">{subtitle}</p>
          )}
        </div>
        <button
          type="button"
          onClick={onUndo}
          className="flex-shrink-0 px-3 py-1.5 rounded-lg bg-electric-pale/20 text-electric-pale text-sm font-semibold hover:bg-electric-pale/30 transition-colors"
        >
          Deshacer
        </button>
      </div>
    </div>
  );
}
