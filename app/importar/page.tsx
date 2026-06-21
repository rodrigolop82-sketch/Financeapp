'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { getUserHousehold } from '@/lib/household'
import { localToday } from '@/lib/dates'
import { useFormatMoney } from '@/lib/hooks/useFormatMoney'
import { AppShell } from '@/components/layout/AppShell'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Upload, FileText, Loader2, Check, AlertCircle, Trash2 } from 'lucide-react'
import type { BudgetCategory } from '@/types'

interface ParsedRow {
  date: string
  description: string
  amount: number
  category_id: string
  selected: boolean
}

export default function ImportarPage() {
  const [loading, setLoading] = useState(true)
  const [householdId, setHouseholdId] = useState('')
  const [userId, setUserId] = useState('')
  const [categories, setCategories] = useState<BudgetCategory[]>([])
  const [step, setStep] = useState<'upload' | 'preview' | 'done'>('upload')
  const [rows, setRows] = useState<ParsedRow[]>([])
  const [saving, setSaving] = useState(false)
  const [savedCount, setSavedCount] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [fileName, setFileName] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)
  const router = useRouter()
  const fmt = useFormatMoney()

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      const hh = await getUserHousehold(supabase, user.id)
      if (!hh) { router.push('/onboarding'); return }

      setHouseholdId(hh.id)
      setUserId(user.id)

      const { data: cats } = await supabase
        .from('budget_categories').select('*')
        .eq('household_id', hh.id).order('bucket')
      setCategories((cats || []) as BudgetCategory[])

      setLoading(false)
    }
    load()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  function parseCSV(text: string): ParsedRow[] {
    const lines = text.split('\n').map(l => l.trim()).filter(Boolean)
    if (lines.length < 2) return []

    const header = lines[0].toLowerCase()
    const sep = header.includes('\t') ? '\t' : ','

    const headers = lines[0].split(sep).map(h => h.trim().replace(/^"|"$/g, '').toLowerCase())

    const dateIdx = headers.findIndex(h => /fecha|date/.test(h))
    const descIdx = headers.findIndex(h => /descripci|concepto|detail|description|referencia|merchant/.test(h))
    const amountIdx = headers.findIndex(h => /monto|amount|valor|debito|debit|cargo|total/.test(h))
    const creditIdx = headers.findIndex(h => /credito|credit|abono|deposit/.test(h))

    if (amountIdx === -1 && creditIdx === -1) return []

    const parsed: ParsedRow[] = []

    for (let i = 1; i < lines.length; i++) {
      const cols = splitCSVLine(lines[i], sep)
      if (cols.length < 2) continue

      const rawDate = dateIdx >= 0 ? cols[dateIdx]?.trim() : ''
      const desc = descIdx >= 0 ? cols[descIdx]?.trim().replace(/^"|"$/g, '') : ''

      let amount = 0
      if (amountIdx >= 0 && cols[amountIdx]) {
        amount = parseAmount(cols[amountIdx])
      }
      if (amount === 0 && creditIdx >= 0 && cols[creditIdx]) {
        amount = parseAmount(cols[creditIdx])
      }

      if (amount <= 0 || !desc) continue

      const date = parseDate(rawDate)

      parsed.push({
        date: date || localToday(),
        description: desc,
        amount,
        category_id: autoMatchCategory(desc),
        selected: true,
      })
    }

    return parsed
  }

  function splitCSVLine(line: string, sep: string): string[] {
    if (sep === '\t') return line.split('\t')

    const result: string[] = []
    let current = ''
    let inQuotes = false

    for (const char of line) {
      if (char === '"') {
        inQuotes = !inQuotes
      } else if (char === sep && !inQuotes) {
        result.push(current)
        current = ''
      } else {
        current += char
      }
    }
    result.push(current)
    return result
  }

  function parseAmount(raw: string): number {
    const cleaned = raw.replace(/[^0-9.,\-]/g, '').replace(/,/g, '.')
    const num = parseFloat(cleaned)
    return isNaN(num) ? 0 : Math.abs(num)
  }

  function parseDate(raw: string): string {
    if (!raw) return ''
    const cleaned = raw.replace(/^"|"$/g, '').trim()

    // YYYY-MM-DD
    if (/^\d{4}-\d{2}-\d{2}$/.test(cleaned)) return cleaned

    // DD/MM/YYYY or DD-MM-YYYY
    const dmy = cleaned.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})$/)
    if (dmy) {
      return `${dmy[3]}-${dmy[2].padStart(2, '0')}-${dmy[1].padStart(2, '0')}`
    }

    // MM/DD/YYYY
    const mdy = cleaned.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})$/)
    if (mdy) {
      const m = parseInt(mdy[1]), d = parseInt(mdy[2])
      if (m > 12 && d <= 12) {
        return `${mdy[3]}-${mdy[2].padStart(2, '0')}-${mdy[1].padStart(2, '0')}`
      }
    }

    return ''
  }

  function autoMatchCategory(desc: string): string {
    const lower = desc.toLowerCase()
    const keywords: Record<string, string[]> = {
      'alimentacion': ['super', 'supermercado', 'mercado', 'comida', 'despensa', 'walmart', 'paiz'],
      'restaurantes': ['almuerzo', 'cena', 'restaurante', 'pizza', 'starbucks', 'mcdonald', 'burger', 'cafe'],
      'transporte': ['uber', 'taxi', 'gasolina', 'gas', 'shell', 'puma', 'didi', 'bus'],
      'salud': ['farmacia', 'medicina', 'doctor', 'hospital', 'clinica'],
      'entretenimiento': ['cine', 'netflix', 'spotify', 'disney'],
      'servicios': ['luz', 'agua', 'internet', 'telefono', 'claro', 'tigo'],
    }

    for (const [catKey, words] of Object.entries(keywords)) {
      if (words.some(w => lower.includes(w))) {
        const match = categories.find(c => c.name.toLowerCase().includes(catKey))
        if (match) return match.id
      }
    }

    return categories.length > 0 ? categories[0].id : ''
  }

  function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    setError(null)
    setFileName(file.name)

    const reader = new FileReader()
    reader.onload = (ev) => {
      const text = ev.target?.result as string
      const parsed = parseCSV(text)
      if (parsed.length === 0) {
        setError('No se encontraron transacciones en el archivo. Verificá que el CSV tenga columnas de fecha, descripción y monto.')
        return
      }
      setRows(parsed)
      setStep('preview')
    }
    reader.readAsText(file)
  }

  async function importSelected() {
    const selected = rows.filter(r => r.selected)
    if (selected.length === 0) return

    setSaving(true)
    setError(null)

    const supabase = createClient()
    const insertRows = selected.map(r => ({
      household_id: householdId,
      category_id: r.category_id || null,
      amount: r.amount,
      description: r.description,
      date: r.date,
      source: 'csv' as const,
      payment_method: 'tarjeta' as const,
      created_by: userId,
    }))

    const { error: insertError } = await supabase.from('transactions').insert(insertRows)

    if (insertError) {
      setError(`Error al importar: ${insertError.message}`)
      setSaving(false)
      return
    }

    setSavedCount(selected.length)
    setSaving(false)
    setStep('done')
  }

  function toggleRow(idx: number) {
    setRows(rows.map((r, i) => i === idx ? { ...r, selected: !r.selected } : r))
  }

  function updateRowCategory(idx: number, catId: string) {
    setRows(rows.map((r, i) => i === idx ? { ...r, category_id: catId } : r))
  }

  function removeRow(idx: number) {
    setRows(rows.filter((_, i) => i !== idx))
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-surface-bg flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-electric-light animate-spin" />
      </div>
    )
  }

  return (
    <AppShell title="Importar estado de cuenta" currentPath="/importar">
      <div className="max-w-3xl mx-auto">

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl flex gap-2">
            <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        {/* Upload step */}
        {step === 'upload' && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Upload className="w-5 h-5" />
                Importar desde archivo CSV
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-gray-500">
                Subí el estado de cuenta de tu banco en formato CSV. La mayoría de bancos
                (BAC, Industrial, G&T, Banrural) permiten exportar tus movimientos como CSV
                desde su banca en línea.
              </p>

              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-800">
                <p className="font-medium mb-1">Formato esperado</p>
                <p>El archivo debe tener columnas para: <strong>Fecha</strong>, <strong>Descripción/Concepto</strong> y <strong>Monto/Débito</strong>.</p>
                <p className="mt-1 text-xs text-blue-600">Se aceptan formatos separados por comas (,) o tabulaciones (TSV).</p>
              </div>

              <button
                onClick={() => fileRef.current?.click()}
                className="w-full border-2 border-dashed border-gray-300 rounded-xl p-8 hover:border-electric hover:bg-blue-50/50 transition-colors cursor-pointer flex flex-col items-center gap-3"
              >
                <div className="w-14 h-14 bg-gray-100 rounded-full flex items-center justify-center">
                  <FileText className="w-7 h-7 text-gray-400" />
                </div>
                <div className="text-center">
                  <p className="font-medium text-gray-700">Seleccionar archivo CSV</p>
                  <p className="text-xs text-gray-400 mt-1">o arrastrá el archivo aquí</p>
                </div>
              </button>

              <input
                ref={fileRef}
                type="file"
                accept=".csv,.tsv,.txt"
                style={{ display: 'none' }}
                onChange={handleFileUpload}
              />
            </CardContent>
          </Card>
        )}

        {/* Preview step */}
        {step === 'preview' && (
          <>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="font-medium text-gray-900">{fileName}</h2>
                <p className="text-sm text-gray-500">
                  {rows.length} transacciones encontradas,{' '}
                  {rows.filter(r => r.selected).length} seleccionadas
                </p>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => { setStep('upload'); setRows([]); setError(null) }}>
                  Cambiar archivo
                </Button>
                <Button
                  onClick={importSelected}
                  disabled={saving || rows.filter(r => r.selected).length === 0}
                >
                  {saving ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Upload className="w-4 h-4 mr-2" />
                  )}
                  Importar ({rows.filter(r => r.selected).length})
                </Button>
              </div>
            </div>

            <Card>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-gray-50">
                        <th className="p-3 text-left w-8"></th>
                        <th className="p-3 text-left">Fecha</th>
                        <th className="p-3 text-left">Descripcion</th>
                        <th className="p-3 text-right">Monto</th>
                        <th className="p-3 text-left">Categoria</th>
                        <th className="p-3 w-8"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((row, i) => (
                        <tr key={i} className={`border-b ${row.selected ? '' : 'opacity-40'}`}>
                          <td className="p-3">
                            <input
                              type="checkbox"
                              checked={row.selected}
                              onChange={() => toggleRow(i)}
                              className="rounded"
                            />
                          </td>
                          <td className="p-3 whitespace-nowrap text-gray-600">{row.date}</td>
                          <td className="p-3 max-w-[200px] truncate" title={row.description}>
                            {row.description}
                          </td>
                          <td className="p-3 text-right font-medium whitespace-nowrap">
                            {fmt(row.amount)}
                          </td>
                          <td className="p-3">
                            <select
                              value={row.category_id}
                              onChange={(e) => updateRowCategory(i, e.target.value)}
                              className="text-xs border rounded px-2 py-1 max-w-[150px] bg-white"
                            >
                              <option value="">Sin categoria</option>
                              {['needs', 'wants', 'savings'].map(bucket => {
                                const bucketCats = categories.filter(c => c.bucket === bucket)
                                if (bucketCats.length === 0) return null
                                const label = bucket === 'needs' ? 'Necesidades' : bucket === 'wants' ? 'Gustos' : 'Ahorro'
                                return (
                                  <optgroup key={bucket} label={label}>
                                    {bucketCats.map(c => (
                                      <option key={c.id} value={c.id}>{c.name}</option>
                                    ))}
                                  </optgroup>
                                )
                              })}
                            </select>
                          </td>
                          <td className="p-3">
                            <button
                              onClick={() => removeRow(i)}
                              className="text-gray-300 hover:text-red-500"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Total */}
                <div className="p-4 border-t bg-gray-50 flex justify-between">
                  <span className="font-medium text-gray-600">Total seleccionado</span>
                  <span className="font-bold text-gray-900">
                    {fmt(rows.filter(r => r.selected).reduce((s, r) => s + r.amount, 0))}
                  </span>
                </div>
              </CardContent>
            </Card>
          </>
        )}

        {/* Done step */}
        {step === 'done' && (
          <Card>
            <CardContent className="p-8 text-center">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Check className="w-8 h-8 text-green-600" />
              </div>
              <h2 className="text-xl font-bold text-gray-900 mb-2">
                {savedCount} transacciones importadas
              </h2>
              <p className="text-sm text-gray-500 mb-6">
                Tus gastos fueron registrados correctamente desde el estado de cuenta.
              </p>
              <div className="flex gap-3 justify-center">
                <Button variant="outline" onClick={() => { setStep('upload'); setRows([]); setError(null) }}>
                  Importar otro archivo
                </Button>
                <Button onClick={() => router.push('/transacciones')}>
                  Ver transacciones
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </AppShell>
  )
}
