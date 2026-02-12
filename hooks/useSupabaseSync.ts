import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { Stroke } from "@/lib/types";
import type { RealtimeChannel } from "@supabase/supabase-js";

export const useSupabaseSync = (roomId: string) => {
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [loading, setLoading] = useState(true);
  const channelRef = useRef<RealtimeChannel | null>(null);

  // Undo/Redo state
  const [history, setHistory] = useState<Stroke[][]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);

  // Initialize room and fetch initial strokes
  useEffect(() => {
    const initRoom = async () => {
      try {
        // Ensure room exists
        const { error: roomError } = await supabase
          .from("rooms")
          .upsert({ id: roomId }, { onConflict: "id" });

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
        setHistory([strokeArray]);
        setHistoryIndex(0);
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
    async (stroke: Stroke) => {
      try {
        const { error } = await supabase.from("strokes").insert({
          id: stroke.id,
          room_id: roomId,
          tool: stroke.tool,
          color: stroke.color,
          size: stroke.size,
          points: stroke.points,
          text: stroke.text || null,
          timestamp: stroke.timestamp,
          is_complete: stroke.isComplete ?? true,
        });

        if (error) throw error;

        // Optimistic update
        setStrokes((prev) => {
          const newStrokes = [...prev, stroke];
          setHistory((h) => [...h.slice(0, historyIndex + 1), newStrokes]);
          setHistoryIndex((i) => i + 1);
          return newStrokes;
        });
      } catch (error) {
        console.error("Error adding stroke:", error);
      }
    },
    [roomId, historyIndex],
  );

  const updateStroke = useCallback(
    async (strokeId: string, updates: Partial<Stroke>) => {
      try {
        const updateData: any = {};
        if (updates.color !== undefined) updateData.color = updates.color;
        if (updates.size !== undefined) updateData.size = updates.size;
        if (updates.points !== undefined) updateData.points = updates.points;
        if (updates.text !== undefined) updateData.text = updates.text || null;
        if (updates.isComplete !== undefined)
          updateData.is_complete = updates.isComplete;

        const { error } = await supabase
          .from("strokes")
          .update(updateData)
          .eq("id", strokeId);

        if (error) throw error;

        // Optimistic update
        setStrokes((prev) =>
          prev.map((s) => (s.id === strokeId ? { ...s, ...updates } : s)),
        );
      } catch (error) {
        console.error("Error updating stroke:", error);
      }
    },
    [],
  );

  const deleteStroke = useCallback(
    async (strokeId: string) => {
      try {
        const { error } = await supabase
          .from("strokes")
          .delete()
          .eq("id", strokeId);

        if (error) throw error;

        // Optimistic update
        setStrokes((prev) => {
          const newStrokes = prev.filter((s) => s.id !== strokeId);
          setHistory((h) => [...h.slice(0, historyIndex + 1), newStrokes]);
          setHistoryIndex((i) => i + 1);
          return newStrokes;
        });
      } catch (error) {
        console.error("Error deleting stroke:", error);
      }
    },
    [historyIndex],
  );

  const undo = useCallback(async () => {
    if (historyIndex > 0) {
      const prevState = history[historyIndex - 1];
      setHistoryIndex((i) => i - 1);
      setStrokes(prevState);

      // Sync to Supabase
      try {
        const currentIds = new Set(strokes.map((s) => s.id));
        const prevIds = new Set(prevState.map((s) => s.id));

        // Delete strokes that were added
        const toDelete = strokes.filter((s) => !prevIds.has(s.id));
        for (const stroke of toDelete) {
          await supabase.from("strokes").delete().eq("id", stroke.id);
        }

        // Add strokes that were deleted
        const toAdd = prevState.filter((s) => !currentIds.has(s.id));
        for (const stroke of toAdd) {
          await supabase.from("strokes").insert({
            id: stroke.id,
            room_id: roomId,
            tool: stroke.tool,
            color: stroke.color,
            size: stroke.size,
            points: stroke.points,
            text: stroke.text || null,
            timestamp: stroke.timestamp,
            is_complete: stroke.isComplete ?? true,
          });
        }
      } catch (error) {
        console.error("Error syncing undo:", error);
      }
    }
  }, [historyIndex, history, strokes, roomId]);

  const redo = useCallback(async () => {
    if (historyIndex < history.length - 1) {
      const nextState = history[historyIndex + 1];
      setHistoryIndex((i) => i + 1);
      setStrokes(nextState);

      // Sync to Supabase
      try {
        const currentIds = new Set(strokes.map((s) => s.id));
        const nextIds = new Set(nextState.map((s) => s.id));

        // Delete strokes that were removed
        const toDelete = strokes.filter((s) => !nextIds.has(s.id));
        for (const stroke of toDelete) {
          await supabase.from("strokes").delete().eq("id", stroke.id);
        }

        // Add strokes that were added
        const toAdd = nextState.filter((s) => !currentIds.has(s.id));
        for (const stroke of toAdd) {
          await supabase.from("strokes").insert({
            id: stroke.id,
            room_id: roomId,
            tool: stroke.tool,
            color: stroke.color,
            size: stroke.size,
            points: stroke.points,
            text: stroke.text || null,
            timestamp: stroke.timestamp,
            is_complete: stroke.isComplete ?? true,
          });
        }
      } catch (error) {
        console.error("Error syncing redo:", error);
      }
    }
  }, [historyIndex, history, strokes, roomId]);

  const canUndo = historyIndex > 0;
  const canRedo = historyIndex < history.length - 1;

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
  };
};
