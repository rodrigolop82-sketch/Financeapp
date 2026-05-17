'use client'
import { BarChart, Bar, XAxis, YAxis, Tooltip, Cell, ResponsiveContainer } from 'recharts'
import { formatMoney } from '@/lib/format'
import type { CategoryShare } from '@/hooks/useHistoricalTrends'

interface HorizontalBarChartProps {
  categories: CategoryShare[]
}

const BUCKET_COLORS: Record<string, string> = {
  needs: '#2563EB',
  wants: '#F59E0B',
  savings: '#10B981',
}

export function HorizontalBarChart({ categories }: HorizontalBarChartProps) {
  if (categories.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '24px 0', color: '#94A3B8', fontSize: 14 }}>
        Sin datos
      </div>
    )
  }

  const data = categories.map((c) => ({
    name: c.name.length > 14 ? c.name.slice(0, 13) + '…' : c.name,
    amount: Math.round(c.amount),
    bucket: c.bucket,
    pct: c.pct,
  }))

  return (
    <ResponsiveContainer width="100%" height={Math.max(160, data.length * 36)}>
      <BarChart data={data} layout="vertical" margin={{ top: 0, right: 60, bottom: 0, left: 0 }}>
        <XAxis type="number" hide />
        <YAxis
          type="category"
          dataKey="name"
          width={110}
          tick={{ fontSize: 11, fill: '#64748B' }}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip
          formatter={(value) => [formatMoney(Number(value)), 'Gasto']}
          contentStyle={{ borderRadius: 8, border: '1px solid #E2E8F0', fontSize: 12 }}
        />
        <Bar dataKey="amount" radius={[0, 4, 4, 0]} maxBarSize={16} label={{ position: 'right', fontSize: 10, fill: '#94A3B8', formatter: (v: number) => formatMoney(v) }}>
          {data.map((entry, index) => (
            <Cell key={index} fill={BUCKET_COLORS[entry.bucket] ?? '#94A3B8'} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}
