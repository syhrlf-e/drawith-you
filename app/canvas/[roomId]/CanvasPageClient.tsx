"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import Header from "@/components/Header";
import Canvas, { CanvasHandle } from "@/components/Canvas";
import Toolbar from "@/components/Toolbar";
import Toast, { ToastType } from "@/components/ui/Toast";
import PeerLeftModal from "@/components/PeerLeftModal";
import { useSupabaseSync } from "@/hooks/useSupabaseSync";
import { useSupabasePresence } from "@/hooks/useSupabasePresence";
import { Tool, Stroke } from "@/lib/types";
import { debounce } from "@/lib/canvas-utils";
import { supabase } from "@/lib/supabase";

interface CanvasPageClientProps {
  roomId: string;
}

export default function CanvasPageClient({ roomId }: CanvasPageClientProps) {
  const {
    strokes,
    addStroke,
    updateStroke,
    loading,
    undo,
    redo,
    canUndo,
    canRedo,
  } = useSupabaseSync(roomId);
  const [tool, setTool] = useState<Tool>("pen");
  const [color, setColor] = useState("#000000");
  const [size, setSize] = useState(5);
  const [selectedStrokeId, setSelectedStrokeId] = useState<string | null>(null);
  const canvasRef = useRef<CanvasHandle>(null);

  // Toast State
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const [toastType, setToastType] = useState<ToastType>("success");

  // Identity Color (Random per session)
  const identityColor = useRef(
    "#" +
      Math.floor(Math.random() * 16777215)
        .toString(16)
        .padStart(6, "0"),
  ).current;

  // Presence & Peer Left Modal
  const [userName, setUserName] = useState("Artist");
  const userId = useRef(
    `user-${Math.random().toString(36).substr(2, 9)}`,
  ).current;
  const { others, updateCursor, setMyName, updateCurrentStroke } =
    useSupabasePresence(roomId, userId, identityColor, userName);
  const [showPeerLeftModal, setShowPeerLeftModal] = useState(false);
  const prevOthersCountRef = useRef(others.length);

  useEffect(() => {
    if (others.length < prevOthersCountRef.current) {
      setShowPeerLeftModal(true);
    }
    prevOthersCountRef.current = others.length;
  }, [others.length]);

  const triggerToast = (message: string, type: ToastType = "success") => {
    setToastMessage(message);
    setToastType(type);
    setShowToast(true);
  };

  const handleToolChange = (newTool: Tool) => {
    setTool(newTool);

    // Smart Default for Text Tool
    if (newTool === "text") {
      let bgColor = "#FFFFFF";
      // Find last background stroke
      for (let i = strokes.length - 1; i >= 0; i--) {
        if (strokes[i].tool === "background") {
          bgColor = strokes[i].color;
          break;
        }
      }

      // If background is black (or essentially black), default text to white.
      // Else default to black.
      if (bgColor.toLowerCase() === "#000000") {
        setColor("#FFFFFF");
      } else {
        setColor("#000000");
      }
    }
  };

  // Sync toolbar color when selection changes
  useEffect(() => {
    if (selectedStrokeId) {
      const s = strokes.find((st) => st.id === selectedStrokeId);
      if (s && (s.tool === "text" || s.tool === "pen")) {
        if (color !== s.color) {
          setColor(s.color);
        }
      }
    }
  }, [selectedStrokeId, strokes, color]);

  // Debounced Firebase update for color changes (prevents spam)
  const debouncedUpdateStroke = useRef(
    debounce((strokeId: string, updates: Partial<Stroke>) => {
      updateStroke(strokeId, updates);
    }, 300),
  ).current;

  const handleColorChange = (newColor: string) => {
    setColor(newColor);

    // Live update for selected stroke with debounce
    if (selectedStrokeId) {
      const stroke = strokes.find((s) => s.id === selectedStrokeId);
      if (stroke && (stroke.tool === "text" || stroke.tool === "pen")) {
        // Debounced update to prevent Firebase spam during color picker drag
        debouncedUpdateStroke(selectedStrokeId, { color: newColor });
      }
    }
  };

  const handleStrokeComplete = (stroke: Stroke) => {
    addStroke(stroke);
  };

  const handleClear = async () => {
    // Clear local canvas
    if (canvasRef.current) {
      canvasRef.current.clearCanvas();
      // Background resets automatically because strokes are cleared
    }
    // Clear Supabase
    try {
      const { error } = await supabase
        .from("strokes")
        .delete()
        .eq("room_id", roomId);

      if (error) throw error;
      triggerToast("Kanvas dan latar belakang berhasil direset!", "info");
    } catch (error) {
      console.error("Error clearing canvas:", error);
      triggerToast("Gagal menghapus kanvas.", "error");
    }
  };

  const handleSave = () => {
    if (canvasRef.current) {
      canvasRef.current.saveImage();
      triggerToast(
        "Selamat! Gambar berhasil disimpan di perangkat kamu.",
        "success",
      );
    }
  };

  const handleBackgroundChange = (bgColor: string) => {
    // OLD: canvasRef.current.setBackgroundColor(color);
    // NEW: Add as a stroke
    const newStroke: Stroke = {
      id: Date.now().toString(),
      tool: "background",
      color: bgColor,
      size: 0,
      points: [{ x: 0, y: 0 }], // Dummy point
      timestamp: Date.now(),
      isComplete: true,
    };
    addStroke(newStroke);
  };

  if (loading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-gray-bg">
        <div className="text-pink-primary animate-pulse text-xl font-bold">
          Memuat Kanvas...
        </div>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-gray-bg flex flex-col">
      <Header
        roomId={roomId}
        userName={userName}
        onUserNameChange={(name) => {
          setUserName(name);
          setMyName(name);
        }}
        onUndo={undo}
        onRedo={redo}
        canUndo={canUndo}
        canRedo={canRedo}
      />

      <Toast
        message={toastMessage}
        type={toastType}
        isVisible={showToast}
        onClose={() => setShowToast(false)}
      />

      <PeerLeftModal
        isOpen={showPeerLeftModal}
        onClose={() => setShowPeerLeftModal(false)}
        playerCount={others.length + 1}
      />

      <div className="flex-1 flex justify-center items-center p-4 pt-20 pb-24">
        <Canvas
          ref={canvasRef}
          roomId={roomId}
          tool={tool}
          color={color}
          size={size}
          initialStrokes={strokes}
          onStrokeComplete={handleStrokeComplete}
          onStrokeUpdate={updateStroke}
          selectedStrokeId={selectedStrokeId}
          onSelectStroke={setSelectedStrokeId}
          others={others}
          onCursorUpdate={updateCursor}
          onStrokeInProgress={updateCurrentStroke}
        />
      </div>

      <Toolbar
        currentTool={tool}
        currentColor={color}
        onToolChange={handleToolChange}
        onColorChange={handleColorChange}
        onClear={handleClear}
        onSave={handleSave}
        onBackgroundChange={handleBackgroundChange}
      />
    </main>
  );
}
