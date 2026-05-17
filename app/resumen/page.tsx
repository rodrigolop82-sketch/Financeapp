'use client'
import { useState } from 'react'
import { AppShell } from '@/components/layout/AppShell'
import { EjecucionTab } from '@/components/resumen/EjecucionTab'
import { TendenciasTab } from '@/components/resumen/TendenciasTab'
import { useMonthExecution } from '@/hooks/useMonthExecution'
import { useHistoricalTrends } from '@/hooks/useHistoricalTrends'
import { Loader2 } from 'lucide-react'

type Tab = 'ejecucion' | 'tendencias'

export default function ResumenPage() {
  const [tab, setTab] = useState<Tab>('ejecucion')
  const exec = useMonthExecution()
  const trends = useHistoricalTrends()

  const isLoading = (tab === 'ejecucion' && exec.loading) || (tab === 'tendencias' && trends.loading)

  return (
    <AppShell title="Resumen" currentPath="/resumen">
      {/* Tab bar */}
      <div style={{
        display: 'flex', margin: '0 16px 20px',
        background: '#F1F5F9', borderRadius: 12, padding: 4,
      }}>
        {([['ejecucion', 'Este mes'], ['tendencias', 'Tendencias']] as [Tab, string][]).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            style={{
              flex: 1, padding: '8px 0', borderRadius: 9,
              border: 'none', cursor: 'pointer', fontSize: 14, fontWeight: 600,
              background: tab === key ? '#fff' : 'transparent',
              color: tab === key ? '#1E3A5F' : '#94A3B8',
              boxShadow: tab === key ? '0 1px 4px rgba(15,23,42,0.08)' : 'none',
              transition: 'all 0.15s ease',
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {isLoading && (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '48px 0' }}>
          <Loader2 className="w-8 h-8 text-electric animate-spin" />
        </div>
      )}

      {!isLoading && tab === 'ejecucion' && exec.data && (
        <EjecucionTab data={exec.data} />
      )}

      {!isLoading && tab === 'ejecucion' && exec.error && (
        <div style={{ margin: '0 16px', padding: '16px', background: '#FFF5F5', borderRadius: 12, color: '#DC2626', fontSize: 14 }}>
          Error cargando datos: {exec.error}
        </div>
      )}

      {!isLoading && tab === 'tendencias' && trends.data && (
        <TendenciasTab data={trends.data} />
      )}

      {!isLoading && tab === 'tendencias' && trends.error && (
        <div style={{ margin: '0 16px', padding: '16px', background: '#FFF5F5', borderRadius: 12, color: '#DC2626', fontSize: 14 }}>
          Error cargando datos: {trends.error}
        </div>
      )}

      <div className="h-6" />
    </AppShell>
  )
}
