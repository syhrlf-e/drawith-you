"use client";

import { X } from "lucide-react";
import { Tool } from "@/lib/types";
import { TOOLS, LIMITS } from "@/lib/constants";
import { useEffect, useState } from "react";

interface ToolSettingsProps {
  tool: Tool;
  size: number;
  feather: number;
  onSizeChange: (size: number) => void;
  onFeatherChange: (feather: number) => void;
  onClose: () => void;
}

export default function ToolSettings({
  tool,
  size,
  feather,
  onSizeChange,
  onFeatherChange,
  onClose,
}: ToolSettingsProps) {
  const [localSize, setLocalSize] = useState(size);
  const [localFeather, setLocalFeather] = useState(feather);

  useEffect(() => {
    setLocalSize(size);
  }, [size]);

  useEffect(() => {
    setLocalFeather(feather);
  }, [feather]);

  const handleSizeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newSize = parseInt(e.target.value);
    setLocalSize(newSize);
    onSizeChange(newSize);
  };

  const handleFeatherChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newFeather = parseInt(e.target.value);
    setLocalFeather(newFeather);
    onFeatherChange(newFeather);
  };

  if (!tool || (tool !== TOOLS.PEN && tool !== TOOLS.ERASER)) return null;

  return (
    <div className="fixed bottom-24 left-1/2 -translate-x-1/2 bg-white/95 backdrop-blur-md rounded-xl shadow-xl border border-pink-100/50 p-2.5 flex items-center gap-3 z-50 animate-in slide-in-from-bottom-5 fade-in duration-300 w-[85vw] max-w-[320px]">
      {/* Size Slider */}
      <div className="flex-1 space-y-0.5">
        <div className="flex justify-between text-[10px] sm:text-xs font-bold text-gray-400 uppercase tracking-tight">
          <span>Ukuran</span>
          <span>{localSize}px</span>
        </div>
        <input
          type="range"
          min={LIMITS.MIN_SIZE}
          max={LIMITS.MAX_SIZE}
          value={localSize}
          onChange={handleSizeChange}
          className="w-full h-1 bg-gray-200 rounded-full appearance-none cursor-pointer accent-pink-500 hover:accent-pink-600 transition-all touch-none"
        />
      </div>

      {/* Vertical Divider */}
      <div className="w-px h-6 bg-gray-200" />

      {/* Feather Slider (Only for Pen) */}
      {tool === TOOLS.PEN && (
        <div className="flex-1 space-y-0.5">
          <div className="flex justify-between text-[10px] sm:text-xs font-bold text-gray-400 uppercase tracking-tight">
            <span>Halus</span>
            <span>{localFeather}%</span>
          </div>
          <input
            type="range"
            min={LIMITS.MIN_FEATHER}
            max={LIMITS.MAX_FEATHER}
            value={localFeather}
            onChange={handleFeatherChange}
            className="w-full h-1 bg-gray-200 rounded-full appearance-none cursor-pointer accent-purple-500 hover:accent-purple-600 transition-all touch-none"
          />
        </div>
      )}

      {/* Close Button */}
      <button
        onClick={onClose}
        className="p-1 hover:bg-gray-100 rounded-full text-gray-300 hover:text-red-500 transition-colors shrink-0"
      >
        <X size={14} />
      </button>
    </div>
  );
}
