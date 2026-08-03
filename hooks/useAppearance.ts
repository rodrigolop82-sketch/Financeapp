'use client'

import { useEffect, useRef } from 'react'
import { useTheme } from 'next-themes'
import { createClient } from '@/lib/supabase'

export type Appearance = 'light' | 'dark' | 'system'

export function useAppearance() {
  const { theme, setTheme, resolvedTheme } = useTheme()
  const synced = useRef(false)

  useEffect(() => {
    if (synced.current) return
    synced.current = true

    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return
      supabase
        .from('notification_preferences')
        .select('appearance')
        .eq('user_id', user.id)
        .single()
        .then(({ data }) => {
          if (data?.appearance) {
            setTheme(data.appearance)
          }
        })
    })
  }, [setTheme])

  function setAppearance(value: Appearance) {
    setTheme(value)

    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return
      supabase
        .from('notification_preferences')
        .upsert({ user_id: user.id, appearance: value })
        .then(() => {})
    })
  }

  return {
    appearance: (theme ?? 'dark') as Appearance,
    resolvedTheme: resolvedTheme ?? 'dark',
    setAppearance,
  }
}
