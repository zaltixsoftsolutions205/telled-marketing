import { Bell, Menu } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';

interface Props {
  title: string;
  onMenuClick: () => void;
}

export default function Header({ title, onMenuClick }: Props) {
  const user = useAuthStore((s) => s.user);
  return (
    <header className="h-14 sm:h-16 bg-white border-b border-gray-100 flex items-center justify-between px-4 sm:px-6 flex-shrink-0">
      <div className="flex items-center gap-3">
        {/* Hamburger — mobile only */}
        <button
          onClick={onMenuClick}
          className="p-2 rounded-xl hover:bg-gray-100 transition-colors lg:hidden"
          aria-label="Open menu"
        >
          <Menu size={18} className="text-gray-600" />
        </button>
        <h1 className="text-base sm:text-lg font-bold text-gray-900 truncate">{title}</h1>
      </div>

      <div className="flex items-center gap-2 sm:gap-3">
        <button className="relative p-2 rounded-xl hover:bg-gray-100 transition-colors">
          <Bell size={17} className="text-gray-500" />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-violet-500 rounded-full" />
        </button>
        <div className="flex items-center gap-2 sm:gap-2.5 pl-2 sm:pl-3 border-l border-gray-100">
          <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-violet-100 flex items-center justify-center">
            <span className="text-violet-700 font-bold text-xs">{user?.name?.charAt(0).toUpperCase()}</span>
          </div>
          <span className="text-sm font-medium text-gray-700 hidden sm:block">{user?.name?.split(' ')[0]}</span>
        </div>
      </div>
    </header>
  );
}
