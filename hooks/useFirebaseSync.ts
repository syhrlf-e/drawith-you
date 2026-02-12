import { useEffect, useState } from "react";
import {
  ref,
  onValue,
  set,
  get,
  child,
  update,
  remove,
} from "firebase/database";
import { database } from "@/lib/firebase";
import { Stroke } from "@/lib/types";

export const useFirebaseSync = (roomId: string) => {
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [loading, setLoading] = useState(true);
  const [redoStack, setRedoStack] = useState<Stroke[]>([]);

  useEffect(() => {
    if (!roomId) return;

    const strokesRef = ref(database, `rooms/${roomId}/strokes`);

    const unsubscribe = onValue(strokesRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        // Convert object to array
        const strokeArray = Object.values(data) as Stroke[];
        // Sort by timestamp if necessary
        strokeArray.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));

        // Custom simple check to avoid new array ref if data is same (prevents render loops)
        setStrokes((prev) => {
          if (JSON.stringify(prev) === JSON.stringify(strokeArray)) {
            return prev;
          }
          return strokeArray;
        });
      } else {
        setStrokes([]);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [roomId]);

  const addStroke = async (stroke: Stroke) => {
    if (!roomId) return;
    // Clear redo stack on new action
    setRedoStack([]);

    const strokeRef = ref(database, `rooms/${roomId}/strokes/${stroke.id}`);
    try {
      await set(strokeRef, stroke);
    } catch (e) {
      console.error("Error adding stroke: ", e);
    }
  };

  const updateStroke = async (strokeId: string, updates: Partial<Stroke>) => {
    if (!roomId) return;
    const strokeRef = ref(database, `rooms/${roomId}/strokes/${strokeId}`);
    try {
      // Ensure strict object structure to avoid Firebase recursion issues with potentially weird React objects
      // JSON stringify/parse is a crude but effective way to strip everything but data
      const cleanUpdates = JSON.parse(JSON.stringify(updates));
      await update(strokeRef, cleanUpdates);
    } catch (e) {
      console.error("Error updating stroke: ", e);
    }
  };

  const undo = async () => {
    if (strokes.length === 0) return;
    const lastStroke = strokes[strokes.length - 1];

    // Add to redo stack locally
    setRedoStack((prev) => [...prev, lastStroke]);

    // Remove from Firebase
    const strokeRef = ref(database, `rooms/${roomId}/strokes/${lastStroke.id}`);
    try {
      await remove(strokeRef);
    } catch (e) {
      console.error("Undo failed:", e);
    }
  };

  const redo = async () => {
    if (redoStack.length === 0) return;
    const strokeToRestore = redoStack[redoStack.length - 1];

    // Remove from redo stack
    setRedoStack((prev) => prev.slice(0, -1));

    // Restore to Firebase
    const strokeRef = ref(
      database,
      `rooms/${roomId}/strokes/${strokeToRestore.id}`,
    );
    try {
      await set(strokeRef, strokeToRestore);
    } catch (e) {
      console.error("Redo failed:", e);
    }
  };

  return {
    strokes,
    addStroke,
    updateStroke,
    loading,
    undo,
    redo,
    canUndo: strokes.length > 0,
    canRedo: redoStack.length > 0,
  };
};
