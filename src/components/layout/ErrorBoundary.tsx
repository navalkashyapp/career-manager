import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from '../ui/button';

interface Props {
  children?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="h-full flex flex-col items-center justify-center p-8 text-center bg-slate-50 dark:bg-[#0F172A] rounded-xl border border-rose-200 dark:border-rose-900/50">
          <AlertTriangle size={48} className="text-rose-500 mb-4" />
          <h2 className="text-2xl font-semibold text-slate-900 dark:text-white mb-2">Something went wrong</h2>
          <p className="text-slate-500 dark:text-slate-400 mb-6 max-w-md">
            The application encountered an unexpected UI error. This can sometimes happen due to malformed AI responses or network issues.
          </p>
          <div className="bg-rose-50 dark:bg-rose-900/10 p-4 rounded-lg w-full max-w-xl text-left overflow-x-auto mb-6">
            <code className="text-sm text-rose-600 dark:text-rose-400">
              {this.state.error?.message}
            </code>
          </div>
          <Button 
            onClick={() => window.location.reload()}
            className="flex items-center gap-2"
          >
            <RefreshCw size={16} />
            Reload Application
          </Button>
        </div>
      );
    }

    return this.props.children;
  }
}
