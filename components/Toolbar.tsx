"use client";

import {
  Pen,
  Eraser,
  Type,
  PaintBucket,
  Menu,
  X,
  Check,
  Download,
  Trash2,
  Palette,
  LogOut,
  MousePointer2,
  Pipette,
  User,
} from "lucide-react";
import { HexColorPicker } from "react-colorful";

import { Tool } from "@/lib/types";
import { useState } from "react";
import AlertModal from "./ui/AlertModal";

interface ToolbarProps {
  currentTool: Tool | null;
  currentColor: string;
  onToolChange: (tool: Tool) => void;
  onColorChange: (color: string) => void;
  onClear?: () => void;
  onSave?: () => void;
  onBackgroundChange?: (color: string) => void;
  onProfileClick?: () => void; // New: triggers profile sidebar
}

declare global {
  interface Window {
    EyeDropper?: any;
  }
}

export default function Toolbar({
  currentTool,
  currentColor,
  onToolChange,
  onColorChange,
  onClear,
  onSave,
  onBackgroundChange,
  onProfileClick,
}: ToolbarProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isColorPickerOpen, setIsColorPickerOpen] = useState(false);
  const [recentColors, setRecentColors] = useState<string[]>([]);

  // Local state for hex input to allow typing without immediate validation/correction interfering
  const [hexInput, setHexInput] = useState(currentColor.replace("#", ""));

  const addToRecentColors = (color: string) => {
    setRecentColors((prev) => {
      // Avoid adding duplicate if it's already the most recent one
      if (prev.length > 0 && prev[0] === color) return prev;

      // Add to front, remove duplicates, keep max 8
      const newColors = [color, ...prev.filter((c) => c !== color)].slice(0, 8);
      return newColors;
    });
  };

  const handleColorUpdate = (color: string) => {
    onColorChange(color);
    setHexInput(color.replace("#", ""));
  };

  // Alert States
  const [alertType, setAlertType] = useState<"save" | "clear" | "exit" | null>(
    null,
  );

  const tools: { id: Tool; icon: React.ElementType; label: string }[] = [
    { id: "select", icon: MousePointer2, label: "Pilih / Pindah" },
    { id: "pen", icon: Pen, label: "Pena" },
    { id: "eraser", icon: Eraser, label: "Penghapus" },
    { id: "text", icon: Type, label: "Teks" },
    { id: "fill", icon: PaintBucket, label: "Isi Warna" },
  ];

  const backgroundPalette = [
    "#FFFFFF", // White
    "#F5F5F5", // Light Gray
    "#FFFAF0", // Floral White
    "#F0F8FF", // Alice Blue
    "#FFF0F5", // Lavender Blush
    "#FAFAFA", // Very Light Gray
    "#E0E0E0", // Gray
    "#000000", // Black
  ];

  const handleConfirm = () => {
    if (alertType === "save" && onSave) {
      onSave();
    } else if (alertType === "clear" && onClear) {
      onClear();
    } else if (alertType === "exit") {
      window.location.href = "/";
    }
    setAlertType(null);
    setIsMenuOpen(false);
  };

  return (
    <>
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-3 z-50 w-max max-w-[95vw] px-2">
        {/* Main Toolbar */}
        <div className="bg-white rounded-full shadow-2xl px-4 py-3 flex items-center gap-2 sm:gap-4 border-2 border-pink-primary/20 backdrop-blur-sm bg-white/90">
          {/* Menu Button */}
          <button
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className="p-2 sm:p-3 rounded-full hover:bg-pink-50 text-gray-400 hover:text-pink-primary transition-colors"
            title="Pilihan"
          >
            <Menu className="w-5 h-5 sm:w-6 sm:h-6" />
          </button>

          <div className="w-px h-6 sm:h-8 bg-gray-200" />

          {/* Tools */}
          {tools.map((tool) => {
            const Icon = tool.icon;
            const isActive = currentTool === tool.id;

            return (
              <button
                key={tool.id}
                onClick={() => onToolChange(tool.id)}
                className={`p-2 sm:p-3 rounded-full transition-all duration-200 ${
                  isActive
                    ? "bg-pink-primary text-white shadow-lg scale-105"
                    : "text-gray-400 hover:bg-pink-50 hover:text-pink-primary"
                }`}
                aria-label={`Pilih alat ${tool.label}`}
                title={tool.label}
              >
                <Icon className="w-5 h-5 sm:w-6 sm:h-6" />
              </button>
            );
          })}

          <div className="w-px h-6 sm:h-8 bg-gray-200" />

          {/* Color Picker Trigger */}
          <div className="relative">
            <button
              onClick={() => setIsColorPickerOpen(!isColorPickerOpen)}
              onMouseDown={(e) => e.preventDefault()} // Prevent focus loss from input
              className="w-8 h-8 sm:w-10 sm:h-10 rounded-full border-2 border-white shadow-md transition-transform hover:scale-110 relative"
              style={{ backgroundColor: currentColor }}
              aria-label="Ganti warna"
              title="Palet Warna"
            >
              {currentColor.toLowerCase() === "#ffffff" && (
                <div className="absolute inset-0 border border-gray-200 rounded-full" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Color Picker Popover */}
      {isColorPickerOpen && (
        <div className="fixed bottom-36 left-1/2 -translate-x-1/2 bg-white p-4 rounded-2xl shadow-xl border border-pink-100 z-[60] animate-in slide-in-from-bottom-5 fade-in duration-200 w-[240px]">
          {/* React Colorful Wheel */}
          <div
            className="mb-4"
            onPointerUp={() => addToRecentColors(currentColor)}
            onMouseDown={(e) => e.preventDefault()} // Prevent focus loss
          >
            <HexColorPicker color={currentColor} onChange={handleColorUpdate} />
          </div>

          {/* Hex Input & Eye Dropper */}
          <div className="flex gap-2 mb-4 items-center">
            <div className="flex-1 relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs font-mono">
                #
              </span>
              <input
                type="text"
                value={hexInput}
                onChange={(e) => {
                  const val = e.target.value;
                  setHexInput(val);
                  if (/^[0-9A-Fa-f]{6}$/.test(val)) {
                    handleColorUpdate(`#${val}`);
                  }
                }}
                className="w-full pl-6 pr-2 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-sm font-mono text-gray-700 focus:outline-none focus:border-pink-500 transition-colors uppercase"
                maxLength={6}
                onBlur={() => addToRecentColors(currentColor)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    addToRecentColors(currentColor);
                    e.currentTarget.blur();
                  }
                }}
              />
            </div>

            {/* Eye Dropper */}
            <button
              onClick={async () => {
                if (!window.EyeDropper) {
                  alert(
                    "Browser kamu belum support fitur ini :( (Coba pake Chrome/Edge ya!)",
                  );
                  return;
                }
                try {
                  const eyeDropper = new window.EyeDropper();
                  const result = await eyeDropper.open();
                  handleColorUpdate(result.sRGBHex);
                } catch (e) {
                  // User canceled
                }
              }}
              className="p-1.5 bg-gray-100 hover:bg-gray-200 rounded-lg text-gray-600 transition-colors"
              title="Ambil Warna (Eye Dropper)"
              onMouseDown={(e) => e.preventDefault()} // Prevent focus loss
            >
              <Pipette className="w-5 h-5" />
            </button>
          </div>

          <div className="space-y-3 pt-3 border-t border-gray-100">
            {/* Document Colors */}
            <div>
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2 block text-left">
                Warna Dokumen
              </span>
              <div className="flex gap-2 flex-wrap justify-start">
                {/* Show unique recent colors */}
                {recentColors.map((color) => (
                  <button
                    key={color}
                    className={`w-6 h-6 rounded-full border border-gray-200 transition-transform hover:scale-110 ${currentColor === color ? "ring-2 ring-pink-primary ring-offset-1" : ""}`}
                    style={{ backgroundColor: color }}
                    onClick={() => {
                      onColorChange(color);
                      setHexInput(color.replace("#", ""));
                    }}
                    onMouseDown={(e) => e.preventDefault()} // Prevent focus loss
                  />
                ))}
                {recentColors.length === 0 && (
                  <span className="text-gray-300 text-xs italic">
                    Belum ada warna.
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="mt-4 pt-2 border-t border-gray-100 flex justify-end">
            <button
              onClick={() => setIsColorPickerOpen(false)}
              className="text-xs text-gray-400 hover:text-gray-600"
            >
              Tutup
            </button>
          </div>
        </div>
      )}

      {/* Settings Menu Modal - Empty (all options moved to Profile Sidebar) */}
      {isMenuOpen && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/20 backdrop-blur-[2px]"
          onClick={() => setIsMenuOpen(false)}
        >
          <div
            className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold text-gray-900">Pilihan</h3>
              <button
                onClick={() => setIsMenuOpen(false)}
                className="p-2 hover:bg-gray-100 rounded-full"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            <div className="text-center py-8 text-gray-400">
              <p className="text-sm">Menu kosong</p>
            </div>
          </div>
        </div>
      )}

      {/* Alert Modals */}
      <AlertModal
        isOpen={alertType === "save"}
        onClose={() => setAlertType(null)}
        onConfirm={handleConfirm}
        title="Yakin mau simpan?"
        confirmText="Iya, simpan sekarang"
        cancelText="Gajadi ah"
        variant="primary"
      />

      <AlertModal
        isOpen={alertType === "clear"}
        onClose={() => setAlertType(null)}
        onConfirm={handleConfirm}
        title="Yakin mau dihapus?"
        confirmText="Iya, hapus aja"
        cancelText="Gajadi ah"
        variant="danger"
      />

      <AlertModal
        isOpen={alertType === "exit"}
        onClose={() => setAlertType(null)}
        onConfirm={handleConfirm}
        title="Yakin mau keluar?"
        confirmText="Iya nih"
        cancelText="Gajadi ah"
        variant="danger"
      />
    </>
  );
}
