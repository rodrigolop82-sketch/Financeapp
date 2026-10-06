'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { isMasterUser } from '@/lib/master-user'
import { AppShell } from '@/components/layout/AppShell'
import { NavCard, NavRow } from '@/components/layout/NavRow'
import { MORE_GROUPS, type MoreGroup } from '@/lib/navigation'
import { FeedbackSheet } from '@/components/feedback/FeedbackSheet'
import { PlanStatusCard } from '@/components/premium/PlanStatusCard'

const ADMIN_GROUP: MoreGroup = {
  title: 'Administración',
  items: [{ emoji: '🛡️', name: 'Admin', description: 'Panel interno', href: '/admin' }],
}

export default function MasPage() {
  const [isMaster, setIsMaster] = useState(false)
  const [feedbackOpen, setFeedbackOpen] = useState(false)

  useEffect(() => {
    createClient().auth.getUser().then(({ data: { user } }) => {
      if (user?.email) setIsMaster(isMasterUser(user.email))
    })
  }, [])

  const groups = isMaster ? [...MORE_GROUPS, ADMIN_GROUP] : MORE_GROUPS

  return (
    <AppShell title="Más" currentPath="/mas">
      <div className="max-w-xl flex flex-col zafi-stagger" style={{ gap: 18 }}>
        <PlanStatusCard />
        {groups.map((group) => (
          <section key={group.title} className="flex flex-col" style={{ gap: 6 }}>
            <h2
              className="px-1 uppercase"
              style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.15em', color: 'var(--zafi-text-secondary)' }}
            >
              {group.title}
            </h2>
            <NavCard>
              {group.items.map((item, i) => (
                <NavRow
                  key={item.href ?? item.name}
                  {...item}
                  onClick={item.action === 'feedback' ? () => setFeedbackOpen(true) : undefined}
                  last={i === group.items.length - 1}
                />
              ))}
            </NavCard>
          </section>
        ))}
      </div>
      <FeedbackSheet open={feedbackOpen} onClose={() => setFeedbackOpen(false)} />
    </AppShell>
  )
}
