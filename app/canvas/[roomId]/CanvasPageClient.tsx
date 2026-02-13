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
import { useCanvasState } from "@/hooks/useCanvasState";
import { generateRandomName } from "@/lib/name-generator";
import { Tool, Stroke } from "@/lib/types";
import { throttle, splitStroke } from "@/lib/canvas-utils";
import { supabase } from "@/lib/supabase";
import { TOOLS, STORAGE_KEYS } from "@/lib/constants";

interface CanvasPageClientProps {
  roomId: string;
}

export default function CanvasPageClient({ roomId }: CanvasPageClientProps) {
  const canvasRef = useRef<CanvasHandle>(null);

  // Ignore updates for the currently selected stroke to prevent "jumping" (server echo)
  const [selectedStrokeId, setSelectedStrokeId] = useState<string | null>(null);
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
    deleteStroke,
  } = useSupabaseSync(roomId, ignoreIds.current);

  const {
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
    handleToolChange,
  } = useCanvasState(strokes);

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
  const [userName, setUserName] = useState("");
  const userId = useRef(
    `user-${Math.random().toString(36).substr(2, 9)}`,
  ).current;

  // Persist userName
  useEffect(() => {
    const storedName = localStorage.getItem(STORAGE_KEYS.USERNAME);
    if (storedName) {
      setUserName(storedName);
    } else {
      const newName = generateRandomName();
      localStorage.setItem(STORAGE_KEYS.USERNAME, newName);
      setUserName(newName);
    }
  }, []);

  const handleUserNameChange = (newName: string) => {
    setUserName(newName);
    localStorage.setItem(STORAGE_KEYS.USERNAME, newName);
    setMyName(newName); // Update presence immediately
  };
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

  // Sync toolbar color when selection changes
  // Note: We need to sync the hook's local state when selection changes externally
  // But wait, `useCanvasState` doesn't know about `selectedStrokeId` since we kept it local?
  // We need to bridge them.
  useEffect(() => {
    if (selectedStrokeId) {
      const s = strokes.find((st) => st.id === selectedStrokeId);
      if (s && (s.tool === TOOLS.TEXT || s.tool === TOOLS.PEN)) {
        if (color !== s.color) {
          setColor(s.color);
        }
      }
    }
  }, [selectedStrokeId, strokes, color, setColor]);

  const handleColorChange = (newColor: string) => {
    setColor(newColor);

    // Live update for selected stroke
    if (selectedStrokeId) {
      const stroke = strokes.find((s) => s.id === selectedStrokeId);
      if (stroke && (stroke.tool === TOOLS.TEXT || stroke.tool === TOOLS.PEN)) {
        // Direct call - throttling is now handled inside useSupabaseSync
        updateStroke(selectedStrokeId, { color: newColor });
      }
    }
  };

  const handleStrokeComplete = (stroke: Stroke) => {
    if (stroke.tool === TOOLS.ERASER) {
      // Vector Eraser Logic (Destructive)
      let strokesToDelete: string[] = [];
      let strokesToAdd: Stroke[] = [];
      let hasChanges = false;

      // Iterate over ALL existing strokes to see if they are cut
      // Note: working with latest 'strokes' state
      strokes.forEach((existingStroke) => {
        if (
          existingStroke.tool === TOOLS.BACKGROUND ||
          existingStroke.tool === TOOLS.ERASER
        )
          return;

        // Optimization: Quick bounding box check could go here

        const fragments = splitStroke(
          existingStroke,
          stroke.points,
          stroke.size,
        );

        // If split resulted in changes (e.g. 0 fragments = fully erased, or >1 fragments = split, or 1 fragment but shorter)
        // Actually splitStroke returns 1 fragment identical to original if NO erase happened.
        // We need to know if it CHANGED.
        // Simple check: if fragments.length !== 1 or fragments[0].points.length !== existingStroke.points.length

        let isModified = false;
        if (fragments.length !== 1) {
          isModified = true;
        } else {
          if (fragments[0].points.length !== existingStroke.points.length) {
            isModified = true;
          }
        }

        if (isModified) {
          hasChanges = true;
          strokesToDelete.push(existingStroke.id);
          strokesToAdd.push(...fragments);
        }
      });

      if (hasChanges) {
        // Apply updates
        // 1. Delete modified/erased strokes
        strokesToDelete.forEach((id) => deleteStroke(id));

        // 2. Add new fragments
        strokesToAdd.forEach((s) => addStroke(s));

        // 3. Do NOT add the eraser stroke to history/canvas
      }
    } else {
      // Normal stroke (Pen, Text, etc)
      addStroke(stroke);
    }
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
      tool: TOOLS.BACKGROUND,
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
        onShowSettings={() => setShowToolSettings((prev) => !prev)}
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
        onUserNameChange={handleUserNameChange}
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
