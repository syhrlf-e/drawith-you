"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Palette, Sparkles, Users, ArrowRight } from "lucide-react";

export default function Home() {
  const router = useRouter();
  const [roomId, setRoomId] = useState("");

  const createRoom = () => {
    const newRoomId = Math.random().toString(36).substring(2, 9);
    router.push(`/canvas/${newRoomId}`);
  };

  const joinRoom = (e: React.FormEvent) => {
    e.preventDefault();
    if (roomId.trim()) {
      router.push(`/canvas/${roomId}`);
    }
  };

  return (
    <main className="min-h-screen bg-gray-bg flex items-center justify-center p-4">
      <div className="max-w-4xl w-full grid md:grid-cols-2 gap-12 items-center">
        <div className="space-y-8">
          <div className="space-y-4">
            <h1 className="text-5xl md:text-6xl font-bold text-pink-primary tracking-tight">
              Drawith You
            </h1>
            <p className="text-xl text-gray-600 leading-relaxed">
              Menggambar kolaboratif dalam waktu nyata untuk semua orang. Buat
              ruangan, bagikan tautan, dan mulailah berkarya bersama secara
              instan.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-4">
            <button
              onClick={createRoom}
              className="px-8 py-4 bg-pink-primary hover:bg-pink-accent text-white rounded-full font-medium text-lg transition-all transform hover:scale-105 shadow-lg flex items-center justify-center gap-2 group"
            >
              <Sparkles className="w-5 h-5 group-hover:rotate-12 transition-transform" />
              Buat Room
            </button>

            <form onSubmit={joinRoom} className="flex-1 relative">
              <input
                type="text"
                placeholder="Masukkan ID Room"
                value={roomId}
                onChange={(e) => setRoomId(e.target.value)}
                className="w-full px-6 py-4 bg-white border-2 border-pink-100 rounded-full focus:outline-none focus:border-pink-primary transition-colors text-lg text-gray-800"
              />
              <button
                type="submit"
                disabled={!roomId.trim()}
                className="absolute right-2 top-2 bottom-2 p-2 bg-pink-50 text-pink-primary rounded-full hover:bg-pink-100 disabled:opacity-50 disabled:hover:bg-pink-50 transition-colors"
                aria-label="Gabung Room"
              >
                <ArrowRight className="w-6 h-6" />
              </button>
            </form>
          </div>

          <div className="flex gap-8 pt-8 border-t border-gray-200">
            <div className="flex items-center gap-2 text-gray-500">
              <Palette className="w-5 h-5 text-pink-400" />
              <span>Alat Lengkap</span>
            </div>
            <div className="flex items-center gap-2 text-gray-500">
              <Users className="w-5 h-5 text-pink-400" />
              <span>Sinkronisasi Real-time</span>
            </div>
          </div>
        </div>

        <div className="hidden md:block relative">
          <div className="absolute inset-0 bg-gradient-to-tr from-pink-200 to-pink-50 rounded-[40px] rotate-6 transform opacity-50 blur-3xl" />
          <div className="relative bg-white p-8 rounded-[40px] shadow-2xl border border-pink-50 transform hover:-rotate-1 transition-transform duration-500">
            <div className="w-full aspect-square bg-gray-50 rounded-2xl border-2 border-dashed border-gray-200 flex items-center justify-center">
              <span className="text-gray-300 font-medium text-lg select-none">
                Pratinjau Kanvas
              </span>
            </div>
            {/* Quick decorative elements */}
            <div className="absolute -top-6 -right-6 w-16 h-16 bg-pink-primary rounded-2xl flex items-center justify-center shadow-lg transform rotate-12">
              <Palette className="w-8 h-8 text-white" />
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
