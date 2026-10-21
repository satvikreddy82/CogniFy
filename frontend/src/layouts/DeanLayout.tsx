import React from 'react';
import { Outlet } from 'react-router-dom';
import { DeanSidebar } from '../components/Sidebar';
import { TopBar } from '../components/TopBar';

export default function DeanLayout() {
  return (
    <div className="flex h-screen overflow-hidden bg-surface-2">
      <DeanSidebar />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <TopBar />
        <main className="flex-1 overflow-y-auto p-6 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
