import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Users, Search, Shield, Building, CheckCircle, XCircle, AlertTriangle, UserCheck, UserX } from 'lucide-react';
import { api } from '../../services/api';

export default function UserManagementPage() {
  const queryClient = useQueryClient();
  const [roleFilter, setRoleFilter] = useState<'all' | 'faculty' | 'dean' | 'admin'>('all');
  const [search, setSearch] = useState('');

  const { data: users = [], isLoading } = useQuery({
    queryKey: ['admin-users'],
    queryFn: async () => {
      const res = await api.get('/admin/users');
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

  const toggleStatusMutation = useMutation({
    mutationFn: async ({ id, is_active, status }: { id: string; is_active: boolean; status?: string }) => {
      await api.patch(`/admin/users/${id}/status`, { is_active, status });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
    },
  });

  const filtered = users.filter((u: any) => {
    const matchesRole = roleFilter === 'all' || u.role === roleFilter;
    const name = (u.full_name || '').toLowerCase();
    const email = (u.email || '').toLowerCase();
    const matchesSearch = name.includes(search.toLowerCase()) || email.includes(search.toLowerCase());
    return matchesRole && matchesSearch;
  });

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-default">User Management</h1>
          <p className="text-sm text-muted">Govern faculty, dean, and administrator accounts, roles, and security statuses.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="w-4 h-4 text-muted absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by name or email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="input pl-9 text-sm w-48 sm:w-64"
            />
          </div>
          <div className="flex bg-surface-2 p-1 rounded-brand text-xs font-semibold">
            {(['all', 'faculty', 'dean', 'admin'] as const).map((r) => (
              <button
                key={r}
                onClick={() => setRoleFilter(r)}
                className={`px-3 py-1.5 rounded-brand capitalize transition-colors ${
                  roleFilter === r ? 'bg-surface shadow text-default' : 'text-muted hover:text-default'
                }`}
              >
                {r}
              </button>
            ))}
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="p-12 text-center text-muted">Loading users...</div>
      ) : (
        <div className="card overflow-hidden border border-border">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-surface-2 text-muted uppercase font-semibold">
                <tr>
                  <th className="p-3">User</th>
                  <th className="p-3">Role</th>
                  <th className="p-3">Department</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">Joined</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map((u: any) => {
                  const dept = departments.find((d: any) => d.id === u.department_id);
                  return (
                    <tr key={u.id} className="hover:bg-surface-2/40 transition-colors">
                      <td className="p-3">
                        <div className="font-bold text-default text-sm">{u.full_name || 'Unnamed User'}</div>
                        <div className="text-muted text-[11px]">{u.email}</div>
                      </td>
                      <td className="p-3">
                        <span
                          className={`badge text-[10px] capitalize font-semibold ${
                            u.role === 'admin'
                              ? 'badge-primary'
                              : u.role === 'dean'
                              ? 'badge-warning'
                              : 'badge-outline'
                          }`}
                        >
                          {u.role}
                        </span>
                      </td>
                      <td className="p-3 text-muted">
                        {dept ? dept.name : '—'}
                      </td>
                      <td className="p-3">
                        <span
                          className={`badge text-[10px] capitalize font-bold ${
                            u.is_active ? 'badge-success' : 'badge-danger'
                          }`}
                        >
                          {u.is_active ? 'Active' : 'Suspended'}
                        </span>
                      </td>
                      <td className="p-3 text-muted">
                        {new Date(u.created_at).toLocaleDateString()}
                      </td>
                      <td className="p-3 text-right">
                        {u.role !== 'admin' && (
                          <button
                            onClick={() =>
                              toggleStatusMutation.mutate({
                                id: u.id,
                                is_active: !u.is_active,
                                status: u.is_active ? 'suspended' : 'approved',
                              })
                            }
                            disabled={toggleStatusMutation.isPending}
                            className={`btn text-xs py-1 px-2.5 ${
                              u.is_active
                                ? 'btn-outline text-danger border-danger/30 hover:bg-danger/10'
                                : 'btn-primary'
                            }`}
                          >
                            {u.is_active ? 'Suspend' : 'Activate'}
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
