import { TOOLS } from "./constants";

export type Tool = (typeof TOOLS)[keyof typeof TOOLS] | null;

export interface Point {
  x: number;
  y: number;
}

export interface Stroke {
  id: string;
  tool: Tool;
  color: string;
  size: number;
  feather?: number; // Softness/Blur radius
  points: Point[];
  timestamp: number;
  text?: string; // For text tool
  isComplete?: boolean;
}

export interface DrawOptions {
  ctx: CanvasRenderingContext2D;
  currentPoint: Point;
  prevPoint: Point | null;
  color: string;
  size: number;
}
export interface UserPresence {
  id: string;
  name: string;
  color: string;
  cursor: Point | null;
  lastActive: number;
  currentStroke: Stroke | null;
}

export type HistoryAction =
  | { type: "ADD"; stroke: Stroke }
  | { type: "UPDATE"; original: Stroke; new: Stroke }
  | { type: "DELETE"; stroke: Stroke };
