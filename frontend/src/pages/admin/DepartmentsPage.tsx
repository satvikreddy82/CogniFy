import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Building, PlusCircle, Search, Users, BookOpen, AlertCircle, CheckCircle } from 'lucide-react';
import { api } from '../../services/api';

export default function DepartmentsPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [newDeptName, setNewDeptName] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [error, setError] = useState('');

  const { data: departments = [], isLoading } = useQuery({
    queryKey: ['admin-departments'],
    queryFn: async () => {
      const res = await api.get('/admin/departments');
      return res.data;
    },
  });

  const { data: users = [] } = useQuery({
    queryKey: ['admin-users'],
    queryFn: async () => {
      const res = await api.get('/admin/users');
      return res.data;
    },
  });

  const addMutation = useMutation({
    mutationFn: async (name: string) => {
      await api.post('/admin/departments', { name });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-departments'] });
      setNewDeptName('');
      setShowAddForm(false);
      setError('');
    },
    onError: (err: any) => {
      setError(err?.response?.data?.error || 'Failed to create department');
    },
  });

  const filtered = departments.filter((d: any) =>
    (d.name || '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-default">Academic Departments</h1>
          <p className="text-sm text-muted">Manage university faculties, schools, and academic branches.</p>
        </div>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="btn btn-primary text-xs flex items-center gap-1.5 self-start sm:self-auto"
        >
          <PlusCircle className="w-4 h-4" /> Add Department
        </button>
      </div>

      {showAddForm && (
        <div className="card p-5 border border-primary/30 shadow-md animate-fade-in max-w-lg">
          <h3 className="font-bold text-default text-base mb-2">Create New Department</h3>
          {error && (
            <div className="p-2.5 mb-3 rounded-brand bg-danger/10 text-danger text-xs flex items-center gap-2">
              <AlertCircle className="w-3.5 h-3.5" /> {error}
            </div>
          )}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (newDeptName.trim()) addMutation.mutate(newDeptName.trim());
            }}
            className="flex gap-2"
          >
            <input
              type="text"
              placeholder="e.g. Department of Mechanical Engineering"
              value={newDeptName}
              onChange={(e) => setNewDeptName(e.target.value)}
              className="input flex-1 text-sm"
              required
            />
            <button
              type="submit"
              disabled={addMutation.isPending}
              className="btn btn-primary text-xs"
            >
              {addMutation.isPending ? 'Saving...' : 'Create'}
            </button>
            <button
              type="button"
              onClick={() => setShowAddForm(false)}
              className="btn btn-outline text-xs"
            >
              Cancel
            </button>
          </form>
        </div>
      )}

      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="w-4 h-4 text-muted absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search departments..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input pl-9 text-sm w-full"
          />
        </div>
      </div>

      {isLoading ? (
        <div className="p-12 text-center text-muted">Loading departments...</div>
      ) : filtered.length === 0 ? (
        <div className="card p-12 text-center">
          <Building className="w-12 h-12 text-muted mx-auto mb-3 opacity-40" />
          <h3 className="font-bold text-default mb-1">No departments found</h3>
          <p className="text-sm text-muted">Click "Add Department" to register the first academic unit.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filtered.map((dept: any) => {
            const facultyCount = users.filter((u: any) => u.department_id === dept.id && u.role === 'faculty').length;
            const deanCount = users.filter((u: any) => u.department_id === dept.id && u.role === 'dean').length;

            return (
              <div key={dept.id} className="card p-5 border border-border hover:shadow transition-shadow space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-brand flex items-center justify-center bg-primary/10 text-primary">
                      <Building className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="font-bold text-default text-base leading-snug">{dept.name}</h3>
                      <span className="text-[10px] text-muted font-mono">{dept.id.slice(0, 8)}...</span>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs text-muted pt-2 border-t border-border">
                  <div className="flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5 text-primary" />
                    <span>Faculty: <strong className="text-default">{facultyCount}</strong></span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Building className="w-3.5 h-3.5 text-warning" />
                    <span>Dean: <strong className="text-default">{deanCount > 0 ? 'Assigned' : 'Vacant'}</strong></span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
