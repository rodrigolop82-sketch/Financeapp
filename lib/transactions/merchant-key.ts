const LEADING_PREPOSITIONS = /^(en el |en la |a la |del |al |en |de |para )/;

export function getMerchantKey(description: string | null): string | null {
  if (!description || !description.trim()) return null;

  return description
    .trim()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[''´`]/g, '')
    .replace(LEADING_PREPOSITIONS, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 60) || null;
}
