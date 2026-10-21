import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Users, CheckCircle, XCircle, Clock, Search, ShieldCheck, Mail, Building, AlertCircle } from 'lucide-react';
import { api } from '../../services/api';

export default function FacultyApplicationsPage() {
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('pending');
  const [search, setSearch] = useState('');
  const [selectedApp, setSelectedApp] = useState<any | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  const { data: applications = [], isLoading, error } = useQuery({
    queryKey: ['dean-faculty-applications'],
    queryFn: async () => {
      const res = await api.get('/dean/faculty-applications');
      return res.data;
    },
  });

  const decideMutation = useMutation({
    mutationFn: async ({ id, decision, reason }: { id: string; decision: 'approved' | 'rejected'; reason?: string }) => {
      await api.post(`/dean/faculty-applications/${id}/decide`, { decision, reason });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dean-faculty-applications'] });
      setSelectedApp(null);
      setRejectReason('');
    },
  });

  const filtered = applications.filter((app: any) => {
    const matchesFilter = filter === 'all' || app.status === filter;
    const name = app.profiles?.full_name?.toLowerCase() || '';
    const email = app.profiles?.email?.toLowerCase() || '';
    const matchesSearch = name.includes(search.toLowerCase()) || email.includes(search.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-default">Faculty Applications</h1>
          <p className="text-sm text-muted">Review, verify, and approve departmental faculty registrations.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="w-4 h-4 text-muted absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search faculty..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="input pl-9 text-sm w-48 sm:w-64"
            />
          </div>
          <div className="flex bg-surface-2 p-1 rounded-brand text-xs font-semibold">
            {(['pending', 'approved', 'rejected', 'all'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setFilter(tab)}
                className={`px-3 py-1.5 rounded-brand capitalize transition-colors ${
                  filter === tab ? 'bg-surface shadow text-default' : 'text-muted hover:text-default'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="p-12 text-center text-muted">Loading applications...</div>
      ) : filtered.length === 0 ? (
        <div className="card p-12 text-center">
          <Users className="w-12 h-12 text-muted mx-auto mb-3 opacity-40" />
          <h3 className="font-bold text-default mb-1">No applications found</h3>
          <p className="text-sm text-muted">
            {filter === 'pending'
              ? 'All faculty registrations have been processed!'
              : `No registrations matching the "${filter}" filter.`}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filtered.map((app: any) => {
            const profile = app.profiles || {};
            const isPending = app.status === 'pending';
            return (
              <div key={app.id} className="card p-5 flex flex-col justify-between space-y-4 shadow-sm border border-border hover:shadow transition-shadow">
                <div>
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div>
                      <h3 className="font-bold text-default text-base">{profile.full_name || 'Unknown Applicant'}</h3>
                      <p className="text-xs text-muted font-medium">{profile.designation || 'Faculty Member'}</p>
                    </div>
                    <span
                      className={`badge text-xs capitalize ${
                        app.status === 'approved'
                          ? 'badge-success'
                          : app.status === 'rejected'
                          ? 'badge-danger'
                          : 'badge-warning'
                      }`}
                    >
                      {app.status}
                    </span>
                  </div>

                  <div className="space-y-1.5 text-xs text-muted">
                    <div className="flex items-center gap-2">
                      <Mail className="w-3.5 h-3.5 text-muted flex-shrink-0" />
                      <span className="truncate">{profile.email}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <ShieldCheck className="w-3.5 h-3.5 text-muted flex-shrink-0" />
                      <span>Employee ID: {profile.employee_id || 'N/A'}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Clock className="w-3.5 h-3.5 text-muted flex-shrink-0" />
                      <span>Applied: {new Date(app.created_at).toLocaleDateString()}</span>
                    </div>
                  </div>
                </div>

                {isPending && (
                  <div className="pt-3 border-t border-border flex items-center gap-2">
                    <button
                      onClick={() => decideMutation.mutate({ id: app.id, decision: 'approved' })}
                      disabled={decideMutation.isPending}
                      className="btn btn-primary text-xs flex-1 justify-center py-1.5"
                    >
                      <CheckCircle className="w-3.5 h-3.5 mr-1" /> Approve
                    </button>
                    <button
                      onClick={() => setSelectedApp(app)}
                      disabled={decideMutation.isPending}
                      className="btn btn-outline text-xs text-danger hover:bg-danger/10 border-danger/30 flex-1 justify-center py-1.5"
                    >
                      <XCircle className="w-3.5 h-3.5 mr-1" /> Reject
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Reject Reason Modal */}
      {selectedApp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 animate-fade-in">
          <div className="card p-6 max-w-md w-full shadow-2xl space-y-4">
            <h3 className="font-bold text-lg text-default">Reject Application</h3>
            <p className="text-sm text-muted">
              Are you sure you want to reject registration for{' '}
              <strong className="text-default">{selectedApp.profiles?.full_name}</strong>?
            </p>
            <div>
              <label className="block text-xs font-semibold text-muted uppercase tracking-wider mb-1">
                Reason (optional)
              </label>
              <textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="e.g. Employee ID verification failed or invalid department."
                className="input w-full h-24 text-sm"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setSelectedApp(null)}
                className="btn btn-outline text-sm"
              >
                Cancel
              </button>
              <button
                onClick={() =>
                  decideMutation.mutate({
                    id: selectedApp.id,
                    decision: 'rejected',
                    reason: rejectReason,
                  })
                }
                disabled={decideMutation.isPending}
                className="btn btn-danger text-sm"
              >
                Confirm Rejection
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
