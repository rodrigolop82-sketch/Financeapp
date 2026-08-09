'use client'

import { CheckCircle2 } from 'lucide-react'
import { formatYearMonth } from '@/lib/month-close'

interface Props {
  yearMonth: string
}

export function MonthSeal({ yearMonth }: Props) {
  const label = formatYearMonth(yearMonth)

  return (
    <div style={{
      background: 'linear-gradient(135deg, #059669 0%, #10B981 100%)',
      borderRadius: 16, padding: '24px 20px',
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      gap: 10, textAlign: 'center',
    }}>
      <div style={{
        width: 56, height: 56, borderRadius: '50%',
        background: 'rgba(255,255,255,0.2)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <CheckCircle2 size={32} color="#fff" />
      </div>
      <h3 className="font-serif" style={{
        fontSize: 20, fontWeight: 400, color: '#fff', margin: 0,
        textTransform: 'capitalize',
      }}>
        {label} cerrado
      </h3>
      <p style={{
        fontSize: 13, color: 'rgba(255,255,255,0.8)', margin: 0,
        lineHeight: 1.5, maxWidth: 260,
      }}>
        Toda tu información financiera de este mes está al día.
      </p>
    </div>
  )
}
