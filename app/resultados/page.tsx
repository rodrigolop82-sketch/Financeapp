'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowRight, RotateCcw } from 'lucide-react';
import { Wordmark } from '@/components/brand/Wordmark';
import { sessionAnalisis, AnalisisData } from '@/lib/session-analisis';

type ScoreColor = 'red' | 'orange' | 'yellow' | 'green' | 'emerald';

interface Recomendacion {
  area: string;
  titulo: string;
  descripcion: string;
  prioridad: 'alta' | 'media' | 'baja';
}

const SCORE_COLORS: Record<ScoreColor, string> = {
  red: '#EF4444',
  orange: '#F97316',
  yellow: '#F59E0B',
  green: '#22C55E',
  emerald: '#10B981',
};

const SCORE_BG: Record<ScoreColor, string> = {
  red: 'bg-red-50',
  orange: 'bg-orange-50',
  yellow: 'bg-yellow-50',
  green: 'bg-green-50',
  emerald: 'bg-emerald-50',
};

const SCORE_TEXT: Record<ScoreColor, string> = {
  red: 'text-red-600',
  orange: 'text-orange-600',
  yellow: 'text-yellow-600',
  green: 'text-green-600',
  emerald: 'text-emerald-600',
};

const PRIORIDAD_COLORS: Record<string, string> = {
  alta: 'bg-red-100 text-red-700',
  media: 'bg-yellow-100 text-yellow-700',
  baja: 'bg-blue-100 text-blue-700',
};

function getScoreColor(score: number): ScoreColor {
  if (score >= 85) return 'emerald';
  if (score >= 65) return 'green';
  if (score >= 45) return 'yellow';
  if (score >= 25) return 'orange';
  return 'red';
}

function getScoreLabel(score: number): string {
  if (score >= 85) return 'Excelente';
  if (score >= 65) return 'Saludable';
  if (score >= 45) return 'Estable';
  if (score >= 25) return 'En riesgo';
  return 'Crítico';
}

function getScoreInterpretacion(score: number): string {
  if (score >= 85) return 'Tus finanzas están en muy buen estado. Seguí así y enfocate en hacer crecer tu patrimonio.';
  if (score >= 65) return 'Tenés una base sólida. Hay oportunidades para optimizar y alcanzar tus metas más rápido.';
  if (score >= 45) return 'Estás en camino correcto pero hay áreas importantes que mejorar para mayor estabilidad.';
  if (score >= 25) return 'Tu situación requiere atención. Con los pasos correctos podés mejorar significativamente.';
  return 'Tu situación financiera necesita acción urgente. Empezá con el primer paso de abajo.';
}

function generarRecomendaciones(data: AnalisisData): Recomendacion[] {
  const recs: Recomendacion[] = [];

  const gastos = Math.max(data.gastos, 1);
  const ingresos = Math.max(data.ingresos, 1);
  const mesesEmergencia = data.ahorros / gastos;
  const tasaAhorro = (data.ingresos - data.gastos) / ingresos;
  const ratioGastos = data.gastos / ingresos;

  if (mesesEmergencia < 3) {
    recs.push({
      area: 'emergencia',
      titulo: 'Construí tu fondo de emergencia',
      descripcion: `Con Q${Math.round(gastos * 3).toLocaleString()} cubrís 3 meses de gastos. Meta: ahorrar Q${Math.round(gastos * 0.1).toLocaleString()} extra al mes.`,
      prioridad: 'alta',
    });
  }

  if (data.deudas > ingresos * 6) {
    recs.push({
      area: 'deuda',
      titulo: 'Reducí tu carga de deuda',
      descripcion: `Tu deuda representa ${Math.round(data.deudas / ingresos)} meses de ingresos. Priorizá pagar la deuda con mayor interés primero.`,
      prioridad: 'alta',
    });
  }

  if (ratioGastos > 0.8) {
    recs.push({
      area: 'gastos',
      titulo: 'Revisá tus gastos variables',
      descripcion: `Estás gastando el ${Math.round(ratioGastos * 100)}% de tus ingresos. Identificá 3 gastos prescindibles para liberar margen.`,
      prioridad: ratioGastos > 1 ? 'alta' : 'media',
    });
  }

  if (tasaAhorro < 0.1 && data.gastos <= data.ingresos) {
    recs.push({
      area: 'ahorro',
      titulo: 'Aumentá tu tasa de ahorro',
      descripcion: `Estás ahorrando menos del 10% de tus ingresos. Empezá con Q${Math.round(ingresos * 0.05).toLocaleString()} extra al mes como meta inicial.`,
      prioridad: 'media',
    });
  }

  // Always have at least one recommendation
  if (recs.length === 0) {
    recs.push({
      area: 'inversion',
      titulo: '¡Bien! Pensá en invertir tus ahorros',
      descripcion: 'Tus finanzas están en buena forma. Considerá poner tus ahorros excedentes a trabajar: fondos de inversión, acciones o bienes raíces.',
      prioridad: 'baja',
    });
  }

  return recs.slice(0, 3);
}

