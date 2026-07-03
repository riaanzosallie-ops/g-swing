import { Component, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";

type Props = {
  children: ReactNode;
  /** Human label of the surface that failed, e.g. "Live GPS", "Golf API". */
  label?: string;
  /** Called when the user taps Retry. Defaults to clearing local error state. */
  onRetry?: () => void;
};
type State = { error: Error | null };

/**
 * Generic error boundary used to keep a single failing surface (GPS,
 * Course Mapper, Golf API Settings, active-round screens) from crashing
 * the whole app or bouncing the user back to Home. Renders a compact
 * inline fallback with a Retry action.
 */
export class AppErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: unknown) {
    // eslint-disable-next-line no-console
    console.error(`[AppErrorBoundary:${this.props.label ?? "app"}]`, error, info);
  }

  private handleRetry = () => {
    this.setState({ error: null });
    this.props.onRetry?.();
  };

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-6 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full border border-gold/40 bg-gold/10 text-gold">
          <AlertTriangle className="h-5 w-5" />
        </div>
        <div>
          <h2 className="font-serif text-lg text-gradient-gold">
            {this.props.label ? `${this.props.label} hit a snag` : "Something went wrong"}
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            You're still signed in. Tap retry to reload just this screen.
          </p>
          {import.meta.env.DEV && (
            <pre className="mt-3 max-h-40 overflow-auto rounded bg-black/40 p-2 text-left text-[10px] text-red-300">
              {this.state.error.message}
            </pre>
          )}
        </div>
        <Button onClick={this.handleRetry} className="gradient-gold text-primary-foreground">
          Retry
        </Button>
      </div>
    );
  }
}