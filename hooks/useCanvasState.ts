import { useState, useCallback } from "react";
import { Tool, Stroke } from "@/lib/types";
import { TOOLS, DEFAULT_COLORS, TOOL_DEFAULTS } from "@/lib/constants";

export const useCanvasState = (strokes: Stroke[]) => {
  const [tool, setTool] = useState<Tool>(null);
  const [color, setColor] = useState<string>(DEFAULT_COLORS.BLACK);
  const [size, setSize] = useState(TOOL_DEFAULTS.PEN_SIZE);
  const [feather, setFeather] = useState(TOOL_DEFAULTS.FEATHER);
  const [showToolSettings, setShowToolSettings] = useState(false);
  const [showProfileSidebar, setShowProfileSidebar] = useState(false);
  const [backgroundColor, setBackgroundColor] = useState<string>(
    DEFAULT_COLORS.WHITE,
  );

  // This state is shared with SupabaseSync, but tracked locally for UI updates
  // In the original code, this was local to CanvasPageClient
  const [selectedStrokeId, setSelectedStrokeId] = useState<string | null>(null);

  const handleToolChange = useCallback(
    (newTool: Tool) => {
      if (
        tool === newTool &&
        (newTool === TOOLS.PEN || newTool === TOOLS.ERASER)
      ) {
        setShowToolSettings((prev) => !prev);
        return;
      }

      setTool(newTool);

      // Auto-open settings for pen/eraser
      if (newTool === TOOLS.PEN || newTool === TOOLS.ERASER) {
        setShowToolSettings(true);
      } else {
        setShowToolSettings(false);
      }

      // Smart Defaults
      if (newTool === TOOLS.ERASER) {
        setSize(TOOL_DEFAULTS.ERASER_SIZE);
      } else if (newTool === TOOLS.PEN) {
        setSize(TOOL_DEFAULTS.PEN_SIZE);
      }

      // Smart Default for Text Tool
      if (newTool === TOOLS.TEXT) {
        setSize(TOOL_DEFAULTS.TEXT_SIZE);
        let bgColor: string = DEFAULT_COLORS.WHITE;

        // Find last background stroke
        for (let i = strokes.length - 1; i >= 0; i--) {
          if (strokes[i].tool === TOOLS.BACKGROUND) {
            bgColor = strokes[i].color;
            break;
          }
        }

        // Contrast check
        if (bgColor.toLowerCase() === DEFAULT_COLORS.BLACK) {
          setColor(DEFAULT_COLORS.WHITE);
        } else {
          setColor(DEFAULT_COLORS.BLACK);
        }
      }
    },
    [tool, strokes],
  );

  return {
    tool,
    setTool,
    color,
    setColor,
    size,
    setSize,
    feather,
    setFeather,
    showToolSettings,
    setShowToolSettings,
    showProfileSidebar,
    setShowProfileSidebar,
    backgroundColor,
    setBackgroundColor,
    selectedStrokeId,
    setSelectedStrokeId,
    handleToolChange,
  };
};
