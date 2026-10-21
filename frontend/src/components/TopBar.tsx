import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Bell, LogOut, User, ChevronDown } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { ThemeSelector } from './ThemeSelector';

export function TopBar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [showProfile, setShowProfile] = useState(false);

  const settingsPath =
    user?.role === 'admin'
      ? '/admin/settings'
      : user?.role === 'dean'
      ? '/dean/settings'
      : '/dashboard/settings';

  const notifPath =
    user?.role === 'admin'
      ? '/admin/notifications'
      : user?.role === 'dean'
      ? '/dean/notifications'
      : '/dashboard/notifications';

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <header
      className="h-14 border-b px-4 lg:px-6 flex items-center justify-between shrink-0 bg-surface transition-colors"
      style={{ borderColor: 'var(--border)' }}
    >
      {/* Left: breadcrumb / portal context */}
      <div className="flex items-center gap-2 text-sm text-muted">
        <span className="font-bold text-default tracking-tight">CogniFy</span>
        <span className="text-muted/50 hidden sm:inline">/</span>
        <span className="capitalize font-medium text-default hidden sm:inline">
          {user?.role} Portal
        </span>
      </div>

      {/* Right: Theme Selector, Notifications, and User Profile */}
      <div className="flex items-center gap-3 ml-auto">
        {/* Top-Right Theme & Appearance Dropdown */}
        <ThemeSelector />

        {/* Notifications Button */}
        <Link
          to={notifPath}
          className="btn btn-ghost p-2 relative rounded-full"
          title="Notifications"
        >
          <Bell className="w-4 h-4 text-default" />
          <span
            className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full ring-2 ring-surface"
            style={{ backgroundColor: 'var(--primary)' }}
          />
        </Link>

        {/* Profile Dropdown */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowProfile(!showProfile)}
            className="flex items-center gap-2 btn btn-ghost py-1 px-2 rounded-full border border-default"
          >
            <div
              className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-on-primary shadow-sm"
              style={{ backgroundColor: 'var(--primary)' }}
            >
              {user?.full_name?.charAt(0).toUpperCase() || 'U'}
            </div>
            <span className="hidden sm:block text-xs font-medium text-default max-w-28 truncate">
              {user?.full_name}
            </span>
            <ChevronDown className="w-3.5 h-3.5 text-muted" />
          </button>

          {showProfile && (
            <div
              className="absolute right-0 top-11 z-50 card w-56 py-1.5 shadow-xl border border-default animate-fade-in bg-surface"
            >
              <div className="px-3.5 py-2 border-b border-default">
                <p className="text-sm font-semibold text-default truncate">{user?.full_name}</p>
                <p className="text-xs text-muted truncate">{user?.email}</p>
                <span className="badge badge-primary mt-1.5 text-[10px] uppercase font-bold tracking-wider">
                  {user?.role}
                </span>
              </div>
              <Link
                to={settingsPath}
                onClick={() => setShowProfile(false)}
                className="flex items-center gap-2 px-3.5 py-2 text-xs text-default hover:bg-surface-2 transition-colors"
              >
                <User className="w-3.5 h-3.5 text-muted" />
                Profile & Appearance
              </Link>
              <button
                type="button"
                onClick={handleLogout}
                className="w-full flex items-center gap-2 px-3.5 py-2 text-xs text-danger hover:bg-surface-2 transition-colors border-t border-default text-left"
              >
                <LogOut className="w-3.5 h-3.5" />
                Sign Out
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Close dropdown on outside click */}
      {showProfile && (
        <div className="fixed inset-0 z-40" onClick={() => setShowProfile(false)} />
      )}
    </header>
  );
}
