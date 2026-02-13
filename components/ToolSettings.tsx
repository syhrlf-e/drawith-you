import { Tool } from "@/lib/types";
import { Sliders, X } from "lucide-react";

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
  if (tool !== "pen" && tool !== "eraser") return null;

  return (
    <div className="absolute bottom-24 left-1/2 -translate-x-1/2 bg-white/90 backdrop-blur-sm p-4 rounded-2xl shadow-xl border border-pink-100 w-[280px] animate-in slide-in-from-bottom-5 fade-in duration-200 z-40">
      <div className="flex items-center justify-between mb-4 border-b border-gray-100 pb-2">
        <div className="flex items-center gap-2 text-gray-700 font-semibold">
          <Sliders className="w-4 h-4" />
          <span className="text-sm">
            Pengaturan {tool === "pen" ? "Pena" : "Penghapus"}
          </span>
        </div>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-gray-600 p-1 rounded-full hover:bg-gray-100 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="space-y-4">
        {/* Size Slider */}
        <div className="space-y-1">
          <div className="flex justify-between text-xs text-gray-500">
            <span>Ukuran</span>
            <span>{size}px</span>
          </div>
          <input
            type="range"
            min={1}
            max={50}
            value={size}
            onChange={(e) => onSizeChange(Number(e.target.value))}
            className="w-full accent-pink-500 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
          />
        </div>

        {/* Feather/Hardness Slider */}
        {tool === "pen" && (
          <div className="space-y-1">
            <div className="flex justify-between text-xs text-gray-500">
              <span>Kehalusan (Feather)</span>
              <span>{feather}%</span>
            </div>
            <input
              type="range"
              min={0}
              max={20}
              value={feather}
              onChange={(e) => onFeatherChange(Number(e.target.value))}
              className="w-full accent-pink-500 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
            />
          </div>
        )}
      </div>
    </div>
  );
}
