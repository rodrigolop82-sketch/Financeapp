'use client';

import { useRef, useEffect, useState, useCallback } from 'react';
import { Search, X } from 'lucide-react';

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  debounceMs?: number;
}

export function SearchBar({ value, onChange, debounceMs = 250 }: SearchBarProps) {
  const [local, setLocal] = useState(value);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setLocal(value);
  }, [value]);

  const debouncedChange = useCallback(
    (v: string) => {
      clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => onChange(v), debounceMs);
    },
    [onChange, debounceMs],
  );

  useEffect(() => () => clearTimeout(timerRef.current), []);

  function handleInput(v: string) {
    setLocal(v);
    debouncedChange(v);
  }

  function handleClear() {
    setLocal('');
    onChange('');
    inputRef.current?.focus();
  }

  return (
    <div className="relative">
      <label className="sr-only" htmlFor="search-tx">Buscar transacciones</label>
      <Search
        className="absolute left-3.5 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-ink-400 pointer-events-none"
        aria-hidden="true"
      />
      <input
        ref={inputRef}
        id="search-tx"
        type="search"
        placeholder="Buscar comercio o nota"
        autoComplete="off"
        value={local}
        onChange={(e) => handleInput(e.target.value)}
        className="w-full h-12 rounded-[14px] border border-ink-200 bg-white pl-11 pr-11 text-body font-medium text-ink-900 placeholder:text-ink-400 focus:outline-none focus:ring-2 focus:ring-electric-pale focus:border-electric-pale"
      />
      {local && (
        <button
          type="button"
          onClick={handleClear}
          aria-label="Borrar búsqueda"
          className="absolute right-0.5 top-0.5 w-11 h-11 flex items-center justify-center text-ink-400 hover:text-ink-700 rounded-xl"
        >
          <X className="w-[18px] h-[18px]" aria-hidden="true" />
        </button>
      )}
    </div>
  );
}
