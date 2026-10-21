import React, { useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, PlusCircle, Target, Upload, CheckCircle, Trash2 } from 'lucide-react';
import { api } from '../../services/api';

export default function CourseDetailPage() {
  const { courseId } = useParams<{ courseId: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [showCOForm, setShowCOForm] = useState(false);
  const [coForm, setCOForm] = useState({ code: '', description: '', target_attainment: '' });
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  const { data: course, isLoading } = useQuery({
    queryKey: ['course', courseId],
    queryFn: () => api.get(`/courses/${courseId}`).then(r => r.data),
  });

  const { data: outcomes = [] } = useQuery({
    queryKey: ['outcomes', courseId],
    queryFn: () => api.get(`/courses/${courseId}/outcomes`).then(r => r.data),
  });

  const addCO = useMutation({
    mutationFn: (d: any) => api.post(`/courses/${courseId}/outcomes`, d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['outcomes', courseId] }); setShowCOForm(false); setCOForm({ code: '', description: '', target_attainment: '' }); },
  });

  const deleteMutation = useMutation({
    mutationFn: () => api.delete(`/courses/${courseId}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['courses'] });
      navigate('/dashboard/courses');
    },
    onError: (err: any) => {
      setDeleteError(
        err?.response?.data?.error ||
          err?.message ||
          'Failed to delete course. It may have linked examination papers or student marks.'
      );
    },
  });

  if (isLoading) return <div className="flex items-center justify-center h-40"><div className="w-6 h-6 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: 'var(--primary)', borderTopColor: 'transparent' }} /></div>;
  if (!course) return <div className="text-muted">Course not found.</div>;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link to="/dashboard/courses" className="text-muted hover:text-default transition-colors">
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <span className="badge badge-primary font-mono">{course.code}</span>
              <h1 className="page-title">{course.name}</h1>
            </div>
            <p className="text-sm text-muted mt-0.5">{course.term || 'No term set'}</p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => { setShowDeleteConfirm(true); setDeleteError(''); }}
          className="btn btn-ghost text-xs text-danger hover:bg-red-50 dark:hover:bg-red-950/30 flex items-center gap-1.5"
          title="Delete this course"
        >
          <Trash2 className="w-3.5 h-3.5" />
          <span>Delete Course</span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Course Outcomes */}
        <div className="lg:col-span-2 space-y-4">
          <div className="card p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="section-title">Course Outcomes</h2>
              <button onClick={() => setShowCOForm(!showCOForm)} className="btn btn-primary text-xs py-1.5">
                <PlusCircle className="w-3.5 h-3.5" /> Add CO
              </button>
            </div>

            {showCOForm && (
              <div className="mb-4 p-4 bg-surface-2 rounded-brand-lg border border-default animate-fade-in">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="label text-xs">CO Code</label>
                    <input className="input text-sm" placeholder="CO1" value={coForm.code} onChange={e => setCOForm(p => ({...p, code: e.target.value}))} />
                  </div>
                  <div>
                    <label className="label text-xs">Target Attainment %</label>
                    <input className="input text-sm" type="number" min="0" max="100" placeholder="70" value={coForm.target_attainment} onChange={e => setCOForm(p => ({...p, target_attainment: e.target.value}))} />
                  </div>
                  <div className="col-span-2">
                    <label className="label text-xs">Description</label>
                    <input className="input text-sm" placeholder="Students will be able to…" value={coForm.description} onChange={e => setCOForm(p => ({...p, description: e.target.value}))} />
                  </div>
                </div>
                <div className="flex gap-2 mt-3">
                  <button onClick={() => addCO.mutate({ ...coForm, target_attainment: Number(coForm.target_attainment) || undefined })} disabled={addCO.isPending || !coForm.code || !coForm.description} className="btn btn-primary text-xs py-1.5">
                    {addCO.isPending ? 'Saving…' : 'Save CO'}
                  </button>
                  <button onClick={() => setShowCOForm(false)} className="btn btn-secondary text-xs py-1.5">Cancel</button>
                </div>
              </div>
            )}

            {outcomes.length === 0 ? (
              <div className="text-center py-8 text-muted">
                <Target className="w-8 h-8 mx-auto mb-2 opacity-20" />
                <p className="text-sm">No Course Outcomes defined yet.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {outcomes.map((co: any) => (
                  <div key={co.id} className="flex items-start gap-3 p-3 rounded-brand bg-surface-2">
                    <CheckCircle className="w-4 h-4 mt-0.5 shrink-0" style={{ color: 'var(--primary)' }} />
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm text-default">{co.code}</span>
                        {co.target_attainment && (
                          <span className="badge badge-info text-xs">Target: {co.target_attainment}%</span>
                        )}
                      </div>
                      <p className="text-xs text-muted mt-0.5">{co.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Sidebar: Actions */}
        <div className="space-y-4">
          <div className="card p-5">
            <h3 className="font-semibold text-default mb-3">Actions</h3>
            <div className="space-y-2">
              <Link to="/dashboard/question-bank" className="btn btn-secondary w-full justify-start text-sm">
                <Upload className="w-4 h-4" /> Manage Question Bank
              </Link>
              <Link to="/dashboard/generate" className="btn btn-primary w-full justify-start text-sm">
                <PlusCircle className="w-4 h-4" /> Generate Paper
              </Link>
            </div>
          </div>
          <div className="card p-5">
            <h3 className="font-semibold text-default mb-3">Course Info</h3>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between"><dt className="text-muted">Code</dt><dd className="font-mono font-medium text-default">{course.code}</dd></div>
              <div className="flex justify-between"><dt className="text-muted">Term</dt><dd className="text-default">{course.term || '–'}</dd></div>
              <div className="flex justify-between"><dt className="text-muted">Outcomes</dt><dd className="text-default">{outcomes.length}</dd></div>
            </dl>
          </div>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 animate-fade-in backdrop-blur-xs">
          <div className="card p-6 max-w-md w-full shadow-2xl border border-default bg-surface animate-scale-in space-y-4">
            <div className="flex items-start gap-3">
              <div className="p-2.5 rounded-full bg-red-100 dark:bg-red-950 text-danger shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <h3 className="text-base font-bold text-default">
                  Delete Course {course.code}?
                </h3>
                <p className="text-xs text-muted mt-1 leading-relaxed">
                  Are you sure you want to delete <strong className="text-default">{course.code} — {course.name}</strong>?
                </p>
                <p className="text-[11px] text-muted mt-1">
                  Courses linked to examination question papers or student marks are protected to preserve accreditation audit records.
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
                  setShowDeleteConfirm(false);
                  setDeleteError('');
                }}
                disabled={deleteMutation.isPending}
                className="btn btn-secondary text-xs"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => deleteMutation.mutate()}
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
