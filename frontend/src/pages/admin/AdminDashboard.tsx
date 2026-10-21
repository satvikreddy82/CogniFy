import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Users, Building, Shield, FileText, ArrowRight, CheckCircle, Clock, AlertTriangle, Activity } from 'lucide-react';
import { api } from '../../services/api';

export default function AdminDashboard() {
  const { data: users = [], isLoading: usersLoading } = useQuery({
    queryKey: ['admin-users'],
    queryFn: async () => {
      const res = await api.get('/admin/users');
      return res.data;
    },
  });

  const { data: depts = [] } = useQuery({
    queryKey: ['admin-departments'],
    queryFn: async () => {
      const res = await api.get('/admin/departments');
      return res.data;
    },
  });

  const { data: deanApps = [] } = useQuery({
    queryKey: ['admin-dean-applications'],
    queryFn: async () => {
      const res = await api.get('/admin/dean-applications');
      return res.data;
    },
  });

  const { data: logsData } = useQuery({
    queryKey: ['admin-recent-audit-logs'],
    queryFn: async () => {
      const res = await api.get('/admin/audit-logs?limit=5');
      return res.data;
    },
  });

  const pendingDeanApps = deanApps.filter((a: any) => a.status === 'pending');
  const activeUsers = users.filter((u: any) => u.is_active);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-default">Institutional Administration</h1>
          <p className="text-sm text-muted">Manage system governance, dean approvals, department taxonomy, and audit trails.</p>
        </div>
        <Link to="/admin/dean-applications" className="btn btn-primary text-xs flex items-center gap-1.5 self-start sm:self-auto">
          <Clock className="w-3.5 h-3.5" />
          Review Dean Applications ({pendingDeanApps.length})
        </Link>
      </div>

      {/* Quick KPI stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card p-4 border border-border">
          <div className="flex items-center justify-between text-muted mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Total Users</span>
            <Users className="w-4 h-4 text-primary" />
          </div>
          <div className="text-2xl font-bold text-default">{users.length}</div>
          <p className="text-xs text-muted mt-1">{activeUsers.length} active accounts</p>
        </div>

        <div className="card p-4 border border-border">
          <div className="flex items-center justify-between text-muted mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Pending Deans</span>
            <Clock className="w-4 h-4 text-warning" />
          </div>
          <div className="text-2xl font-bold text-default">{pendingDeanApps.length}</div>
          <p className="text-xs text-muted mt-1">Awaiting verification</p>
        </div>

        <div className="card p-4 border border-border">
          <div className="flex items-center justify-between text-muted mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Departments</span>
            <Building className="w-4 h-4 text-primary" />
          </div>
          <div className="text-2xl font-bold text-default">{depts.length}</div>
          <p className="text-xs text-muted mt-1">Configured academic units</p>
        </div>

        <div className="card p-4 border border-border">
          <div className="flex items-center justify-between text-muted mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">System Security</span>
            <Shield className="w-4 h-4 text-success" />
          </div>
          <div className="text-2xl font-bold text-default">Active</div>
          <p className="text-xs text-muted mt-1">Audit trail logging live</p>
        </div>
      </div>

      {/* Grid: Pending Applications & Quick Nav */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Pending Dean Applications Card */}
        <div className="lg:col-span-2 card p-5 border border-border space-y-4">
          <div className="flex items-center justify-between border-b border-border pb-3">
            <div>
              <h3 className="font-bold text-default text-base">Pending Dean Registrations</h3>
              <p className="text-xs text-muted">Institutional appointments requiring administrator approval</p>
            </div>
            <Link to="/admin/dean-applications" className="text-xs text-primary hover:underline font-semibold flex items-center gap-1">
              View All <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {pendingDeanApps.length === 0 ? (
            <div className="py-8 text-center text-muted text-sm">
              <CheckCircle className="w-8 h-8 text-success mx-auto mb-2 opacity-60" />
              All dean registration applications have been reviewed!
            </div>
          ) : (
            <div className="space-y-3">
              {pendingDeanApps.slice(0, 4).map((app: any) => (
                <div key={app.id} className="p-3 bg-surface-2 rounded-brand border border-border flex items-center justify-between gap-4">
                  <div>
                    <h4 className="font-bold text-default text-sm">{app.profiles?.full_name || 'Dean Applicant'}</h4>
                    <p className="text-xs text-muted">{app.profiles?.email}</p>
                    <span className="text-[10px] text-muted font-mono">Applied: {new Date(app.created_at).toLocaleDateString()}</span>
                  </div>
                  <Link
                    to="/admin/dean-applications"
                    className="btn btn-primary text-xs py-1.5 px-3 whitespace-nowrap"
                  >
                    Review
                  </Link>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Quick Admin Actions */}
        <div className="card p-5 border border-border space-y-4">
          <h3 className="font-bold text-default text-base border-b border-border pb-3">System Modules</h3>
          <div className="space-y-2">
            <Link
              to="/admin/users"
              className="p-3 bg-surface-2 hover:bg-surface-3 transition-colors rounded-brand border border-border flex items-center justify-between"
            >
              <div className="flex items-center gap-3">
                <Users className="w-4 h-4 text-primary" />
                <div>
                  <div className="text-sm font-semibold text-default">User Management</div>
                  <div className="text-xs text-muted">Roles, active status, profiles</div>
                </div>
              </div>
              <ArrowRight className="w-4 h-4 text-muted" />
            </Link>

            <Link
              to="/admin/departments"
              className="p-3 bg-surface-2 hover:bg-surface-3 transition-colors rounded-brand border border-border flex items-center justify-between"
            >
              <div className="flex items-center gap-3">
                <Building className="w-4 h-4 text-primary" />
                <div>
                  <div className="text-sm font-semibold text-default">Academic Departments</div>
                  <div className="text-xs text-muted">Create & structure faculties</div>
                </div>
              </div>
              <ArrowRight className="w-4 h-4 text-muted" />
            </Link>

            <Link
              to="/admin/audit-logs"
              className="p-3 bg-surface-2 hover:bg-surface-3 transition-colors rounded-brand border border-border flex items-center justify-between"
            >
              <div className="flex items-center gap-3">
                <Activity className="w-4 h-4 text-primary" />
                <div>
                  <div className="text-sm font-semibold text-default">Security Audit Trail</div>
                  <div className="text-xs text-muted">Immutable event records</div>
                </div>
              </div>
              <ArrowRight className="w-4 h-4 text-muted" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
