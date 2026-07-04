// Central Premium render-order + style tokens. Consumed by the Premium
// renderer so layer stacking is consistent hole-to-hole and course-to-
// course. Values are semantic — actual colours come from the design
// system in index.css / tailwind.config.

export type PremiumLayerKey =
  | "rough"
  | "waste"
  | "water"
  | "fairway"
  | "bunkers"
  | "cart-paths"
  | "green"
  | "trees"
  | "tee"
  | "labels"
  | "markers"
  | "pin"
  | "player";

/** Bottom → top render order for the Premium illustrated hole view. */
export const PREMIUM_LAYER_ORDER: readonly PremiumLayerKey[] = [
  "rough",
  "waste",
  "water",
  "fairway",
  "bunkers",
  "cart-paths",
  "green",
  "trees",
  "tee",
  "labels",
  "markers",
  "pin",
  "player",
] as const;

export interface PremiumLayerStyle {
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  opacity?: number;
  filter?: string;
}

/**
 * Neutral, painterly presets. Kept as plain CSS values (not tokens)
 * because the SVG-based Premium renderer draws directly. Refined
 * colours can be lifted into index.css later without touching layer
 * ordering or renderer wiring.
 */
export const PREMIUM_LAYER_STYLES: Record<PremiumLayerKey, PremiumLayerStyle> = {
  rough:        { fill: "#0f4a2a", opacity: 0.9 },
  waste:        { fill: "#c9a86a", opacity: 0.85 },
  water:        { fill: "#1e5a8a", opacity: 0.92, stroke: "#0f3a5f", strokeWidth: 0.5 },
  fairway:      { fill: "#3aa066", opacity: 0.95 },
  bunkers:      { fill: "#eddca6", stroke: "#8a6a2a", strokeWidth: 0.6, opacity: 0.98 },
  "cart-paths": { stroke: "#c9c1a8", strokeWidth: 1.2, opacity: 0.75 },
  green:        { fill: "#7dd28f", stroke: "#2f6b3f", strokeWidth: 0.8, opacity: 0.98 },
  trees:        { fill: "#0b3820", opacity: 0.55 },
  tee:          { fill: "#5cb87a", stroke: "#2f6b3f", strokeWidth: 0.6 },
  labels:       { fill: "#f8f4e6" },
  markers:      { fill: "#f8f4e6", stroke: "#1a2a1a", strokeWidth: 0.5 },
  pin:          { fill: "#f5c84b", stroke: "#5c3a05", strokeWidth: 0.6 },
  player:       { fill: "#3ea6ff", stroke: "#0b3d70", strokeWidth: 1 },
};
