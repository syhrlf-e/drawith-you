import { Point } from "./types";

export const getCoordinates = (
  event: MouseEvent | TouchEvent | React.MouseEvent | React.TouchEvent,
  canvas: HTMLCanvasElement,
): Point | null => {
  const rect = canvas.getBoundingClientRect();
  let clientX, clientY;

  if ("touches" in event) {
    // Touch event
    if (event.touches.length > 0) {
      clientX = event.touches[0].clientX;
      clientY = event.touches[0].clientY;
    } else {
      return null;
    }
  } else {
    // Mouse event
    clientX = (event as React.MouseEvent).clientX;
    clientY = (event as React.MouseEvent).clientY;
  }

  return {
    x: clientX - rect.left,
    y: clientY - rect.top,
  };
};

export const drawSmoothLine = (
  ctx: CanvasRenderingContext2D,
  points: Point[],
  color: string,
  size: number,
  isEraser: boolean = false,
  feather: number = 0,
  source: string = "unknown", // Add source parameter
) => {
  if (points.length === 0) return;

  // Save context state
  ctx.save();

  if (isEraser) {
    ctx.globalCompositeOperation = "destination-out";
  } else {
    ctx.globalCompositeOperation = "source-over";
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    if (feather > 0) {
      ctx.shadowBlur = feather;
      ctx.shadowColor = color;
    }
  }

  ctx.lineWidth = size;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  // Handle single point (draw a dot)
  if (points.length === 1) {
    ctx.beginPath();
    ctx.arc(points[0].x, points[0].y, size / 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    return;
  }

  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);

  if (points.length === 2) {
    ctx.lineTo(points[1].x, points[1].y);
    ctx.stroke();
    ctx.restore();
    return;
  }

  // Smooth curves using quadratic bezier
  for (let i = 1; i < points.length - 2; i++) {
    const xc = (points[i].x + points[i + 1].x) / 2;
    const yc = (points[i].y + points[i + 1].y) / 2;
    ctx.quadraticCurveTo(points[i].x, points[i].y, xc, yc);
  }

  // Handle the last segment
  const i = points.length - 2;
  ctx.quadraticCurveTo(
    points[i].x,
    points[i].y,
    points[i + 1].x,
    points[i + 1].y,
  );

  ctx.stroke();
  ctx.restore();
};

// Refactored to return a separate canvas with the fill, allowing caching.
export const getFloodFillRegion = (
  ctx: CanvasRenderingContext2D,
  startX: number,
  startY: number,
  fillColor: string,
): HTMLCanvasElement | null => {
  const canvas = ctx.canvas;
  const width = canvas.width;
  const height = canvas.height;

  // Read current state
  const imageData = ctx.getImageData(0, 0, width, height);
  const data = imageData.data;

  // Math.floor coords once
  const sx = Math.floor(startX);
  const sy = Math.floor(startY);

  if (sx < 0 || sx >= width || sy < 0 || sy >= height) return null;

  const getPixelIndex = (x: number, y: number) => (y * width + x) * 4;

  const startIndex = getPixelIndex(sx, sy);
  const targetR = data[startIndex];
  const targetG = data[startIndex + 1];
  const targetB = data[startIndex + 2];
  const targetA = data[startIndex + 3];

  // Parse fill color
  const tempCanvas = document.createElement("canvas");
  tempCanvas.width = 1;
  tempCanvas.height = 1;
  const tempCtx = tempCanvas.getContext("2d");
  if (!tempCtx) return null;
  tempCtx.fillStyle = fillColor;
  tempCtx.fillRect(0, 0, 1, 1);
  const fillData = tempCtx.getImageData(0, 0, 1, 1).data;
  const [fillR, fillG, fillB, fillA] = fillData;

  // Early exit if color matches
  if (
    targetR === fillR &&
    targetG === fillG &&
    targetB === fillB &&
    targetA === fillA
  ) {
    return null;
  }

  // Create output buffer
  const outputCanvas = document.createElement("canvas");
  outputCanvas.width = width;
  outputCanvas.height = height;
  const outputCtx = outputCanvas.getContext("2d");
  if (!outputCtx) return null;

  const outputImageData = outputCtx.createImageData(width, height);
  const outputData = outputImageData.data;

  // Stack-based flood fill
  // Use a flat Uint8Array for 'seen' (0 or 1)
  const seen = new Uint8Array(width * height);
  const tolerance = 35; // Color tolerance

  // Use a simple array stack. Push x, then y.
  const stack: number[] = [sx, sy];

  // Boundary Leakage Check
  let hitBoundary = false;

  while (stack.length > 0) {
    const y = stack.pop()!;
    const x = stack.pop()!;

    const pixelIndex = y * width + x;
    if (seen[pixelIndex]) continue;

    // Strict Containment Rule: If we touch the absolute edge, we consider it a leak.
    if (x <= 0 || x >= width - 1 || y <= 0 || y >= height - 1) {
      hitBoundary = true;
      break;
    }

    // Color Match Check
    const dataIdx = pixelIndex * 4;
    const r = data[dataIdx];
    const g = data[dataIdx + 1];
    const b = data[dataIdx + 2];
    const a = data[dataIdx + 3];

    // Inline matchColor Logic
    if (
      Math.abs(r - targetR) <= tolerance &&
      Math.abs(g - targetG) <= tolerance &&
      Math.abs(b - targetB) <= tolerance &&
      Math.abs(a - targetA) <= tolerance
    ) {
      // Mark seen
      seen[pixelIndex] = 1;

      // Write to Output
      outputData[dataIdx] = fillR;
      outputData[dataIdx + 1] = fillG;
      outputData[dataIdx + 2] = fillB;
      outputData[dataIdx + 3] = fillA;

      // Push Neighbors (Check bounds here to save stack space)
      if (x + 1 < width) {
        stack.push(x + 1, y);
      }
      if (x - 1 >= 0) {
        stack.push(x - 1, y);
      }
      if (y + 1 < height) {
        stack.push(x, y + 1);
      }
      if (y - 1 >= 0) {
        stack.push(x, y - 1);
      }
    }
  }

  if (hitBoundary) {
    return null; // Cancel fill if it leaked
  }

  outputCtx.putImageData(outputImageData, 0, 0);
  return outputCanvas;
};

