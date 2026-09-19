import { type ReactNode } from 'react';

function normalize(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();
}

export function highlightMatch(
  text: string | null,
  query: string,
): ReactNode {
  if (!text) return null;
  const nq = normalize(query.trim());
  if (!nq) return text;

  const nText = normalize(text);
  const idx = nText.indexOf(nq);
  if (idx < 0) return text;

  return (
    <>
      {text.slice(0, idx)}
      <mark className="bg-electric-pale/30 text-inherit rounded-sm px-px">
        {text.slice(idx, idx + nq.length)}
      </mark>
      {text.slice(idx + nq.length)}
    </>
  );
}
