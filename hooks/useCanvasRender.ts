import { useCallback, useEffect, useRef } from "react";
import { Point, Stroke, Tool, UserPresence } from "@/lib/types";
import { drawSmoothLine, floodFill } from "@/lib/canvas-utils";

interface UseCanvasRenderProps {
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  overlayRef: React.RefObject<HTMLCanvasElement | null>;
  containerRef: React.RefObject<HTMLDivElement | null>;
  strokes: Stroke[];
  others: UserPresence[];
  tool: Tool;
  selectedStrokeId: string | null;
  editingStrokeId: string | null;
  currentPoints: Point[];
  currentPointsRef: React.MutableRefObject<Point[]>; // Added Ref
  color: string;
  size: number;
  feather?: number;
  cursorPos?: { x: number; y: number } | null;
}

export const useCanvasRender = ({
  canvasRef,
  overlayRef,
  containerRef,
  strokes,
  others,
  tool,
  selectedStrokeId,
  editingStrokeId,
  currentPoints,
  currentPointsRef, // Destructure Ref
  color,
  size,
  feather = 0,
  cursorPos,
}: UseCanvasRenderProps) => {
  // Refs to track current values for overlay rendering (avoid stale closure)
  const toolRef = useRef(tool);
  const colorRef = useRef(color);
  const sizeRef = useRef(size);
  const featherRef = useRef(feather);
  const cursorPosRef = useRef(cursorPos);
  const othersRef = useRef(others);

  // Sync props to refs
  useEffect(() => {
    toolRef.current = tool;
    colorRef.current = color;
    sizeRef.current = size;
    featherRef.current = feather;
    cursorPosRef.current = cursorPos;
    othersRef.current = others;
  }, [tool, color, size, feather, cursorPos, others]);

  // --- LAYER 1: Main Canvas (Committed Strokes) ---
  // Only redraws when history changes (undo/redo/new stroke/load)
  const drawMain = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return;

    // Handle Resize / DPI
    // We rely on the container resizing to trigger this, but we should match dims
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();

    // Check if we need to resize (fuzzy match to avoid subpixel loop)
    if (
      Math.abs(canvas.width - rect.width * dpr) > 1 ||
      Math.abs(canvas.height - rect.height * dpr) > 1
    ) {
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
    }

    // Always reset transform to ensure clean state, then scale
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(dpr, dpr);

    ctx.clearRect(0, 0, rect.width, rect.height);

    // Background
    let bgColor = "#FFFFFF";
    for (let i = strokes.length - 1; i >= 0; i--) {
      if (strokes[i].tool === "background") {
        bgColor = strokes[i].color;
        break;
      }
    }
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, rect.width, rect.height);

    // Draw Committed Strokes
    strokes.forEach((stroke) => {
      if (stroke.tool === "background") return;
      if (stroke.id === editingStrokeId) return;

      // Selection Glow
      if (
        stroke.id === selectedStrokeId &&
        (tool === "select" || tool === "text")
      ) {
        ctx.save();
        ctx.shadowBlur = 10;
        ctx.shadowColor = "#FF1493";
      }

      if (stroke.tool === "fill") {
        const p = stroke.points[0];
        // Fix: floodFill uses getImageData which ignores scale, so we must pass physical coordinates
        if (p) floodFill(ctx, p.x * dpr, p.y * dpr, stroke.color);
      } else if (stroke.tool === "text") {
        const p = stroke.points[0];
        if (p && stroke.text) {
          const fontSize = stroke.size * 3;
          ctx.font = `${fontSize}px Satoshi, sans-serif`;
          ctx.fillStyle = stroke.color;
          ctx.fillText(stroke.text, p.x, p.y);
        }
      } else {
        drawSmoothLine(
          ctx,
          stroke.points,
          stroke.color,
          stroke.id === selectedStrokeId && tool === "select"
            ? stroke.size + 2
            : stroke.size,
          stroke.tool === "eraser",
          stroke.feather || 0,
          "MAIN_COMMITTED_STROKE",
        );
      }

      if (
        stroke.id === selectedStrokeId &&
        (tool === "select" || tool === "text")
      ) {
        ctx.restore();
      }
    });
  }, [canvasRef, strokes, editingStrokeId, selectedStrokeId, tool]);

  // --- LAYER 2: Overlay Canvas (Cursors, Ghosts, Active Stroke) ---
  // High frequency updates
  const drawOverlay = useCallback(() => {
    const overlay = overlayRef.current;
    if (!overlay) return;
    const ctx = overlay.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = overlay.getBoundingClientRect();

    if (
      Math.abs(overlay.width - rect.width * dpr) > 1 ||
      Math.abs(overlay.height - rect.height * dpr) > 1
    ) {
      overlay.width = rect.width * dpr;
      overlay.height = rect.height * dpr;
    }

    // Always reset transform to ensure clean state, then scale
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(dpr, dpr);

    ctx.clearRect(0, 0, rect.width, rect.height);

    // Read current values from refs
    const currentTool = toolRef.current;
    const currentColor = colorRef.current;
    const currentSize = sizeRef.current;
    const currentFeather = featherRef.current;
    const currentCursorPos = cursorPosRef.current;
    const currentOthers = othersRef.current;

    // 1. Ghost Strokes (Peers)
    currentOthers.forEach((user) => {
      if (user.currentStroke) {
        const s = user.currentStroke;
        if (s.tool === "pen" || s.tool === "eraser") {
          ctx.globalAlpha = 0.5;
          drawSmoothLine(
            ctx,
            s.points,
            s.color,
            s.size,
            s.tool === "eraser",
            s.feather || 0,
            "GHOST_PEER_STROKE",
          );
          ctx.globalAlpha = 1.0;
        }
      }
    });

    // 2. Current Active Stroke
    const activePoints = currentPointsRef.current;

    if (activePoints.length > 0) {
      if (currentTool === "pen") {
        drawSmoothLine(
          ctx,
          activePoints,
          currentColor,
          currentSize,
          false,
          currentFeather,
          "OVERLAY_ACTIVE_STROKE",
        );
      } else if (currentTool === "eraser") {
        // Eraser preview: show white/red semi-transparent stroke to indicate what will be erased
        ctx.save();
        ctx.strokeStyle = "rgba(255, 0, 0, 0.3)"; // Red semi-transparent
        ctx.lineWidth = currentSize;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";

        ctx.beginPath();
        ctx.moveTo(activePoints[0].x, activePoints[0].y);

        for (let i = 1; i < activePoints.length - 1; i++) {
          const xc = (activePoints[i].x + activePoints[i + 1].x) / 2;
          const yc = (activePoints[i].y + activePoints[i + 1].y) / 2;
          ctx.quadraticCurveTo(activePoints[i].x, activePoints[i].y, xc, yc);
        }

        if (activePoints.length > 1) {
          const last = activePoints[activePoints.length - 1];
          const secondLast = activePoints[activePoints.length - 2];
          ctx.quadraticCurveTo(secondLast.x, secondLast.y, last.x, last.y);
        }

        ctx.stroke();
        ctx.restore();
      }
    }

    // 3. Previews & Cursors

    // Eraser Preview
    if (currentTool === "eraser" && currentCursorPos) {
      ctx.save();
      ctx.beginPath();
      ctx.arc(
        currentCursorPos.x,
        currentCursorPos.y,
        currentSize / 2,
        0,
        Math.PI * 2,
      );
      ctx.strokeStyle = "rgba(0, 0, 0, 0.3)";
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.fillStyle = "rgba(255, 255, 255, 0.1)";
      ctx.fill();
      ctx.restore();
    }

    // Pen Preview
    if (currentTool === "pen" && currentCursorPos) {
      ctx.save();
      ctx.beginPath();
      ctx.arc(
        currentCursorPos.x,
        currentCursorPos.y,
        currentSize / 2,
        0,
        Math.PI * 2,
      );
      if (currentFeather > 0) {
        ctx.shadowBlur = currentFeather;
        ctx.shadowColor = currentColor;
      }
      ctx.fillStyle = currentColor;
      ctx.globalAlpha = 0.5;
      ctx.fill();
      ctx.strokeStyle = "rgba(255, 255, 255, 0.5)";
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.restore();
    }

    // Peer Cursors
    others.forEach((user) => {
      if (user.cursor) {
        // ... (Keep existing peer cursor logic)
        const { x, y } = user.cursor;
        const userColor = user.color || "#FF1493";

        ctx.save();
        ctx.translate(x, y);

        const cursorPath = new Path2D(
          "M4.037 4.688a.495.495 0 0 1 .651-.651l16 6.5a.5.5 0 0 1-.063.947l-6.124 1.58a2 2 0 0 0-1.438 1.435l-1.579 6.126a.5.5 0 0 1-.947.063z",
        );

        ctx.fillStyle = userColor;
        ctx.fill(cursorPath);
        ctx.strokeStyle = "white";
        ctx.lineWidth = 1;
        ctx.stroke(cursorPath);

        const name = user.name || "Anonymous";
        ctx.font = "bold 12px Satoshi, sans-serif";
        const metrics = ctx.measureText(name);
        const paddingX = 10;
        const boxHeight = 24;
        const boxWidth = metrics.width + paddingX * 2;
        const labelX = 16;
        const labelY = 16;

        let r = 0,
          g = 0,
          b = 0;
        if (userColor.startsWith("#")) {
          r = parseInt(userColor.slice(1, 3), 16);
          g = parseInt(userColor.slice(3, 5), 16);
          b = parseInt(userColor.slice(5, 7), 16);
        }
        const bgColor = `rgba(${r}, ${g}, ${b}, 0.5)`;

        ctx.fillStyle = bgColor;
        ctx.beginPath();
        ctx.roundRect(labelX, labelY, boxWidth, boxHeight, 6);
        ctx.fill();

        ctx.strokeStyle = userColor;
        ctx.lineWidth = 1.5;
        ctx.stroke();

        ctx.fillStyle = userColor;
        ctx.textBaseline = "middle";
        ctx.fillText(name, labelX + paddingX, labelY + boxHeight / 2);

        ctx.restore();
      }
    });
  }, [
    overlayRef,
    others,
    currentPointsRef,
    tool,
    color,
    size,
    feather,
    cursorPos,
  ]);

  // Main Draw Effect (Strokes changed)
  useEffect(() => {
    drawMain();
  }, [drawMain]);

  // Overlay Draw Effect (Cursor/Interaction)
  useEffect(() => {
    let animId: number;
    const renderLoop = () => {
      drawOverlay();
      animId = requestAnimationFrame(renderLoop);
    };
    renderLoop();
    return () => cancelAnimationFrame(animId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Empty deps - render loop should run once and never restart

  // Handle Resize
  const handleResize = useCallback(() => {
    // Force both to resize logic (handled inside drawMain/drawOverlay checks)
    drawMain();
    drawOverlay();
  }, [drawMain, drawOverlay]);

  useEffect(() => {
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [handleResize]);

  return { redraw: drawMain };
};
