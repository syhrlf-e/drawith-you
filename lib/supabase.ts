import { createClient } from "@supabase/supabase-js";
import { Point, Stroke } from "./types";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error("Missing Supabase environment variables");
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  realtime: {
    params: {
      eventsPerSecond: 100, // High frequency for real-time drawing
    },
  },
});

// Database types
export interface Database {
  public: {
    Tables: {
      rooms: {
        Row: {
          id: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          created_at?: string;
          updated_at?: string;
        };
      };
      strokes: {
        Row: {
          id: string;
          room_id: string;
          tool: string;
          color: string;
          size: number;
          points: Point[]; // JSONB -> Point[]
          text: string | null;
          timestamp: number;
          is_complete: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          room_id: string;
          tool: string;
          color: string;
          size: number;
          points: Point[];
          text?: string | null;
          timestamp: number;
          is_complete?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          room_id?: string;
          tool?: string;
          color?: string;
          size?: number;
          points?: Point[];
          text?: string | null;
          timestamp?: number;
          is_complete?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };
      presence: {
        Row: {
          id: string;
          room_id: string;
          user_id: string;
          name: string;
          color: string;
          cursor: Point | null;
          current_stroke: Stroke | null;
          last_active: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          room_id: string;
          user_id: string;
          name: string;
          color: string;
          cursor?: Point | null;
          current_stroke?: Stroke | null;
          last_active: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          room_id?: string;
          user_id?: string;
          name?: string;
          color?: string;
          cursor?: Point | null;
          current_stroke?: Stroke | null;
          last_active?: number;
          created_at?: string;
          updated_at?: string;
        };
      };
    };
  };
}
