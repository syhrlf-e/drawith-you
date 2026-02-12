export type Tool = "pen" | "eraser" | "text" | "fill" | "select" | "background";

export interface Point {
  x: number;
  y: number;
}

export interface Stroke {
  id: string;
  tool: Tool;
  color: string;
  size: number;
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
