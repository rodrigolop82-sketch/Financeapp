'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase'
import { formatMoney, formatPercent, formatScore, Currency, FormatOptions } from '@/lib/format'

export function useFormatMoney() {
  const [prefs, setPrefs] = useState<{ currency: Currency; showDecimals: boolean }>({
    currency: 'GTQ',
    showDecimals: false,
  })

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        supabase
          .from('users')
          .select('currency, show_decimals')
          .eq('id', user.id)
          .single()
          .then(({ data }) => {
            if (data) {
              setPrefs({
                currency: (data.currency || 'GTQ') as Currency,
                showDecimals: data.show_decimals ?? false,
              })
            }
          })
      }
    })
  }, [])

  const fmt = useCallback(
    (amount: number, options?: Partial<FormatOptions>) =>
      formatMoney(amount, {
        currency: prefs.currency,
        showDecimals: prefs.showDecimals,
        ...options,
      }),
    [prefs.currency, prefs.showDecimals]
  )

  return fmt
}

/**
 * Extended hook returning money/percent/score formatters.
 * Use this when you need all three formatters.
 */
export function useMoneyFormat() {
  const money = useFormatMoney()
  return {
    money,
    percent: formatPercent,
    score: formatScore,
  }
}
