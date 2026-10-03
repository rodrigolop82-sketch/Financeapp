'use client';

import { useEffect } from 'react';

export interface StatusMessage {
  text: string;
  tone: 'ok' | 'error';
}

interface StatusToastProps {
  message: StatusMessage | null;
  onDone: () => void;
}

/** Toast sin acciones (3 s; 5 s si es error), a la altura del UndoToast. */
export function StatusToast({ message, onDone }: StatusToastProps) {
  useEffect(() => {
    if (!message) return;
    const t = setTimeout(onDone, message.tone === 'error' ? 5000 : 3000);
    return () => clearTimeout(t);
  }, [message, onDone]);

  if (!message) return null;
  return (
    <div
      role={message.tone === 'error' ? 'alert' : 'status'}
      className="fixed bottom-[calc(80px+env(safe-area-inset-bottom))] lg:bottom-6 left-4 right-4 z-[60] mx-auto max-w-md animate-in slide-in-from-bottom-4 fade-in duration-300"
    >
      <div
        className={`px-4 py-3 rounded-2xl text-sm font-semibold ${
          message.tone === 'error' ? 'bg-danger-light text-danger-text' : 'bg-navy-darker text-white'
        }`}
        style={{ boxShadow: '0 10px 30px rgba(13,31,54,0.3)' }}
      >
        {message.text}
      </div>
    </div>
  );
}
