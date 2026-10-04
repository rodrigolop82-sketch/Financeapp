// Presentación de categorías y formas de pago: emoji, grupos y etiquetas.

const CATEGORY_EMOJI: Record<string, string> = {
  'Vivienda/alquiler': '🏠',
  'Alimentación': '🛒',
  'Transporte': '🚗',
  'Salud/medicinas': '💊',
  'Servicios': '💡',
  'Educación': '📚',
  'Restaurantes y salidas': '🍽️',
  'Ropa': '👕',
  'Entretenimiento': '🎬',
  'Suscripciones': '📱',
  'Varios personales': '🛍️',
  'Fondo de emergencia': '🛡️',
  'Ahorro para metas': '🎯',
  'Pago extra de deudas': '💳',
};

type CategoryLike = { name: string; bucket: string; icon?: string | null };

export function getEmoji(cat: CategoryLike | null | undefined): string {
  if (!cat) return '❔';
  if (cat.icon) return cat.icon;
  if (CATEGORY_EMOJI[cat.name]) return CATEGORY_EMOJI[cat.name];
  if (cat.bucket === 'needs') return '📦';
  if (cat.bucket === 'wants') return '✨';
  if (cat.bucket === 'income') return '💵';
  return '💰';
}

export type Bucket = 'needs' | 'wants' | 'savings' | 'income';

export const BUCKET_GROUPS: { bucket: Bucket; title: string; hint: string }[] = [
  { bucket: 'needs', title: 'Lo básico', hint: 'lo que no puedes dejar de pagar' },
  { bucket: 'wants', title: 'Gustos', hint: 'lo que podrías recortar' },
  { bucket: 'savings', title: 'Ahorro y deudas', hint: 'lo que guardas o adelantas' },
  { bucket: 'income', title: 'Ingresos', hint: 'dinero que recibiste' },
];

export type PaymentMethod = 'efectivo' | 'tarjeta' | 'transferencia' | 'cheque';

export const PAYMENT_OPTIONS: { value: PaymentMethod; label: string }[] = [
  { value: 'efectivo', label: 'Efectivo' },
  { value: 'tarjeta', label: 'Tarjeta' },
  { value: 'transferencia', label: 'Transferencia' },
  { value: 'cheque', label: 'Cheque' },
];

export function paymentLabel(value: string | null | undefined): string {
  return PAYMENT_OPTIONS.find((o) => o.value === value)?.label ?? 'Efectivo';
}

/** "¿En qué fue?" para gastos, "¿De dónde vino?" para ingresos. */
export function categoryQuestion(type: 'expense' | 'income'): string {
  return type === 'income' ? '¿De dónde vino?' : '¿En qué fue?';
}
