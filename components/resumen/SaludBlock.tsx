'use client';

// Tu salud financiera dentro de Cómo te fue (C8): puntaje del mes que se
// está viendo, lo que más te ayudó y si es provisional. "Qué lo compone",
// la historia y las lecciones quedan detrás de "Ver qué lo compone".
// /score redirige aquí (#salud).

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase';
import { useHealthScore } from '@/hooks/useHealthScore';
import { getRecommendedCapsules } from '@/lib/capsule-recommendations';
import { ProvisionalTag, PROVISIONAL_TEXT, ScoreHistoryChart, ScoreParts, changeText } from '@/components/score/ScoreUI';
import { CapsuleRecommendations } from '@/components/education/CapsuleRecommendations';
import { CARD, GROUP_LABEL } from './ctf-ui';
import { TEXT_MUTED, TEXT_STRONG } from '@/components/movimientos/ui';
import { longMonth } from '@/lib/como-te-fue';
import { mejorParte } from '@/lib/salud-resumen';
import type { CapsuleRecommendation } from '@/types';

function Ring({ value, color }: { value: number; color: string }) {
  const r = 42;
  const c = 2 * Math.PI * r;
  return (
    <svg viewBox="0 0 100 100" className="h-[92px] w-[92px] flex-none" aria-hidden>
      <circle cx="50" cy="50" r={r} fill="none" stroke="var(--zafi-border-light)" strokeWidth="9" />
      <circle
        cx="50" cy="50" r={r} fill="none" stroke={color} strokeWidth="9" strokeLinecap="round"
        strokeDasharray={c} strokeDashoffset={c * (1 - Math.max(0, Math.min(100, value)) / 100)}
        transform="rotate(-90 50 50)" style={{ transition: 'stroke-dashoffset .6s ease' }}
      />
      <text x="50" y="58" textAnchor="middle" className="fill-ink-900 font-outfit dark:fill-ink-100" style={{ fontSize: 28, fontWeight: 800 }}>
        {value}
      </text>
    </svg>
  );
}

export function SaludBlock({ householdId, month }: { householdId: string; month: string }) {
  const { score, history } = useHealthScore(householdId, { month, history: true });
  const [open, setOpen] = useState(false);
  const [recs, setRecs] = useState<CapsuleRecommendation[]>([]);

  useEffect(() => {
    if (window.location.hash === '#salud') setOpen(true);
  }, []);

  useEffect(() => {
    if (!open || !score || score.components.length === 0) return;
    createClient().auth.getUser().then(({ data: { user } }) => {
      if (user) getRecommendedCapsules(user.id, score.components).then(setRecs).catch(() => {});
    });
  }, [open, score]);

  if (!score || score.components.length === 0) return null;

  // Un mes cerrado muestra el puntaje que quedó guardado.
  const saved = history.find((h) => h.month === month);
  const total = saved ? saved.score : score.total;
  const provisional = !saved && score.provisional;
  const best = mejorParte(score.components);
  const prev = [...history].reverse().find((h) => h.month < month) ?? null;
  const points = [...history.filter((h) => h.month < month).slice(-5), { month, score: total }];

  return (
    <section id="salud" aria-label="Tu salud financiera" className={`mt-3 flex flex-col gap-3 p-5 ${CARD}`}>
      <div className="flex items-center gap-4">
        <Ring value={total} color={score.color} />
        <div className="flex min-w-0 flex-col gap-1">
          <span className={`flex flex-wrap items-center gap-2 text-[16px] font-bold ${TEXT_STRONG}`}>
            Tu salud financiera · {score.label}
            {provisional && <ProvisionalTag />}
          </span>
          <span className={`text-sm leading-[1.45] [text-wrap:pretty] ${TEXT_MUTED}`}>
            {provisional ? `${PROVISIONAL_TEXT} ` : ''}
            {best ? <>Lo que más te ayudó: <b className={TEXT_STRONG}>{best.label.toLowerCase()} ({best.score}/{best.max})</b>.</> : null}
            {prev ? ` ${changeText(total, { score: prev.score, name: longMonth(prev.month) })}` : ''}
          </span>
        </div>
      </div>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="-mb-2 flex h-11 items-center justify-between"
      >
        <span className={`${GROUP_LABEL} ${TEXT_MUTED}`}>Ver qué lo compone</span>
        <span aria-hidden className={`inline-block font-bold text-electric transition-transform ${open ? 'rotate-90' : ''}`}>›</span>
      </button>
      {open && (
        <div className="flex flex-col gap-3">
          <ScoreParts score={score} />
          {points.length > 1 && <ScoreHistoryChart points={points} color={score.color} />}
          {recs.length > 0 && (
            <>
              <span className={`${GROUP_LABEL} ${TEXT_MUTED}`}>Para mejorar tu puntaje</span>
              <CapsuleRecommendations recommendations={recs} />
            </>
          )}
        </div>
      )}
    </section>
  );
}
