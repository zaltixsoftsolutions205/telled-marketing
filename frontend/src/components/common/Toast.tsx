// src/components/common/Toast.tsx
import { useEffect } from 'react';
import { X, CheckCircle, AlertCircle, Info, AlertTriangle } from 'lucide-react';

interface ToastProps {
  message: string;
  type?: 'success' | 'error' | 'info' | 'warning';
  duration?: number;
  onClose: () => void;
}

const icons = {
  success: { icon: CheckCircle, color: 'text-emerald-500', bg: 'bg-emerald-50', border: 'border-emerald-200' },
  error: { icon: AlertCircle, color: 'text-red-500', bg: 'bg-red-50', border: 'border-red-200' },
  info: { icon: Info, color: 'text-blue-500', bg: 'bg-blue-50', border: 'border-blue-200' },
  warning: { icon: AlertTriangle, color: 'text-amber-500', bg: 'bg-amber-50', border: 'border-amber-200' },
};

export default function Toast({ message, type = 'info', duration = 5000, onClose }: ToastProps) {
  const { icon: Icon, color, bg, border } = icons[type];

  useEffect(() => {
    const timer = setTimeout(() => {
      onClose();
    }, duration);

    return () => clearTimeout(timer);
  }, [duration, onClose]);

  return (
    <div className={`fixed top-4 right-4 z-50 animate-slide-in-right`}>
      <div className={`flex items-center gap-3 px-4 py-3 rounded-lg shadow-lg border ${bg} ${border} min-w-[300px] max-w-md`}>
        <Icon className={`${color} flex-shrink-0`} size={20} />
        <p className="text-sm text-gray-700 flex-1">{message}</p>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-gray-600 transition-colors flex-shrink-0"
        >
          <X size={16} />
        </button>
      </div>
    </div>
  );
}