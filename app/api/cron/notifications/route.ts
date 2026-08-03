import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { sendPushToUser, wasNotifiedRecently } from '@/lib/push-send'
import { getMonthCloseChecklist, getPreviousYearMonth } from '@/lib/month-close'

const CRON_SECRET = process.env.CRON_SECRET

function getServiceSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (CRON_SECRET && authHeader !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = getServiceSupabase()
  const results = { inactivity: 0, monthClose: 0 }

  const { data: prefs } = await supabase
    .from('notification_preferences')
    .select('user_id, inactivity_enabled, inactivity_threshold_days, month_close_enabled, month_close_day')

  if (!prefs || prefs.length === 0) {
    return NextResponse.json({ message: 'No preferences found', results })
  }

  const today = new Date()
  const dayOfMonth = today.getDate()

  for (const pref of prefs) {
    // --- Inactivity check ---
    if (pref.inactivity_enabled) {
      const alreadyNotified = await wasNotifiedRecently(
        pref.user_id,
        'inactivity',
        7 * 24 * 60 * 60 * 1000,
      )

      if (!alreadyNotified) {
        const thresholdDays = pref.inactivity_threshold_days || 5
        const cutoff = new Date(Date.now() - thresholdDays * 24 * 60 * 60 * 1000)
          .toISOString()
          .split('T')[0]

        const { data: members } = await supabase
          .from('household_members')
          .select('household_id')
          .eq('user_id', pref.user_id)
          .limit(1)

        const householdId = members?.[0]?.household_id
        if (householdId) {
          const { count } = await supabase
            .from('transactions')
            .select('id', { count: 'exact', head: true })
            .eq('household_id', householdId)
            .gte('date', cutoff)

          if ((count ?? 0) === 0) {
            await sendPushToUser(
              pref.user_id,
              {
                title: '¿Todo bien? 👀',
                body: `Llevas ${thresholdDays} días sin registrar gastos. Un registro rápido mantiene tu plan al día.`,
                url: '/dashboard',
                tag: 'inactivity',
              },
              'inactivity',
            )
            results.inactivity++
          }
        }
      }
    }

    // --- Month close check ---
    if (pref.month_close_enabled && dayOfMonth === (pref.month_close_day || 2)) {
      const alreadyNotified = await wasNotifiedRecently(
        pref.user_id,
        'month_close',
        25 * 24 * 60 * 60 * 1000,
      )

      if (!alreadyNotified) {
        const { data: members } = await supabase
          .from('household_members')
          .select('household_id')
          .eq('user_id', pref.user_id)
          .limit(1)

        const householdId = members?.[0]?.household_id
        if (householdId) {
          const yearMonth = getPreviousYearMonth()
          const checklist = await getMonthCloseChecklist(pref.user_id, householdId, yearMonth)

          if (!checklist.isFullyClosed) {
            const pending = checklist.totalCount - checklist.completedCount
            const body = pending === 1
              ? `Te falta 1 elemento por cerrar del mes pasado.`
              : `Te faltan ${pending} elementos por cerrar del mes pasado.`

            await sendPushToUser(
              pref.user_id,
              {
                title: 'Cierre de mes pendiente 📋',
                body,
                url: '/cierre-mes',
                tag: 'month-close',
              },
              'month_close',
            )
            results.monthClose++
          }
        }
      }
    }
  }

  return NextResponse.json({ message: 'Notifications processed', results })
}
