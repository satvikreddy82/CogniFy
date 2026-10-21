import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { ClipboardCheck, Users, CheckCircle, Clock, FileText, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { api } from '../../services/api';
import { useAuth } from '../../context/AuthContext';

export default function DeanDashboard() {
  const { user } = useAuth();

  const { data: papers = [] } = useQuery({
    queryKey: ['dean-papers'],
    queryFn: () => api.get('/papers').then(r => r.data),
    retry: false,
  });

  const pending = papers.filter((p: any) => p.status === 'pending_review');
  const approved = papers.filter((p: any) => p.status === 'approved');
  const rejected = papers.filter((p: any) => p.status === 'rejected');

  return (
    <div className="space-y-8 animate-fade-in">
      <div>
        <h1 className="page-title">Welcome, {user?.full_name?.split(' ').slice(-1)[0]} 🎓</h1>
        <p className="text-sm text-muted mt-1">Dean oversight dashboard — review papers and manage faculty.</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="stat-card"><p className="text-xs font-medium text-muted uppercase tracking-wide">Pending Review</p><p className="text-3xl font-bold text-default mt-1">{pending.length}</p></div>
        <div className="stat-card"><p className="text-xs font-medium text-muted uppercase tracking-wide">Approved</p><p className="text-3xl font-bold text-default mt-1">{approved.length}</p></div>
        <div className="stat-card"><p className="text-xs font-medium text-muted uppercase tracking-wide">Rejected</p><p className="text-3xl font-bold text-default mt-1">{rejected.length}</p></div>
        <div className="stat-card"><p className="text-xs font-medium text-muted uppercase tracking-wide">Total Papers</p><p className="text-3xl font-bold text-default mt-1">{papers.length}</p></div>
      </div>

      {/* Pending papers */}
      <div className="card p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="section-title">Papers Awaiting Review</h2>
          <Link to="/dean/papers" className="text-xs font-medium flex items-center gap-1" style={{ color: 'var(--primary)' }}>View all <ArrowRight className="w-3 h-3" /></Link>
        </div>
        {pending.length === 0 ? (
          <div className="text-center py-8 text-muted">
            <CheckCircle className="w-8 h-8 mx-auto mb-2 opacity-20" />
            <p className="text-sm">All caught up! No papers pending review.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {pending.slice(0, 5).map((p: any) => (
              <div key={p.id} className="flex items-center justify-between p-3 rounded-brand bg-surface-2 hover:bg-surface-3 transition-colors">
                <div>
                  <p className="text-sm font-medium text-default">{p.title || `Paper ${p.id.slice(0, 8)}`}</p>
                  <p className="text-xs text-muted mt-0.5">{p.total_marks} marks · {new Date(p.created_at).toLocaleDateString()}</p>
                </div>
                <Link to="/dean/papers" className="btn btn-primary text-xs py-1.5">Review</Link>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Link to="/dean/applications" className="card p-5 hover:shadow-card-md transition-all group flex items-center gap-4">
          <div className="p-3 rounded-brand-lg bg-primary-light"><Users className="w-5 h-5" style={{ color: 'var(--primary)' }} /></div>
          <div><p className="font-semibold text-default">Faculty Applications</p><p className="text-xs text-muted mt-0.5">Review pending registrations</p></div>
          <ArrowRight className="w-4 h-4 text-muted ml-auto opacity-0 group-hover:opacity-100 transition-opacity" />
        </Link>
        <Link to="/dean/analytics" className="card p-5 hover:shadow-card-md transition-all group flex items-center gap-4">
          <div className="p-3 rounded-brand-lg bg-primary-light"><ClipboardCheck className="w-5 h-5" style={{ color: 'var(--primary)' }} /></div>
          <div><p className="font-semibold text-default">Department Analytics</p><p className="text-xs text-muted mt-0.5">Attainment overview</p></div>
          <ArrowRight className="w-4 h-4 text-muted ml-auto opacity-0 group-hover:opacity-100 transition-opacity" />
        </Link>
      </div>
    </div>
  );
}
