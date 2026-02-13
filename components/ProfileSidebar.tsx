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
} from "lucide-react";
import { HexColorPicker } from "react-colorful";
import { useState } from "react";
import AlertModal from "./ui/AlertModal";

interface ProfileSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  userName: string;
  userColor: string;
  backgroundColor: string;
  roomId?: string; // New: for displaying room code
  onSave: () => void;
  onClear: () => void;
  onBackgroundChange: (color: string) => void;
  onExitRoom: () => void;
}

export default function ProfileSidebar({
  isOpen,
  onClose,
  userName,
  userColor,
  backgroundColor,
  roomId,
  onSave,
  onClear,
  onBackgroundChange,
  onExitRoom,
}: ProfileSidebarProps) {
  const [showBackgroundPicker, setShowBackgroundPicker] = useState(false);
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

  return (
    <>
      {/* Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/30 backdrop-blur-sm z-40 transition-opacity duration-300"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <div
        className={`fixed top-0 right-0 h-full w-80 max-w-[85vw] bg-white shadow-2xl z-50 transform transition-transform duration-300 ease-out ${
          isOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">Profile</h2>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <X size={20} className="text-gray-600" />
            </button>
          </div>

          {/* Scrollable Content */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {/* User Info */}
            <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl p-4 border border-gray-200">
              <div className="flex items-center gap-3">
                <div
                  className="w-12 h-12 rounded-full border-2 border-white shadow-md"
                  style={{ backgroundColor: userColor }}
                />
                <div>
                  <p className="text-sm text-gray-500 font-medium">Nama</p>
                  <p className="text-base font-semibold text-gray-900">
                    {userName}
                  </p>
                </div>
              </div>
            </div>

            {/* Room Code & Share Link */}
            {roomId && (
              <div className="bg-pink-50 border border-pink-100 rounded-xl p-4 space-y-3">
                <p className="text-xs font-semibold text-pink-700 uppercase tracking-wider">
                  Undang Teman
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {/* Copy Code */}
                  <button
                    onClick={copyCode}
                    className="flex flex-col items-start p-3 bg-white hover:bg-gray-50 rounded-lg border border-gray-200 transition-all group"
                  >
                    <span className="text-[10px] uppercase font-bold text-gray-400 mb-1">
                      Kode Room
                    </span>
                    <div className="flex items-center gap-2 w-full justify-between">
                      <span className="font-mono text-gray-900 font-bold text-sm tracking-tight">
                        {roomId}
                      </span>
                      {copiedCode ? (
                        <Check className="w-4 h-4 text-green-500" />
                      ) : (
                        <Copy className="w-4 h-4 text-gray-300 group-hover:text-pink-500" />
                      )}
                    </div>
                  </button>

                  {/* Copy Link */}
                  <button
                    onClick={copyLink}
                    className="flex flex-col items-center justify-center p-3 bg-pink-primary hover:bg-pink-accent rounded-lg transition-all text-center gap-1 active:scale-95 shadow-sm"
                  >
                    <Link className="w-5 h-5 text-white" />
                    <span className="font-semibold text-xs text-white">
                      {copiedLink ? "Tersalin!" : "Salin Link"}
                    </span>
                  </button>
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="space-y-3">
              {/* Simpan Gambar */}
              <button
                onClick={() => {
                  onSave();
                  onClose();
                }}
                className="w-full flex items-center gap-3 px-4 py-3 bg-blue-500 hover:bg-blue-600 text-white rounded-xl transition-colors shadow-sm font-medium"
              >
                <Download size={20} />
                <span className="text-base">Simpan Gambar</span>
              </button>

              {/* Bersihkan Kanvas */}
              <button
                onClick={() => setAlertType("clear")}
                className="w-full flex items-center gap-3 px-4 py-3 bg-red-500 hover:bg-red-600 text-white rounded-xl transition-colors shadow-sm font-medium"
              >
                <Trash2 size={20} />
                <span className="text-base">Bersihkan Kanvas</span>
              </button>

              {/* Latar Belakang */}
              <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
                <button
                  onClick={() => setShowBackgroundPicker(!showBackgroundPicker)}
                  className="w-full flex items-center justify-between"
                >
                  <div className="flex items-center gap-3">
                    <Paintbrush size={20} className="text-gray-700" />
                    <span className="text-base font-medium text-gray-900">
                      Latar Belakang
                    </span>
                  </div>
                  <div
                    className="w-8 h-8 rounded-lg border-2 border-gray-300 shadow-sm"
                    style={{ backgroundColor }}
                  />
                </button>

                {showBackgroundPicker && (
                  <div className="mt-4 pt-4 border-t border-gray-200">
                    <HexColorPicker
                      color={backgroundColor}
                      onChange={onBackgroundChange}
                      style={{ width: "100%" }}
                    />
                    <div className="mt-3 flex items-center justify-between">
                      <span className="text-sm text-gray-600 font-medium">
                        Warna:
                      </span>
                      <span className="text-sm font-mono font-semibold text-gray-900 bg-gray-100 px-3 py-1 rounded-lg">
                        {backgroundColor.toUpperCase()}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Footer - Keluar Room */}
          <div className="p-4 border-t border-gray-200 bg-gray-50">
            <button
              onClick={() => setAlertType("exit")}
              className="w-full flex items-center justify-center gap-3 px-4 py-3 bg-gray-800 hover:bg-gray-900 text-white rounded-xl transition-colors shadow-sm font-medium"
            >
              <LogOut size={20} />
              <span className="text-base">Keluar Room</span>
            </button>
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
