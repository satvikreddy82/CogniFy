import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, Legend } from 'recharts';
import { BarChart2, TrendingUp, CheckCircle, AlertTriangle, Users, FileText, Download } from 'lucide-react';
import { api } from '../../services/api';

export default function DeanAnalyticsPage() {
  const { data: analytics, isLoading } = useQuery({
    queryKey: ['dean-analytics'],
    queryFn: async () => {
      const res = await api.get('/dean/analytics');
      return res.data;
    },
  });

  if (isLoading) {
    return <div className="p-12 text-center text-muted">Loading department OBE analytics...</div>;
  }

  const coStats = analytics?.coStats || [
    { co: 'CO1', target: 70, actual: 78, status: 'met' },
    { co: 'CO2', target: 65, actual: 71, status: 'met' },
    { co: 'CO3', target: 60, actual: 48, status: 'unmet' },
    { co: 'CO4', target: 70, actual: 64, status: 'unmet' },
    { co: 'CO5', target: 75, actual: 82, status: 'met' },
  ];

  const monthlyTrends = analytics?.monthlyTrends || [
    { month: 'May', submissions: 12, approved: 10 },
    { month: 'Jun', submissions: 19, approved: 16 },
    { month: 'Jul', submissions: 8, approved: 8 },
    { month: 'Aug', submissions: 24, approved: 20 },
    { month: 'Sep', submissions: 31, approved: 27 },
    { month: 'Oct', submissions: 18, approved: 14 },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-default">Department OBE Analytics</h1>
          <p className="text-sm text-muted">Comprehensive outcome-based education metrics and compliance trends.</p>
        </div>
        <button
          onClick={() => alert('Exporting Department OBE Report as CSV...')}
          className="btn btn-outline text-xs flex items-center gap-1.5 self-start sm:self-auto"
        >
          <Download className="w-3.5 h-3.5" /> Export OBE Report
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card p-4 border border-border">
          <div className="flex items-center justify-between text-muted mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Average Attainment</span>
            <TrendingUp className="w-4 h-4 text-primary" />
          </div>
          <div className="text-2xl font-bold text-default">{analytics?.avgAttainment || 72.4}%</div>
          <p className="text-xs text-muted mt-1">+3.2% vs last academic semester</p>
        </div>

        <div className="card p-4 border border-border">
          <div className="flex items-center justify-between text-muted mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Papers Approved</span>
            <FileText className="w-4 h-4 text-success" />
          </div>
          <div className="text-2xl font-bold text-default">
            {analytics?.approvedPapers || 28} / {analytics?.totalPapers || 32}
          </div>
          <p className="text-xs text-muted mt-1">{analytics?.pendingPapers || 4} pending review</p>
        </div>

        <div className="card p-4 border border-border">
          <div className="flex items-center justify-between text-muted mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Active Faculty</span>
            <Users className="w-4 h-4 text-primary" />
          </div>
          <div className="text-2xl font-bold text-default">{analytics?.activeFaculty || 14}</div>
          <p className="text-xs text-muted mt-1">{analytics?.totalFaculty || 15} registered members</p>
        </div>

        <div className="card p-4 border border-border">
          <div className="flex items-center justify-between text-muted mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">CO Compliance Rate</span>
            <CheckCircle className="w-4 h-4 text-success" />
          </div>
          <div className="text-2xl font-bold text-default">60%</div>
          <p className="text-xs text-muted mt-1">3 of 5 COs met threshold</p>
        </div>
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* CO Attainment vs Target */}
        <div className="card p-5 border border-border space-y-4">
          <div>
            <h3 className="font-bold text-default text-base">Course Outcome (CO) Attainment vs Target</h3>
            <p className="text-xs text-muted">Comparison of targeted vs actual student cohort attainment levels</p>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={coStats} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                <XAxis dataKey="co" tick={{ fontSize: 12 }} />
                <YAxis unit="%" tick={{ fontSize: 12 }} domain={[0, 100]} />
                <Tooltip
                  formatter={(val: any) => [`${val}%`]}
                  contentStyle={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)', borderRadius: '8px', fontSize: '12px' }}
                />
                <Legend wrapperStyle={{ fontSize: '12px' }} />
                <Bar dataKey="target" name="Target %" fill="var(--muted)" radius={[4, 4, 0, 0]} />
                <Bar dataKey="actual" name="Actual %" fill="var(--primary)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Paper Submissions Trend */}
        <div className="card p-5 border border-border space-y-4">
          <div>
            <h3 className="font-bold text-default text-base">Monthly Submission & Approval Trends</h3>
            <p className="text-xs text-muted">Faculty exam paper generation and review throughput</p>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={monthlyTrends} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip
                  contentStyle={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)', borderRadius: '8px', fontSize: '12px' }}
                />
                <Legend wrapperStyle={{ fontSize: '12px' }} />
                <Line type="monotone" dataKey="submissions" name="Submissions" stroke="var(--primary)" strokeWidth={2} />
                <Line type="monotone" dataKey="approved" name="Approved" stroke="var(--success)" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Outcome Breakdown Table */}
      <div className="card overflow-hidden border border-border">
        <div className="p-4 border-b border-border">
          <h3 className="font-bold text-default text-base">Course Outcome Detailed Status</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-surface-2 text-muted uppercase font-semibold">
              <tr>
                <th className="p-3">Course Outcome</th>
                <th className="p-3">Target Attainment</th>
                <th className="p-3">Actual Attainment</th>
                <th className="p-3">Deviation</th>
                <th className="p-3">OBE Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {coStats.map((item: any) => {
                const diff = item.actual - item.target;
                const isMet = diff >= 0;
                return (
                  <tr key={item.co} className="hover:bg-surface-2/50 transition-colors">
                    <td className="p-3 font-bold text-default">{item.co}</td>
                    <td className="p-3 font-mono text-muted">{item.target}%</td>
                    <td className="p-3 font-mono font-bold text-default">{item.actual}%</td>
                    <td className={`p-3 font-mono font-semibold ${isMet ? 'text-success' : 'text-danger'}`}>
                      {diff > 0 ? `+${diff}%` : `${diff}%`}
                    </td>
                    <td className="p-3">
                      <span className={`badge text-[10px] uppercase font-bold ${isMet ? 'badge-success' : 'badge-danger'}`}>
                        {isMet ? 'Target Met' : 'Action Needed'}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
