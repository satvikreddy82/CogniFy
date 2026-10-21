import React, { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { clsx } from 'clsx';
import {
  BookOpen, LayoutDashboard, FileText, Database, PenTool,
  BarChart2, Brain, Bell, Settings, LogOut, ChevronLeft, ChevronRight,
  Users, ClipboardCheck, TrendingUp, ShieldCheck, FolderOpen, Menu, X, User,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import type { LucideIcon } from 'lucide-react';

interface NavItem {
  label: string;
  to: string;
  icon: LucideIcon;
}

interface SidebarProps {
  items: NavItem[];
  basePath: string;
}

export function Sidebar({ items, basePath }: SidebarProps) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const SidebarContent = () => (
    <div className="flex flex-col h-full bg-sidebar">
      {/* Logo */}
      <div className={clsx('flex items-center px-4 h-16 shrink-0 border-b', collapsed ? 'justify-center' : 'gap-3')} style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
        <div className="w-8 h-8 rounded-brand flex items-center justify-center shrink-0" style={{ backgroundColor: 'var(--primary)' }}>
          <BookOpen className="w-4 h-4" style={{ color: 'var(--text-on-primary)' }} />
        </div>
        {!collapsed && <span className="font-bold text-base text-sidebar-active">CogniFy</span>}
      </div>

      {/* User info */}
      {!collapsed && (
        <div className="px-4 py-4 border-b" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
          <p className="text-xs font-semibold truncate text-on-sidebar">{user?.full_name}</p>
          <p className="text-xs truncate capitalize" style={{ color: 'var(--text-on-sidebar)', opacity: 0.6 }}>
            {user?.role}
          </p>
        </div>
      )}

      {/* Nav items */}
      <nav className="flex-1 overflow-y-auto px-3 py-3 space-y-1">
        {items.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === basePath}
            className={({ isActive }) =>
              clsx('sidebar-link', isActive && 'active', collapsed && 'justify-center px-2')
            }
            title={collapsed ? item.label : undefined}
          >
            <item.icon className="w-4 h-4 shrink-0" />
            {!collapsed && <span className="truncate">{item.label}</span>}
          </NavLink>
        ))}
      </nav>

      {/* Bottom controls */}
      <div className="px-3 py-3 border-t space-y-1" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
        <button
          onClick={handleLogout}
          className={clsx('sidebar-link w-full', collapsed && 'justify-center px-2')}
        >
          <LogOut className="w-4 h-4 shrink-0" />
          {!collapsed && <span>Sign Out</span>}
        </button>
        <button
          onClick={() => setCollapsed(!collapsed)}
          className={clsx('sidebar-link w-full hidden lg:flex', collapsed && 'justify-center px-2')}
        >
          {collapsed
            ? <ChevronRight className="w-4 h-4" />
            : <><ChevronLeft className="w-4 h-4" /><span>Collapse</span></>
          }
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Sidebar */}
      <aside
        className={clsx(
          'hidden lg:flex flex-col h-screen sticky top-0 shrink-0 transition-all duration-200',
          collapsed ? 'w-16' : 'w-60'
        )}
      >
        <SidebarContent />
      </aside>

      {/* Mobile: hamburger */}
      <button
        className="lg:hidden fixed top-4 left-4 z-50 p-2 rounded-brand card"
        onClick={() => setMobileOpen(true)}
      >
        <Menu className="w-5 h-5 text-default" />
      </button>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div className="w-64 flex flex-col h-full">
            <div className="flex justify-end p-3" style={{ backgroundColor: 'var(--surface-sidebar)' }}>
              <button onClick={() => setMobileOpen(false)} className="text-on-sidebar p-1">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1">
              <SidebarContent />
            </div>
          </div>
          <div className="flex-1 bg-black/50" onClick={() => setMobileOpen(false)} />
        </div>
      )}
    </>
  );
}

// ── Pre-configured sidebars for each role ─────────────────────────────────────

export function FacultySidebar() {
  return (
    <Sidebar
      basePath="/dashboard"
      items={[
        { label: 'Dashboard', to: '/dashboard', icon: LayoutDashboard },
        { label: 'Courses', to: '/dashboard/courses', icon: FolderOpen },
        { label: 'Question Bank', to: '/dashboard/question-bank', icon: Database },
        { label: 'Generate Paper', to: '/dashboard/generate', icon: PenTool },
        { label: 'Previous Papers', to: '/dashboard/papers', icon: FileText },
        { label: 'Marks & Analytics', to: '/dashboard/marks', icon: BarChart2 },
        { label: 'Adaptive Planning', to: '/dashboard/adaptive', icon: Brain },
        { label: 'Notifications', to: '/dashboard/notifications', icon: Bell },
        { label: 'Profile', to: '/dashboard/profile', icon: User },
        { label: 'Appearance', to: '/dashboard/settings', icon: Settings },
      ]}
    />
  );
}

export function DeanSidebar() {
  return (
    <Sidebar
      basePath="/dean"
      items={[
        { label: 'Dashboard', to: '/dean', icon: LayoutDashboard },
        { label: 'Faculty Applications', to: '/dean/applications', icon: Users },
        { label: 'Paper Review', to: '/dean/papers', icon: ClipboardCheck },
        { label: 'Analytics', to: '/dean/analytics', icon: TrendingUp },
        { label: 'Notifications', to: '/dean/notifications', icon: Bell },
        { label: 'Profile', to: '/dean/profile', icon: User },
        { label: 'Appearance', to: '/dean/settings', icon: Settings },
      ]}
    />
  );
}

export function AdminSidebar() {
  return (
    <Sidebar
      basePath="/admin"
      items={[
        { label: 'Dashboard', to: '/admin', icon: LayoutDashboard },
        { label: 'Dean Applications', to: '/admin/dean-applications', icon: ClipboardCheck },
        { label: 'Users', to: '/admin/users', icon: Users },
        { label: 'Departments', to: '/admin/departments', icon: FolderOpen },
        { label: 'Audit Logs', to: '/admin/audit-logs', icon: ShieldCheck },
        { label: 'Notifications', to: '/admin/notifications', icon: Bell },
        { label: 'Profile', to: '/admin/profile', icon: User },
        { label: 'Appearance', to: '/admin/settings', icon: Settings },
      ]}
    />
  );
}
