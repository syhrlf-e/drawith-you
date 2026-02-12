"use client";

import { useEffect } from "react";
import { Check, X, AlertCircle, Info } from "lucide-react";

export type ToastType = "success" | "error" | "info";

interface ToastProps {
  message: string;
  type?: ToastType;
  isVisible: boolean;
  onClose: () => void;
  duration?: number;
}

export default function Toast({
  message,
  type = "success",
  isVisible,
  onClose,
  duration = 3000,
}: ToastProps) {
  useEffect(() => {
    if (isVisible) {
      const timer = setTimeout(() => {
        onClose();
      }, duration);
      return () => clearTimeout(timer);
    }
  }, [isVisible, duration, onClose]);

  if (!isVisible) return null;

  const styles = {
    success: {
      icon: (
        <div className="p-1 bg-green-100 rounded-full">
          <Check className="w-4 h-4 text-green-600" />
        </div>
      ),
      border: "border-green-100",
    },
    error: {
      icon: (
        <div className="p-1 bg-red-100 rounded-full">
          <X className="w-4 h-4 text-red-600" />
        </div>
      ),
      border: "border-red-100",
    },
    info: {
      icon: (
        <div className="p-1 bg-blue-100 rounded-full">
          <Info className="w-4 h-4 text-blue-600" />
        </div>
      ),
      border: "border-blue-100",
    },
  };

  return (
    <div
      className={`fixed top-24 left-1/2 -translate-x-1/2 z-[100] flex items-center gap-3 px-4 py-3 bg-white rounded-full shadow-2xl border ${styles[type].border} transform transition-all duration-300 animate-in slide-in-from-top-5 fade-in min-w-[300px] max-w-md`}
    >
      {styles[type].icon}
      <p className="font-medium text-gray-700 text-sm flex-1 text-center">
        {message}
      </p>
      <button
        onClick={onClose}
        className="p-1 hover:bg-gray-100 rounded-full transition-colors text-gray-400"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
