import React from 'react';
import { RefreshCw, RotateCcw } from 'lucide-react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('UI rendering failed:', error, errorInfo);
    this.props.onError?.(error, errorInfo);
  }

  reset = () => {
    this.setState({ error: null });
    this.props.onReset?.();
  };

  reload = () => {
    if (typeof window !== 'undefined') {
      window.location.reload();
    }
  };

  render() {
    if (!this.state.error) {
      return this.props.children;
    }

    if (this.props.fallback) {
      return typeof this.props.fallback === 'function'
        ? this.props.fallback({ error: this.state.error, reset: this.reset, reload: this.reload })
        : this.props.fallback;
    }

    const title = this.props.title || 'Something went wrong';
    const message = this.props.message || 'Refresh the page or try again.';
    const resetLabel = this.props.resetLabel || 'Try again';
    const reloadLabel = this.props.reloadLabel || 'Reload';

    return (
      <div className="flex min-h-full items-center justify-center bg-card px-4 py-10 text-center" role="alert">
        <div className="w-full max-w-sm rounded-lg border border-border bg-card p-5 shadow-sm">
          <div className="mx-auto grid h-12 w-12 place-items-center rounded-xl bg-rose-50 text-rose-600">
            <RotateCcw className="h-5 w-5" />
          </div>
          <h2 className="mt-4 text-base font-semibold text-foreground">{title}</h2>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">{message}</p>
          <div className="mt-5 flex items-center justify-center gap-2">
            <button
              type="button"
              onClick={this.reset}
              className="btn-secondary inline-flex h-9 items-center justify-center gap-2 rounded-md px-3 text-sm"
            >
              <RefreshCw className="h-4 w-4" />
              {resetLabel}
            </button>
            <button
              type="button"
              onClick={this.reload}
              className="btn-primary inline-flex h-9 items-center justify-center rounded-md px-3 text-sm"
            >
              {reloadLabel}
            </button>
          </div>
        </div>
      </div>
    );
  }
}

export default ErrorBoundary;
