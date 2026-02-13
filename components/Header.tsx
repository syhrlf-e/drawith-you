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
  onProfileClick?: () => void; // New: triggers profile sidebar
}

export default function Header({
  onUndo,
  onRedo,
  canUndo = false,
  canRedo = false,
  roomId,
  userName = "Artist",
  onUserNameChange,
  onProfileClick,
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
      <div className="flex items-center gap-2 sm:gap-3">
        <h1 className="text-xl sm:text-2xl font-bold text-pink-primary tracking-tight">
          Drawith
        </h1>
        {roomId && (
          <>
            <div className="w-1 h-1 rounded-full bg-gray-300" />
            <button
              onClick={copyCode}
              className="text-xs sm:text-sm font-medium text-gray-400 hover:text-pink-500 transition-colors flex items-center gap-1 cursor-pointer -ml-1 pl-1"
              title="Salin Kode Room"
            >
              <span className="font-mono tracking-wide">{roomId}</span>
              {copiedCode && <Check className="w-3 h-3 text-green-500" />}
            </button>
          </>
        )}
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

        {/* Profile Button - Opens ProfileSidebar */}
        {onProfileClick && (
          <button
            onClick={onProfileClick}
            className="flex items-center justify-center w-10 h-10 rounded-full bg-pink-primary hover:bg-pink-accent transition-all shadow-md hover:shadow-lg ml-2 active:scale-95 border-2 border-pink-100"
            title="Profile & Settings"
          >
            <span className="font-bold text-white text-base">
              {userName.charAt(0).toUpperCase()}
            </span>
          </button>
        )}
      </div>
    </header>
  );
}
