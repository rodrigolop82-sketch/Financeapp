'use client'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, ResponsiveContainer } from 'recharts'
import { formatMoney } from '@/lib/format'
import type { MonthPoint } from '@/hooks/useHistoricalTrends'

interface TrendLineChartProps {
  data: MonthPoint[]
  avgMonthly: number
}

export function TrendLineChart({ data, avgMonthly }: TrendLineChartProps) {
  if (data.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '24px 0', color: '#94A3B8', fontSize: 14 }}>
        Sin datos
      </div>
    )
  }

  const chartData = data.map((mp) => ({
    month: mp.month,
    total: Math.round(mp.total),
    fixed: Math.round(mp.fixed),
    variable: Math.round(mp.variable),
  }))

  return (
    <ResponsiveContainer width="100%" height={180}>
      <LineChart data={chartData} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
        <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#94A3B8' }} axisLine={false} tickLine={false} />
        <YAxis
          tick={{ fontSize: 10, fill: '#94A3B8' }}
          axisLine={false}
          tickLine={false}
          tickFormatter={(v) => `Q${Math.round(v / 1000)}k`}
          width={36}
        />
        <Tooltip
          formatter={(value, name) => [formatMoney(Number(value)), name === 'total' ? 'Total' : name === 'fixed' ? 'Fijo' : 'Variable']}
          contentStyle={{ borderRadius: 8, border: '1px solid #E2E8F0', fontSize: 12 }}
        />
        <ReferenceLine y={avgMonthly} stroke="#94A3B8" strokeDasharray="4 2" label={{ value: 'Promedio', position: 'insideTopRight', fontSize: 10, fill: '#94A3B8' }} />
        <Line type="monotone" dataKey="total" stroke="#2563EB" strokeWidth={2.5} dot={{ fill: '#2563EB', r: 3 }} activeDot={{ r: 5 }} />
        <Line type="monotone" dataKey="fixed" stroke="#10B981" strokeWidth={1.5} dot={false} strokeDasharray="4 2" />
        <Line type="monotone" dataKey="variable" stroke="#F59E0B" strokeWidth={1.5} dot={false} strokeDasharray="4 2" />
      </LineChart>
    </ResponsiveContainer>
  )
}
