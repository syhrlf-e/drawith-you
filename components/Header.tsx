"use client";

import { Undo2, Redo2, User, Link, Copy, Check, X, Pencil } from "lucide-react";
import { useState, useRef, useEffect } from "react";

interface HeaderProps {
  onUndo?: () => void;
  onRedo?: () => void;
  canUndo?: boolean;
  canRedo?: boolean;
  roomId?: string;
  userName?: string;
  onUserNameChange?: (name: string) => void;
}

export default function Header({
  onUndo,
  onRedo,
  canUndo = false,
  canRedo = false,
  roomId,
  userName = "Artist",
  onUserNameChange,
}: HeaderProps) {
  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const inviteRef = useRef<HTMLDivElement>(null);

  // Close invite modal/popover when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        inviteRef.current &&
        !inviteRef.current.contains(event.target as Node)
      ) {
        setIsInviteOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [inviteRef]);

  const copyLink = () => {
    if (!roomId) return;
    const url = window.location.href;
    navigator.clipboard.writeText(url).then(() => {
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    });
  };

  const copyCode = () => {
    if (!roomId) return;
    navigator.clipboard.writeText(roomId).then(() => {
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    });
  };

  return (
    <header className="fixed top-0 left-0 right-0 bg-white/80 backdrop-blur-md border-b border-gray-100 px-4 py-3 flex items-center justify-between z-40 shadow-sm transition-all">
      <div className="flex items-center gap-2 sm:gap-4">
        <h1 className="text-xl sm:text-2xl font-bold text-pink-primary tracking-tight truncate max-w-[120px] sm:max-w-none">
          Drawith You
        </h1>
      </div>

      <div className="flex items-center gap-2">
        {/* Undo/Redo Group */}
        <div className="flex items-center bg-gray-50 rounded-full p-1 border border-gray-100">
          <button
            onClick={onUndo}
            disabled={!canUndo}
            className="p-2 rounded-full hover:bg-white hover:shadow-sm text-gray-600 hover:text-pink-primary transition-all disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:shadow-none"
            title="Urungkan"
          >
            <Undo2 className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>
          <div className="w-px h-4 bg-gray-200 mx-1"></div>
          <button
            onClick={onRedo}
            disabled={!canRedo}
            className="p-2 rounded-full hover:bg-white hover:shadow-sm text-gray-600 hover:text-pink-primary transition-all disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:shadow-none"
            title="Ulangi"
          >
            <Redo2 className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>
        </div>

        {/* Profile / Invite Menu */}
        <div className="relative" ref={inviteRef}>
          <button
            onClick={() => setIsInviteOpen(!isInviteOpen)}
            className={`flex items-center justify-center w-10 h-10 rounded-full transition-all shadow-md hover:shadow-lg ml-2 border-2 ${isInviteOpen ? "bg-pink-600 border-pink-600 scale-105" : "bg-pink-500 border-white hover:bg-pink-600"}`}
            title="Profile & Menu"
          >
            <span className="font-bold text-white text-base">
              {userName.charAt(0).toUpperCase()}
            </span>
          </button>

          {isInviteOpen && (
            <div className="absolute right-0 top-full mt-3 w-72 sm:w-80 bg-white rounded-2xl shadow-xl border border-pink-100 p-4 sm:p-5 animate-in slide-in-from-top-2 fade-in duration-200 z-50">
              <div className="flex justify-between items-center mb-3 sm:mb-4">
                <h3 className="font-bold text-gray-900 text-base sm:text-lg">
                  Profile
                </h3>
                <button
                  onClick={() => setIsInviteOpen(false)}
                  className="text-gray-400 hover:text-gray-600 transition-colors bg-gray-50 p-1 rounded-full"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-4 sm:space-y-6">
                {/* 1. Name Input (Editable Text Style) */}
                <div className="space-y-1">
                  <label className="text-[10px] sm:text-xs font-semibold text-gray-400 ml-3 uppercase tracking-wider">
                    Nama kamu
                  </label>
                  <div className="flex items-center justify-between group py-1 px-3">
                    <input
                      type="text"
                      value={userName}
                      onChange={(e) =>
                        onUserNameChange && onUserNameChange(e.target.value)
                      }
                      className="bg-transparent border-none outline-none text-gray-900 font-bold text-lg sm:text-xl w-full placeholder-gray-300 focus:ring-0 px-0 leading-tight"
                      placeholder="Ketik nama..."
                      maxLength={15}
                    />
                    <Pencil className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-gray-400 group-hover:text-pink-500 transition-colors cursor-pointer" />
                  </div>
                  <div className="h-0.5 w-[calc(100%-24px)] mx-auto bg-gray-100 mt-0.5" />
                </div>

                {/* 2. Room Code & Share */}
                <div className="grid grid-cols-2 gap-2 sm:gap-3">
                  {/* Code Display */}
                  <button
                    onClick={copyCode}
                    className="flex flex-col items-start justify-center p-2.5 sm:p-3 bg-gray-50 hover:bg-gray-100 rounded-xl sm:rounded-2xl border border-transparent transition-all group gap-0.5 relative overflow-hidden"
                    title="Salin Kode"
                  >
                    <span className="text-[9px] sm:text-[10px] uppercase font-bold text-gray-400">
                      Kode Room
                    </span>
                    <div className="flex items-center gap-2 w-full justify-between mt-0.5">
                      <span className="font-mono text-gray-900 font-bold text-base sm:text-xl tracking-tight">
                        {roomId}
                      </span>
                      {copiedCode ? (
                        <Check className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-green-500" />
                      ) : (
                        <Copy className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-gray-300 group-hover:text-pink-500" />
                      )}
                    </div>
                  </button>

                  {/* Share Link Button */}
                  <button
                    onClick={copyLink}
                    className="flex flex-col items-center justify-center p-3 bg-pink-500 hover:bg-pink-600 rounded-2xl border border-transparent transition-all shadow-md hover:shadow-lg text-center gap-1 active:scale-95"
                    title="Bagikan Link"
                  >
                    <span className="font-bold text-sm text-white">
                      {copiedLink ? "Tersalin!" : "Undang Teman"}
                    </span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
