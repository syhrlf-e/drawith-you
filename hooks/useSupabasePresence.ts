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
  const roomReadyRef = useRef(false); // Track if room is ready for presence updates

  // Throttled update to Supabase (non-blocking fire-and-forget)
  const updatePresence = useRef(
    throttle((presence: UserPresence) => {
      if (!roomId || !userId) return;
      if (!roomReadyRef.current) return; // Don't update until room is confirmed ready

      // Fire-and-forget - don't wait for response to keep cursor smooth
      supabase
        .from("presence")
        .upsert({
          id: userId,
          room_id: roomId,
          user_id: userId,
          name: presence.name,
          color: presence.color,
          cursor: presence.cursor,
          current_stroke: presence.currentStroke,
          last_active: presence.lastActive,
        })
        .then(({ error }) => {
          if (error) console.error("Presence update failed", error);
        });
    }, 100), // Update max every 100ms (10fps)
  ).current;

  // Initial setup and real-time subscription
  useEffect(() => {
    if (!roomId || !userId) return;

    const initPresence = async () => {
      // 1. Ensure room exists (Wait for useSupabaseSync to create it)
      let roomExists = false;
      let attempts = 0;
      const maxAttempts = 10; // Increase attempts

      while (!roomExists && attempts < maxAttempts) {
        // Check if room exists
        const { data: room, error } = await supabase
          .from("rooms")
          .select("id")
          .eq("id", roomId)
          .single();

        if (room) {
          roomExists = true;
        } else {
          // Wait longer between checks
          await new Promise((r) => setTimeout(r, 1000));
          attempts++;
        }
      }

      if (!roomExists) {
        // Fallback: Try to create it only if waiting failed (last resort)
        const { error: createError } = await supabase
          .from("rooms")
          .upsert({ id: roomId })
          .select()
          .single();

        if (!createError) {
          roomExists = true;
        } else {
          console.error(
            "Failed to join room: Room not found and creation failed",
            createError,
          );
          return;
        }
      }

      // Set initial presence
      await supabase.from("presence").upsert({
        id: userId,
        room_id: roomId,
        user_id: userId,
        name: myPresenceRef.current.name,
        color: myPresenceRef.current.color,
        cursor: null,
        current_stroke: null,
        last_active: Date.now(),
      });

      // Fetch initial presence
      const { data } = await supabase
        .from("presence")
        .select("*")
        .eq("room_id", roomId)
        .neq("user_id", userId);

      if (data) {
        const presenceList: UserPresence[] = data.map((row) => ({
          id: row.user_id,
          name: row.name,
          color: row.color,
          cursor: row.cursor,
          lastActive: row.last_active,
          currentStroke: row.current_stroke,
        }));
        setOthers(presenceList);
      }

      // Mark room as ready for presence updates
      roomReadyRef.current = true;
    };

    initPresence();

    // Subscribe to presence changes
    const channel = supabase
      .channel(`presence:${roomId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "presence",
          filter: `room_id=eq.${roomId}`,
        },
        (payload) => {
          const payloadNew = payload.new as any;
          const payloadOld = payload.old as any;

          if (payloadNew && payloadNew.user_id !== userId) {
            const newPresence: UserPresence = {
              id: payloadNew.user_id,
              name: payloadNew.name,
              color: payloadNew.color,
              cursor: payloadNew.cursor,
              lastActive: payloadNew.last_active,
              currentStroke: payloadNew.current_stroke,
            };

            if (
              payload.eventType === "INSERT" ||
              payload.eventType === "UPDATE"
            ) {
              setOthers((prev) => {
                const existing = prev.findIndex((p) => p.id === newPresence.id);
                if (existing >= 0) {
                  // Update existing
                  const updated = [...prev];
                  updated[existing] = newPresence;
                  return updated;
                } else {
                  // Add new
                  return [...prev, newPresence];
                }
              });
            } else if (payload.eventType === "DELETE" && payloadOld) {
              setOthers((prev) =>
                prev.filter((p) => p.id !== payloadOld.user_id),
              );
            }
          }
        },
      )
      .subscribe();

    channelRef.current = channel;

    // Cleanup on unmount
    return () => {
      roomReadyRef.current = false; // Reset room ready state
      channel.unsubscribe();
      // Remove presence from database
      supabase.from("presence").delete().eq("id", userId).then();
    };
  }, [roomId, userId]);

  // Sync color changes
  useEffect(() => {
    myPresenceRef.current.color = color;
    updatePresence(myPresenceRef.current);
  }, [color, updatePresence]);

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
