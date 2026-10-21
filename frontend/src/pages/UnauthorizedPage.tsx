import React from 'react';
import { Link } from 'react-router-dom';
import { ShieldAlert, ArrowLeft, LogOut } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function UnauthorizedPage() {
  const { logout, user } = useAuth();

  return (
    <div className="min-h-screen flex items-center justify-center bg-surface-2 p-6">
      <div className="card p-10 max-w-md w-full text-center animate-fade-in shadow-xl">
        <div className="w-16 h-16 rounded-full bg-danger/10 text-danger flex items-center justify-center mx-auto mb-4">
          <ShieldAlert className="w-8 h-8" />
        </div>
        <h1 className="text-2xl font-bold text-default mb-2">Access Restricted</h1>
        <p className="text-sm text-muted mb-6 leading-relaxed">
          You do not have administrative clearance or the necessary role permissions to access this section of CogniFy.
        </p>

        {user && (
          <div className="p-3 bg-surface-2 rounded-brand text-xs text-muted mb-6">
            Signed in as <strong className="text-default">{user.email}</strong> (Role: <span className="capitalize font-semibold">{user.role}</span>)
          </div>
        )}

        <div className="flex flex-col gap-2">
          <Link
            to={user?.role === 'admin' ? '/admin' : user?.role === 'dean' ? '/dean' : '/dashboard'}
            className="btn btn-primary justify-center"
          >
            <ArrowLeft className="w-4 h-4 mr-1.5" /> Return to Dashboard
          </Link>
          <button
            onClick={logout}
            className="btn btn-outline justify-center text-xs"
          >
            <LogOut className="w-3.5 h-3.5 mr-1.5" /> Sign in with another account
          </button>
        </div>
      </div>
    </div>
  );
}
