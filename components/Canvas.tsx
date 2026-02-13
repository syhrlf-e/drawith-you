"use client";

import {
  useEffect,
  useRef,
  useState,
  useImperativeHandle,
  forwardRef,
  useCallback,
} from "react";
import { Point, Stroke, Tool, UserPresence, HistoryAction } from "@/lib/types";
import { getCoordinates, isPointNearStroke } from "@/lib/canvas-utils";
import { useCanvasDrawing } from "@/hooks/useCanvasDrawing";
import { useCanvasRender } from "@/hooks/useCanvasRender";
import { TOOLS, DEFAULT_COLORS } from "@/lib/constants";

export interface CanvasHandle {
  clearCanvas: () => void;
  saveImage: () => void;
  setBackgroundColor: (color: string) => void;
}

interface CanvasProps {
  roomId: string;
  tool: Tool;
  color: string;
  size: number;
  feather?: number;
  initialStrokes?: Stroke[];
  onStrokeComplete: (stroke: Stroke) => void;
  onStrokeUpdate?: (strokeId: string, updates: Partial<Stroke>) => void;
  onClear?: () => void;
  selectedStrokeId?: string | null;
  onSelectStroke?: (strokeId: string | null) => void;
  others?: UserPresence[];
  onCursorUpdate?: (x: number, y: number) => void;
  onStrokeInProgress?: (stroke: Stroke | null) => void;
  onHistoryAction?: (action: HistoryAction) => void; // New Prop
}

