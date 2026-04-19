import { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Zafi — Finanzas personales',
    short_name: 'Zafi',
    description: 'Tu planner financiero para Guatemala y Latinoamérica',
    start_url: '/dashboard',
    display: 'standalone',
    background_color: '#F0F4FA',
    theme_color: '#1E3A5F',
    icons: [
      {
        src: '/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
      },
      {
        src: '/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
      },
    ],
    share_target: {
      action: '/transacciones',
      method: 'get',
      params: {
        text: 'shared_text',
      },
    },
  }
}
