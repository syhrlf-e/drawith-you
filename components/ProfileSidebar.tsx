"use client";

import {
  X,
  Download,
  Trash2,
  Paintbrush,
  LogOut,
  Copy,
  Check,
  Link,
  ChevronDown,
  ChevronUp,
  MoreHorizontal,
  Pencil,
} from "lucide-react";
import { HexColorPicker } from "react-colorful";
import { useState } from "react";
import AlertModal from "./ui/AlertModal";

interface ProfileSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  userName: string;
  onUserNameChange: (name: string) => void;
  userColor: string;
  backgroundColor: string;
  roomId?: string;
  onSave: () => void;
  onClear: () => void;
  onBackgroundChange: (color: string) => void;
  onExitRoom: () => void;
}

export default function ProfileSidebar({
  isOpen,
  onClose,
  userName,
  onUserNameChange,
  userColor,
  backgroundColor,
  roomId,
  onSave,
  onClear,
  onBackgroundChange,
  onExitRoom,
}: ProfileSidebarProps) {
  const [showBackgroundPicker, setShowBackgroundPicker] = useState(false);
  const [showOthers, setShowOthers] = useState(false);
  const [isEditingName, setIsEditingName] = useState(false);
  const [alertType, setAlertType] = useState<"clear" | "exit" | null>(null);
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  const copyCode = () => {
    if (!roomId) return;
    navigator.clipboard.writeText(roomId).then(() => {
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    });
  };

  const copyLink = () => {
    if (!roomId) return;
    const url = window.location.href;
    navigator.clipboard.writeText(url).then(() => {
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    });
  };

  const handleConfirm = () => {
    if (alertType === "clear") {
      onClear();
    } else if (alertType === "exit") {
      onExitRoom();
    }
    setAlertType(null);
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Invisible Backdrop for click-outside */}
      <div className="fixed inset-0 z-40 bg-transparent" onClick={onClose} />

      {/* Popup Menu */}
      <div className="fixed top-[70px] right-4 w-72 max-h-[80vh] overflow-y-auto bg-white rounded-2xl shadow-2xl border border-pink-100 z-50 animate-in fade-in slide-in-from-top-4 duration-200">
        <div className="p-4 space-y-1">
          {/* Header / User Profile & Invite */}
          <div className="flex items-center gap-3 pb-4 mb-2 border-b border-pink-50">
            <div
              className="w-10 h-10 rounded-full border-2 border-pink-100 shadow-sm flex items-center justify-center text-white font-bold text-lg shrink-0"
              style={{ backgroundColor: userColor }}
            >
              {userName.charAt(0).toUpperCase()}
            </div>

            <div className="flex-1 min-w-0 group">
              <p className="text-[10px] text-pink-400 font-bold uppercase tracking-wider mb-0.5">
                Profile
              </p>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 min-w-0">
                  {isEditingName ? (
                    <input
                      type="text"
                      value={userName}
                      onChange={(e) => onUserNameChange(e.target.value)}
                      onBlur={() => setIsEditingName(false)}
                      onKeyDown={(e) =>
                        e.key === "Enter" && setIsEditingName(false)
                      }
                      autoFocus
                      className="w-full text-base font-bold text-gray-800 border-b-2 border-pink-300 focus:border-pink-500 outline-none bg-transparent px-0 py-0"
                      maxLength={15}
                    />
                  ) : (
                    <button
                      onClick={() => setIsEditingName(true)}
                      className="flex items-center gap-1.5 hover:bg-gray-50 rounded-lg pr-2 -ml-1 pl-1 py-0.5 transition-colors max-w-full text-left"
                    >
                      <span className="text-base font-bold text-gray-800 truncate block">
                        {userName}
                      </span>
                      <Pencil
                        size={12}
                        className="text-gray-400 group-hover:text-pink-500 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                      />
                    </button>
                  )}
                </div>

                {/* Inline Invite Button */}
                <button
                  onClick={copyLink}
                  className="p-1.5 text-gray-400 hover:text-pink-500 hover:bg-pink-50 rounded-full transition-colors"
                  title="Undang Teman (Salin Link)"
                >
                  {copiedLink ? (
                    <Check size={16} className="text-green-500" />
                  ) : (
                    <Link size={16} />
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Main Actions - Minimalist Style (No Boxes) */}
          <div className="space-y-1">
            <button
              onClick={() => {
                onSave();
                onClose();
              }}
              className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-gray-50 text-gray-600 hover:text-gray-900 rounded-xl transition-colors text-sm font-medium group"
            >
              <Download
                size={18}
                className="text-gray-400 group-hover:text-blue-500 transition-colors"
              />
              Simpan Gambar
            </button>

            <button
              onClick={() => setAlertType("clear")}
              className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-gray-50 text-gray-600 hover:text-gray-900 rounded-xl transition-colors text-sm font-medium group"
            >
              <Trash2
                size={18}
                className="text-gray-400 group-hover:text-red-500 transition-colors"
              />
              Bersihkan Kanvas
            </button>

            {/* Background Picker */}
            <div className="rounded-xl overflow-hidden">
              <button
                onClick={() => setShowBackgroundPicker(!showBackgroundPicker)}
                className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-gray-50 text-gray-600 hover:text-gray-900 transition-colors group"
              >
                <div className="flex items-center gap-3">
                  <Paintbrush
                    size={18}
                    className="text-gray-400 group-hover:text-purple-500 transition-colors"
                  />
                  <span className="text-sm font-medium">Latar Belakang</span>
                </div>
                <div className="flex items-center gap-2">
                  <div
                    className="w-5 h-5 rounded-full border border-gray-200 shadow-sm"
                    style={{ backgroundColor }}
                  />
                </div>
              </button>

              {showBackgroundPicker && (
                <div className="p-3 bg-gray-50/50 rounded-xl mt-1 animate-in slide-in-from-top-2">
                  <HexColorPicker
                    color={backgroundColor}
                    onChange={onBackgroundChange}
                    style={{ width: "100%", height: "100px" }}
                  />
                </div>
              )}
            </div>
          </div>

          <div className="h-px bg-pink-100 mx-2" />

          {/* Lainnya (Others) Section */}
          <div className="space-y-1">
            <button
              onClick={() => setShowOthers(!showOthers)}
              className="w-full flex items-center justify-between px-3 py-2 text-gray-500 hover:text-pink-600 hover:bg-pink-50 rounded-lg transition-colors"
            >
              <div className="flex items-center gap-2">
                <MoreHorizontal size={18} />
                <span className="text-sm font-bold">Lainnya</span>
              </div>
              {showOthers ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>

            {showOthers && (
              <div className="pt-1 pl-2 animate-in slide-in-from-top-2 duration-200">
                <button
                  onClick={() => setAlertType("exit")}
                  className="w-full flex items-center gap-3 px-3 py-2.5 text-red-500 hover:bg-red-50 rounded-xl transition-colors text-sm font-medium"
                >
                  <LogOut size={16} />
                  Keluar Room
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Alert Modals */}
      <AlertModal
        isOpen={alertType === "clear"}
        onClose={() => setAlertType(null)}
        onConfirm={handleConfirm}
        title="Bersihkan Kanvas?"
        description="Semua gambar akan dihapus permanen. Tindakan ini tidak dapat dibatalkan."
        confirmText="Bersihkan"
        cancelText="Batal"
        variant="danger"
      />

      <AlertModal
        isOpen={alertType === "exit"}
        onClose={() => setAlertType(null)}
        onConfirm={handleConfirm}
        title="Keluar dari Room?"
        description="Anda akan keluar dari room ini dan kembali ke halaman utama."
        confirmText="Keluar"
        cancelText="Batal"
        variant="primary"
      />
    </>
  );
}
