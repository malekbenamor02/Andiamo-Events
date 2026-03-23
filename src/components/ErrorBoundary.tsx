import React, { Component, ErrorInfo, ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { WifiOff } from 'lucide-react';
import { logger } from '@/lib/logger';
import { humanizeAppError } from '@/lib/network-error-message';
import { Button } from '@/components/ui/button';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  /** When true, only the main area is replaced (use inside layout that already has nav + footer). */
  embedded?: boolean;
  language?: 'en' | 'fr';
}

interface State {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Log error to database
    logger.error('React Error Boundary caught an error', error, {
      category: 'error',
      details: {
        componentStack: errorInfo.componentStack,
        errorMessage: error.message,
        errorName: error.name
      }
    });

    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  private handleReload = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      const lang = this.props.language ?? 'en';
      const { title, detail } = humanizeAppError(this.state.error?.message, lang);
      const reloadLabel = lang === 'en' ? 'Reload page' : 'Recharger la page';
      const homeLabel = lang === 'en' ? 'Back to home' : "Retour à l'accueil";

      const body = (
        <div className="mx-auto w-full max-w-md rounded-xl border border-border bg-card/80 backdrop-blur-sm p-8 shadow-lg text-center space-y-5">
          <div className="flex justify-center">
            <span className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-destructive/10 text-destructive">
              <WifiOff className="h-7 w-7" aria-hidden />
            </span>
          </div>
          <div className="space-y-2">
            <h1 className="text-2xl font-bold text-foreground font-heading tracking-tight">{title}</h1>
            <p className="text-sm text-muted-foreground leading-relaxed">{detail}</p>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Button type="button" onClick={this.handleReload} className="w-full sm:w-auto">
              {reloadLabel}
            </Button>
            <Button type="button" variant="outline" asChild className="w-full sm:w-auto">
              <Link to="/">{homeLabel}</Link>
            </Button>
          </div>
        </div>
      );

      if (this.props.embedded) {
        return (
          <main className="flex-1 flex flex-col items-center justify-center px-4 py-16 w-full min-h-[50vh]">
            {body}
          </main>
        );
      }

      return (
        <div className="min-h-screen bg-background flex items-center justify-center p-4">
          {body}
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;