const matchColor = (
  data: Uint8ClampedArray,
  index: number,
  r: number,
  g: number,
  b: number,
  a: number,
) => {
  // Increased tolerance to handle anti-aliasing at stroke edges
  // This prevents white gaps when filling shapes drawn with pen tool
  const tolerance = 35;
  return (
    Math.abs(data[index] - r) <= tolerance &&
    Math.abs(data[index + 1] - g) <= tolerance &&
    Math.abs(data[index + 2] - b) <= tolerance &&
    Math.abs(data[index + 3] - a) <= tolerance
  );
};

// --- New Hit Detection Utils ---

export const getDistanceToLineSegment = (
  x: number,
  y: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
) => {
  const A = x - x1;
  const B = y - y1;
  const C = x2 - x1;
  const D = y2 - y1;

  const dot = A * C + B * D;
  const lenSq = C * C + D * D;
  let param = -1;
  if (lenSq !== 0) param = dot / lenSq;

  let xx, yy;

  if (param < 0) {
    xx = x1;
    yy = y1;
  } else if (param > 1) {
    xx = x2;
    yy = y2;
  } else {
    xx = x1 + param * C;
    yy = y1 + param * D;
  }

  const dx = x - xx;
  const dy = y - yy;
  return Math.sqrt(dx * dx + dy * dy);
};

export const isPointNearStroke = (
  x: number,
  y: number,
  points: Point[],
  threshold: number = 10,
): boolean => {
  if (points.length < 2) {
    // Single point logic (dot)
    if (points.length === 1) {
      const dx = x - points[0].x;
      const dy = y - points[0].y;
      return Math.sqrt(dx * dx + dy * dy) < threshold;
    }
    return false;
  }

  // Optimize: check bounding box first?
  // For now simple checks.
  for (let i = 0; i < points.length - 1; i++) {
    const p1 = points[i];
    const p2 = points[i + 1];
    const dist = getDistanceToLineSegment(x, y, p1.x, p1.y, p2.x, p2.y);
    if (dist < threshold) return true;
  }
  return false;
};

// --- Performance Utilities ---

/**
 * Debounce function - delays execution until after wait milliseconds have elapsed
 * since the last time it was invoked.
 */
