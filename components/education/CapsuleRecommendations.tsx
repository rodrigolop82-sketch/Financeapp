'use client'

import Link from 'next/link'
import { BookOpen, ArrowRight, Clock } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { CapsuleRecommendation } from '@/types'

interface CapsuleRecommendationsProps {
  recommendations: CapsuleRecommendation[]
}

export function CapsuleRecommendations({ recommendations }: CapsuleRecommendationsProps) {
  if (recommendations.length === 0) return null

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-purple-500" />
            <CardTitle className="text-lg">Aprende</CardTitle>
          </div>
          <Link
            href="/aprende"
            className="text-sm text-purple-600 hover:text-purple-700 flex items-center gap-1"
          >
            Ver todo <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
        <p className="text-sm text-muted-foreground">
          Cápsulas recomendadas para mejorar tu puntaje
        </p>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {recommendations.map((rec) => (
            <Link
              key={rec.capsule_id}
              href={`/aprende/${rec.module_slug}/${rec.slug}`}
              className="block p-3 bg-purple-50 border border-purple-100 rounded-xl
                         hover:border-purple-300 transition-colors"
            >
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-purple-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <BookOpen className="w-4 h-4 text-purple-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground">{rec.title}</p>
                  <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                    {rec.subtitle}
                  </p>
                  <div className="flex items-center gap-3 mt-1.5">
                    <span className="text-xs text-purple-600 font-medium">
                      {rec.module_title}
                    </span>
                    <span className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Clock className="w-3 h-3" />
                      {rec.read_time_minutes} min
                    </span>
                  </div>
                  <p className="text-xs text-purple-700 mt-1 italic">
                    {rec.reason}
                  </p>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
