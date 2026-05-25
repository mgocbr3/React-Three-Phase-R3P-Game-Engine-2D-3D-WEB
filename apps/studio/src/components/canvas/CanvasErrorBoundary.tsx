import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Props {
  children: ReactNode;
  onReset?: () => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

// Module-level dedupe — without this an unloadable GLB throws on every Suspense
// retry, producing 40+ identical errors per session. We log once per unique
// message and silently swallow the rest.
const loggedErrorFingerprints = new Set<string>();
const errorCountByFingerprint = new Map<string, number>();

const fingerprint = (err: Error): string => {
  const message = err.message || String(err);
  // Strip variable URL tokens so retries with the same URL collapse to one fingerprint.
  return message.replace(/\?v=[a-f0-9]+/g, '').replace(/\d{3,}/g, '<n>').slice(0, 200);
};

/**
 * ErrorBoundary specifically for Canvas components.
 * Catches React errors (including R3F/postprocessing crashes) and provides recovery options.
 */
export class CanvasErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    const fp = fingerprint(error);
    const count = (errorCountByFingerprint.get(fp) ?? 0) + 1;
    errorCountByFingerprint.set(fp, count);

    if (!loggedErrorFingerprints.has(fp)) {
      loggedErrorFingerprints.add(fp);
      console.error('[CanvasErrorBoundary] Caught error:', error);
      console.error('[CanvasErrorBoundary] Component stack:', errorInfo.componentStack);
    } else if (count === 5) {
      // One follow-up so users know the loop is happening, then silence.
      console.warn(`[CanvasErrorBoundary] Same error repeating (${count}+ times) — suppressing further logs for: ${fp}`);
    }
    this.setState({ errorInfo });
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    this.props.onReset?.();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="absolute inset-0 flex items-center justify-center bg-background/95 z-50">
          <div className="max-w-md p-6 text-center space-y-4">
            <div className="flex justify-center">
              <AlertTriangle className="h-12 w-12 text-destructive" />
            </div>
            <h2 className="text-xl font-semibold text-foreground">
              Rendering Error
            </h2>
            <p className="text-sm text-muted-foreground">
              The 3D engine encountered an error. This is usually caused by WebGL context issues or effect processing failures.
            </p>
            {this.state.error && (
              <div className="p-3 bg-muted rounded-md text-left">
                <p className="text-xs font-mono text-destructive break-all">
                  {this.state.error.message}
                </p>
              </div>
            )}
            <div className="flex justify-center gap-2">
              <Button onClick={this.handleReset} variant="default">
                <RefreshCw className="h-4 w-4 mr-2" />
                Try Again
              </Button>
              <Button 
                onClick={() => window.location.reload()} 
                variant="outline"
              >
                Reload Page
              </Button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
