'use client';

import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export default function PlanPage() {
  return (
    <div className="min-h-screen bg-gray-50 p-4 lg:p-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <Link href="/dashboard">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="w-5 h-5" />
            </Button>
          </Link>
          <h1 className="text-2xl font-bold">Plan de acción mensual</h1>
        </div>
        <Card>
          <CardContent className="p-8 text-center text-gray-500">
            <p>Próximamente: plan de acción interactivo con checklist y progreso.</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
