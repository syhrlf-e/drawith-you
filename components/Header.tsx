"use client";

import { Undo2, Redo2, UserPlus, Link, Copy, Check, X } from "lucide-react";
import { useState, useRef, useEffect } from "react";

interface HeaderProps {
  onUndo?: () => void;
  onRedo?: () => void;
  canUndo?: boolean;
  canRedo?: boolean;
  roomId?: string;
}

export default function Header({
  onUndo,
  onRedo,
  canUndo = false,
  canRedo = false,
  roomId,
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

        {/* Invite Button & Popover */}
        <div className="relative" ref={inviteRef}>
          <button
            onClick={() => setIsInviteOpen(!isInviteOpen)}
            className={`flex items-center gap-2 px-3 sm:px-4 py-2 rounded-full transition-all shadow-md hover:shadow-lg ml-2 ${isInviteOpen ? "bg-pink-primary text-white scale-105" : "bg-white text-gray-700 hover:text-pink-primary border border-gray-100"}`}
          >
            <UserPlus className="w-4 h-4 sm:w-5 sm:h-5" />
            <span className="hidden sm:inline font-medium text-sm">Undang</span>
          </button>

          {isInviteOpen && (
            <div className="absolute right-0 top-full mt-2 w-72 bg-white rounded-2xl shadow-xl border border-pink-100 p-4 animate-in slide-in-from-top-2 fade-in duration-200 z-50">
              <div className="flex justify-between items-center mb-3">
                <h3 className="font-bold text-gray-900">Undang Teman</h3>
                <button
                  onClick={() => setIsInviteOpen(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-3">
                {/* Copy Link */}
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-gray-500 uppercase">
                    Bagikan Link
                  </label>
                  <button
                    onClick={copyLink}
                    className="w-full flex items-center justify-between p-3 bg-gray-50 hover:bg-pink-50 rounded-xl border border-gray-100 hover:border-pink-200 transition-all group"
                  >
                    <div className="flex items-center gap-3 text-sm text-gray-700 font-medium">
                      <div className="p-2 bg-white rounded-lg text-pink-500 shadow-sm">
                        <Link className="w-4 h-4" />
                      </div>
                      Salin Link
                    </div>
                    {copiedLink ? (
                      <Check className="w-4 h-4 text-green-500" />
                    ) : (
                      <Copy className="w-4 h-4 text-gray-400 group-hover:text-pink-500" />
                    )}
                  </button>
                </div>

                {/* Copy Code */}
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-gray-500 uppercase">
                    Kode Room
                  </label>
                  <button
                    onClick={copyCode}
                    className="w-full flex items-center justify-between p-3 bg-gray-50 hover:bg-pink-50 rounded-xl border border-gray-100 hover:border-pink-200 transition-all group"
                  >
                    <div className="flex items-center gap-3 text-sm text-gray-700 font-medium">
                      <div className="p-2 bg-white rounded-lg text-pink-500 shadow-sm">
                        <span className="w-4 h-4 flex items-center justify-center font-mono text-xs font-bold leading-none">
                          #
                        </span>
                      </div>
                      <span className="font-mono text-gray-600">{roomId}</span>
                    </div>
                    {copiedCode ? (
                      <Check className="w-4 h-4 text-green-500" />
                    ) : (
                      <Copy className="w-4 h-4 text-gray-400 group-hover:text-pink-500" />
                    )}
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
