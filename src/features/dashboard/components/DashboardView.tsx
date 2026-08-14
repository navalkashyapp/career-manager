import React, { useState } from 'react';
import { useData } from '../../../hooks/useData';
import { useCareerOps } from '../../../hooks/useCareerOps';
import { useSmartFollowUp } from '../hooks/useSmartFollowUp';
import { useNavigate } from 'react-router-dom';
import {
  Briefcase,
  Target,
  CheckCircle2,
  TrendingUp,
  Activity,
  Calendar,
  ChevronRight
} from 'lucide-react';
import { motion } from 'motion/react';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '../../../lib/utils';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../../components/ui/card';

import { useMemo } from 'react';
import { startOfWeek, addDays, format, isSameDay } from 'date-fns';

export default function DashboardView() {
  const { applications, profile, loading, error, addApplication } = useData();
  const navigate = useNavigate();
  const { nudges } = useSmartFollowUp(applications);

  const chartData = useMemo(() => {
    const start = startOfWeek(new Date(), { weekStartsOn: 1 });
    const days = Array.from({ length: 7 }, (_, i) => {
      const date = addDays(start, i);
      return {
        name: format(date, 'EEE'),
        date,
        applied: 0,
        interviews: 0
      };
    });

    applications.forEach(app => {
      const appDate = new Date(app.createdAt || app.updatedAt);
      const dayData = days.find(d => isSameDay(d.date, appDate));
      if (dayData) {
        if (app.stage === 'Applied') {
          dayData.applied++;
        } else if (['Recruiter Screen', 'Technical Loop', 'Onsite'].includes(app.stage)) {
          dayData.interviews++;
        }
      }
    });

    return days.map(({ name, applied, interviews }) => ({ name, applied, interviews }));
  }, [applications]);

  if (loading) {
    return (
      <div className="h-full flex flex-col p-4 md:p-8 overflow-y-auto space-y-8 animate-pulse">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-3">
            <div className="h-8 w-64 bg-white dark:bg-[#1E293B] rounded-lg"></div>
            <div className="h-4 w-48 bg-white dark:bg-[#1E293B] rounded-lg"></div>
          </div>
          <div className="h-10 w-32 bg-white dark:bg-[#1E293B] rounded-lg"></div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
          {[1, 2, 3, 4].map(i => <div key={i} className="h-32 bg-white dark:bg-[#1E293B] rounded-2xl"></div>)}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 h-80 bg-white dark:bg-[#1E293B] rounded-2xl"></div>
          <div className="h-80 bg-white dark:bg-[#1E293B] rounded-2xl"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return <div className="p-8 text-rose-400">Error loading data: {error}</div>;
  }

  const totalActive = applications.filter(a => a.stage !== 'Archived').length;
  const interviewing = applications.filter(a =>
    ['Recruiter Screen', 'Technical Loop', 'Onsite'].includes(a.stage)
  ).length;
  const offers = applications.filter(a => a.stage === 'Offer Extended').length;

  return (
    <div className="h-full flex flex-col p-4 md:p-8 overflow-y-auto">
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 md:mb-8 gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-semibold text-slate-900 dark:text-white tracking-tight">Welcome back, {profile.fullName.split(' ')[0]}</h1>
          <p className="text-sm md:text-base text-slate-500 dark:text-slate-400 mt-1">Here's your TPM job search pipeline overview.</p>
        </div>
        <Button
          onClick={() => navigate('/applications')}
          className="flex items-center space-x-2"
        >
          <Target size={16} />
          <span>New Target Role</span>
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 md:gap-6 mb-6 md:mb-8">
        <MetricCard title="Total Active" value={totalActive} icon={Briefcase} trend="+12%" color="text-indigo-400" bg="bg-indigo-500/10" />
        <MetricCard title="In Interviews" value={interviewing} icon={Activity} trend="+2" color="text-amber-400" bg="bg-amber-500/10" />
        <MetricCard title="Offers Extended" value={offers} icon={CheckCircle2} trend="0" color="text-emerald-400" bg="bg-emerald-500/10" />
        <MetricCard title="Profile Views" value={142} icon={TrendingUp} trend="+28%" color="text-pink-400" bg="bg-pink-500/10" />
      </div>

      {nudges.length > 0 && (
        <Card className="mb-8 border-rose-200 dark:border-rose-900/50 bg-rose-50/50 dark:bg-rose-900/10 backdrop-blur-md">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2 text-rose-600 dark:text-rose-400">
              <Activity size={20} />
              Smart Follow-Up Nudges
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {nudges.map((nudge, i) => (
                <div key={i} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-white dark:bg-[#0F172A]/50 rounded-xl border border-slate-200 dark:border-[#334155]">
                  <div>
                    <h4 className="font-semibold text-slate-900 dark:text-white flex flex-wrap items-center gap-2">
                      {nudge.app.companyName} - {nudge.app.jobTitle}
                      {nudge.urgency === 'high' && (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-600 dark:bg-rose-900/30 dark:text-rose-400 uppercase tracking-wide">
                          Action Required
                        </span>
                      )}
                    </h4>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{nudge.reason}</p>
                    <p className="text-sm font-medium text-slate-700 dark:text-slate-300 mt-1 flex items-center gap-1.5">
                      <Target size={14} className="text-sky-500" />
                      {nudge.suggestedAction}
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => navigate('/applications')}
                    className="mt-4 sm:mt-0 whitespace-nowrap"
                  >
                    Go to Board
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}


      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 md:gap-8">
        <Card className="lg:col-span-2 bg-white/50 dark:bg-[#1E293B]/50 backdrop-blur-md border border-slate-200 dark:border-[#334155]">
          <CardHeader>
            <CardTitle className="text-lg font-medium">Activity Pipeline</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorApplied" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6366F1" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#6366F1" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="name" stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#0F172A', borderColor: '#334155', color: '#f1f5f9' }}
                    itemStyle={{ color: '#818cf8' }}
                  />
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                  <Area type="monotone" dataKey="applied" stroke="#6366F1" strokeWidth={2} fillOpacity={1} fill="url(#colorApplied)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white/50 dark:bg-[#1E293B]/50 backdrop-blur-md border border-slate-200 dark:border-[#334155] flex flex-col">
          <CardHeader>
            <CardTitle className="text-lg font-medium">Recent Updates</CardTitle>
          </CardHeader>
          <CardContent className="flex-1 flex flex-col min-h-0">
            <div className="flex-1 space-y-5 overflow-y-auto pr-2">
              {applications.slice(0, 5).map(app => (
                <div key={app.id} className="relative pl-4 border-l-2 border-slate-200 dark:border-[#334155]">
                  <div className="absolute w-2 h-2 bg-indigo-500 rounded-full -left-[5px] top-1.5" />
                  <h4 className="text-sm font-medium text-slate-700 dark:text-slate-200">{app.companyName}</h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Moved to <span className="text-indigo-400">{app.stage}</span></p>
                  <p className="text-[10px] text-slate-500 mt-1">{formatDistanceToNow(app.updatedAt)} ago</p>
                </div>
              ))}
            </div>
            <Button variant="outline" className="w-full mt-4">
              View All Activity
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function MetricCard({ title, value, icon: Icon, trend, color, bg }: any) {
  return (
    <Card className="bg-white/50 dark:bg-[#1E293B]/50 backdrop-blur-md border border-slate-200 dark:border-[#334155] hover:-translate-y-0.5 transition-transform">
      <CardContent className="p-5">
        <div className="flex items-start justify-between mb-4">
          <div className={cn("p-2 rounded-xl", bg, color)}>
            <Icon size={20} />
          </div>
          <span className="text-xs font-medium text-emerald-400 bg-emerald-400/10 px-2 py-1 rounded-lg">
            {trend}
          </span>
        </div>
        <div>
          <h4 className="text-3xl font-semibold text-slate-900 dark:text-white tracking-tight">{value}</h4>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 font-medium">{title}</p>
        </div>
      </CardContent>
    </Card>
  );
}
