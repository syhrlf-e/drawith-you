import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { Stroke, HistoryAction } from "@/lib/types";
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
  const [undoStack, setUndoStack] = useState<HistoryAction[]>([]);
  const [redoStack, setRedoStack] = useState<HistoryAction[]>([]);

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

  // Debounce map for network updates to avoid flooding Supabase
  const networkUpdateTimeouts = useRef<{ [key: string]: NodeJS.Timeout }>({});

  // Core Sync Helpers (Network Only)
  const syncInsert = useCallback(
    (stroke: Stroke) => {
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

  const syncUpdate = useCallback(
    (strokeId: string, updates: Partial<Stroke>) => {
      // Check debounce
      if (networkUpdateTimeouts.current[strokeId]) {
        clearTimeout(networkUpdateTimeouts.current[strokeId]);
      }

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
            delete networkUpdateTimeouts.current[strokeId];
          });
      }, 100);
    },
    [],
  );

  const syncDelete = useCallback((strokeId: string) => {
    supabase
      .from("strokes")
      .delete()
      .eq("id", strokeId)
      .then(({ error }) => {
        if (error) console.error("Error deleting stroke:", error);
      });
  }, []);

  // -- HISTORY DISPATCHER --
  const dispatch = useCallback(
    (action: HistoryAction) => {
      // 1. Optimistic Update Local State
      if (action.type === "ADD") {
        setStrokes((prev) => [...prev, action.stroke]);
        syncInsert(action.stroke);
      } else if (action.type === "UPDATE") {
        setStrokes((prev) =>
          prev.map((s) =>
            s.id === action.new.id ? { ...s, ...action.new } : s,
          ),
        );
        syncUpdate(action.new.id, action.new);
      } else if (action.type === "DELETE") {
        setStrokes((prev) => prev.filter((s) => s.id !== action.stroke.id));
        syncDelete(action.stroke.id);
      }

      // 2. Add to History
      setUndoStack((prev) => [...prev, action]);
      setRedoStack([]);
    },
    [syncInsert, syncUpdate, syncDelete],
  );

  const addStroke = useCallback(
    (stroke: Stroke) => {
      dispatch({ type: "ADD", stroke });
    },
    [dispatch],
  );

  const updateStroke = useCallback(
    (strokeId: string, updates: Partial<Stroke>) => {
      // NOTE: Traditional updateStroke is "blind" to history if we don't know original state.
      // This is used for live dragging where we DON'T want history.
      // Or for minor updates.
      // IF we want history, use recordAction explicitly.

      setStrokes((prev) =>
        prev.map((s) => (s.id === strokeId ? { ...s, ...updates } : s)),
      );
      syncUpdate(strokeId, updates);
    },
    [syncUpdate],
  );

  const deleteStroke = useCallback((strokeId: string) => {
    // We need the stroke object to be able to undo delete
    setStrokes((prev) => {
      const s = prev.find((p) => p.id === strokeId);
      if (s) {
        // We found it, dispatch properly if we can, but we are inside setter...
        // Can't dispatch inside setter.
        // So we must find it outside.
        return prev; // Don't delete here, do it in dispatch
      }
      return prev;
    });

    // Find it from current state (might be stale if inside callback, but `strokes` is dep?)
    // We need to use Functional Update pattern or `strokesRef`.
    // Let's rely on the component/caller to pass the object if they want robust undo?
    // OR, we just find it in `strokes` state.
    // Since `deleteStroke` is a callback, it captures `strokes` at creation time if included in deps.
    // If we add `strokes` to deps, `deleteStroke` changes on every stroke change -> bad for perf.
    //
    // BETTER: The caller usually has the stroke ID.
    // `dispatch` needs the full object for undo.
    // Let's try to find it in the current state wrapper.
    // Actually, for now, let's just implement `deleteStroke` using `setStrokes` callback to find it,
    // and THEN dispatch.
    // But `dispatch` updates state too.
    //
    // SIMPLIFICATION: `deleteStroke` provided here is a helper.
    // If we want history, we should find the stroke first.
    // Use a ref to access latest strokes without re-creating callback.
  }, []);

  // Use a Ref for strokes to access in non-reactive handlers
  const strokesRef = useRef(strokes);
  useEffect(() => {
    strokesRef.current = strokes;
  }, [strokes]);

  const deleteStrokeWithHistory = useCallback(
    (strokeId: string) => {
      const s = strokesRef.current.find((st) => st.id === strokeId);
      if (s) {
        dispatch({ type: "DELETE", stroke: s });
      } else {
        // Just delete locally/remote if not found (consistency)
        syncDelete(strokeId);
        setStrokes((prev) => prev.filter((p) => p.id !== strokeId));
      }
    },
    [dispatch, syncDelete],
  );

  const undo = useCallback(() => {
    if (undoStack.length === 0) return;

    const actionRaw = undoStack[undoStack.length - 1];
    // Need to clone to avoid mutating history references?
    // HistoryAction is immutable-ish.

    const action = actionRaw;

    // OPTIMISTIC UPDATE FIRST
    if (action.type === "ADD") {
      // Undo Add = Delete
      setStrokes((prev) => prev.filter((s) => s.id !== action.stroke.id));
      syncDelete(action.stroke.id);
    } else if (action.type === "UPDATE") {
      // Undo Update = Revert to Original
      setStrokes((prev) =>
        prev.map((s) =>
          s.id === action.original.id ? { ...s, ...action.original } : s,
        ),
      );
      syncUpdate(action.original.id, action.original);
    } else if (action.type === "DELETE") {
      // Undo Delete = Restore
      setStrokes((prev) => [...prev, action.stroke]);
      syncInsert(action.stroke);
    }

    setUndoStack((prev) => prev.slice(0, -1));
    setRedoStack((prev) => [...prev, action]);
  }, [undoStack, syncDelete, syncUpdate, syncInsert]);

  const redo = useCallback(() => {
    if (redoStack.length === 0) return;

    const action = redoStack[redoStack.length - 1];

    if (action.type === "ADD") {
      // Redo Add = Add again
      setStrokes((prev) => [...prev, action.stroke]);
      syncInsert(action.stroke);
    } else if (action.type === "UPDATE") {
      // Redo Update = Apply New
      setStrokes((prev) =>
        prev.map((s) => (s.id === action.new.id ? { ...s, ...action.new } : s)),
      );
      syncUpdate(action.new.id, action.new);
    } else if (action.type === "DELETE") {
      // Redo Delete = Delete again
      setStrokes((prev) => prev.filter((s) => s.id !== action.stroke.id));
      syncDelete(action.stroke.id);
    }

    setRedoStack((prev) => prev.slice(0, -1));
    setUndoStack((prev) => [...prev, action]);
  }, [redoStack, syncInsert, syncUpdate, syncDelete]);

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
    updateStroke, // Non-history update (live)
    deleteStroke: deleteStrokeWithHistory, // History-aware delete
    recordAction: dispatch, // Expose raw dispatch
    loading,
    undo,
    redo,
    canUndo,
    canRedo,
    clearCanvas,
  };
};