export const debounce = <T extends (...args: any[]) => any>(
  func: T,
  wait: number,
): ((...args: Parameters<T>) => void) => {
  let timeout: NodeJS.Timeout | null = null;

  return function executedFunction(...args: Parameters<T>) {
    const later = () => {
      timeout = null;
      func(...args);
    };

    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
};

/**
 * Throttle function - ensures function is called at most once per limit milliseconds
 */
export const throttle = <T extends (...args: any[]) => any>(
  func: T,
  limit: number,
): ((...args: Parameters<T>) => void) => {
  let inThrottle: boolean = false;

  return function executedFunction(...args: Parameters<T>) {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
};

export const resamplePoints = (
  points: Point[],
  spacing: number = 5,
): Point[] => {
  if (points.length < 2) return points;

  const newPoints: Point[] = [points[0]];
  let prev = points[0];

  for (let i = 1; i < points.length; i++) {
    const curr = points[i];
    const dx = curr.x - prev.x;
    const dy = curr.y - prev.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist >= spacing) {
      const steps = Math.floor(dist / spacing);
      const stepX = dx / steps;
      const stepY = dy / steps;

      for (let j = 1; j < steps; j++) {
        newPoints.push({
          x: prev.x + stepX * j,
          y: prev.y + stepY * j,
        });
      }
    }

    newPoints.push(curr);
    prev = curr;
  }

  return newPoints;
};

// --- Bounding Box Optimization ---

interface BoundingBox {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export const getBoundingBox = (
  points: Point[],
  padding: number = 0,
): BoundingBox => {
  if (points.length === 0) {
    return { minX: 0, minY: 0, maxX: 0, maxY: 0 };
  }

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const p of points) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }

  return {
    minX: minX - padding,
    minY: minY - padding,
    maxX: maxX + padding,
    maxY: maxY + padding,
  };
};

export const doBoxesIntersect = (
  box1: BoundingBox,
  box2: BoundingBox,
): boolean => {
  return (
    box1.minX < box2.maxX &&
    box1.maxX > box2.minX &&
    box1.minY < box2.maxY &&
    box1.maxY > box2.minY
  );
};

export const splitStroke = (
  originalStroke: import("./types").Stroke,
  eraserPoints: Point[],
  eraserSize: number,
): import("./types").Stroke[] => {
  if (originalStroke.points.length === 0) return [originalStroke];
  if (eraserPoints.length === 0) return [originalStroke];

  // 1. OPTIMIZATION: Bounding Box Check
  // If the bounding boxes don't intersect, the eraser cannot possibly hit the stroke.
  // We add padding equal to half the size of the stroke/eraser to account for thickness.
  const strokeBox = getBoundingBox(
    originalStroke.points,
    originalStroke.size / 2,
  );
  const eraserBox = getBoundingBox(eraserPoints, eraserSize / 2);

  if (!doBoxesIntersect(strokeBox, eraserBox)) {
    return [originalStroke];
  }

  // 2. Resample points for fine-grained erasing
  // Use a spacing relative to eraser size, but capped at a minimum (e.g. 5px) for performance
  // High precision: finer spacing
  const spacing = Math.max(1, eraserSize / 4); // Increased precision from /8 to /4 for better results? No, /8 is finer.
  // Let's stick to /8 or somewhat fine. Original was /8.
  // Actually, let's keep it consistent.
  const sampleSpacing = Math.max(1, eraserSize / 8);
  const points = resamplePoints(originalStroke.points, sampleSpacing);

  if (points.length === 0) return [];

  const newStrokes: import("./types").Stroke[] = [];
  let currentSegment: Point[] = [];

  // Minimal length to consider a valid stroke
  // Changed to 1 to preserve small dots/fragments
  const MIN_POINTS = 1;

  for (let i = 0; i < points.length; i++) {
    const p = points[i];

    // Check if this point is hit by the eraser
    // Eraser "hit" means the point is covered by the eraser stroke
    const isErased = isPointNearStroke(p.x, p.y, eraserPoints, eraserSize / 2);

    if (isErased) {
      // If current segment has valid points, push it as a new stroke
      if (currentSegment.length >= MIN_POINTS) {
        newStrokes.push({
          ...originalStroke,
          id: crypto.randomUUID(), // New unique ID
          points: currentSegment,
          isComplete: true, // Fragments are always complete
        });
      }
      currentSegment = []; // Reset
    } else {
      currentSegment.push(p);
    }
  }

  // Push pending segment
  if (currentSegment.length >= MIN_POINTS) {
    newStrokes.push({
      ...originalStroke,
      id: crypto.randomUUID(),
      points: currentSegment,
      isComplete: true,
    });
  }

  return newStrokes;
};
