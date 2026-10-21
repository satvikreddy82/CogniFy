import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Users, CheckCircle, XCircle, Search, Mail, Shield, Building, AlertCircle } from 'lucide-react';
import { api } from '../../services/api';

export default function DeanApplicationsPage() {
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('pending');
  const [search, setSearch] = useState('');
  const [selectedApp, setSelectedApp] = useState<any | null>(null);
  const [selectedDeptId, setSelectedDeptId] = useState('');
  const [decisionReason, setDecisionReason] = useState('');

  const { data: applications = [], isLoading } = useQuery({
    queryKey: ['admin-dean-applications'],
    queryFn: async () => {
      const res = await api.get('/admin/dean-applications');
      return res.data;
    },
  });

  const { data: departments = [] } = useQuery({
    queryKey: ['admin-departments'],
    queryFn: async () => {
      const res = await api.get('/admin/departments');
      return res.data;
    },
  });

  const decideMutation = useMutation({
    mutationFn: async ({
      id,
      decision,
      department_id,
      reason,
    }: {
      id: string;
      decision: 'approved' | 'rejected';
      department_id?: string;
      reason?: string;
    }) => {
      await api.post(`/admin/dean-applications/${id}/decide`, {
        decision,
        department_id,
        reason,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-dean-applications'] });
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      setSelectedApp(null);
      setDecisionReason('');
      setSelectedDeptId('');
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
          <h1 className="text-2xl font-bold text-default">Dean Appointments & Applications</h1>
          <p className="text-sm text-muted">Verify institutional Dean credentials, assign departmental jurisdiction, and authorize access.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="w-4 h-4 text-muted absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search deans..."
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
        <div className="p-12 text-center text-muted">Loading dean applications...</div>
      ) : filtered.length === 0 ? (
        <div className="card p-12 text-center">
          <Shield className="w-12 h-12 text-muted mx-auto mb-3 opacity-40" />
          <h3 className="font-bold text-default mb-1">No applications found</h3>
          <p className="text-sm text-muted">
            {filter === 'pending'
              ? 'No pending Dean appointments require review at this time.'
              : `No applications with status "${filter}".`}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filtered.map((app: any) => {
            const profile = app.profiles || {};
            const isPending = app.status === 'pending';
            return (
              <div key={app.id} className="card p-5 flex flex-col justify-between space-y-4 border border-border hover:shadow transition-shadow">
                <div>
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div>
                      <h3 className="font-bold text-default text-base">{profile.full_name || 'Dean Applicant'}</h3>
                      <span className="badge badge-primary text-[10px] mt-0.5">Dean of Faculty</span>
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
                      <Mail className="w-3.5 h-3.5 flex-shrink-0" />
                      <span className="truncate">{profile.email}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Building className="w-3.5 h-3.5 flex-shrink-0" />
                      <span>Dept: {departments.find((d: any) => d.id === profile.department_id)?.name || 'Unassigned'}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Shield className="w-3.5 h-3.5 flex-shrink-0" />
                      <span>Employee ID: {profile.employee_id || 'N/A'}</span>
                    </div>
                  </div>
                </div>

                {isPending && (
                  <div className="pt-3 border-t border-border flex items-center gap-2">
                    <button
                      onClick={() => {
                        setSelectedApp(app);
                        setSelectedDeptId(profile.department_id || '');
                      }}
                      className="btn btn-primary text-xs flex-1 justify-center py-1.5"
                    >
                      Review & Decide
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Decision Modal */}
      {selectedApp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 animate-fade-in backdrop-blur-sm">
          <div className="card p-6 max-w-md w-full shadow-2xl space-y-4">
            <h3 className="font-bold text-lg text-default">Review Dean Appointment</h3>
            <p className="text-sm text-muted">
              Applicant: <strong className="text-default">{selectedApp.profiles?.full_name}</strong> ({selectedApp.profiles?.email})
            </p>

            <div>
              <label className="block text-xs font-semibold text-muted uppercase tracking-wider mb-1">
                Assign Department Jurisdiction
              </label>
              <select
                value={selectedDeptId}
                onChange={(e) => setSelectedDeptId(e.target.value)}
                className="input w-full text-sm"
              >
                <option value="">Select Department</option>
                {departments.map((d: any) => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-muted uppercase tracking-wider mb-1">
                Decision Notes / Reason
              </label>
              <textarea
                value={decisionReason}
                onChange={(e) => setDecisionReason(e.target.value)}
                placeholder="Appointment notes or justification..."
                className="input w-full h-20 text-xs"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setSelectedApp(null)}
                className="btn btn-outline text-xs"
              >
                Cancel
              </button>
              <button
                onClick={() =>
                  decideMutation.mutate({
                    id: selectedApp.id,
                    decision: 'rejected',
                    reason: decisionReason,
                  })
                }
                disabled={decideMutation.isPending}
                className="btn btn-danger text-xs"
              >
                Reject
              </button>
              <button
                onClick={() =>
                  decideMutation.mutate({
                    id: selectedApp.id,
                    decision: 'approved',
                    department_id: selectedDeptId || undefined,
                    reason: decisionReason,
                  })
                }
                disabled={decideMutation.isPending}
                className="btn btn-primary text-xs"
              >
                Approve & Activate
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
