import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { FileText, CheckCircle, Clock, Award, PlusCircle, BarChart2, BookOpen, ArrowRight, TrendingUp, AlertTriangle, Upload } from 'lucide-react';
import { Link } from 'react-router-dom';
import { api } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

function StatCard({ label, value, icon: Icon, color, sub }: {
  label: string; value: string | number; icon: React.ElementType; color?: string; sub?: string;
}) {
  return (
    <div className="stat-card animate-fade-in">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium text-muted uppercase tracking-wide">{label}</p>
          <p className="text-3xl font-bold text-default mt-1">{value}</p>
          {sub && <p className="text-xs text-muted mt-1">{sub}</p>}
        </div>
        <div className="p-2.5 rounded-brand-lg" style={{ backgroundColor: color ? `${color}18` : 'var(--primary-light)' }}>
          <Icon className="w-5 h-5" style={{ color: color || 'var(--primary)' }} />
        </div>
      </div>
    </div>
  );
}

export default function FacultyDashboard() {
  const { user } = useAuth();

  const { data: papers = [] } = useQuery({
    queryKey: ['papers'],
    queryFn: () => api.get('/papers').then(r => r.data),
    retry: false,
  });

  const { data: courses = [] } = useQuery({
    queryKey: ['courses'],
    queryFn: () => api.get('/courses').then(r => r.data),
    retry: false,
  });

  const draftCount = papers.filter((p: any) => p.status === 'draft').length;
  const pendingCount = papers.filter((p: any) => p.status === 'pending_review').length;
  const approvedCount = papers.filter((p: any) => p.status === 'approved').length;

  const { data: coOverview, isLoading: overviewLoading } = useQuery({
    queryKey: ['dashboard-overview'],
    queryFn: () => api.get('/assessments/overview').then((r) => r.data),
    retry: false,
  });

  const recentPapers = papers.slice(0, 5);

  const statusBadge = (status: string) => {
    const map: Record<string, string> = {
      draft: 'badge-neutral', generating: 'badge-info', validation_required: 'badge-warning',
      pending_review: 'badge-warning', changes_requested: 'badge-warning',
      approved: 'badge-success', rejected: 'badge-error', archived: 'badge-neutral',
    };
    return map[status] || 'badge-neutral';
  };

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="page-title">Welcome back, {user?.full_name?.split(' ')[0]} 👋</h1>
          <p className="text-sm text-muted mt-1">Here's what's happening with your assessments today.</p>
        </div>
        <div className="flex gap-2">
          <Link to="/dashboard/generate" className="btn btn-primary">
            <PlusCircle className="w-4 h-4" /> Generate Paper
          </Link>
          <Link to="/dashboard/marks" className="btn btn-secondary">
            <BarChart2 className="w-4 h-4" /> Analyse Marks
          </Link>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Papers" value={papers.length} icon={FileText} />
        <StatCard label="Pending Review" value={pendingCount} icon={Clock} color="#D97706" sub="Awaiting Dean approval" />
        <StatCard label="Approved" value={approvedCount} icon={CheckCircle} color="#059669" />
        <StatCard label="Courses" value={courses.length} icon={BookOpen} />
      </div>

      {/* Main content grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* CO Attainment Chart */}
        <div className="card p-6 lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="section-title">CO Attainment Overview</h2>
              {coOverview?.has_data && coOverview.paper_title && (
                <p className="text-xs text-muted mt-0.5">
                  Latest: {coOverview.paper_title} ({coOverview.course_code}) • {coOverview.student_count} Students
                </p>
              )}
            </div>
            <Link to="/dashboard/marks" className="text-xs font-medium flex items-center gap-1" style={{ color: 'var(--primary)' }}>
              View Analytics <ArrowRight className="w-3 h-3" />
            </Link>
          </div>

          {overviewLoading ? (
            <div className="h-48 flex items-center justify-center">
              <div className="animate-pulse flex flex-col items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-surface-3" />
                <span className="text-xs text-muted">Loading attainment analytics…</span>
              </div>
            </div>
          ) : !coOverview?.has_data || !coOverview.co_attainment || coOverview.co_attainment.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-muted gap-2.5 text-center">
              <TrendingUp className="w-10 h-10 opacity-30 text-primary" />
              <div className="space-y-1">
                <p className="text-sm font-semibold text-default">
                  No CO attainment analysis available yet.
                </p>
                <p className="text-xs text-muted max-w-sm">
                  Upload student marks and run an analysis to view results.
                </p>
              </div>
              <Link to="/dashboard/marks" className="btn btn-primary text-xs mt-2 inline-flex items-center gap-1.5">
                <Upload className="w-3.5 h-3.5" />
                Upload Marks in Analytics
              </Link>
            </div>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={coOverview.co_attainment} barSize={28}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="co" tick={{ fontSize: 12, fill: 'var(--text-muted)' }} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 12, fill: 'var(--text-muted)' }} unit="%" />
                  <Tooltip
                    contentStyle={{ backgroundColor: 'var(--surface-card)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }}
                    formatter={(v) => [`${v}%`, 'Attainment']}
                  />
                  <Bar dataKey="attainment" radius={[4, 4, 0, 0]}>
                    {coOverview.co_attainment.map((entry: any, i: number) => (
                      <Cell
                        key={i}
                        fill={
                          entry.attainment < 60
                            ? 'var(--error)'
                            : entry.attainment < 75
                            ? 'var(--warning)'
                            : 'var(--primary)'
                        }
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>

              <div className="flex gap-4 mt-3 text-xs text-muted justify-center border-t border-default pt-2">
                <span className="flex items-center gap-1">
                  <span className="w-2.5 h-2.5 rounded-sm bg-red-500 inline-block" /> Below 60%
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2.5 h-2.5 rounded-sm inline-block" style={{ backgroundColor: 'var(--warning)' }} /> 60–75%
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2.5 h-2.5 rounded-sm inline-block" style={{ backgroundColor: 'var(--primary)' }} /> Above 75%
                </span>
              </div>
            </>
          )}
        </div>

        {/* Quick actions + recent activity */}
        <div className="space-y-4">
          {/* Quick actions */}
          <div className="card p-5">
            <h2 className="section-title mb-3">Quick Actions</h2>
            <div className="space-y-2">
              {[
                { label: 'Add Course', to: '/dashboard/courses', icon: BookOpen },
                { label: 'Upload Questions', to: '/dashboard/question-bank', icon: FileText },
                { label: 'View Papers', to: '/dashboard/papers', icon: Award },
                { label: 'Adaptive Plan', to: '/dashboard/adaptive', icon: TrendingUp },
              ].map((a) => (
                <Link key={a.to} to={a.to} className="flex items-center gap-3 p-2.5 rounded-brand hover:bg-surface-2 transition-colors group">
                  <div className="p-1.5 rounded-brand-sm bg-primary-light">
                    <a.icon className="w-3.5 h-3.5" style={{ color: 'var(--primary)' }} />
                  </div>
                  <span className="text-sm text-default group-hover:text-primary transition-colors">{a.label}</span>
                  <ArrowRight className="w-3.5 h-3.5 text-muted ml-auto opacity-0 group-hover:opacity-100 transition-opacity" />
                </Link>
              ))}
            </div>
          </div>

          {/* Pending task indicator */}
          {pendingCount > 0 && (
            <div className="card p-4 border-l-4" style={{ borderLeftColor: 'var(--warning)' }}>
              <div className="flex gap-2">
                <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" style={{ color: 'var(--warning)' }} />
                <div>
                  <p className="text-sm font-medium text-default">{pendingCount} paper{pendingCount > 1 ? 's' : ''} awaiting review</p>
                  <p className="text-xs text-muted mt-0.5">Check with your Dean for status updates.</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Recent Papers */}
      <div className="card p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="section-title">Recent Papers</h2>
          <Link to="/dashboard/papers" className="text-xs font-medium flex items-center gap-1" style={{ color: 'var(--primary)' }}>
            View all <ArrowRight className="w-3 h-3" />
          </Link>
        </div>
        {recentPapers.length === 0 ? (
          <div className="text-center py-10 text-muted">
            <FileText className="w-10 h-10 mx-auto mb-3 opacity-20" />
            <p className="text-sm">No papers yet. Click "Generate Paper" to create your first assessment.</p>
            <Link to="/dashboard/generate" className="btn btn-primary mt-4 mx-auto">
              <PlusCircle className="w-4 h-4" /> Generate Paper
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-default">
                  <th className="text-left py-2 text-xs font-semibold text-muted uppercase tracking-wide">Title</th>
                  <th className="text-left py-2 text-xs font-semibold text-muted uppercase tracking-wide">Status</th>
                  <th className="text-left py-2 text-xs font-semibold text-muted uppercase tracking-wide">Created</th>
                  <th className="text-left py-2 text-xs font-semibold text-muted uppercase tracking-wide">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-default">
                {recentPapers.map((p: any) => (
                  <tr key={p.id} className="hover:bg-surface-2 transition-colors">
                    <td className="py-3 font-medium text-default">{p.title || p.id.slice(0, 8)}</td>
                    <td className="py-3">
                      <span className={`badge ${statusBadge(p.status)} capitalize`}>{p.status?.replace(/_/g, ' ')}</span>
                    </td>
                    <td className="py-3 text-muted">{new Date(p.created_at).toLocaleDateString()}</td>
                    <td className="py-3">
                      <Link to={`/dashboard/papers`} className="text-xs font-medium" style={{ color: 'var(--primary)' }}>View</Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
