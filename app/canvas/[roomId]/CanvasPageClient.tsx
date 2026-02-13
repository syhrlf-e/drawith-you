"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import Header from "@/components/Header";
import Canvas, { CanvasHandle } from "@/components/Canvas";
import Toolbar from "@/components/Toolbar";
import ToolSettings from "@/components/ToolSettings";
import ProfileSidebar from "@/components/ProfileSidebar";
import Toast, { ToastType } from "@/components/ui/Toast";
import PeerLeftModal from "@/components/PeerLeftModal";
import { useSupabaseSync } from "@/hooks/useSupabaseSync";
import { useSupabasePresence } from "@/hooks/useSupabasePresence";
import { Tool, Stroke } from "@/lib/types";
import { throttle } from "@/lib/canvas-utils";
import { supabase } from "@/lib/supabase";

interface CanvasPageClientProps {
  roomId: string;
}

export default function CanvasPageClient({ roomId }: CanvasPageClientProps) {
  const [tool, setTool] = useState<Tool>("pen");
  const [color, setColor] = useState("#000000");
  const [size, setSize] = useState(5);
  const [feather, setFeather] = useState(0); // 0 = sharp, >0 = soft
  const [showToolSettings, setShowToolSettings] = useState(false);
  const [showProfileSidebar, setShowProfileSidebar] = useState(false);
  const [backgroundColor, setBackgroundColor] = useState("#FFFFFF");
  const [selectedStrokeId, setSelectedStrokeId] = useState<string | null>(null);
  const canvasRef = useRef<CanvasHandle>(null);

  // Ignore updates for the currently selected stroke to prevent "jumping" (server echo)
  // We Memoize the array to prevent infinite loops in useEffect inside the hook
  const ignoreIds = useRef<string[]>([]);
  if (selectedStrokeId) ignoreIds.current = [selectedStrokeId];
  else ignoreIds.current = [];

  const {
    strokes,
    addStroke,
    updateStroke,
    loading,
    undo,
    redo,
    canUndo,
    canRedo,
    clearCanvas: clearSupabaseCanvas,
  } = useSupabaseSync(roomId, ignoreIds.current);

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
    if (tool === newTool && (newTool === "pen" || newTool === "eraser")) {
      setShowToolSettings((prev) => !prev);
      return;
    }

    setTool(newTool);

    // Auto-open settings for pen/eraser initially?
    // User said "ganggu banget", so maybe default to FALSE (closed),
    // and let them click again to open.
    // OR: Open it once, let them close.
    // Let's try: Open by default, but easy to close.
    if (newTool === "pen" || newTool === "eraser") {
      setShowToolSettings(true);
    } else {
      setShowToolSettings(false);
    }

    // Smart Defaults
    if (newTool === "eraser") {
      setSize(30); // Default larger for eraser (wraps the icon)
    } else if (newTool === "pen") {
      setSize(5); // Default finer for pen
    }

    // Smart Default for Text Tool
    if (newTool === "text") {
      setSize(12); // Readable default text size
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

  const handleColorChange = (newColor: string) => {
    setColor(newColor);

    // Live update for selected stroke
    if (selectedStrokeId) {
      const stroke = strokes.find((s) => s.id === selectedStrokeId);
      if (stroke && (stroke.tool === "text" || stroke.tool === "pen")) {
        // Direct call - throttling is now handled inside useSupabaseSync
        updateStroke(selectedStrokeId, { color: newColor });
      }
    }
  };

  const handleStrokeComplete = (stroke: Stroke) => {
    addStroke(stroke);
  };

  const handleClear = async () => {
    // Clear both local canvas and Supabase in one unified call
    try {
      if (canvasRef.current) {
        canvasRef.current.clearCanvas();
      }
      clearSupabaseCanvas(); // This handles both local state and Supabase deletion
      triggerToast("Kanvas dan latar belakang berhasil direset!", "info");
    } catch (error) {
      console.error("Error clearing canvas:", error);
      triggerToast("Gagal menghapus kanvas.", "error");
    }
  };

  const handleExitRoom = () => {
    window.location.href = "/";
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
    setBackgroundColor(bgColor);
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
        onProfileClick={() => setShowProfileSidebar(true)}
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
          feather={feather}
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
        onProfileClick={() => setShowProfileSidebar(true)}
      />

      {showToolSettings && (
        <ToolSettings
          tool={tool}
          size={size}
          feather={feather}
          onSizeChange={setSize}
          onFeatherChange={setFeather}
          onClose={() => setShowToolSettings(false)}
        />
      )}

      <ProfileSidebar
        isOpen={showProfileSidebar}
        onClose={() => setShowProfileSidebar(false)}
        userName={userName}
        userColor={identityColor}
        backgroundColor={backgroundColor}
        roomId={roomId}
        onSave={handleSave}
        onClear={handleClear}
        onBackgroundChange={handleBackgroundChange}
        onExitRoom={handleExitRoom}
      />
    </main>
  );
}
