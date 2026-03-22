'use client';

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';

interface BudgetChartProps {
  needs: number;
  wants: number;
  savings: number;
}

const COLORS = ['#059669', '#10b981', '#6ee7b7'];
const LABELS = ['Necesidades', 'Gustos', 'Ahorro'];

export function BudgetChart({ needs, wants, savings }: BudgetChartProps) {
  const data = [
    { name: 'Necesidades (50%)', value: needs },
    { name: 'Gustos (30%)', value: wants },
    { name: 'Ahorro/Deudas (20%)', value: savings },
  ].filter((d) => d.value > 0);

  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-gray-400 text-sm">
        Sin datos de presupuesto
      </div>
    );
  }

  return (
    <div className="h-48">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={50}
            outerRadius={80}
            paddingAngle={3}
            dataKey="value"
          >
            {data.map((_, index) => (
              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip
            formatter={(value) =>
              `Q ${Number(value).toLocaleString('es-GT', { minimumFractionDigits: 2 })}`
            }
          />
        </PieChart>
      </ResponsiveContainer>
      <div className="flex justify-center gap-4 -mt-2">
        {data.map((d, i) => (
          <div key={d.name} className="flex items-center gap-1.5 text-xs">
            <div
              className="w-2.5 h-2.5 rounded-full"
              style={{ backgroundColor: COLORS[i] }}
            />
            <span className="text-gray-600">{LABELS[i]}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
