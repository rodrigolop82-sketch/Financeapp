/**
 * `transactions.transaction_type` (gasto/ingreso/ahorro) is a legacy column
 * used by search and the merchant-learning RPCs, kept separate from
 * `transactions.type` (expense/income) which drives budget/Resumen/Insights.
 * It's never kept in sync automatically on insert or update — every write
 * path must derive it explicitly from `type` + the category's bucket.
 * Centralized here so new capture flows (manual, voice, SMS, notification)
 * don't re-introduce the bug.
 */
export function deriveTransactionType(
  type: 'expense' | 'income',
  categoryBucket?: string | null,
): 'gasto' | 'ingreso' | 'ahorro' {
  if (type === 'income') return 'ingreso';
  return categoryBucket === 'savings' ? 'ahorro' : 'gasto';
}
