// Provider abstraction for external course-data sources.
// All providers normalise to these G-Swing types so the rest of the app
// never depends on a specific vendor.

export type ProviderId = "GolfCourseAPI" | "iGolf" | "GolfIntelligence" | "OpenStreetMap";

export interface NormalisedTee {
  tee_name: string;
  gender: "male" | "female";
  total_yards: number | null;
  total_meters: number | null;
  par_total: number | null;
  course_rating: number | null;
  slope_rating: number | null;
}

export interface NormalisedHole {
  hole_number: number;
  par: number | null;
  yardage: number | null;
  handicap: number | null;
}

export interface NormalisedCourse {
  provider: ProviderId;
  external_id: string;
  club_name: string;
  course_name: string;
  address: string | null;
  city: string | null;
  country: string | null;
  latitude: number | null;
  longitude: number | null;
  tees: NormalisedTee[];
  holes: NormalisedHole[];
  raw: unknown;
}

export interface NormalisedSearchHit {
  provider: ProviderId;
  external_id: string;
  club_name: string;
  course_name: string;
  address: string | null;
}

export interface CourseDataProvider {
  id: ProviderId;
  search(query: string): Promise<NormalisedSearchHit[]>;
  getCourse(externalId: string | number): Promise<NormalisedCourse>;
}

export type YardageSource = "G-Swing Mapping" | "GolfCourseAPI" | "OSM Preview" | "Missing";