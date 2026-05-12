import { useEffect, useRef, useState } from 'react';
import { Bell, Menu, CheckCheck, Calendar, Wrench, Headphones, DollarSign, Info, ImagePlus, X, FileText, ShoppingCart, Users, Receipt, BookOpen, UserCheck, User, LogOut, UserCircle } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { useNavigate } from 'react-router-dom';
import { settingsApi } from '@/api/settings';
import { useLogoStore } from '@/store/logoStore';
import { useNotificationStore, type NotifType } from '@/store/notificationStore';

const AVATAR_KEY = (id: string) => `avatar_${id}`;

interface Props {
  title: string;
  onMenuClick: () => void;
}

const typeIcon: Record<NotifType | string, React.ElementType> = {
  lead:         Users,
  quotation:    FileText,
  drf:          BookOpen,
  purchase:     ShoppingCart,
  account:      UserCheck,
  invoice:      Receipt,
  support:      Headphones,
  leave:        Calendar,
  salary:       DollarSign,
  visit:        Wrench,
  installation: Wrench,
  training:     BookOpen,
  general:      Info,
};

const typeColor: Record<NotifType | string, string> = {
  lead:         'bg-blue-100 text-blue-600',
  quotation:    'bg-violet-100 text-violet-600',
  drf:          'bg-indigo-100 text-indigo-600',
  purchase:     'bg-orange-100 text-orange-600',
  account:      'bg-emerald-100 text-emerald-600',
  invoice:      'bg-green-100 text-green-600',
  support:      'bg-amber-100 text-amber-600',
  leave:        'bg-sky-100 text-sky-600',
  salary:       'bg-green-100 text-green-600',
  visit:        'bg-violet-100 text-violet-600',
  installation: 'bg-teal-100 text-teal-600',
  training:     'bg-pink-100 text-pink-600',
  general:      'bg-gray-100 text-gray-500',
};

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function Header({ title, onMenuClick }: Props) {
  const user = useAuthStore((s) => s.user);
  const navigate = useNavigate();
  const logoutStore = useAuthStore((s) => s.logout);
  const [open, setOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);
  const avatar = user ? localStorage.getItem(AVATAR_KEY(user._id)) : null;
  const logoInputRef = useRef<HTMLInputElement>(null);
  const logoUrl = useLogoStore((s) => s.logoUrl);
  const setLogoUrl = useLogoStore((s) => s.setLogoUrl);
  const isAdmin = user?.role === 'admin';

  const notifications = useNotificationStore((s) => s.notifications);
  const unread = useNotificationStore((s) => s.unreadCount);
  const markRead = useNotificationStore((s) => s.markRead);
  const markAllRead = useNotificationStore((s) => s.markAllRead);

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      await settingsApi.uploadLogo(file);
    } catch {}
    e.target.value = '';
  };

  const handleRemoveLogo = async () => {
    await settingsApi.deleteLogo();
    setLogoUrl(null);
  };

  // Close dropdowns on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) setOpen(false);
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) setProfileOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleClick = (n: typeof notifications[0]) => {
    if (!n.isRead) markRead(n._id);
    if (n.link) { navigate(n.link); setOpen(false); }
  };

  return (
    <header className="h-14 sm:h-16 bg-white border-b border-gray-100 flex items-center justify-between px-4 sm:px-6 flex-shrink-0">
      <div className="flex items-center gap-3">
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
        {/* Admin: Logo Upload */}
        {isAdmin && (
          <div className="flex items-center gap-1.5">
            <input
              ref={logoInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleLogoUpload}
            />
            <button
              onClick={() => logoInputRef.current?.click()}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-medium text-violet-600 bg-violet-50 hover:bg-violet-100 transition-colors border border-violet-100"
              title="Upload company logo"
            >
              {logoUrl ? (
                <img src={logoUrl} alt="logo" className="h-5 w-5 object-contain rounded" />
              ) : (
                <ImagePlus size={14} />
              )}
              <span className="hidden sm:inline">{logoUrl ? 'Change Logo' : 'Upload Logo'}</span>
            </button>
            {logoUrl && (
              <button
                onClick={handleRemoveLogo}
                className="p-1.5 rounded-xl text-gray-400 hover:bg-red-50 hover:text-red-500 transition-colors"
                title="Remove logo"
              >
                <X size={13} />
              </button>
            )}
          </div>
        )}

        {/* Notification Bell */}
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setOpen(o => !o)}
            className="relative p-2 rounded-xl hover:bg-gray-100 transition-colors"
          >
            <Bell size={17} className="text-gray-500" />
            {unread > 0 && (
              <span className="absolute top-0.5 right-0.5 min-w-[14px] h-3.5 bg-red-500 text-white text-[8px] font-bold rounded-full flex items-center justify-center px-0.5 leading-none">
                {unread > 9 ? '9+' : unread}
              </span>
            )}
          </button>

          {open && (
            <div className="absolute right-0 top-full mt-2 w-80 bg-white border border-gray-200 rounded-2xl shadow-xl z-50 overflow-hidden">
              {/* Header */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
                <span className="font-semibold text-gray-800 text-sm">Notifications</span>
                {unread > 0 && (
                  <button
                    onClick={markAllRead}
                    className="flex items-center gap-1 text-xs text-violet-600 hover:text-violet-800 font-medium"
                  >
                    <CheckCheck size={13} /> Mark all read
                  </button>
                )}
              </div>

              {/* List */}
              <div className="max-h-80 overflow-y-auto divide-y divide-gray-50">
                {notifications.length === 0 ? (
                  <div className="py-10 text-center text-sm text-gray-400">
                    <Bell size={28} className="mx-auto mb-2 opacity-20" />
                    No notifications yet
                  </div>
                ) : (
                  notifications.map(n => {
                    const Icon = typeIcon[n.type] || Info;
                    const iconCls = typeColor[n.type] || typeColor.general;
                    return (
                      <button
                        key={n._id}
                        onClick={() => handleClick(n)}
                        className={`w-full text-left px-4 py-3 flex gap-3 hover:bg-gray-50 transition-colors ${!n.isRead ? 'bg-violet-50/40' : ''}`}
                      >
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5 ${iconCls}`}>
                          <Icon size={14} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={`text-xs font-semibold text-gray-800 leading-tight ${!n.isRead ? 'font-bold' : ''}`}>{n.title}</p>
                          <p className="text-xs text-gray-500 mt-0.5 leading-snug line-clamp-2">{n.message}</p>
                          <p className="text-[10px] text-gray-400 mt-1">{timeAgo(n.createdAt)}</p>
                        </div>
                        {!n.isRead && (
                          <span className="w-2 h-2 bg-violet-500 rounded-full flex-shrink-0 mt-2" />
                        )}
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </div>

        {/* User avatar + dropdown */}
        <div className="relative pl-2 sm:pl-3 border-l border-gray-100" ref={profileRef}>
          <button
            onClick={() => setProfileOpen(o => !o)}
            className="flex items-center gap-2 sm:gap-2.5 hover:opacity-80 transition-opacity"
          >
            {avatar ? (
              <img src={avatar} alt="avatar" className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl object-cover ring-2 ring-violet-200 flex-shrink-0" />
            ) : (
              <UserCircle size={34} className="text-violet-400 flex-shrink-0" strokeWidth={1.5} />
            )}
            <div className="hidden sm:flex flex-col leading-tight text-left">
              <span className="text-sm font-semibold text-gray-800">
                {user?.name?.trim() ? user.name.trim().split(' ')[0] : user?.email?.split('@')[0] ?? 'User'}
              </span>
              <span className="text-[10px] text-gray-400 capitalize">{user?.role?.replace('_', ' ')}</span>
            </div>
          </button>

          {profileOpen && (
            <div className="absolute right-0 top-full mt-2 w-44 bg-white border border-gray-200 rounded-2xl shadow-xl z-50 overflow-hidden">
              <button
                onClick={() => { setProfileOpen(false); navigate('profile'); }}
                className="w-full flex items-center gap-2.5 px-4 py-3 text-sm text-gray-700 hover:bg-violet-50 hover:text-violet-700 transition-colors"
              >
                <User size={14} /> View Profile
              </button>
              <div className="border-t border-gray-100" />
              <button
                onClick={async () => {
                  setProfileOpen(false);
                  const { authApi } = await import('@/api/auth');
                  await authApi.logout();
                  logoutStore();
                  navigate('/login', { replace: true });
                }}
                className="w-full flex items-center gap-2.5 px-4 py-3 text-sm text-red-600 hover:bg-red-50 transition-colors"
              >
                <LogOut size={14} /> Logout
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
