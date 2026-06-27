// G-Swing Premium Course Mapping Engine — shared types.
// Strictly geometric. No fabricated golf data anywhere downstream.

export interface GpsCoordinate {
  lat: number;
  lng: number;
}

export type HazardCategory =
  | "bunker"
  | "water"
  | "penalty_area"
  | "trees"
  | "rough"
  | "out_of_bounds"
  | "waste_area"
  | "custom";

export type SideLabel = "left" | "right" | "center" | "short" | "long";

export interface HazardGeometry {
  id: string;
  name: string;
  type: HazardCategory;
  side: SideLabel | null;
  /** Outer polygon ring [lng, lat]. Null when only point data is mapped. */
  polygon: Array<[number, number]> | null;
  /** Nearest edge facing the player — used for "reach" distance. */
  front: GpsCoordinate | null;
  /** Far edge facing the green — used for "carry" distance. */
  carry: GpsCoordinate | null;
  /** Hazard centroid — used for labels. */
  center: GpsCoordinate;
  notes: string | null;
}

export interface GreenGeometry {
  front: GpsCoordinate | null;
  center: GpsCoordinate | null;
  back: GpsCoordinate | null;
  /** Outer polygon ring [lng, lat]. */
  polygon: Array<[number, number]> | null;
  slopeNote: string | null;
}

export interface PinPosition {
  coordinate: GpsCoordinate;
  /** ISO date of the pin sheet. */
  setOn: string | null;
  notes: string | null;
}

export interface TeeBoxMarker {
  id: string;
  name: string;
  coordinate: GpsCoordinate;
  yardage: number | null;
}

export interface LayupTarget {
  id: string;
  name: string;
  coordinate: GpsCoordinate;
  targetYardageFromGreen: number | null;
  notes: string | null;
}

export interface DoglegTarget {
  id: string;
  coordinate: GpsCoordinate;
  notes: string | null;
}

export interface FairwayLandingZone {
  id: string;
  name: string;
  coordinate: GpsCoordinate;
  radiusYards: number | null;
  notes: string | null;
}

export interface CourseBoundary {
  /** Polygon ring [lng, lat]. */
  polygon: Array<[number, number]>;
  name: string | null;
}

export interface MeasurementLine {
  from: GpsCoordinate;
  to: GpsCoordinate;
  distanceMeters: number;
  bearingDeg: number;
}

export interface MappedHole {
  id: string;
  holeNumber: number;
  par: number | null;
  lengthYards: number | null;
  lengthMeters: number | null;
  tees: TeeBoxMarker[];
  green: GreenGeometry;
  pin: PinPosition | null;
  hazards: HazardGeometry[];
  layups: LayupTarget[];
  doglegs: DoglegTarget[];
  landingZones: FairwayLandingZone[];
}

export interface CourseMap {
  id: string;
  courseName: string;
  locationLabel: string | null;
  center: GpsCoordinate;
  boundary: CourseBoundary | null;
  holes: MappedHole[];
  updatedAt: string | null;
}

/** Snapshot of every distance a HUD/AI caddie can safely render for one hole. */
export interface GolfGpsSnapshot {
  hasMapping: boolean;
  green: {
    front: number | null;
    center: number | null;
    back: number | null;
    approximate: boolean;
  };
  pin: number | null;
  hazards: Array<{
    id: string;
    name: string;
    type: HazardCategory;
    side: SideLabel | null;
    reach: number | null;
    carry: number | null;
    risk: "low" | "medium" | "high" | null;
  }>;
  layups: Array<{ id: string; name: string; distance: number | null }>;
  dogleg: number | null;
  landingZones: Array<{ id: string; name: string; distance: number | null }>;
}