const Canvas = forwardRef<CanvasHandle, CanvasProps>(
  (
    {
      roomId,
      tool,
      color,
      size,
      feather = 0,
      initialStrokes = [],
      onStrokeComplete,
      onStrokeUpdate,
      onClear,
      selectedStrokeId = null,
      onSelectStroke,
      others = [],
      onCursorUpdate,
      onStrokeInProgress,
      onHistoryAction,
    },
    ref,
  ) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const overlayRef = useRef<HTMLCanvasElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLDivElement>(null);

    // Component instance tracking removed for performance

    // -- Refs --
    const [strokes, setStrokes] = useState<Stroke[]>(initialStrokes);

    // Sync props to local state
    useEffect(() => {
      setStrokes(initialStrokes);
    }, [initialStrokes]);

    // -- Text Tool State (Kept local as it involves DOM overlay) --
    const [isTyping, setIsTyping] = useState(false);
    const [textInput, setTextInput] = useState({ x: 0, y: 0, value: "" });
    const [editingStrokeId, setEditingStrokeId] = useState<string | null>(null);

    // -- Helper: Hit Test --
    const hitTestStroke = useCallback(
      (x: number, y: number): string | null => {
        // Hit Test Logic
        const hitTest = (x: number, y: number): string | null => {
          // Need context for text measurement
          const ctx = canvasRef.current?.getContext("2d");

          // Iterate in reverse to find top-most stroke
          for (let i = strokes.length - 1; i >= 0; i--) {
            const s = strokes[i];
            if (s.tool === TOOLS.BACKGROUND) continue;
            if (s.tool === TOOLS.ERASER) continue; // Erasers themselves are not selectable

            // Check if point hits this stroke
            let isHit = false;
            if (s.tool === TOOLS.TEXT && s.text && s.points[0] && ctx) {
              const fontSize = s.size * 3;
              ctx.font = `${fontSize}px Satoshi, sans-serif`;
              const metrics = ctx.measureText(s.text);
              const p = s.points[0];
              if (
                x >= p.x &&
                x <= p.x + metrics.width &&
                y >= p.y - fontSize &&
                y <= p.y + 10
              ) {
                isHit = true;
              }
            } else if (s.tool === TOOLS.PEN || s.tool === TOOLS.FILL) {
              // Fill is basically a shape or point, treat as stroke for now or usually fillers are unselectable?
              // Checking 'fill' might be complex if it's flood fill, but if it has points array, user might select it?
              // Assuming fill is selectable for now if it has points.
              if (isPointNearStroke(x, y, s.points, Math.max(s.size * 2, 10))) {
                // Added s.points and size for isPointNearStroke
                isHit = true;
              }
            }

            if (isHit) {
              return s.id;
            }
          }
          return null;
        };
        return hitTest(x, y); // Call the inner hitTest function
      },
      [strokes],
    );

    const [cursorPos, setCursorPos] = useState<{ x: number; y: number } | null>(
      null,
    );

    // -- Hooks --
    const {
      isDrawing,
      isDraggingStroke,
      isScaling,
      currentPoints,
      currentPointsRef, // Get Ref
      startDrawing: hookStartDrawing,
      drawMove,
      stopDrawing,
    } = useCanvasDrawing({
      canvasRef,
      tool,
      color,
      size,
      feather,
      strokes,
      setStrokes,
      onStrokeComplete: (newStroke) => {
        // Optimistically update local state to prevent "flash" (glitch)
        // between dropping currentPoints and receiving new strokes from parent
        setStrokes((prev) => [...prev, newStroke]);
        onStrokeComplete(newStroke);
      },
      onStrokeUpdate,
      onSelectStroke,
      selectedStrokeId,
      onCursorUpdate: (x, y) => {
        setCursorPos({ x, y });
        if (onCursorUpdate) onCursorUpdate(x, y);
      },
      onStrokeInProgress,
      onHistoryAction, // Pass it down
    });

    const { redraw } = useCanvasRender({
      canvasRef,
      overlayRef,
      containerRef,
      strokes,
      others,
      tool,
      selectedStrokeId,
      editingStrokeId,
      currentPoints: currentPoints,
      currentPointsRef,
      color,
      size,
      feather,
      cursorPos,
      isTransforming: isDraggingStroke || isScaling,
    });

    // Helper to get current background color
    const getCurrentBackgroundColor = () => {
      for (let i = strokes.length - 1; i >= 0; i--) {
        if (strokes[i].tool === TOOLS.BACKGROUND) {
          return strokes[i].color;
        }
      }
      return DEFAULT_COLORS.WHITE;
    };

    // Component initialization complete

    // CRITICAL: Manually set overlay canvas dimensions to match container
    useEffect(() => {
      const updateCanvasSizes = () => {
        if (!containerRef.current || !overlayRef.current || !canvasRef.current)
          return;

        const rect = containerRef.current.getBoundingClientRect();

        // Set CSS size to match container
        overlayRef.current.style.width = `${rect.width}px`;
        overlayRef.current.style.height = `${rect.height}px`;
        canvasRef.current.style.width = `${rect.width}px`;
        canvasRef.current.style.height = `${rect.height}px`;
      };

      updateCanvasSizes();
      window.addEventListener("resize", updateCanvasSizes);
      return () => window.removeEventListener("resize", updateCanvasSizes);
    }, []);

    // -- Imperative Handle --
    useImperativeHandle(ref, () => ({
      clearCanvas: () => {
        setStrokes([]);
        if (onClear) onClear();
      },
      saveImage: () => {
        const canvas = canvasRef.current;
        const overlay = overlayRef.current;
        if (!canvas || !overlay) return;

        if (!canvas) return;

        // Create a temporary canvas to composite background + drawing
        const tempCanvas = document.createElement("canvas");
        tempCanvas.width = canvas.width;
        tempCanvas.height = canvas.height;
        const ctx = tempCanvas.getContext("2d");
        if (!ctx) return;

        // 1. Draw Background Color
        // Find latest background stroke or default to white.
        // Actually, we pass 'backgroundColor' prop to Canvas, let's use that if possible.
        // But we don't have it in this scope easily without prop drilling or searching strokes.
        // Let's search strokes as before since that's the source of truth for "saved" background,
        // OR rely on the parent state passed down.
        // Better: Search strokes like before to be safe.
        let bgColor: string = DEFAULT_COLORS.WHITE;
        for (let i = strokes.length - 1; i >= 0; i--) {
          if (strokes[i].tool === TOOLS.BACKGROUND) {
            bgColor = strokes[i].color;
            break;
          }
        }

        ctx.fillStyle = bgColor;
        ctx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);

        // 2. Draw the main canvas (transparent strokes) on top
        ctx.drawImage(canvas, 0, 0);

        const link = document.createElement("a");
        link.download = `drawith-${Date.now()}.png`;
        link.href = tempCanvas.toDataURL();
        link.click();
      },
      setBackgroundColor: () => {}, // Deprecated
    }));

    // -- Event Wrappers --
    const handleMouseDown = (e: React.MouseEvent | React.TouchEvent) => {
      // Special case: Text tool click existing text or new spot
      // We override the hook's startDrawing for text tool specific formatting
      if (tool === TOOLS.TEXT) {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const point = getCoordinates(e, canvas);
        if (!point) return;

        const hitId = hitTestStroke(point.x, point.y);

        if (hitId) {
          if (onSelectStroke) onSelectStroke(hitId);
        } else {
          if (onSelectStroke) onSelectStroke(null);
        }

        if (hitId && !isTyping) {
          const s = strokes.find((st) => st.id === hitId);
          if (s && s.tool === TOOLS.TEXT) {
            setIsTyping(true);
            setTextInput({
              x: s.points[0].x,
              y: s.points[0].y,
              value: s.text || "",
            });
            setEditingStrokeId(hitId);
            requestAnimationFrame(() => {
              if (inputRef.current) {
                inputRef.current.innerText = s.text || "";
                inputRef.current.focus();
                const range = document.createRange();
                const sel = window.getSelection();
                range.selectNodeContents(inputRef.current);
                range.collapse(false);
                sel?.removeAllRanges();
                sel?.addRange(range);
              }
            });
            return;
          }
        }

        if (!isTyping) {
          setIsTyping(true);
          setEditingStrokeId(null);
          setTextInput({ x: point.x, y: point.y, value: "" });
          requestAnimationFrame(() => {
            if (inputRef.current) {
              inputRef.current.innerText = "";
              inputRef.current.focus();
            }
          });
        }
        return;
      }

      hookStartDrawing(e, hitTestStroke);
    };

    const commitText = () => {
      if (!inputRef.current) return;
      const text = inputRef.current.innerText;

      if (text.trim()) {
        if (editingStrokeId) {
          if (onStrokeUpdate) onStrokeUpdate(editingStrokeId, { text: text });
          setStrokes((prev) =>
            prev.map((s) =>
              s.id === editingStrokeId ? { ...s, text: text } : s,
            ),
          );
        } else {
          const newStroke: Stroke = {
            id: Date.now().toString(),
            tool: TOOLS.TEXT,
            color: color,
            size: size,
            points: [{ x: textInput.x, y: textInput.y }],
            text: text,
            timestamp: Date.now(),
            isComplete: true,
          };
          onStrokeComplete(newStroke);
        }
      }
      setIsTyping(false);
      setEditingStrokeId(null);
      setTextInput({ ...textInput, value: "" });
    };

    // -- Cursor Logic --
    const getCursorStyle = () => {
      switch (tool) {
        case TOOLS.PEN:
          return "url('https://api.iconify.design/lucide:pencil.svg?color=%23000000&width=24&height=24') 0 24, auto";
        case TOOLS.ERASER:
          return "none"; // Hide cursor, we draw a custom circle
        case TOOLS.TEXT:
          return "text";
        case TOOLS.FILL:
          return "url('https://api.iconify.design/lucide:paint-bucket.svg?color=%23000000&width=24&height=24') 12 12, auto";
        case TOOLS.SELECT:
          return "default";
        default:
          return "crosshair";
      }
    };

    return (
      <div
        ref={containerRef}
        className="relative w-full h-[80vh] bg-white rounded-[20px] shadow-lg overflow-hidden touch-none"
        style={{ cursor: getCursorStyle() }}
      >
        {/* Main Canvas - Committed Strokes */}
        <canvas
          ref={canvasRef}
          className="absolute inset-0 block z-10"
          style={{ backgroundColor: getCurrentBackgroundColor() }} // Add helper to get bg color
        />
        {/* Overlay Canvas - NOW HANDLES EVENTS */}
        <canvas
          ref={overlayRef}
          className="absolute inset-0 block z-20"
          style={{
            display: "block",
            touchAction: "none",
            pointerEvents: "auto",
          }}
          onMouseDown={handleMouseDown}
          onMouseMove={drawMove}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
          onTouchStart={handleMouseDown}
          onTouchMove={drawMove}
          onTouchEnd={stopDrawing}
        />

        {isTyping && (
          <div
            ref={inputRef}
            contentEditable
            suppressContentEditableWarning={true}
            spellCheck={false}
            autoCorrect="off"
            autoCapitalize="off"
            data-gramm="false"
            data-enable-grammarly="false" // Disable Grammarly
            onBlur={commitText}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                inputRef.current?.blur();
              }
              e.stopPropagation();
            }}
            style={{
              position: "absolute",
              left: textInput.x,
              top: textInput.y - size * 3,
              fontSize: `${size * 3}px`,
              color: color,
              fontFamily: "Satoshi, sans-serif",
              background: "transparent",
              border: "2px dashed #FF1493",
              outline: "none",
              padding: "0 4px",
              margin: 0,
              minWidth: "1em",
              maxWidth: "90%",
              height: "auto",
              zIndex: 50,
              lineHeight: 1,
              whiteSpace: "pre",
              display: "inline-block",
            }}
            className="z-50 empty:before:content-['Type...'] empty:before:text-gray-400 empty:before:opacity-50"
          />
        )}
      </div>
    );
  },
);

Canvas.displayName = "Canvas";

export default Canvas;
