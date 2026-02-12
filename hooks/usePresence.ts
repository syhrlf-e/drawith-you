import { useEffect, useState, useRef, useCallback } from "react";
import {
  ref,
  onValue,
  set,
  onDisconnect,
  serverTimestamp,
  remove,
} from "firebase/database";
import { database } from "@/lib/firebase";
import { UserPresence, Stroke, Point } from "@/lib/types";

// Simple throttle implementation
const throttle = (func: (...args: any[]) => void, limit: number) => {
  let inThrottle: boolean;
  return function (this: any, ...args: any[]) {
    if (!inThrottle) {
      func.apply(this, args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
};

export const usePresence = (
  roomId: string,
  userId: string,
  color: string,
  initialName: string,
) => {
  const [others, setOthers] = useState<UserPresence[]>([]);
  const myPresenceRef = useRef<UserPresence>({
    id: userId,
    name: initialName,
    color: color,
    cursor: null,
    lastActive: Date.now(),
    currentStroke: null,
  });

  // Reference to throttling function to persist across renders
  const updatePresence = useRef(
    throttle((presence: UserPresence) => {
      if (!roomId || !userId) return;
      const userRef = ref(database, `rooms/${roomId}/presence/${userId}`);
      set(userRef, presence).catch((e) =>
        console.error("Presence update failed", e),
      );
    }, 50), // Update max every 50ms (20fps)
  ).current;

  // Initial Setup & Cleanup
  useEffect(() => {
    if (!roomId || !userId) return;

    const userRef = ref(database, `rooms/${roomId}/presence/${userId}`);
    const presenceRef = ref(database, `rooms/${roomId}/presence`);

    // Set initial presence
    set(userRef, myPresenceRef.current);

    // Remove presence on disconnect (close tab/internet lost)
    onDisconnect(userRef).remove();

    // Listen to others
    const unsubscribe = onValue(presenceRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const presenceList = Object.values(data) as UserPresence[];
        // Filter out self
        setOthers(presenceList.filter((p) => p.id !== userId));
      } else {
        setOthers([]);
      }
    });

    return () => {
      unsubscribe();
      remove(userRef); // Remove self on component unmount
    };
  }, [roomId, userId]);

  // Sync Color changes
  useEffect(() => {
    myPresenceRef.current.color = color;
    updatePresence(myPresenceRef.current);
  }, [color]);

  // Sync Name changes manually
  const setMyName = useCallback(
    (name: string) => {
      myPresenceRef.current.name = name;
      updatePresence(myPresenceRef.current);
    },
    [updatePresence],
  );

  const updateCursor = useCallback(
    (x: number, y: number) => {
      myPresenceRef.current.cursor = { x, y };
      myPresenceRef.current.lastActive = Date.now();
      updatePresence(myPresenceRef.current);
    },
    [updatePresence],
  );

  const updateCurrentStroke = useCallback(
    (stroke: Stroke | null) => {
      myPresenceRef.current.currentStroke = stroke;
      myPresenceRef.current.lastActive = Date.now();
      updatePresence(myPresenceRef.current);
    },
    [updatePresence],
  );

  return {
    others,
    updateCursor,
    updateCurrentStroke,
    setMyName,
  };
};
