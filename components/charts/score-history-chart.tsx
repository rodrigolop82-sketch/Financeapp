'use client';

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

interface ScoreHistoryProps {
  data: { month: string; score: number }[];
}

export function ScoreHistoryChart({ data }: ScoreHistoryProps) {
  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-gray-400 text-sm">
        Aún no hay historial
      </div>
    );
  }

  return (
    <div className="h-48">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis dataKey="month" tick={{ fontSize: 12 }} stroke="#9ca3af" />
          <YAxis domain={[0, 100]} tick={{ fontSize: 12 }} stroke="#9ca3af" />
          <Tooltip />
          <Area
            type="monotone"
            dataKey="score"
            stroke="#7c3aed"
            fill="#ede9fe"
            strokeWidth={2}
            name="Puntaje"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
