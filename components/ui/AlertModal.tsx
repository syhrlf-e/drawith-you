"use client";

import { X } from "lucide-react";

interface AlertModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description?: string;
  confirmText: string;
  cancelText: string;
  variant?: "danger" | "primary";
}

export default function AlertModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  confirmText,
  cancelText,
  variant = "primary",
}: AlertModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden scale-100 animate-in zoom-in-95 duration-200">
        <div className="p-6 text-center space-y-4">
          <h2 className="text-xl font-bold text-gray-900">{title}</h2>
          {description && <p className="text-gray-500">{description}</p>}

          <div className="flex flex-col gap-3 pt-2">
            <button
              onClick={() => {
                onConfirm();
                onClose();
              }}
              className={`w-full py-3 rounded-xl font-bold text-white transition-transform active:scale-95 ${
                variant === "danger"
                  ? "bg-red-500 hover:bg-red-600 shadow-lg shadow-red-200"
                  : "bg-pink-primary hover:bg-pink-accent shadow-lg shadow-pink-200"
              }`}
            >
              {confirmText}
            </button>
            <button
              onClick={onClose}
              className="w-full py-3 rounded-xl font-bold text-gray-500 hover:bg-gray-100 transition-colors"
            >
              {cancelText}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
