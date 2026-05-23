// SectionErrorBoundary — generic boundary for Hub sections. Stops a single
// section (recent projects, samples, templates) from blanking the whole
// page if its render throws. Logs the error + component stack to the
// console with a clear prefix so the root cause is visible during dev.

import React, { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle } from 'lucide-react';

interface Props {
  /** Used in the fallback UI + console log prefix to identify which section failed. */
  sectionName: string;
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  componentStack: string | null;
}

export class SectionErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, componentStack: null };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    // Log with a clear prefix so the source of the crash is greppable. React
    // 18's default warning hides the actual Error — this is where it lives.
    // eslint-disable-next-line no-console
    console.error(`[SectionErrorBoundary:${this.props.sectionName}] Caught:`, error);
    // eslint-disable-next-line no-console
    console.error(`[SectionErrorBoundary:${this.props.sectionName}] Stack:`, errorInfo.componentStack);
    this.setState({ componentStack: errorInfo.componentStack ?? null });
  }

  render(): ReactNode {
    if (!this.state.hasError) return this.props.children;

    return (
      <section className="mb-7 rounded-lg border border-destructive/40 bg-destructive/5 p-4">
        <div className="flex items-start gap-3">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
          <div className="min-w-0 flex-1">
            <h2 className="text-base font-semibold text-foreground">
              {this.props.sectionName} crashou — outras seções continuam funcionando
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">
              {this.state.error?.message ?? 'Erro desconhecido — veja o console.'}
            </p>
            {this.state.componentStack && (
              <pre className="mt-2 max-h-32 overflow-auto rounded bg-background/60 p-2 text-[11px] text-muted-foreground">
                {this.state.componentStack.split('\n').slice(0, 8).join('\n')}
              </pre>
            )}
          </div>
        </div>
      </section>
    );
  }
}
