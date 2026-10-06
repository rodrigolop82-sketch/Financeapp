import { NextResponse } from 'next/server'
import { adminClient, sessionUser } from '@/lib/billing/server'
import { mergePreview } from '@/lib/unir-server'

// Lo que el invitado ve antes de unir: lo que trae, el plan combinado,
// repetidos, metas parecidas y si se le devuelve algo de su plan.
export async function GET(request: Request) {
  const user = await sessionUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  const code = new URL(request.url).searchParams.get('code')
  if (!code) return NextResponse.json({ error: 'Código requerido' }, { status: 400 })
  const preview = await mergePreview(adminClient(), code, user.id)
  if ('error' in preview) return NextResponse.json({ error: 'Esta invitación ya no sirve', code: preview.error }, { status: 404 })
  return NextResponse.json(preview)
}
