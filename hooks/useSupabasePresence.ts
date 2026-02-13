import { useEffect, useState, useRef, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { UserPresence, Stroke } from "@/lib/types";
import type { RealtimeChannel } from "@supabase/supabase-js";

// Throttle implementation
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

export const useSupabasePresence = (
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
  const channelRef = useRef<RealtimeChannel | null>(null);

  // 1. Initial Presence Tracking & Subscription
  // 1. Initial Presence Tracking & Subscription
  useEffect(() => {
    if (!roomId || !userId) return;

    const setupPresence = async () => {
      // WaitForRoom creation logic (copied from previous version)
      // Although Ephemeral doesn't stricter require it, good for consistency
      let roomExists = false;
      let attempts = 0;
      const maxAttempts = 10;

      while (!roomExists && attempts < maxAttempts) {
        const { data, error } = await supabase
          .from("rooms")
          .select("id")
          .eq("id", roomId)
          .single();

        if (data) {
          roomExists = true;
        } else {
          await new Promise((r) => setTimeout(r, 1000));
          attempts++;
        }
      }

      // If still not exists, try to create (fallback)
      if (!roomExists) {
        await supabase.from("rooms").upsert({ id: roomId }).select().single();
      }

      // NOW subscribe
      if (channelRef.current) return; // Prevent double sub

      const channel = supabase.channel(`presence:${roomId}`, {
        config: {
          presence: {
            key: userId,
          },
        },
      });

      channel
        .on("presence", { event: "sync" }, () => {
          const state = channel.presenceState<UserPresence>();
          const validOthers: UserPresence[] = [];

          for (const key in state) {
            if (key === userId) continue;
            const presences = state[key];
            if (presences && presences.length > 0) {
              validOthers.push(presences[0] as UserPresence);
            }
          }
          setOthers(validOthers);
        })
        .on("broadcast", { event: "cursor" }, ({ payload }) => {
          if (payload.userId === userId) return;
          setOthers((prev) => {
            const existingIndex = prev.findIndex(
              (p) => p.id === payload.userId,
            );
            if (existingIndex >= 0) {
              const updated = [...prev];
              updated[existingIndex] = {
                ...updated[existingIndex],
                cursor: { x: payload.x, y: payload.y },
                lastActive: Date.now(),
              };
              return updated;
            }
            return prev;
          });
        })
        .on("broadcast", { event: "stroke-start" }, ({ payload }) => {
          setOthers((prev) => {
            const existingIndex = prev.findIndex(
              (p) => p.id === payload.userId,
            );
            if (existingIndex >= 0) {
              const updated = [...prev];
              updated[existingIndex] = {
                ...updated[existingIndex],
                currentStroke: payload.stroke,
              };
              return updated;
            }
            return prev;
          });
        })
        .on("broadcast", { event: "stroke-end" }, ({ payload }) => {
          setOthers((prev) => {
            const existingIndex = prev.findIndex(
              (p) => p.id === payload.userId,
            );
            if (existingIndex >= 0) {
              const updated = [...prev];
              updated[existingIndex] = {
                ...updated[existingIndex],
                currentStroke: null,
              };
              return updated;
            }
            return prev;
          });
        })
        .subscribe(async (status) => {
          console.log(
            `[Presence] Channel status: ${status} for room ${roomId}`,
          );
          if (status === "SUBSCRIBED") {
            const trackStatus = await channel.track(myPresenceRef.current);
            console.log(`[Presence] Track result: ${trackStatus}`);
          }
        });

      channelRef.current = channel;
    };

    setupPresence();

    return () => {
      // Create a cleanup function variable to capture channel
      if (channelRef.current) {
        channelRef.current.unsubscribe();
        channelRef.current = null;
      }
    };
  }, [roomId, userId]);

  // Sync basic info changes (Name/Color) via Presence Track
  useEffect(() => {
    // Check if channel is ready
    if (channelRef.current) {
      // Just re-track with new data
      channelRef.current.track(myPresenceRef.current);
    }
  }, [color, initialName]); // When props change

  // Throttled Broadcasts
  const broadcastCursor = useRef(
    throttle((x: number, y: number) => {
      if (!channelRef.current) return;
      channelRef.current.send({
        type: "broadcast",
        event: "cursor",
        payload: { userId, x, y },
      });
    }, 50), // 20fps cap for network hygiene
  ).current;

  const broadcastStrokeStart = useRef((stroke: Stroke) => {
    if (!channelRef.current) return;
    channelRef.current.send({
      type: "broadcast",
      event: "stroke-start",
      payload: { userId, stroke },
    });
  }).current;

  const broadcastStrokeEnd = useRef(() => {
    if (!channelRef.current) return;
    channelRef.current.send({
      type: "broadcast",
      event: "stroke-end",
      payload: { userId },
    });
  }).current;

  // -- Exposed Methods with local ref updates --

  const setMyName = useCallback((name: string) => {
    myPresenceRef.current.name = name;
    if (channelRef.current) {
      channelRef.current.track(myPresenceRef.current);
    }
  }, []);

  const updateCursor = useCallback(
    (x: number, y: number) => {
      myPresenceRef.current.cursor = { x, y };
      myPresenceRef.current.lastActive = Date.now();
      // We don't track() every move (too expensive for Presence). Use Broadcast.
      broadcastCursor(x, y);
    },
    [broadcastCursor],
  );

  const updateCurrentStroke = useCallback(
    (stroke: Stroke | null) => {
      myPresenceRef.current.currentStroke = stroke;
      myPresenceRef.current.lastActive = Date.now();

      if (stroke) {
        broadcastStrokeStart(stroke);
      } else {
        broadcastStrokeEnd();
      }
    },
    [broadcastStrokeStart, broadcastStrokeEnd],
  );

  return {
    others,
    updateCursor,
    updateCurrentStroke,
    setMyName,
  };
};
