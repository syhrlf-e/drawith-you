"use client";

import {
  useEffect,
  useRef,
  useState,
  useCallback,
  useImperativeHandle,
  forwardRef,
} from "react";
import { Stroke, Point, Tool, UserPresence } from "@/lib/types";
import {
  drawSmoothLine,
  getCoordinates,
  floodFill,
  isPointNearStroke,
  throttle,
} from "@/lib/canvas-utils";

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
  initialStrokes?: Stroke[];
  onStrokeComplete: (stroke: Stroke) => void;
  onStrokeUpdate?: (strokeId: string, updates: Partial<Stroke>) => void;
  onClear?: () => void;
  selectedStrokeId?: string | null;
  onSelectStroke?: (strokeId: string | null) => void;
  // Presence
  others?: UserPresence[];
  onCursorUpdate?: (x: number, y: number) => void;
  onStrokeInProgress?: (stroke: Stroke | null) => void;
}

const Canvas = forwardRef<CanvasHandle, CanvasProps>(
  (
    {
      roomId,
      tool,
      color,
      size,
      initialStrokes = [],
      onStrokeComplete,
      onStrokeUpdate,
      onClear,
      selectedStrokeId = null,
      onSelectStroke,
      others = [],
      onCursorUpdate,
      onStrokeInProgress,
    },
    ref,
  ) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLDivElement>(null); // Changed to div for contentEditable

    const [isDrawing, setIsDrawing] = useState(false);
    const [currentPoints, setCurrentPoints] = useState<Point[]>([]);
    const [strokes, setStrokes] = useState<Stroke[]>(initialStrokes);
    // const [backgroundColor, setBackgroundColor] = useState("#FFFFFF"); // Deprecated, derived from strokes

    // -- Text Tool State --
    const [isTyping, setIsTyping] = useState(false);
    const [textInput, setTextInput] = useState({ x: 0, y: 0, value: "" });
    const [editingStrokeId, setEditingStrokeId] = useState<string | null>(null);

    // -- Select/Move Tool State --
    // const [selectedStrokeId, setSelectedStrokeId] = useState<string | null>(null); // Lifted to props
    const [isDraggingStroke, setIsDraggingStroke] = useState(false);
    const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

    // Throttled drag update refs to prevent excessive re-renders and Firebase spam
    // IMPORTANT: Pass strokeId as parameter to avoid stale closure

    // Local state update: 16ms throttle for smooth 60fps visual feedback
    const throttledDragUpdateRef = useRef(
      throttle((strokeId: string, newPoints: Point[]) => {
        setStrokes((prev) =>
          prev.map((st) => {
            if (st.id === strokeId) {
              return { ...st, points: newPoints };
            }
            return st;
          }),
        );
      }, 16), // ~60fps max
    );

    // Firebase sync: 100ms throttle for real-time collaboration without spam
    const throttledFirebaseSyncRef = useRef(
      throttle((strokeId: string, newPoints: Point[]) => {
        if (onStrokeUpdate) {
          onStrokeUpdate(strokeId, { points: newPoints });
        }
      }, 100), // 10 updates/sec max
    );

    useEffect(() => {
      setStrokes(initialStrokes);
    }, [initialStrokes]);

    useImperativeHandle(ref, () => ({
      clearCanvas: () => {
        setStrokes([]);
        if (onClear) onClear();
      },
      saveImage: () => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const link = document.createElement("a");
        link.download = `drawith-you-${Date.now()}.png`;
        link.href = canvas.toDataURL();
        link.click();
      },
      // setBackgroundColor is no longer needed/supported imperatively for drawing
      // Backgrounds are now strokes. We keep the interface for TS compatibility if needed internally but it does nothing to state.
      setBackgroundColor: (color: string) => {},
    }));

    // --- Redraw Logic (defined before handleResize to fix dependency order) ---
    const redraw = useCallback(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      if (!ctx) return;

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Derive background color from strokes (last "background" tool wins)
      let bgColor = "#FFFFFF";
      for (let i = strokes.length - 1; i >= 0; i--) {
        if (strokes[i].tool === "background") {
          bgColor = strokes[i].color;
          break;
        }
      }

      ctx.fillStyle = bgColor;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      strokes.forEach((stroke) => {
        if (stroke.tool === "background") return; // Skip rendering background strokes as lines

        if (stroke.id === editingStrokeId) return;

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
          if (p) floodFill(ctx, p.x, p.y, stroke.color);
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
          );
        }

        if (
          stroke.id === selectedStrokeId &&
          (tool === "select" || tool === "text")
        ) {
          ctx.restore();
        }
      });

      // --- Draw Others' Strokes (Ghost) ---
      others.forEach((user) => {
        if (user.currentStroke) {
          const s = user.currentStroke;
          if (s.tool === "pen" || s.tool === "eraser") {
            ctx.globalAlpha = 0.5; // Ghost effect
            drawSmoothLine(ctx, s.points, s.color, s.size, s.tool === "eraser");
            ctx.globalAlpha = 1.0;
          }
        }
      });

      // --- Draw Others' Cursors ---
      others.forEach((user) => {
        if (user.cursor) {
          const { x, y } = user.cursor;
          const userColor = user.color || "#FF1493";

          ctx.save();
          ctx.translate(x, y);

          // 1. Draw Mouse Pointer (Lucide MousePointer2)
          // SVG Path provided by user:
          // <path d="M4.037 4.688a.495.495 0 0 1 .651-.651l16 6.5a.5.5 0 0 1-.063.947l-6.124 1.58a2 2 0 0 0-1.438 1.435l-1.579 6.126a.5.5 0 0 1-.947.063z"/>
          const cursorPath = new Path2D(
            "M4.037 4.688a.495.495 0 0 1 .651-.651l16 6.5a.5.5 0 0 1-.063.947l-6.124 1.58a2 2 0 0 0-1.438 1.435l-1.579 6.126a.5.5 0 0 1-.947.063z",
          );

          ctx.fillStyle = userColor;
          ctx.fill(cursorPath);
          ctx.strokeStyle = "white"; // White border for contrast
          ctx.lineWidth = 1;
          ctx.stroke(cursorPath);

          // 2. Name Tag (Box)
          const name = user.name || "Anonymous";
          ctx.font = "bold 12px Satoshi, sans-serif";
          const metrics = ctx.measureText(name);
          const paddingX = 10;
          const boxHeight = 24;
          const boxWidth = metrics.width + paddingX * 2;

          const labelX = 16;
          const labelY = 16;

          // Helper: Hex to RGBA inline
          // Assuming userColor is always hex string like #RRGGBB
          let r = 0,
            g = 0,
            b = 0;
          if (userColor.startsWith("#")) {
            r = parseInt(userColor.slice(1, 3), 16);
            g = parseInt(userColor.slice(3, 5), 16);
            b = parseInt(userColor.slice(5, 7), 16);
          }
          const bgAlpha = 0.2; // 20% opacity as requested (user said "ijo 50%", I'll confirm to 20% or 50%... user said "ijo 50% teks ijo 100% border 100%")
          // User: "bg nya ijo 50%" -> Okay let's use 0.5 alpha
          const bgColor = `rgba(${r}, ${g}, ${b}, 0.5)`;

          // Box Background
          ctx.fillStyle = bgColor;
          ctx.beginPath();
          ctx.roundRect(labelX, labelY, boxWidth, boxHeight, 6);
          ctx.fill();

          // Box Border
          ctx.strokeStyle = userColor; // 100% opacity
          ctx.lineWidth = 1.5;
          ctx.stroke();

          // Text
          ctx.fillStyle = userColor; // 100% opacity
          ctx.textBaseline = "middle";
          // We add a tiny bit more paddingY to center vertically in boxHeight=24
          ctx.fillText(name, labelX + paddingX, labelY + boxHeight / 2);

          ctx.restore();
        }
      });

      if (currentPoints.length > 0) {
        if (tool === "pen" || tool === "eraser") {
          drawSmoothLine(ctx, currentPoints, color, size, tool === "eraser");
        }
      }
    }, [
      strokes,
      currentPoints,
      color,
      size,
      tool,
      selectedStrokeId,
      editingStrokeId,
      others, // Trigger redraw when others change
    ]);

    useEffect(() => {
      redraw();
    }, [redraw]);

    // handleResize needs redraw, so define after redraw
    const handleResize = useCallback(() => {
      if (!containerRef.current || !canvasRef.current) return;
      const { width, height } = containerRef.current.getBoundingClientRect();
      const canvas = canvasRef.current;
      canvas.width = width;
      canvas.height = height;
      requestAnimationFrame(redraw);
    }, [redraw]);

    useEffect(() => {
      window.addEventListener("resize", handleResize);
      handleResize();
      return () => window.removeEventListener("resize", handleResize);
    }, [handleResize]);

    // --- Interaction Handlers ---

    const hitTestStroke = (x: number, y: number): string | null => {
      for (let i = strokes.length - 1; i >= 0; i--) {
        const s = strokes[i];

        if (s.tool === "text" && s.text && s.points[0]) {
          const ctx = canvasRef.current?.getContext("2d");
          if (!ctx) continue;
          const fontSize = s.size * 3;
          ctx.font = `${fontSize}px Satoshi, sans-serif`;
          const metrics = ctx.measureText(s.text);
          const p = s.points[0];
          const width = metrics.width;
          const height = fontSize;

          if (
            x >= p.x &&
            x <= p.x + width &&
            y >= p.y - height &&
            y <= p.y + 10
          ) {
            return s.id;
          }
        } else if (s.tool === "pen" || s.tool === "eraser") {
          if (isPointNearStroke(x, y, s.points, Math.max(s.size * 2, 10))) {
            return s.id;
          }
        }
      }
      return null;
    };

    const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const point = getCoordinates(e, canvas);
      if (!point) return;

      if (tool === "select") {
        const hitId = hitTestStroke(point.x, point.y);
        if (hitId) {
          if (onSelectStroke) onSelectStroke(hitId);
          setIsDraggingStroke(true);
          const s = strokes.find((st) => st.id === hitId);
          if (s && s.points[0]) {
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

      if (tool === "text") {
        const hitId = hitTestStroke(point.x, point.y);

        // Select the stroke so parent knows (and color picker works)
        if (hitId) {
          if (onSelectStroke) onSelectStroke(hitId);
        } else {
          // If clicking empty space, maybe clear selection?
          // But we are also potentially creating new text.
          if (onSelectStroke) onSelectStroke(null);
        }

        if (hitId && !isTyping) {
          const s = strokes.find((st) => st.id === hitId);
          if (s && s.tool === "text") {
            setIsTyping(true);
            setTextInput({
              x: s.points[0].x,
              y: s.points[0].y,
              value: s.text || "",
            });
            setEditingStrokeId(hitId);
            // Need to wait for render to focus and set text
            requestAnimationFrame(() => {
              if (inputRef.current) {
                inputRef.current.innerText = s.text || "";
                inputRef.current.focus();
                // Set cursor to end
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

      if (tool === "fill") {
        const newStroke: Stroke = {
          id: Date.now().toString(),
          tool: "fill",
          color: color,
          size: 0,
          points: [point],
          timestamp: Date.now(),
          isComplete: true,
        };
        onStrokeComplete(newStroke);
        return;
      }

      setIsDrawing(true);
      setCurrentPoints([point]);
    };

    const drawMove = (e: React.MouseEvent | React.TouchEvent) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const point = getCoordinates(e, canvas);
      if (!point) return;

      // Broadcast Cursor Position
      if (onCursorUpdate) {
        onCursorUpdate(point.x, point.y);
      }

      if (tool === "select" && isDraggingStroke && selectedStrokeId) {
        const s = strokes.find((st) => st.id === selectedStrokeId);
        if (!s) return;

        const newRefX = point.x - dragOffset.x;
        const newRefY = point.y - dragOffset.y;

        const dx = newRefX - s.points[0].x;
        const dy = newRefY - s.points[0].y;

        if (dx === 0 && dy === 0) return;

        const newPoints = s.points.map((p) => ({ x: p.x + dx, y: p.y + dy }));

        // Update local state for smooth visual feedback (60fps)
        throttledDragUpdateRef.current(selectedStrokeId, newPoints);

        // Sync to Firebase for real-time collaboration (10fps)
        throttledFirebaseSyncRef.current(selectedStrokeId, newPoints);

        return;
      }

      if (!isDrawing) return;
      if (tool !== "pen" && tool !== "eraser") return;

      const newPoints = [...currentPoints, point];
      setCurrentPoints(newPoints);

      // Broadcast Current Stroke
      if (onStrokeInProgress) {
        const liveStroke: Stroke = {
          id: "temp",
          tool: tool,
          color: color,
          size: size,
          points: newPoints,
          timestamp: Date.now(),
        };
        onStrokeInProgress(liveStroke);
      }
    };

    const stopDrawing = () => {
      // Broadcast Stop Stroke
      if (onStrokeInProgress) {
        onStrokeInProgress(null);
      }

      if (tool === "select" && isDraggingStroke && selectedStrokeId) {
        setIsDraggingStroke(false);
        // Firebase sync is already handled by throttledFirebaseSyncRef during drag
        // No need to sync again here
        return;
      }

      if (!isDrawing) return;
      setIsDrawing(false);

      if (currentPoints.length > 0) {
        const newStroke: Stroke = {
          id: Date.now().toString(),
          tool: tool,
          color: color,
          size: size,
          points: currentPoints,
          timestamp: Date.now(),
          isComplete: true,
        };
        onStrokeComplete(newStroke);
      }
      setCurrentPoints([]);
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
            tool: "text",
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

    return (
      <div
        ref={containerRef}
        className="relative w-full h-[80vh] bg-white rounded-[20px] shadow-lg overflow-hidden cursor-crosshair touch-none"
      >
        <canvas
          ref={canvasRef}
          className="absolute inset-0 block"
          onMouseDown={startDrawing}
          onMouseMove={drawMove}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
          onTouchStart={startDrawing}
          onTouchMove={drawMove}
          onTouchEnd={stopDrawing}
        />

        {isTyping && (
          <div
            ref={inputRef}
            contentEditable
            onBlur={commitText}
            onKeyDown={(e) => {
              // Normally shift+enter is new line, enter is submit?
              // Similar apps: Enter escapes/submits. Shift+Enter is newline.
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                inputRef.current?.blur();
              }
              e.stopPropagation();
            }}
            style={{
              position: "absolute",
              left: textInput.x,
              top: textInput.y - size * 3, // Font baseline align
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
              whiteSpace: "pre", // Allows growing width
              display: "inline-block", // fit content
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
