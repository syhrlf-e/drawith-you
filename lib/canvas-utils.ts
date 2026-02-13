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

export const floodFill = (
  ctx: CanvasRenderingContext2D,
  startX: number,
  startY: number,
  fillColor: string,
) => {
  const canvas = ctx.canvas;
  const width = canvas.width;
  const height = canvas.height;
  const imageData = ctx.getImageData(0, 0, width, height);
  const data = imageData.data;

  const getPixelIndex = (x: number, y: number) =>
    (Math.floor(y) * width + Math.floor(x)) * 4;

  const startIndex = getPixelIndex(startX, startY);
  const targetR = data[startIndex];
  const targetG = data[startIndex + 1];
  const targetB = data[startIndex + 2];
  const targetA = data[startIndex + 3];

  const tempCanvas = document.createElement("canvas");
  tempCanvas.width = 1;
  tempCanvas.height = 1;
  const tempCtx = tempCanvas.getContext("2d");
  if (!tempCtx) return;
  tempCtx.fillStyle = fillColor;
  tempCtx.fillRect(0, 0, 1, 1);
  const fillData = tempCtx.getImageData(0, 0, 1, 1).data;
  const [fillR, fillG, fillB, fillA] = fillData;

  if (
    targetR === fillR &&
    targetG === fillG &&
    targetB === fillB &&
    targetA === fillA
  ) {
    return;
  }

  const stack = [[Math.floor(startX), Math.floor(startY)]];
  const seen = new Set<string>();

  while (stack.length > 0) {
    const [x, y] = stack.pop()!;
    const key = `${x},${y}`;
    if (seen.has(key)) continue;

    if (x < 0 || x >= width || y < 0 || y >= height) continue;

    const idx = getPixelIndex(x, y);
    if (matchColor(data, idx, targetR, targetG, targetB, targetA)) {
      data[idx] = fillR;
      data[idx + 1] = fillG;
      data[idx + 2] = fillB;
      data[idx + 3] = fillA;
      seen.add(key);

      stack.push([x + 1, y]);
      stack.push([x - 1, y]);
      stack.push([x, y + 1]);
      stack.push([x, y - 1]);
    }
  }

  ctx.putImageData(imageData, 0, 0);
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
