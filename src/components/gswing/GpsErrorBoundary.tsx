import { Component, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { MapPin } from "lucide-react";
import { getActiveCourse } from "@/lib/active-course";

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
    // IMPORTANT: never wipe the active course here and never call
    // window.location.reload(). A full reload boots the app back to
    // the Splash / Welcome stage, which is a critical UX regression
    // (Reselect Course → Welcome/Login). Instead, drop the error
    // state and route to the Course Selector (Manage Courses),
    // which is the correct "choose a course" surface.
    this.setState({ error: null });
    try {
      window.dispatchEvent(
        new CustomEvent<string>("gswing-nav", { detail: "courses" }),
      );
    } catch {
      /* best-effort */
    }
  };

  render() {
    if (!this.state.error) return this.props.children;
    const active = getActiveCourse();
    return (
      <div className="flex min-h-[70vh] flex-col items-center justify-center gap-4 px-6 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-full border border-gold/40 bg-gold/10 text-gold">
          <MapPin className="h-6 w-6" />
        </div>
        <div>
          <h2 className="font-serif text-lg text-gradient-gold">
            {active ? "GPS needs a refresh" : "No Active Course"}
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            {active
              ? "Tap below to choose or reactivate a course."
              : "Choose a course to begin."}
          </p>
          {import.meta.env.DEV && (
            <pre className="mt-3 max-h-40 overflow-auto rounded bg-black/40 p-2 text-left text-[10px] text-red-300">
              {this.state.error.message}
            </pre>
          )}
        </div>
        <Button onClick={this.handleReset} className="gradient-gold text-primary-foreground">
          Choose Course
        </Button>
      </div>
    );
  }
}