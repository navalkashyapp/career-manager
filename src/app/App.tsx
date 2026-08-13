import React, { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from '../lib/react-query';
import { ErrorBoundary } from '../components/layout/ErrorBoundary';

import Layout from '../components/layout/Layout';
import { DataProvider } from '../hooks/useData';
import { ThemeProvider } from '../contexts/ThemeContext';

// Lazy load feature views
const DashboardView = lazy(() => import('../features/dashboard/components/DashboardView'));
const PerformanceView = lazy(() => import('../features/dashboard/components/PerformanceView'));
const Board = lazy(() => import('../features/kanban/components/Board'));
const ProfileView = lazy(() => import('../features/profile/components/ProfileView'));
const ResumeStudio = lazy(() => import('../features/resume-studio/components/ResumeStudio'));
const Inbox = lazy(() => import('../features/mail/components/Inbox'));
const TasksView = lazy(() => import('../features/tasks/components/TasksView'));
const EvaluateView = lazy(() => import('../features/evaluate/components/EvaluateView'));

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <BrowserRouter>
          <DataProvider>
            <ErrorBoundary>
              <Suspense fallback={<div className="h-screen w-screen flex items-center justify-center">Loading...</div>}>
                <Routes>
                  <Route path="/" element={<Layout />}>
                    <Route index element={<DashboardView />} />
                    <Route path="performance" element={<PerformanceView />} />
                    <Route path="applications" element={<Board />} />
                    <Route path="profile" element={<ProfileView />} />
                    <Route path="resume" element={<ResumeStudio />} />
                    <Route path="evaluate" element={<EvaluateView />} />
                    <Route path="mail" element={<Inbox />} />
                    <Route path="tasks" element={<TasksView />} />
                  </Route>
                </Routes>
              </Suspense>
            </ErrorBoundary>
          </DataProvider>
        </BrowserRouter>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
