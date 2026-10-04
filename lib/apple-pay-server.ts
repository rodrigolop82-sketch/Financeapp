// Apple Pay vía Atajos, lado servidor (service role). Lo usa
// POST /api/parse-notification cuando llega `Authorization: Bearer zafi_…`.
import type { SupabaseClient } from '@supabase/supabase-js';
import { getUserHousehold } from '@/lib/household';
import { toGTQ } from '@/lib/currency';
import { cleanTransactionName, formatMoney } from '@/lib/format';
import { getEmoji } from '@/lib/categories-ui';
import { suggestCategory } from '@/lib/import/classify';
import { getMerchantKey } from '@/lib/transactions/merchant-key';
import { deriveTransactionType } from '@/lib/transactions/transaction-type';
import { applePayCopy } from '@/lib/avisos';
import { sendPushToUser } from '@/lib/push-send';
import { looksLikeShortcutToken, rateLimitStep, type ApplePayCharge } from '@/lib/apple-pay';
import { hashShortcutToken } from '@/lib/apple-pay-token';

export interface ShortcutTokenRow {
  id: string;
  user_id: string;
  revoked_at: string | null;
  rate_window_start: string | null;
  rate_window_count: number | null;
}

/** La clave activa que corresponde al token, o null (formato raro, no existe o revocada). */
export async function findShortcutToken(admin: SupabaseClient, token: string): Promise<ShortcutTokenRow | null> {
  if (!looksLikeShortcutToken(token)) return null;
  const { data, error } = await admin
    .from('shortcut_tokens')
    .select('id, user_id, revoked_at, rate_window_start, rate_window_count')
    .eq('token_hash', hashShortcutToken(token))
    .maybeSingle();
  if (error) {
    console.warn('[apple-pay] No se pudo leer shortcut_tokens', error.message);
    return null;
  }
  const row = data as ShortcutTokenRow | null;
  return row && !row.revoked_at ? row : null;
}

/** Aplica el límite por clave y marca last_used_at. false si se pasó del límite. */
export async function touchShortcutToken(admin: SupabaseClient, row: ShortcutTokenRow, nowMs = Date.now()): Promise<boolean> {
  const step = rateLimitStep({ start: row.rate_window_start, count: row.rate_window_count ?? 0 }, nowMs);
  if (!step.allowed) return false;
  await admin
    .from('shortcut_tokens')
    .update({
      last_used_at: new Date(nowMs).toISOString(),
      rate_window_start: step.next.start,
      rate_window_count: step.next.count,
    })
    .eq('id', row.id);
  return true;
}

export interface RegisteredCharge {
  id: string;
  amount: number;
  merchant: string;
  date: string;
  categoryId: string | null;
  categoryName: string | null;
  /** Llegó con la categoría que la persona pidió recordar para este comercio. */
  remembered: boolean;
  pushed: boolean;
}

/**
 * Crea el gasto (source 'apple_pay', categoría por la regla del comercio o
 * sugerida) y manda el push "Registramos {Q} en {comercio}…" que abre la
 * hoja de confirmación (/transacciones?applepay={id}).
 */
export async function registerApplePayCharge(
  admin: SupabaseClient,
  userId: string,
  charge: ApplePayCharge,
): Promise<{ ok: true; value: RegisteredCharge } | { ok: false; status: number; error: string }> {
  const household = await getUserHousehold(admin, userId);
  if (!household) return { ok: false, status: 409, error: 'Tu cuenta no tiene un hogar todavía. Abre Zafi para terminar de configurarla.' };
  const hh = household.id;

  const [{ data: cats }, { data: subs }, { data: overrides }] = await Promise.all([
    admin.from('budget_categories').select('*').eq('household_id', hh),
    admin.from('budget_sub_items').select('id, category_id, name').eq('household_id', hh),
    admin.from('merchant_category_overrides').select('merchant_key, category_id').eq('household_id', hh),
  ]);
  const categories = ((cats ?? []) as { id: string; name: string; bucket: string; icon?: string | null; archived_at?: string | null }[])
    .filter((c) => !c.archived_at);
  const merchant = cleanTransactionName(charge.merchant) || 'Apple Pay';
  const key = getMerchantKey(merchant);
  const rules = (overrides ?? []) as { merchant_key: string; category_id: string }[];
  const remembered = !!key && rules.some((o) => o.merchant_key === key && categories.some((c) => c.id === o.category_id));
  const { categoryId, subItemId } = suggestCategory(
    { description: merchant, category_id: null },
    { categories: categories.filter((c) => c.bucket !== 'income'), subItems: (subs ?? []) as { id: string; category_id: string; name: string }[], overrides: rules },
  );
  const cat = categories.find((c) => c.id === categoryId) ?? null;

  const isForex = charge.currency !== 'GTQ';
  const amount = isForex ? toGTQ(charge.amount, charge.currency) : charge.amount;
  const { data: inserted, error } = await admin
    .from('transactions')
    .insert({
      household_id: hh,
      category_id: cat?.id ?? null,
      amount,
      description: merchant,
      date: charge.date,
      source: 'apple_pay',
      type: 'expense',
      transaction_type: deriveTransactionType('expense', cat?.bucket),
      payment_method: 'tarjeta',
      payment_card: charge.card,
      category_source: 'auto',
      created_by: userId,
      original_amount: isForex ? charge.amount : null,
      original_currency: isForex ? charge.currency : null,
      ...(subItemId && cat ? { budget_sub_item_id: subItemId } : {}),
    })
    .select('id')
    .single();
  if (error || !inserted) {
    console.error('[apple-pay] No se pudo crear el movimiento', error?.message);
    return { ok: false, status: 500, error: 'No pudimos registrar el pago. Intenta de nuevo.' };
  }

  const id = (inserted as { id: string }).id;
  const categoryName = cat ? `${getEmoji(cat)} ${cat.name}` : null;
  const copy = applePayCopy(amount, merchant, (n) => formatMoney(n, { showDecimals: true }), remembered ? categoryName : null);
  const pushed = await sendPushToUser(
    userId,
    { ...copy, url: `/transacciones?applepay=${id}`, tag: `zafi-applepay-${id}`, key: `apple_pay:${id}` },
    'apple_pay',
  ).catch(() => 0);

  return {
    ok: true,
    value: { id, amount, merchant, date: charge.date, categoryId: cat?.id ?? null, categoryName: cat?.name ?? null, remembered, pushed: pushed > 0 },
  };
}
