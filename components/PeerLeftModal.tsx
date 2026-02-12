import React from "react";
import { LogOut, User } from "lucide-react";
import { useRouter } from "next/navigation";

interface PeerLeftModalProps {
  isOpen: boolean;
  onClose: () => void;
  playerCount: number;
}

export default function PeerLeftModal({
  isOpen,
  onClose,
  playerCount,
}: PeerLeftModalProps) {
  const router = useRouter();

  if (!isOpen) return null;

  const handleLeave = () => {
    router.push("/");
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm p-6 transform transition-all scale-100 animate-in zoom-in-95 duration-200 border border-pink-100">
        <div className="flex flex-col items-center text-center space-y-4">
          {/* Icon Section */}
          <div className="w-16 h-16 bg-pink-50 rounded-full flex items-center justify-center mb-2">
            <LogOut className="w-8 h-8 text-pink-500 ml-1" />
          </div>

          {/* Text Section */}
          <div className="space-y-2">
            <h3 className="text-xl font-bold text-gray-900 leading-tight">
              Teman kamu keluar <br /> dari room 😔
            </h3>
            <p className="text-gray-500 text-sm">
              Kamu mau lanjut main sendirian?
            </p>
          </div>

          {/* Player Count Badge */}
          <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-gray-50 rounded-full border border-gray-100">
            <User className="w-3.5 h-3.5 text-gray-400" />
            <span className="text-xs font-semibold text-gray-600">
              {playerCount} Pemain di room
            </span>
          </div>

          {/* Buttons */}
          <div className="flex flex-col w-full gap-3 pt-2">
            <button
              onClick={onClose}
              className="w-full py-3 px-4 bg-pink-500 hover:bg-pink-600 text-white font-bold rounded-xl transition-all shadow-md hover:shadow-lg active:scale-95"
            >
              Iya, sendirian aja
            </button>
            <button
              onClick={handleLeave}
              className="w-full py-3 px-4 bg-white border-2 border-gray-100 hover:border-gray-200 text-gray-600 font-bold rounded-xl transition-all hover:bg-gray-50 active:scale-95"
            >
              Keluar juga ah
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
