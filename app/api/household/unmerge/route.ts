import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'

// Deshace la unión (30 días) o, después, "Salir del hogar".
export async function POST(request: Request) {
  const supabase = createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  const body = await request.json().catch(() => ({})) as { mergeId?: string }
  if (!body.mergeId) return NextResponse.json({ error: 'Falta la unión' }, { status: 400 })

  const { data, error } = await supabase.rpc('unmerge_household', { p_merge_id: body.mergeId })
  if (error) {
    const code = (error.message || '').match(/[a-z_]+/)?.[0] ?? 'unknown'
    return NextResponse.json({ error: code === 'not_allowed' ? 'Solo lo puede hacer alguien del hogar.' : 'No pudimos deshacer la unión. Intenta de nuevo.', code }, { status: code === 'merge_not_found' ? 404 : 409 })
  }
  return NextResponse.json(data)
}
