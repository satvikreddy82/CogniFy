import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Shield, Search, Filter, Clock, User, ChevronLeft, ChevronRight, FileText } from 'lucide-react';
import { api } from '../../services/api';

export default function AuditLogsPage() {
  const [offset, setOffset] = useState(0);
  const [search, setSearch] = useState('');
  const [selectedLog, setSelectedLog] = useState<any | null>(null);
  const limit = 20;

  const { data, isLoading } = useQuery({
    queryKey: ['admin-audit-logs', offset],
    queryFn: async () => {
      const res = await api.get(`/admin/audit-logs?limit=${limit}&offset=${offset}`);
      return res.data;
    },
  });

  const logs = data?.data || [];
  const total = data?.total || 0;

  const filtered = logs.filter((log: any) => {
    const actor = log.profiles?.full_name?.toLowerCase() || '';
    const email = log.profiles?.email?.toLowerCase() || '';
    const action = (log.action || '').toLowerCase();
    const query = search.toLowerCase();
    return actor.includes(query) || email.includes(query) || action.includes(query);
  });

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-default">Security & Compliance Audit Trail</h1>
          <p className="text-sm text-muted">Immutable ledger of administrative, faculty, and examination actions.</p>
        </div>
        <div className="relative">
          <Search className="w-4 h-4 text-muted absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search action or actor..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input pl-9 text-sm w-48 sm:w-64"
          />
        </div>
      </div>

      {isLoading ? (
        <div className="p-12 text-center text-muted">Loading audit records...</div>
      ) : (
        <div className="card overflow-hidden border border-border">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-surface-2 text-muted uppercase font-semibold">
                <tr>
                  <th className="p-3">Timestamp</th>
                  <th className="p-3">Actor</th>
                  <th className="p-3">Action</th>
                  <th className="p-3">Target Table</th>
                  <th className="p-3">Target ID</th>
                  <th className="p-3 text-right">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map((log: any) => (
                  <tr key={log.id} className="hover:bg-surface-2/40 transition-colors">
                    <td className="p-3 text-muted font-mono whitespace-nowrap">
                      {new Date(log.created_at).toLocaleString()}
                    </td>
                    <td className="p-3">
                      <div className="font-semibold text-default">{log.profiles?.full_name || 'System / Service'}</div>
                      <div className="text-[10px] text-muted">{log.profiles?.email || 'automated'}</div>
                    </td>
                    <td className="p-3">
                      <span className="badge badge-outline text-[10px] font-mono capitalize">
                        {log.action?.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="p-3 font-mono text-[11px] text-muted">{log.target_table || '—'}</td>
                    <td className="p-3 font-mono text-[10px] text-muted truncate max-w-[120px]">
                      {log.target_id || '—'}
                    </td>
                    <td className="p-3 text-right">
                      {log.details && Object.keys(log.details).length > 0 ? (
                        <button
                          onClick={() => setSelectedLog(log)}
                          className="btn btn-outline text-xs py-1 px-2 text-primary"
                        >
                          View JSON
                        </button>
                      ) : (
                        <span className="text-muted text-[11px]">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="p-3 bg-surface-2 border-t border-border flex items-center justify-between text-xs text-muted">
            <span>
              Showing {logs.length > 0 ? offset + 1 : 0} to {Math.min(offset + limit, total)} of {total} events
            </span>
            <div className="flex gap-2">
              <button
                disabled={offset === 0}
                onClick={() => setOffset(Math.max(0, offset - limit))}
                className="btn btn-outline text-xs py-1 px-2 disabled:opacity-40"
              >
                <ChevronLeft className="w-3.5 h-3.5 mr-1" /> Previous
              </button>
              <button
                disabled={offset + limit >= total}
                onClick={() => setOffset(offset + limit)}
                className="btn btn-outline text-xs py-1 px-2 disabled:opacity-40"
              >
                Next <ChevronRight className="w-3.5 h-3.5 ml-1" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* JSON Viewer Modal */}
      {selectedLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 animate-fade-in backdrop-blur-sm">
          <div className="card p-6 max-w-lg w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-default text-base">Audit Event Details</h3>
              <button onClick={() => setSelectedLog(null)} className="text-muted hover:text-default font-bold">
                ✕
              </button>
            </div>
            <div className="bg-surface-2 p-3 rounded-brand font-mono text-xs overflow-x-auto max-h-80 border border-border">
              <pre>{JSON.stringify(selectedLog.details, null, 2)}</pre>
            </div>
            <div className="flex justify-end">
              <button onClick={() => setSelectedLog(null)} className="btn btn-primary text-xs">
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
