import React from 'react';
import { Link } from 'react-router-dom';
import { FileQuestion, ArrowLeft, Home } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function NotFoundPage() {
  const { user } = useAuth();

  const destination = user
    ? user.role === 'admin'
      ? '/admin'
      : user.role === 'dean'
      ? '/dean'
      : '/dashboard'
    : '/login';

  return (
    <div className="min-h-screen flex items-center justify-center bg-surface-2 p-6">
      <div className="card p-10 max-w-md w-full text-center animate-fade-in shadow-xl">
        <div className="w-16 h-16 rounded-full bg-primary/10 text-primary flex items-center justify-center mx-auto mb-4">
          <FileQuestion className="w-8 h-8" />
        </div>
        <h1 className="text-3xl font-bold text-default mb-1">404</h1>
        <h2 className="text-lg font-bold text-default mb-2">Page Not Found</h2>
        <p className="text-sm text-muted mb-6 leading-relaxed">
          The page or assessment resource you are looking for does not exist or has been relocated.
        </p>

        <Link to={destination} className="btn btn-primary justify-center w-full">
          <Home className="w-4 h-4 mr-1.5" /> Return to Workspace
        </Link>
      </div>
    </div>
  );
}
