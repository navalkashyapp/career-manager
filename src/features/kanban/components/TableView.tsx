import React from 'react';
import { formatDistanceToNow } from 'date-fns';
import { Badge } from '../../../components/ui/badge';
import type { JobApplication } from '../../../types';

interface TableViewProps {
  applications: JobApplication[];
}

export const TableView: React.FC<TableViewProps> = ({ applications }) => {
  return (
    <div className="flex-1 bg-white/50 dark:bg-[#1E293B]/50 border border-slate-200 dark:border-[#334155] rounded-xl overflow-hidden">
      <table className="w-full text-left text-sm">
        <thead className="bg-slate-100 dark:bg-[#0F172A] text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-[#334155]">
          <tr>
            <th className="px-6 py-4 font-medium">Role</th>
            <th className="px-6 py-4 font-medium">Company</th>
            <th className="px-6 py-4 font-medium">Stage</th>
            <th className="px-6 py-4 font-medium">Match</th>
            <th className="px-6 py-4 font-medium">Last Updated</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[#334155]">
          {applications.map(app => (
            <tr key={app.id} className="hover:bg-white dark:bg-[#1E293B] transition-colors cursor-pointer">
              <td className="px-6 py-4 font-medium text-slate-900 dark:text-white">{app.jobTitle}</td>
              <td className="px-6 py-4 text-slate-600 dark:text-slate-300">{app.companyName}</td>
              <td className="px-6 py-4">
                <Badge variant="secondary">
                  {app.stage}
                </Badge>
              </td>
              <td className="px-6 py-4 text-indigo-400">{app.matchScore}%</td>
              <td className="px-6 py-4 text-slate-500">{formatDistanceToNow(app.updatedAt)} ago</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
