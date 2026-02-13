import { useState, useRef, useCallback, useEffect } from "react";
import { Point, Stroke, Tool, HistoryAction } from "@/lib/types";
import { getCoordinates, throttle } from "@/lib/canvas-utils";

interface UseCanvasDrawingProps {
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  tool: Tool;
  color: string;
  size: number;
  feather?: number;
  strokes: Stroke[];
  setStrokes: React.Dispatch<React.SetStateAction<Stroke[]>>;
  onStrokeComplete: (stroke: Stroke) => void;
  onStrokeUpdate?: (strokeId: string, updates: Partial<Stroke>) => void;
  onSelectStroke?: (strokeId: string | null) => void;
  selectedStrokeId?: string | null;
  onCursorUpdate?: (x: number, y: number) => void;
  onStrokeInProgress?: (stroke: Stroke | null) => void;
  onHistoryAction?: (action: HistoryAction) => void; // New Prop
}

export const useCanvasDrawing = ({
  canvasRef,
  tool,
  color,
  size,
  feather = 0,
  strokes,
  setStrokes,
  onStrokeComplete,
  onStrokeUpdate,
  onSelectStroke,
  selectedStrokeId,
  onCursorUpdate,
  onStrokeInProgress,
  onHistoryAction,
}: UseCanvasDrawingProps) => {
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentPoints, setCurrentPoints] = useState<Point[]>([]);

  // Refs for hot paths
  const toolRef = useRef(tool);
  const colorRef = useRef(color);
  const sizeRef = useRef(size);
  const featherRef = useRef(feather);
  const isDrawingRef = useRef(isDrawing);
  const currentPointsRef = useRef<Point[]>([]); // ← FIX: Initialize with empty array, NOT state!
  const strokesRef = useRef(strokes);

  useEffect(() => {
    toolRef.current = tool;
  }, [tool]);
  useEffect(() => {
    colorRef.current = color;
  }, [color]);
  useEffect(() => {
    sizeRef.current = size;
  }, [size]);
  useEffect(() => {
    featherRef.current = feather;
  }, [feather]);
  useEffect(() => {
    isDrawingRef.current = isDrawing;
  }, [isDrawing]);
  // Removed useEffect syncing currentPoints -> Ref because we now sync Ref -> State (or update Ref directly)
  // to avoid lag.
  /* 
  useEffect(() => {
    currentPointsRef.current = currentPoints;
  }, [currentPoints]);
  */
  useEffect(() => {
    strokesRef.current = strokes;
  }, [strokes]);

  // -- Select/Move Tool State --
  const [isDraggingStroke, setIsDraggingStroke] = useState(false);
  const isDraggingStrokeRef = useRef(isDraggingStroke);
  const originalStrokeRef = useRef<Stroke | null>(null); // Track original state for Undo

  useEffect(() => {
    isDraggingStrokeRef.current = isDraggingStroke;
  }, [isDraggingStroke]);

  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const dragOffsetRef = useRef(dragOffset);
  useEffect(() => {
    dragOffsetRef.current = dragOffset;
  }, [dragOffset]);

  // Firebase sync throttle (keep this for network)
  const throttledFirebaseSyncRef = useRef(
    throttle((strokeId: string, newPoints: Point[]) => {
      if (onStrokeUpdate) {
        onStrokeUpdate(strokeId, { points: newPoints });
      }
    }, 100),
  );

  const startDrawing = useCallback(
    (
      e: React.MouseEvent | React.TouchEvent,
      hitTest: (x: number, y: number) => string | null,
    ) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const point = getCoordinates(e, canvas);
      if (!point) return;

      const currentTool = toolRef.current;
      if (!currentTool) return;

      if (currentTool === "select") {
        const hitId = hitTest(point.x, point.y);
        if (hitId) {
          if (onSelectStroke) onSelectStroke(hitId);
          setIsDraggingStroke(true); // Triggers re-render to set cursor style

          const s = strokesRef.current.find((st) => st.id === hitId);
          if (s && s.points[0]) {
            originalStrokeRef.current = parseStroke(s); // Deep copy original state
            setDragOffset({
              x: point.x - s.points[0].x,
              y: point.y - s.points[0].y,
            });
          }
        } else {
          if (onSelectStroke) onSelectStroke(null);
        }
        return;
      }

      if (currentTool === "text") {
        const hitId = hitTest(point.x, point.y);
        if (hitId && onSelectStroke) onSelectStroke(hitId);
        else if (onSelectStroke) onSelectStroke(null);
        return;
      }

      if (currentTool === "fill") {
        // Optimistic UI: Use setTimeout to allow render cycle (cursor update/loading state)
        // to happen BEFORE the heavy floodFill calculation blocks the thread.
        // We can also trigger a "processing" cursor here if we had one.
        document.body.style.cursor = "wait";

        setTimeout(() => {
          const newStroke: Stroke = {
            id: Date.now().toString(),
            tool: "fill",
            color: colorRef.current,
            size: 0,
            points: [point],
            timestamp: Date.now(),
            isComplete: true,
          };

          // This will trigger the calculation (sync)
          onStrokeComplete(newStroke);

          // Clear Ref just in case
          currentPointsRef.current = [];

          // Restore cursor
          document.body.style.cursor = "";
        }, 10);

        return;
      }

      setIsDrawing(true);
      // Init Ref directly
      currentPointsRef.current = [point];
      setCurrentPoints([point]);
    },
    [canvasRef, onSelectStroke, onStrokeComplete],
  );

  const drawMove = useCallback(
    (e: React.MouseEvent | React.TouchEvent) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const point = getCoordinates(e, canvas);
      if (!point) return;

      if (onCursorUpdate) onCursorUpdate(point.x, point.y);

      const tool = toolRef.current;
      const isDragging = isDraggingStrokeRef.current;

      if (tool === "select" && isDragging && selectedStrokeId) {
        const s = strokesRef.current.find((st) => st.id === selectedStrokeId);
        if (!s) return;

        const offset = dragOffsetRef.current;
        const newRefX = point.x - offset.x;
        const newRefY = point.y - offset.y;
        const dx = newRefX - s.points[0].x;
        const dy = newRefY - s.points[0].y;

        if (dx === 0 && dy === 0) return;

        const newPoints = s.points.map((p) => ({ x: p.x + dx, y: p.y + dy }));

        // CRITICAL OPTIMIZATION:
        // Do NOT set state here. Modifying state triggers React render cycle -> Diffing -> Commit.
        // Instead, we mutate the strokesRef.current temporarily for visual feedback if we had a loop,
        // OR we just directly call setStrokes but purely without any other overhead.
        // But wait, setStrokes IS state update.
        // To truly fix "lag", we should use requestAnimationFrame to batch these.

        // Let's try direct state update but WITHOUT the throttle overhead first if 60fps is the goal
        // The previous implementation used `throttle(..., 16)`. React 18+ automatic batching might be fighting with throttle.
        // Let's try setting state DIRECTLY (it is async) but let React handle the batching.

        setStrokes((prev) =>
          prev.map((st) =>
            st.id === selectedStrokeId ? { ...st, points: newPoints } : st,
          ),
        );

        // Sync to network (throttled)
        throttledFirebaseSyncRef.current(selectedStrokeId, newPoints);
        return;
      }

      if (!isDrawingRef.current) return;
      if (tool !== "pen" && tool !== "eraser") return;

      // Mutate Ref DIRECTLY for zero latency
      currentPointsRef.current.push(point);

      // Update state to trigger re-renders if needed (debounced? or just for final commit?)
      // For now, keep it to ensure other components relying on state know about it?
      // Actually, since we render via Ref in Overlay, we don't strictly *need* state update for drawing.
      // But we might want it for "onStrokeInProgress" or debugging.
      // Let's keep setCurrentPoints but rely on Ref for the loop.
      setCurrentPoints([...currentPointsRef.current]);

      if (onStrokeInProgress) {
        onStrokeInProgress({
          id: "temp",
          tool: tool,
          color: colorRef.current,
          size: sizeRef.current,
          feather: featherRef.current,
          points: currentPointsRef.current, // Use Ref
          timestamp: Date.now(),
        });
      }
    },
    [
      canvasRef,
      selectedStrokeId,
      onCursorUpdate,
      onStrokeInProgress,
      setStrokes,
    ],
  );

  const stopDrawing = useCallback(() => {
    if (onStrokeInProgress) onStrokeInProgress(null);

    // If dragging, just stop the flag. State is already updated live.
    if (toolRef.current === "select" && isDraggingStrokeRef.current) {
      if (selectedStrokeId && originalStrokeRef.current && onHistoryAction) {
        // Find the final state of the stroke
        const finalStroke = strokesRef.current.find(
          (s) => s.id === selectedStrokeId,
        );

        const originalStroke = originalStrokeRef.current;

        // Check if actually changed
        if (
          finalStroke &&
          originalStroke &&
          (finalStroke.points[0].x !== originalStroke.points[0].x ||
            finalStroke.points[0].y !== originalStroke.points[0].y)
        ) {
          onHistoryAction({
            type: "UPDATE",
            original: originalStroke,
            new: finalStroke,
          });
        }
      }

      setIsDraggingStroke(false);
      originalStrokeRef.current = null;
      return;
    }

    if (!isDrawingRef.current) return;
    setIsDrawing(false);

    if (currentPointsRef.current.length > 0) {
      const newStroke: Stroke = {
        id: Date.now().toString(),
        tool: toolRef.current,
        color: colorRef.current,
        size: sizeRef.current,
        feather: featherRef.current,
        points: currentPointsRef.current,
        timestamp: Date.now(),
        isComplete: true,
      };
      onStrokeComplete(newStroke);
    }
    // Clear Ref explicitly to prevent stale points
    currentPointsRef.current = [];
    setCurrentPoints([]);
  }, [onStrokeInProgress, onStrokeComplete, selectedStrokeId, onHistoryAction]);

  return {
    isDrawing,
    currentPoints,
    currentPointsRef, // Export Ref
    startDrawing,
    drawMove,
    stopDrawing,
  };
};

// Helper for deep cloning stroke to avoid reference issues
function parseStroke(stroke: Stroke): Stroke {
  return JSON.parse(JSON.stringify(stroke));
}
