'use client'

import { useState } from 'react'
import { Check, X, Edit3, Mic } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { useFormatMoney } from '@/lib/hooks/useFormatMoney'
import type { ExtractedTransaction, VoiceExtractionResult } from '@/types'

interface TransactionPreviewProps {
  result: VoiceExtractionResult
  onConfirm: (transactions: ExtractedTransaction[]) => void
  onCancel: () => void
}

export function TransactionPreview({ result, onConfirm, onCancel }: TransactionPreviewProps) {
  const [transactions, setTransactions] = useState(result.transactions)
  const [editing, setEditing] = useState<number | null>(null)
  const fmt = useFormatMoney()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const updateTransaction = (index: number, field: keyof ExtractedTransaction, value: any) => {
    setTransactions(prev => prev.map((t, i) =>
      i === index ? { ...t, [field]: value } : t
    ))
  }

  const removeTransaction = (index: number) => {
    setTransactions(prev => prev.filter((_, i) => i !== index))
  }

  if (transactions.length === 0) {
    return (
      <Card className="border-orange-200 bg-orange-50">
        <CardContent className="p-4 text-center">
          <p className="text-sm text-orange-800">No se detectaron gastos. Intentá de nuevo.</p>
          <Button variant="outline" size="sm" onClick={onCancel} className="mt-2">
            Cerrar
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="border-purple-200">
      <CardContent className="p-4">
        {/* Raw text feedback */}
        <div className="flex items-center gap-2 mb-3 text-xs text-gray-500">
          <Mic className="w-3 h-3" />
          <span className="italic">&ldquo;{result.raw_text}&rdquo;</span>
        </div>

        {result.ambiguous && result.clarification && (
          <div className="mb-3 p-2 bg-amber-50 border border-amber-200 rounded-lg">
            <p className="text-xs text-amber-800">{result.clarification}</p>
          </div>
        )}

        {/* Transaction list */}
        <div className="space-y-2">
          {transactions.map((tx, i) => (
            <div
              key={i}
              className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
            >
              <div className="flex-1 min-w-0">
                {editing === i ? (
                  <div className="space-y-2">
                    <input
                      type="text"
                      value={tx.description}
                      onChange={e => updateTransaction(i, 'description', e.target.value)}
                      className="w-full text-sm border rounded px-2 py-1"
                    />
                    <input
                      type="number"
                      value={tx.amount}
                      onChange={e => updateTransaction(i, 'amount', parseFloat(e.target.value) || 0)}
                      className="w-24 text-sm border rounded px-2 py-1"
                    />
                    <Button size="sm" variant="ghost" onClick={() => setEditing(null)}>
                      Listo
                    </Button>
                  </div>
                ) : (
                  <>
                    <p className="text-sm font-medium truncate">{tx.description}</p>
                    <p className="text-xs text-gray-500">{tx.category}</p>
                  </>
                )}
              </div>
              <div className="flex items-center gap-2 ml-3">
                <span className="text-sm font-semibold">{fmt(tx.amount)}</span>
                {tx.confidence < 0.8 && (
                  <span className="text-xs text-amber-600">~</span>
                )}
                <button
                  onClick={() => setEditing(editing === i ? null : i)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => removeTransaction(i)}
                  className="text-gray-400 hover:text-red-500"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Actions */}
        <div className="flex gap-2 mt-4">
          <Button
            onClick={() => onConfirm(transactions)}
            className="flex-1 bg-purple-600 hover:bg-purple-700"
          >
            <Check className="w-4 h-4 mr-2" />
            Guardar {transactions.length > 1 ? `${transactions.length} gastos` : 'gasto'}
          </Button>
          <Button variant="outline" onClick={onCancel}>
            Cancelar
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
