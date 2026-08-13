import React from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../../../components/ui/card';
import { ResponsiveContainer, ComposedChart, CartesianGrid, XAxis, YAxis, Tooltip, Bar, Cell } from 'recharts';

interface FunnelData {
  name: string;
  count: number;
  color: string;
  rate: number;
}

interface FunnelChartProps {
  data: FunnelData[];
}

export const FunnelChart: React.FC<FunnelChartProps> = ({ data }) => (
  <Card className="bg-white dark:bg-[#1E293B] border border-slate-200 dark:border-[#334155]">
    <CardHeader>
      <CardTitle className="text-lg font-medium">Pipeline Conversion Funnel</CardTitle>
      <CardDescription>Survival rate from Applied to Offer</CardDescription>
    </CardHeader>
    <CardContent>
      <div className="h-80">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} layout="vertical" margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" horizontal={true} vertical={false} />
            <XAxis type="number" stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
            <YAxis dataKey="name" type="category" stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} width={80} />
            <Tooltip 
              contentStyle={{ backgroundColor: '#0F172A', borderColor: '#334155', color: '#f1f5f9', borderRadius: '8px' }}
              itemStyle={{ color: '#fff' }}
              cursor={{ fill: '#334155', opacity: 0.2 }}
            />
            <Bar dataKey="count" barSize={32} radius={[0, 4, 4, 0]}>
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} opacity={0.8} />
              ))}
            </Bar>
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      
      <div className="mt-4 grid grid-cols-5 gap-2">
        {data.map((stage, i) => (
          <div key={i} className="text-center">
            <div className="text-xs text-slate-500 dark:text-slate-400 mb-1">{stage.name}</div>
            <div className="text-sm font-semibold text-slate-900 dark:text-white">{i === 0 ? '-' : `${stage.rate}%`}</div>
          </div>
        ))}
      </div>
    </CardContent>
  </Card>
);
