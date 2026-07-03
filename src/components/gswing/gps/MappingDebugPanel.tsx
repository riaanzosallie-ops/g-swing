import type { MappedHole } from "@/types/gswing-course-map";
import type { LatLng } from "@/lib/gps-utils";

/**
 * Owner-only Mapping Debug panel. Surfaces exactly which row from
 * gswing_course_maps / gswing_mapped_holes is feeding the live GPS
 * distances right now, plus player location + accuracy, the
 * resolved front/center/back yardages, and the data source. This is
 * used to verify on-course that the right hole's geometry is in play.
 */
export interface MappingDebugPanelProps {
  courseName: string | null;
  courseMapId: string | null;
  selectedHole: number;
  mappedHole: MappedHole | null;
  mappingStatus: "idle" | "loading" | "mapped" | "missing";
  playerPosition: LatLng | null;
  playerAccuracy: number | null;
  front: number | null;
  center: number | null;
  back: number | null;
  unitShort: "y" | "m";
  /** External provider link, if any, on the course map. */
  externalProvider?: string | null;
  externalCourseId?: string | null;
  lastSynced?: string | null;
  /** Premium renderer state. */
  rendererActive?: boolean;
  visualMode?: "premium" | "satellite";
  /** Current measurement state (post-tap). */
  measurementTarget?: LatLng | null;
  measurementDistance?: number | null;
  measurementSource?: "premium-projected" | "satellite-mapbox" | null;
  /** Satellite provider diagnostics (owner-only). */
  satellite?: {
    activeProvider: string;
    providerLabel: string;
    sampleTileUrl: string;
    mapboxTokenStatus: "ready" | "loading" | "missing" | "error";
    fallbackActive: boolean;
    lastTileError: string | null;
    retryCount: number;
    attribution: string;
  };
}

function yn(v: boolean) {
  return v ? "yes" : "no";
}

function fmt(v: number | null) {
  return v == null || !Number.isFinite(v) ? "—" : Math.round(v).toString();
}

function source(
  status: MappingDebugPanelProps["mappingStatus"],
  provider?: string | null,
): string {
  // Distance priority: G-Swing mapping → GolfAPI.io metadata → Missing.
  // We only return a single source — sources are never mixed for one hole.
  if (status === "mapped") return "G-Swing Mapping";
  if (status === "missing") {
    return provider ? `${provider} (metadata only — geometry missing)` : "Missing";
  }
  return "loading";
}

export function MappingDebugPanel(props: MappingDebugPanelProps) {
  const {
    courseName,
    courseMapId,
    selectedHole,
    mappedHole,
    mappingStatus,
    playerPosition,
    playerAccuracy,
    front,
    center,
    back,
    unitShort,
  } = props;

  const tees = mappedHole?.tees ?? [];
  const green = mappedHole?.green ?? null;
  const hazards = mappedHole?.hazards ?? [];
  const features = hazards.length;
  const greenPolyVertices = green?.polygon?.length ?? 0;
  const greenSource =
    greenPolyVertices >= 3
      ? `polygon (${greenPolyVertices} pts)`
      : green?.center
        ? "center fallback"
        : "—";
  const hazardBreakdown = hazards.reduce<Record<string, number>>((acc, h) => {
    acc[h.type] = (acc[h.type] ?? 0) + 1;
    return acc;
  }, {});
  const fairwayPoints =
    (tees.length ? 1 : 0) +
    (mappedHole?.doglegs.length ?? 0) +
    (mappedHole?.landingZones.length ?? 0) +
    (green?.front || green?.center ? 1 : 0);

  return (
    <div className="rounded-md border border-gold/25 bg-black/85 p-2 text-[10px] leading-snug text-white/80">
      <div className="mb-1 text-[9px] font-semibold uppercase tracking-[0.18em] text-gold">
        Mapping Debug · owner
      </div>
      <Row k="Course" v={courseName ?? "—"} />
      <Row k="course_map_id" v={courseMapId ?? "—"} mono />
      <Row k="Hole selected" v={String(selectedHole)} />
      <Row k="mapped_hole_id" v={mappedHole?.id ?? "—"} mono />
      <Row k="Tee saved" v={yn(tees.length > 0)} />
      <Row k="Front saved" v={yn(!!green?.front)} />
      <Row k="Center saved" v={yn(!!green?.center)} />
      <Row k="Back saved" v={yn(!!green?.back)} />
      <Row k="Features" v={String(features)} />
      <Row k="Green render" v={greenSource} />
      <Row k="Fairway pts" v={String(fairwayPoints)} />
      {Object.entries(hazardBreakdown).map(([t, n]) => (
        <Row key={t} k={`· ${t}`} v={String(n)} />
      ))}
      <Row
        k="Player GPS"
        v={
          playerPosition
            ? `${playerPosition.lat.toFixed(5)}, ${playerPosition.lng.toFixed(5)}`
            : "—"
        }
      />
      <Row
        k="Accuracy"
        v={playerAccuracy != null ? `±${Math.round(playerAccuracy)} m` : "—"}
      />
      <Row k={`Front ${unitShort}`} v={fmt(front)} />
      <Row k={`Center ${unitShort}`} v={fmt(center)} />
      <Row k={`Back ${unitShort}`} v={fmt(back)} />
      <Row k="Source" v={source(mappingStatus, props.externalProvider)} />
      {props.visualMode && <Row k="Visual mode" v={props.visualMode} />}
      {props.rendererActive != null && (
        <Row k="Renderer active" v={yn(props.rendererActive)} />
      )}
      {props.measurementTarget && (
        <Row
          k="Tap target"
          v={`${props.measurementTarget.lat.toFixed(5)}, ${props.measurementTarget.lng.toFixed(5)}`}
          mono
        />
      )}
      {props.measurementDistance != null && (
        <Row k={`Measured ${unitShort}`} v={fmt(props.measurementDistance)} />
      )}
      {props.measurementSource && (
        <Row k="Measurement src" v={props.measurementSource} />
      )}
      {props.satellite && (
        <>
          <div className="mt-2 mb-1 text-[9px] font-semibold uppercase tracking-[0.18em] text-gold">
            Satellite · diagnostics
          </div>
          <Row k="Provider" v={props.satellite.providerLabel} />
          <Row k="Provider id" v={props.satellite.activeProvider} mono />
          <Row k="Fallback active" v={yn(props.satellite.fallbackActive)} />
          <Row k="Mapbox token" v={props.satellite.mapboxTokenStatus} />
          <Row k="Retry count" v={String(props.satellite.retryCount)} />
          <Row k="Last tile error" v={props.satellite.lastTileError ?? "—"} />
          <Row k="Sample tile" v={props.satellite.sampleTileUrl} mono />
          <Row k="Attribution" v={props.satellite.attribution} />
        </>
      )}
      {props.externalProvider && (
        <>
          <Row k="Linked provider" v={props.externalProvider} />
          <Row k="External id" v={props.externalCourseId ?? "—"} mono />
          <Row k="Last synced" v={props.lastSynced ?? "—"} />
        </>
      )}
    </div>
  );
}

function Row({ k, v, mono }: { k: string; v: string; mono?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-2 py-[1px]">
      <span className="text-white/55">{k}</span>
      <span
        className={`max-w-[60%] truncate text-right ${
          mono ? "font-mono text-[9.5px]" : ""
        } text-gold-soft`}
        title={v}
      >
        {v}
      </span>
    </div>
  );
}