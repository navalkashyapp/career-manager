import React from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../../../components/ui/card';
import { ResponsiveContainer, BarChart, CartesianGrid, XAxis, YAxis, Tooltip, Bar, Cell } from 'recharts';
import { AlertTriangle } from 'lucide-react';

interface TimeData {
  name: string;
  avgDays: number;
  count: number;
}

interface TimeInStageChartProps {
  data: TimeData[];
}

export const TimeInStageChart: React.FC<TimeInStageChartProps> = ({ data }) => (
  <Card className="bg-white dark:bg-[#1E293B] border border-slate-200 dark:border-[#334155]">
    <CardHeader className="flex flex-row items-start justify-between">
      <div>
        <CardTitle className="text-lg font-medium">Time in Stage (Days)</CardTitle>
        <CardDescription>Average duration before advancing</CardDescription>
      </div>
      <div className="flex items-center text-amber-400 text-xs bg-amber-400/10 px-2 py-1 rounded-md mt-0">
        <AlertTriangle size={14} className="mr-1" /> Bottlenecks
      </div>
    </CardHeader>
    <CardContent>
      <div className="h-80">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 20, right: 30, left: -20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
            <XAxis dataKey="name" stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
            <YAxis stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
            <Tooltip 
              cursor={{ fill: '#334155', opacity: 0.2 }}
              contentStyle={{ backgroundColor: '#0F172A', borderColor: '#334155', color: '#f1f5f9', borderRadius: '8px' }}
            />
            <Bar dataKey="avgDays" name="Avg Days" fill="#8b5cf6" radius={[4, 4, 0, 0]} barSize={40}>
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.avgDays > 14 ? '#ef4444' : '#8b5cf6'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-4 text-sm text-slate-500 dark:text-slate-400 text-center">
        Stages taking longer than <strong className="text-rose-400">14 days</strong> are highlighted in red.
      </div>
    </CardContent>
  </Card>
);
