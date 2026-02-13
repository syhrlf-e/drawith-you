import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { Stroke } from "@/lib/types";
import type { RealtimeChannel } from "@supabase/supabase-js";

export const useSupabaseSync = (
  roomId: string,
  ignoreUpdateIds: string[] = [],
) => {
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [loading, setLoading] = useState(true);
  const channelRef = useRef<RealtimeChannel | null>(null);

  // Keep ignore list fresh in ref to use inside effect
  const ignoreIdsRef = useRef(ignoreUpdateIds);
  useEffect(() => {
    ignoreIdsRef.current = ignoreUpdateIds;
  }, [ignoreUpdateIds]);

  // Undo/Redo stacks (simpler than full history)
  const [undoStack, setUndoStack] = useState<Stroke[]>([]);
  const [redoStack, setRedoStack] = useState<Stroke[]>([]);

  // Initialize room and fetch initial strokes
  useEffect(() => {
    const initRoom = async () => {
      try {
        // Ensure room exists
        const { error: roomError } = await supabase
          .from("rooms")
          .upsert({ id: roomId });

        if (roomError) throw roomError;

        // Fetch initial strokes
        const { data, error } = await supabase
          .from("strokes")
          .select("*")
          .eq("room_id", roomId)
          .order("timestamp", { ascending: true });

        if (error) throw error;

        const strokeArray: Stroke[] = (data || []).map((row) => ({
          id: row.id,
          tool: row.tool as Stroke["tool"],
          color: row.color,
          size: row.size,
          points: row.points,
          text: row.text || undefined,
          timestamp: row.timestamp,
          isComplete: row.is_complete,
        }));

        setStrokes(strokeArray);
        setLoading(false);
      } catch (error) {
        console.error("Error initializing room:", error);
        setLoading(false);
      }
    };

    initRoom();
  }, [roomId]);

  // Subscribe to real-time changes
  useEffect(() => {
    const channel = supabase
      .channel(`room:${roomId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "strokes",
          filter: `room_id=eq.${roomId}`,
        },
        (payload) => {
          if (payload.eventType === "INSERT") {
            const newStroke: Stroke = {
              id: payload.new.id,
              tool: payload.new.tool as Stroke["tool"],
              color: payload.new.color,
              size: payload.new.size,
              points: payload.new.points,
              text: payload.new.text || undefined,
              timestamp: payload.new.timestamp,
              isComplete: payload.new.is_complete,
            };

            setStrokes((prev) => {
              // Check if stroke already exists
              if (prev.some((s) => s.id === newStroke.id)) {
                return prev;
              }
              return [...prev, newStroke];
            });
          } else if (payload.eventType === "UPDATE") {
            // CRITICAL FIX: Ignore updates for items currently being manipulated locally
            // This prevents "jumping" where server state overwrites local drag state
            if (ignoreIdsRef.current.includes(payload.new.id)) {
              return;
            }

            const updatedStroke: Stroke = {
              id: payload.new.id,
              tool: payload.new.tool as Stroke["tool"],
              color: payload.new.color,
              size: payload.new.size,
              points: payload.new.points,
              text: payload.new.text || undefined,
              timestamp: payload.new.timestamp,
              isComplete: payload.new.is_complete,
            };

            setStrokes((prev) =>
              prev.map((s) => (s.id === updatedStroke.id ? updatedStroke : s)),
            );
          } else if (payload.eventType === "DELETE") {
            setStrokes((prev) => prev.filter((s) => s.id !== payload.old.id));
          }
        },
      )
      .subscribe();

    channelRef.current = channel;

    return () => {
      channel.unsubscribe();
    };
  }, [roomId]);

  const addStroke = useCallback(
    (stroke: Stroke) => {
      // OPTIMISTIC UPDATE FIRST - immediate UI feedback
      setStrokes((prev) => [...prev, stroke]);

      // Add to undo stack, clear redo stack on new action
      setUndoStack((prev) => [...prev, stroke]);
      setRedoStack([]);

      // Background sync to Supabase (fire-and-forget, non-blocking)
      supabase
        .from("strokes")
        .insert({
          id: stroke.id,
          room_id: roomId,
          tool: stroke.tool,
          color: stroke.color,
          size: stroke.size,
          points: stroke.points,
          text: stroke.text || null,
          timestamp: stroke.timestamp,
          is_complete: stroke.isComplete ?? true,
        })
        .then(({ error }) => {
          if (error) console.error("Error syncing stroke:", error);
        });
    },
    [roomId],
  );

  // Debounce map for network updates to avoid flooding Supabase
  const networkUpdateTimeouts = useRef<{ [key: string]: NodeJS.Timeout }>({});

  const updateStroke = useCallback(
    (strokeId: string, updates: Partial<Stroke>) => {
      // 1. OPTIMISTIC UPDATE - Immediate UI feedback
      setStrokes((prev) =>
        prev.map((s) => (s.id === strokeId ? { ...s, ...updates } : s)),
      );

      // 2. DEBOUNCED NETWORK SYNC
      // Clear existing timeout for this stroke
      if (networkUpdateTimeouts.current[strokeId]) {
        clearTimeout(networkUpdateTimeouts.current[strokeId]);
      }

      // Set new timeout (e.g. 100ms)
      networkUpdateTimeouts.current[strokeId] = setTimeout(() => {
        const updateData: any = {};
        if (updates.color !== undefined) updateData.color = updates.color;
        if (updates.size !== undefined) updateData.size = updates.size;
        if (updates.points !== undefined) updateData.points = updates.points;
        if (updates.text !== undefined) updateData.text = updates.text || null;
        if (updates.isComplete !== undefined)
          updateData.is_complete = updates.isComplete;

        supabase
          .from("strokes")
          .update(updateData)
          .eq("id", strokeId)
          .then(({ error }) => {
            if (error) console.error("Error syncing stroke update:", error);
            // Cleanup timeout reference
            delete networkUpdateTimeouts.current[strokeId];
          });
      }, 100); // 100ms debounce
    },
    [],
  );

  const deleteStroke = useCallback((strokeId: string) => {
    // OPTIMISTIC UPDATE FIRST - immediate UI feedback
    setStrokes((prev) => prev.filter((s) => s.id !== strokeId));

    // Remove from undo stack, clear redo
    setUndoStack((prev) => prev.filter((s) => s.id !== strokeId));
    setRedoStack([]);

    // Background sync to Supabase (fire-and-forget, non-blocking)
    supabase
      .from("strokes")
      .delete()
      .eq("id", strokeId)
      .then(({ error }) => {
        if (error) console.error("Error syncing stroke deletion:", error);
      });
  }, []);

  const undo = useCallback(() => {
    if (undoStack.length === 0) return;

    const strokeToRemove = undoStack[undoStack.length - 1];

    // OPTIMISTIC UPDATE FIRST - immediate UI feedback
    setStrokes((prev) => prev.filter((s) => s.id !== strokeToRemove.id));
    setUndoStack((prev) => prev.slice(0, -1));
    setRedoStack((prev) => [...prev, strokeToRemove]);

    // Background sync to Supabase (fire-and-forget, non-blocking)
    supabase
      .from("strokes")
      .delete()
      .eq("id", strokeToRemove.id)
      .then(({ error }) => {
        if (error) console.error("Error syncing undo:", error);
      });
  }, [undoStack]);

  const redo = useCallback(() => {
    if (redoStack.length === 0) return;

    const strokeToAdd = redoStack[redoStack.length - 1];

    // OPTIMISTIC UPDATE FIRST - immediate UI feedback
    setStrokes((prev) => [...prev, strokeToAdd]);
    setRedoStack((prev) => prev.slice(0, -1));
    setUndoStack((prev) => [...prev, strokeToAdd]);

    // Background sync to Supabase (fire-and-forget, non-blocking)
    supabase
      .from("strokes")
      .insert({
        id: strokeToAdd.id,
        room_id: roomId,
        tool: strokeToAdd.tool,
        color: strokeToAdd.color,
        size: strokeToAdd.size,
        points: strokeToAdd.points,
        text: strokeToAdd.text || null,
        timestamp: strokeToAdd.timestamp,
        is_complete: strokeToAdd.isComplete ?? true,
      })
      .then(({ error }) => {
        if (error) console.error("Error syncing redo:", error);
      });
  }, [redoStack, roomId]);

  const canUndo = undoStack.length > 0;
  const canRedo = redoStack.length > 0;

  const clearCanvas = useCallback(() => {
    // Clear local state first for immediate UI feedback
    setStrokes([]);
    setUndoStack([]);
    setRedoStack([]);

    // Delete all strokes from Supabase
    supabase
      .from("strokes")
      .delete()
      .eq("room_id", roomId)
      .then(({ error }) => {
        if (error) console.error("Error clearing canvas:", error);
      });
  }, [roomId]);

  return {
    strokes,
    addStroke,
    updateStroke,
    deleteStroke,
    loading,
    undo,
    redo,
    canUndo,
    canRedo,
    clearCanvas,
  };
};
