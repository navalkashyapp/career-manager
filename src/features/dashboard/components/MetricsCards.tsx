import React from 'react';
import { Card, CardContent } from '../../../components/ui/card';
import { Target, TrendingUp, Clock } from 'lucide-react';

interface MetricsCardsProps {
  totalApplied: number;
  overallConversion: number;
  avgTimeInStage: number;
}

export const MetricsCards: React.FC<MetricsCardsProps> = ({ totalApplied, overallConversion, avgTimeInStage }) => (
  <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
    <Card className="bg-white/50 dark:bg-[#1E293B]/50 border border-slate-200 dark:border-[#334155]">
      <CardContent className="p-6 flex items-center space-x-4">
        <div className="p-3 bg-blue-500/20 text-blue-400 rounded-xl">
          <Target size={24} />
        </div>
        <div>
          <p className="text-sm font-medium text-slate-500">Total Pipeline</p>
          <h3 className="text-2xl font-bold text-slate-900 dark:text-white">
            {totalApplied} <span className="text-sm font-normal text-slate-500">active apps</span>
          </h3>
        </div>
      </CardContent>
    </Card>
    
    <Card className="bg-white/50 dark:bg-[#1E293B]/50 border border-slate-200 dark:border-[#334155]">
      <CardContent className="p-6 flex items-center space-x-4">
        <div className="p-3 bg-emerald-500/20 text-emerald-400 rounded-xl">
          <TrendingUp size={24} />
        </div>
        <div>
          <p className="text-sm font-medium text-slate-500">Overall Conversion</p>
          <h3 className="text-2xl font-bold text-slate-900 dark:text-white">
            {overallConversion}% <span className="text-sm font-normal text-slate-500">applied to offer</span>
          </h3>
        </div>
      </CardContent>
    </Card>

    <Card className="bg-white/50 dark:bg-[#1E293B]/50 border border-slate-200 dark:border-[#334155]">
      <CardContent className="p-6 flex items-center space-x-4">
        <div className="p-3 bg-amber-500/20 text-amber-400 rounded-xl">
          <Clock size={24} />
        </div>
        <div>
          <p className="text-sm font-medium text-slate-500">Avg Time in Stage</p>
          <h3 className="text-2xl font-bold text-slate-900 dark:text-white">
            {avgTimeInStage} <span className="text-sm font-normal text-slate-500">days</span>
          </h3>
        </div>
      </CardContent>
    </Card>
  </div>
);
