import { Component, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";

type Props = { children: ReactNode };
type State = { error: Error | null };

/**
 * Error boundary scoped to the GPS / Premium renderer surface.
 * Prevents the whole app from going blank if Mapbox or the
 * premium SVG renderer throws on bad/missing course data.
 */
export class GpsErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: unknown) {
    // eslint-disable-next-line no-console
    console.error("[GpsErrorBoundary]", error, info);
  }

  private handleReset = () => {
    try {
      localStorage.removeItem("gswing.lastCourseId");
    } catch {
      /* ignore */
    }
    this.setState({ error: null });
    // Soft reload to drop any cached map/SVG state.
    window.location.reload();
  };

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="flex min-h-[70vh] flex-col items-center justify-center gap-4 px-6 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-full border border-gold/40 bg-gold/10 text-gold">
          <AlertTriangle className="h-6 w-6" />
        </div>
        <div>
          <h2 className="font-serif text-lg text-gradient-gold">
            Course failed to load
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Please reselect your course to continue.
          </p>
          {import.meta.env.DEV && (
            <pre className="mt-3 max-h-40 overflow-auto rounded bg-black/40 p-2 text-left text-[10px] text-red-300">
              {this.state.error.message}
            </pre>
          )}
        </div>
        <Button onClick={this.handleReset} className="gradient-gold text-primary-foreground">
          Reselect course
        </Button>
      </div>
    );
  }
}