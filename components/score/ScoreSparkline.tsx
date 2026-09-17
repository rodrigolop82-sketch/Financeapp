'use client'

interface SparklineProps {
  data: { month: string; score: number }[]
  width?: number
  height?: number
}

const MONTH_SHORT = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']

function monthLabel(m: string) {
  const d = new Date(m + '-15')
  return MONTH_SHORT[d.getMonth()] ?? m.slice(5, 7)
}

export function ScoreSparkline({ data, width = 300, height = 120 }: SparklineProps) {
  if (data.length < 2) {
    return (
      <div className="flex items-center justify-center text-gray-400" style={{ height, fontSize: 12 }}>
        Necesitas al menos 2 meses de historial
      </div>
    )
  }

  const padX = 28
  const padTop = 12
  const padBottom = 22
  const chartW = width - padX * 2
  const chartH = height - padTop - padBottom

  const scores = data.map(d => d.score)
  const minS = Math.max(Math.min(...scores) - 10, 0)
  const maxS = Math.min(Math.max(...scores) + 10, 100)
  const range = maxS - minS || 1

  const points = data.map((d, i) => {
    const x = padX + (i / (data.length - 1)) * chartW
    const y = padTop + chartH - ((d.score - minS) / range) * chartH
    return { x, y, ...d }
  })

  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ')
  const areaPath = linePath + ` L${points[points.length - 1].x},${padTop + chartH} L${points[0].x},${padTop + chartH} Z`

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{ display: 'block', width: '100%', height: 'auto' }}>
      <defs>
        <linearGradient id="sparkGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#2563EB" stopOpacity="0.25" />
          <stop offset="100%" stopColor="#2563EB" stopOpacity="0.02" />
        </linearGradient>
      </defs>
      <path d={areaPath} fill="url(#sparkGrad)" />
      <path d={linePath} fill="none" stroke="#2563EB" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      {points.map((p, i) => (
        <g key={i}>
          <circle cx={p.x} cy={p.y} r="3.5" fill="#fff" stroke="#2563EB" strokeWidth="1.5" />
          <text x={p.x} y={padTop + chartH + 14} textAnchor="middle" fontSize="9" fill="#94A3B8" fontFamily="sans-serif">
            {monthLabel(p.month)}
          </text>
          <text x={p.x} y={p.y - 8} textAnchor="middle" fontSize="9" fontWeight="600" fill="#1E3A5F" fontFamily="sans-serif">
            {p.score}
          </text>
        </g>
      ))}
    </svg>
  )
}
