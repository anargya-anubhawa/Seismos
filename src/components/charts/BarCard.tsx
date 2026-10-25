'use client';

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Panel } from '@/components/ui/common';

interface Props {
  title: string;
  subtitle: string;
  data: { name: string; jumlah: number }[];
  xLabel: string;
  yLabel?: string;
}

export function BarCard({ title, subtitle, data, xLabel, yLabel = 'Jumlah kejadian' }: Props) {
  const empty = data.every((d) => d.jumlah === 0);
  return (
    <Panel title={title}>
      <p className="px-4 pt-2 text-xs text-muted">{subtitle}</p>
      {empty ? (
        <p className="p-6 text-sm text-muted">Tidak ada data pada periode ini.</p>
      ) : (
        <div className="h-64 px-2 pb-3 pt-2" role="img" aria-label={`${title}. ${data.map((d) => `${d.name}: ${d.jumlah}`).join('; ')}`}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 8, right: 12, bottom: 22, left: 4 }}>
              <CartesianGrid stroke="rgb(var(--line))" strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="name" label={{ value: xLabel, position: 'insideBottom', offset: -14, fill: 'rgb(var(--muted))', fontSize: 12 }} stroke="rgb(var(--line))" />
              <YAxis allowDecimals={false} label={{ value: yLabel, angle: -90, position: 'insideLeft', fill: 'rgb(var(--muted))', fontSize: 12 }} stroke="rgb(var(--line))" />
              <Tooltip
                formatter={(v) => [`${v} kejadian`, 'Jumlah']}
                contentStyle={{ background: 'rgb(var(--surface))', border: '1px solid rgb(var(--line))', color: 'rgb(var(--ink))' }}
                cursor={{ fill: 'rgb(var(--line) / 0.4)' }}
              />
              <Bar dataKey="jumlah" fill="rgb(var(--accent))" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </Panel>
  );
}
