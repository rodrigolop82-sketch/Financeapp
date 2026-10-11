import { redirect } from 'next/navigation'

// Los retos viven ahora en Plan › Metas › Retos.
export default function RetosRedirect() {
  redirect('/plan?s=metas&v=retos')
}
