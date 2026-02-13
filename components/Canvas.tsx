"use client";

import {
  useEffect,
  useRef,
  useState,
  useImperativeHandle,
  forwardRef,
  useCallback,
} from "react";
import { Point, Stroke, Tool, UserPresence } from "@/lib/types";
import { getCoordinates, isPointNearStroke } from "@/lib/canvas-utils";
import { useCanvasDrawing } from "@/hooks/useCanvasDrawing";
import { useCanvasRender } from "@/hooks/useCanvasRender";

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
        // Need context for text measurement
        const ctx = canvasRef.current?.getContext("2d");

        for (let i = strokes.length - 1; i >= 0; i--) {
          const s = strokes[i];

          if (s.tool === "text" && s.text && s.points[0] && ctx) {
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
      },
      [strokes],
    );

    const [cursorPos, setCursorPos] = useState<{ x: number; y: number } | null>(
      null,
    );

    // -- Hooks --
    const {
      isDrawing,
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
      currentPoints: currentPoints, // Keep strictly for compatibility if prop type demands it, but logic uses Ref
      currentPointsRef, // Pass Ref
      color,
      size,
      feather,
      cursorPos, // Pass local cursor position
    });

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

        // Composite for save
        const compositeCanvas = document.createElement("canvas");
        compositeCanvas.width = canvas.width;
        compositeCanvas.height = canvas.height;
        const ctx = compositeCanvas.getContext("2d");
        if (ctx) {
          ctx.drawImage(canvas, 0, 0);
          ctx.drawImage(overlay, 0, 0); // Include ghosts/cursors in save? Maybe not.
          // Usually save is just the artwork. Let's keep just canvas (main) for now.
          // Wait, user might want to save what they see.
          // Reverting to just 'canvas' (main strokes) is safer for "Clean Export".
        }

        const link = document.createElement("a");
        link.download = `drawith-you-${Date.now()}.png`;
        link.href = canvas.toDataURL(); // Save ONLY main strokes layer
        link.click();
      },
      setBackgroundColor: () => {}, // Deprecated
    }));

    // -- Event Wrappers --
    const handleMouseDown = (e: React.MouseEvent | React.TouchEvent) => {
      // Special case: Text tool click existing text or new spot
      // We override the hook's startDrawing for text tool specific formatting
      if (tool === "text") {
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
          if (s && s.tool === "text") {
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

    // -- Cursor Logic --
    const getCursorStyle = () => {
      switch (tool) {
        case "pen":
          return "url('https://api.iconify.design/lucide:pencil.svg?color=%23000000&width=24&height=24') 0 24, auto";
        case "eraser":
          return "none"; // Hide cursor, we draw a custom circle
        case "text":
          return "text";
        case "fill":
          return "url('https://api.iconify.design/lucide:paint-bucket.svg?color=%23000000&width=24&height=24') 12 12, auto";
        case "select":
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
        <canvas ref={canvasRef} className="absolute inset-0 block z-10" />
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