function ScoreCircle({ score, color }: { score: number; color: ScoreColor }) {
  const [animated, setAnimated] = useState(0);
  const radius = 54;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (animated / 100) * circumference;
  const hex = SCORE_COLORS[color];

  useEffect(() => {
    let current = 0;
    const target = score;
    const duration = 900;
    const increment = target / (duration / 16);
    const timer = setInterval(() => {
      current += increment;
      if (current >= target) {
        setAnimated(target);
        clearInterval(timer);
      } else {
        setAnimated(Math.round(current));
      }
    }, 16);
    return () => clearInterval(timer);
  }, [score]);

  return (
    <div className="relative w-36 h-36 mx-auto">
      <svg className="w-full h-full -rotate-90" viewBox="0 0 120 120">
        <circle
          cx="60" cy="60" r={radius}
          fill="none"
          stroke="#E2E8F0"
          strokeWidth="10"
        />
        <circle
          cx="60" cy="60" r={radius}
          fill="none"
          stroke={hex}
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          style={{ transition: 'stroke-dashoffset 0.05s linear' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-4xl font-bold text-navy leading-none">{animated}</span>
        <span className={`text-xs font-semibold mt-1 ${SCORE_TEXT[color]}`}>
          {getScoreLabel(score)}
        </span>
      </div>
    </div>
  );
}

export default function ResultadosPage() {
  const router = useRouter();
  const [data, setData] = useState<AnalisisData | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const d = sessionAnalisis.leer();
    if (!d || !d.score) {
      router.replace('/analisis');
      return;
    }
    setData(d);
    setLoaded(true);
  }, [router]);

  if (!loaded || !data) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-electric border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const score = data.score!;
  const color = getScoreColor(score);
  const recs = generarRecomendaciones(data);

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 bg-white border-b border-gray-100">
        <Wordmark size="sm" variant="light" />
        <Link href="/login" className="text-sm text-gray-500 hover:text-navy transition-colors">
          Ya tengo cuenta
        </Link>
      </header>

      <div className="flex-1 max-w-md mx-auto w-full px-6 py-8 animate-[fade-in_0.4s_ease-out]">
        {/* Score section */}
        <div className={`rounded-2xl p-6 mb-6 ${SCORE_BG[color]}`}>
          <p className="text-sm font-medium text-gray-500 text-center mb-4">Tu salud financiera</p>
          <ScoreCircle score={score} color={color} />
          <p className="text-center text-sm text-gray-600 mt-4 leading-relaxed">
            {getScoreInterpretacion(score)}
          </p>
        </div>

        {/* Recommendations */}
        <div className="mb-6">
          <h2 className="font-serif text-xl text-navy mb-3">Tus próximos pasos</h2>
          <div className="space-y-3">
            {recs.map((rec, i) => (
              <div key={i} className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
                <div className="flex items-start justify-between gap-2 mb-1.5">
                  <h3 className="font-semibold text-navy text-sm leading-snug">{rec.titulo}</h3>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${PRIORIDAD_COLORS[rec.prioridad]}`}>
                    {rec.prioridad === 'alta' ? 'Urgente' : rec.prioridad === 'media' ? 'Importante' : 'Sugerido'}
                  </span>
                </div>
                <p className="text-xs text-gray-500 leading-relaxed">{rec.descripcion}</p>
              </div>
            ))}
          </div>
        </div>

        {/* CTA */}
        <div className="text-center">
          <Link href="/guardar" className="btn-primary w-full flex items-center justify-center gap-2 py-3.5">
            Guardar mi plan gratis
            <ArrowRight className="w-4 h-4" />
          </Link>
          <p className="text-xs text-gray-400 mt-2">
            También te lo enviamos por correo. Sin spam.
          </p>
          <button
            onClick={() => { sessionAnalisis.limpiar(); router.push('/analisis'); }}
            className="mt-4 flex items-center gap-1.5 text-sm text-gray-400 hover:text-navy transition-colors mx-auto"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Volver a hacer el análisis
          </button>
        </div>
      </div>
    </div>
  );
}
