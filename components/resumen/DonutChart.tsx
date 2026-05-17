'use client'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts'
import { formatMoney } from '@/lib/format'

interface DonutChartProps {
  fixed: number
  variable: number
}

export function DonutChart({ fixed, variable }: DonutChartProps) {
  const total = fixed + variable
  const data = [
    { name: 'Fijo', value: fixed, color: '#2563EB' },
    { name: 'Variable', value: variable, color: '#F59E0B' },
  ]

  if (total === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '24px 0', color: '#94A3B8', fontSize: 14 }}>
        Sin datos de gastos
      </div>
    )
  }

  return (
    <div>
      <ResponsiveContainer width="100%" height={160}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={48}
            outerRadius={70}
            paddingAngle={3}
            dataKey="value"
            stroke="none"
          >
            {data.map((entry, index) => (
              <Cell key={index} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip
            formatter={(value: number) => formatMoney(value)}
            contentStyle={{ borderRadius: 8, border: '1px solid #E2E8F0', fontSize: 12 }}
          />
        </PieChart>
      </ResponsiveContainer>
      <div style={{ display: 'flex', justifyContent: 'center', gap: 20, marginTop: 4 }}>
        {data.map((d) => (
          <div key={d.name} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ width: 10, height: 10, borderRadius: '50%', background: d.color }} />
            <span style={{ fontSize: 12, color: '#64748B', fontWeight: 500 }}>
              {d.name} {total > 0 ? `${Math.round(d.value / total * 100)}%` : ''}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
