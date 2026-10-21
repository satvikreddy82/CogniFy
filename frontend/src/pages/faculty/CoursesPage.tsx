import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { PlusCircle, BookOpen, ArrowRight, Edit2, Trash2, Search } from 'lucide-react';
import { Link } from 'react-router-dom';
import { api } from '../../services/api';

export default function CoursesPage() {
  const qc = useQueryClient();
  const [showNew, setShowNew] = useState(false);
  const [form, setForm] = useState({ code: '', name: '', term: '', description: '' });
  const [search, setSearch] = useState('');

  const { data: courses = [], isLoading } = useQuery({
    queryKey: ['courses'],
    queryFn: () => api.get('/courses').then(r => r.data),
  });

  const [validationError, setValidationError] = useState('');
  const [courseToDelete, setCourseToDelete] = useState<any>(null);
  const [deleteError, setDeleteError] = useState<string>('');
  const [deleteSuccess, setDeleteSuccess] = useState<string>('');

  const createMutation = useMutation({
    mutationFn: (d: any) => api.post('/courses', d),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['courses'] });
      setShowNew(false);
      setForm({ code: '', name: '', term: '', description: '' });
      setValidationError('');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/courses/${id}`),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['courses'] });
      setCourseToDelete(null);
      setDeleteError('');
      setDeleteSuccess(res.data?.message || 'Course deleted successfully.');
      setTimeout(() => setDeleteSuccess(''), 5000);
    },
    onError: (err: any) => {
      setDeleteError(
        err?.response?.data?.error ||
          err?.message ||
          'Failed to delete course. It may have linked examination papers or marks.'
      );
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError('');
    const code = form.code.trim();
    const name = form.name.trim();

    if (!code || code.length < 2) {
      setValidationError('Course code must be at least 2 characters.');
      return;
    }
    if (!name || name.length < 2) {
      setValidationError('Course name must be at least 2 characters.');
      return;
    }

    createMutation.mutate({
      code: code.toUpperCase(),
      name,
      term: form.term.trim() || undefined,
      description: form.description.trim() || undefined,
    });
  };

  const filtered = courses.filter((c: any) =>
    c.name?.toLowerCase().includes(search.toLowerCase()) ||
    c.code?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6 animate-fade-in">
      {deleteSuccess && (
        <div className="p-3.5 rounded-brand bg-green-50 border border-green-200 text-green-800 text-xs flex items-center justify-between animate-fade-in">
          <span>{deleteSuccess}</span>
          <button onClick={() => setDeleteSuccess('')} className="font-bold text-sm px-1 hover:opacity-75">×</button>
        </div>
      )}

      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title">Courses</h1>
          <p className="text-sm text-muted mt-1">Manage your courses, syllabi, and Course Outcomes</p>
        </div>
        <button onClick={() => { setShowNew(true); setValidationError(''); }} className="btn btn-primary">
          <PlusCircle className="w-4 h-4" /> New Course
        </button>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
        <input className="input pl-9" placeholder="Search courses…" value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      {/* New course form */}
      {showNew && (
        <form onSubmit={handleSubmit} className="card p-6 border-l-4 animate-fade-in" style={{ borderLeftColor: 'var(--primary)' }}>
          <h2 className="section-title mb-4">New Course</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="label">Course Code <span className="text-error">*</span></label>
              <input
                className="input"
                placeholder="CS101"
                value={form.code}
                onChange={e => { setForm(p => ({...p, code: e.target.value})); setValidationError(''); }}
                required
              />
            </div>
            <div>
              <label className="label">Course Name <span className="text-error">*</span></label>
              <input
                className="input"
                placeholder="Introduction to Programming"
                value={form.name}
                onChange={e => { setForm(p => ({...p, name: e.target.value})); setValidationError(''); }}
                required
              />
            </div>
            <div>
              <label className="label">Academic Term</label>
              <input
                className="input"
                placeholder="Fall 2026 / 2024-25 Sem 1"
                value={form.term}
                onChange={e => setForm(p => ({...p, term: e.target.value}))}
              />
            </div>
            <div>
              <label className="label">Description (optional)</label>
              <input
                className="input"
                placeholder="Brief course summary..."
                value={form.description}
                onChange={e => setForm(p => ({...p, description: e.target.value}))}
              />
            </div>
          </div>

          {(validationError || createMutation.isError) && (
            <div className="p-3 rounded-brand bg-red-50 border border-red-200 text-red-800 text-xs mt-4">
              {validationError || (createMutation.error as any)?.response?.data?.error || 'Failed to create course. Please check inputs and try again.'}
            </div>
          )}

          <div className="flex gap-2 mt-5">
            <button
              type="submit"
              disabled={createMutation.isPending || !form.code.trim() || !form.name.trim()}
              className="btn btn-primary"
            >
              {createMutation.isPending ? 'Creating…' : 'Create Course'}
            </button>
            <button
              type="button"
              onClick={() => { setShowNew(false); setValidationError(''); }}
              className="btn btn-secondary"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Courses grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="card p-5 animate-pulse">
              <div className="h-4 bg-surface-3 rounded mb-2 w-2/3" />
              <div className="h-3 bg-surface-3 rounded w-1/2" />
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-muted">
          <BookOpen className="w-12 h-12 mx-auto mb-3 opacity-20" />
          <p className="font-medium text-default">No courses found</p>
          <p className="text-sm mt-1">Create your first course to get started</p>
          <button onClick={() => setShowNew(true)} className="btn btn-primary mt-4">
            <PlusCircle className="w-4 h-4" /> New Course
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((course: any) => (
            <Link key={course.id} to={`/dashboard/courses/${course.id}`} className="card p-5 hover:shadow-card-md transition-all group relative">
              <div className="flex items-start justify-between mb-2">
                <span className="badge badge-primary text-xs font-mono">{course.code}</span>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setCourseToDelete(course);
                      setDeleteError('');
                    }}
                    className="p-1 rounded text-muted hover:text-danger hover:bg-red-50 dark:hover:bg-red-950/30 transition-all opacity-60 hover:opacity-100"
                    title={`Delete course ${course.code}`}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                  <ArrowRight className="w-4 h-4 text-muted opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              </div>
              <h3 className="font-semibold text-default mb-1">{course.name}</h3>
              <p className="text-xs text-muted">{course.term || 'No term set'}</p>
              {course.description && <p className="text-xs text-muted mt-2 line-clamp-2">{course.description}</p>}
              <div className="flex gap-3 mt-3 text-xs text-muted border-t border-default pt-3">
                <span>COs: {course.course_outcomes?.length ?? '–'}</span>
                <span>Papers: –</span>
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {courseToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 animate-fade-in backdrop-blur-xs">
          <div className="card p-6 max-w-md w-full shadow-2xl border border-default bg-surface animate-scale-in space-y-4">
            <div className="flex items-start gap-3">
              <div className="p-2.5 rounded-full bg-red-100 dark:bg-red-950 text-danger shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <h3 className="text-base font-bold text-default">
                  Delete Course {courseToDelete.code}?
                </h3>
                <p className="text-xs text-muted mt-1 leading-relaxed">
                  Are you sure you want to delete <strong className="text-default">{courseToDelete.code} — {courseToDelete.name}</strong>?
                </p>
                <p className="text-[11px] text-muted mt-1 leading-normal">
                  Courses linked to examination papers or student marks are protected to preserve accreditation audit records.
                </p>
              </div>
            </div>

            {deleteError && (
              <div className="p-3 rounded-brand bg-red-50 border border-red-200 text-red-800 text-xs">
                {deleteError}
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2 border-t border-default">
              <button
                type="button"
                onClick={() => {
                  setCourseToDelete(null);
                  setDeleteError('');
                }}
                disabled={deleteMutation.isPending}
                className="btn btn-secondary text-xs"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => deleteMutation.mutate(courseToDelete.id)}
                disabled={deleteMutation.isPending}
                className="btn text-xs font-bold text-white bg-danger hover:bg-red-700 shadow-sm"
              >
                {deleteMutation.isPending ? 'Deleting…' : 'Confirm Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
