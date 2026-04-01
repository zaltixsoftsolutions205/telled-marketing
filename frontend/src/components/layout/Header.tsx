import { useEffect, useRef, useState, useCallback } from 'react';
import { Bell, Menu, CheckCheck, Calendar, Wrench, Headphones, DollarSign, Info, ImagePlus, X, Pencil, Check } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { notificationsApi, type Notification } from '@/api/notifications';
import { useNavigate } from 'react-router-dom';
import { settingsApi, resolveLogoUrl } from '@/api/settings';
import { useLogoStore } from '@/store/logoStore';

interface Props {
  title: string;
  onMenuClick: () => void;
}

const typeIcon: Record<string, React.ElementType> = {
  leave:   Calendar,
  visit:   Wrench,
  support: Headphones,
  salary:  DollarSign,
  general: Info,
};

const typeColor: Record<string, string> = {
  leave:   'bg-blue-100 text-blue-600',
  visit:   'bg-violet-100 text-violet-600',
  support: 'bg-amber-100 text-amber-600',
  salary:  'bg-green-100 text-green-600',
  general: 'bg-gray-100 text-gray-500',
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
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unread, setUnread] = useState(0);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const logoUrl = useLogoStore((s) => s.logoUrl);
  const setLogoUrl = useLogoStore((s) => s.setLogoUrl);
  const companyName = useLogoStore((s) => s.companyName);
  const setCompanyName = useLogoStore((s) => s.setCompanyName);
  const isAdmin = user?.role === 'admin';
  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState('');

  const startEditName = () => {
    setNameInput(companyName);
    setEditingName(true);
  };
  const saveCompanyName = () => {
    const trimmed = nameInput.trim();
    if (trimmed) setCompanyName(trimmed);
    setEditingName(false);
  };
  const handleNameKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') saveCompanyName();
    if (e.key === 'Escape') setEditingName(false);
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      await settingsApi.uploadLogo(file);
    } catch {}
    // reset input so same file can be re-uploaded
    e.target.value = '';
  };

  const handleRemoveLogo = async () => {
    await settingsApi.deleteLogo();
    setLogoUrl(null);
  };

  const resolvedLogo = resolveLogoUrl(logoUrl);

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await notificationsApi.getAll();
      setNotifications(res.data);
      setUnread(res.unreadCount);
    } catch {}
  }, []);

  // Initial fetch + poll every 30s
  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleClick = async (n: Notification) => {
    if (!n.isRead) {
      await notificationsApi.markRead(n._id);
      setNotifications(prev => prev.map(x => x._id === n._id ? { ...x, isRead: true } : x));
      setUnread(u => Math.max(0, u - 1));
    }
    if (n.link) {
      navigate(n.link);
      setOpen(false);
    }
  };

  const handleMarkAll = async () => {
    await notificationsApi.markAllRead();
    setNotifications(prev => prev.map(x => ({ ...x, isRead: true })));
    setUnread(0);
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
              {resolvedLogo ? (
                <img src={resolvedLogo} alt="logo" className="h-5 w-5 object-contain rounded" />
              ) : (
                <ImagePlus size={14} />
              )}
              <span className="hidden sm:inline">{resolvedLogo ? 'Change Logo' : 'Upload Logo'}</span>
            </button>
            {resolvedLogo && (
              <button
                onClick={handleRemoveLogo}
                className="p-1.5 rounded-xl text-gray-400 hover:bg-red-50 hover:text-red-500 transition-colors"
                title="Remove logo"
              >
                <X size={13} />
              </button>
            )}

            {/* Company name editor */}
            {editingName ? (
              <div className="flex items-center gap-1">
                <input
                  autoFocus
                  value={nameInput}
                  onChange={(e) => setNameInput(e.target.value)}
                  onKeyDown={handleNameKey}
                  placeholder="Company name"
                  className="h-7 px-2 text-xs border border-violet-300 rounded-lg outline-none focus:ring-1 focus:ring-violet-400 w-36"
                />
                <button onClick={saveCompanyName} className="p-1 rounded-lg text-violet-600 hover:bg-violet-100 transition-colors">
                  <Check size={13} />
                </button>
                <button onClick={() => setEditingName(false)} className="p-1 rounded-lg text-gray-400 hover:bg-gray-100 transition-colors">
                  <X size={13} />
                </button>
              </div>
            ) : (
              <button
                onClick={startEditName}
                className="flex items-center gap-1 px-2 py-1.5 rounded-xl text-xs text-gray-500 hover:bg-gray-100 transition-colors"
                title="Set company name"
              >
                <Pencil size={12} />
                <span className="hidden sm:inline">{companyName || 'Set Name'}</span>
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
                    onClick={handleMarkAll}
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

        {/* User avatar */}
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
