import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { FileText, Search, Eye, Download, X, Loader2, BookOpen, Clock, AlertCircle } from 'lucide-react';
import { api } from '../../services/api';
import QuestionPaperDocument from '../../components/QuestionPaperDocument';

const STATUS_MAP: Record<string, string> = {
  draft: 'badge-neutral',
  generating: 'badge-info',
  validation_required: 'badge-warning',
  pending_review: 'badge-warning',
  changes_requested: 'badge-warning',
  approved: 'badge-success',
  rejected: 'badge-error',
  archived: 'badge-neutral',
};

export default function PreviousPapersPage() {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  // Selected paper for viewing in modal
  const [selectedPaperId, setSelectedPaperId] = useState<string | null>(null);
  const [loadingPaperId, setLoadingPaperId] = useState<string | null>(null);
  const [fullPaper, setFullPaper] = useState<any | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const { data: papers = [], isLoading } = useQuery({
    queryKey: ['papers'],
    queryFn: () => api.get('/papers').then((r) => r.data),
  });

  const filtered = papers.filter((p: any) => {
    const courseCode = p.course_code || p.courses?.code || '';
    const courseName = p.course_name || p.courses?.name || '';
    const titleMatch = p.title?.toLowerCase().includes(search.toLowerCase());
    const courseMatch =
      courseCode.toLowerCase().includes(search.toLowerCase()) ||
      courseName.toLowerCase().includes(search.toLowerCase());
    const matchSearch = !search || titleMatch || courseMatch;
    const matchStatus = !statusFilter || p.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const handleOpenPreview = async (paperId: string) => {
    setErrorMsg(null);
    setLoadingPaperId(paperId);
    try {
      const res = await api.get(`/papers/${paperId}`);
      if (res.data) {
        setFullPaper(res.data);
        setSelectedPaperId(paperId);
      } else {
        setErrorMsg('Failed to load paper details.');
      }
    } catch (err: any) {
      setErrorMsg(err.response?.data?.error || 'Unable to retrieve the complete question paper.');
    } finally {
      setLoadingPaperId(null);
    }
  };

  const handleDirectDownload = async (paperId: string) => {
    setErrorMsg(null);
    setLoadingPaperId(paperId);
    try {
      const res = await api.get(`/papers/${paperId}`);
      if (res.data) {
        setFullPaper(res.data);
        setSelectedPaperId(paperId);
        // Allow DOM to render before triggering print dialog
        setTimeout(() => {
          window.print();
        }, 300);
      } else {
        setErrorMsg('Failed to retrieve paper for download.');
      }
    } catch (err: any) {
      setErrorMsg(err.response?.data?.error || 'Unable to download question paper.');
    } finally {
      setLoadingPaperId(null);
    }
  };

  const handleCloseModal = () => {
    setSelectedPaperId(null);
    setFullPaper(null);
    setErrorMsg(null);
  };

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="page-title flex items-center gap-2">
            <FileText className="w-6 h-6 text-primary" />
            Previous Question Papers
          </h1>
          <p className="text-sm text-muted mt-1">
            Review, preview, and download complete examination papers generated for your courses.
          </p>
        </div>
      </div>

      {errorMsg && (
        <div className="p-4 bg-danger/10 border border-danger/30 rounded-brand text-danger text-sm flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
          <button onClick={() => setErrorMsg(null)} className="text-muted hover:text-default">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
          <input
            className="input pl-9 w-full"
            placeholder="Search by paper title or course code…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select
          className="input w-auto"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="">All Statuses</option>
          <option value="approved">Approved</option>
          <option value="pending_review">Pending Review</option>
          <option value="validation_required">Validation Required</option>
          <option value="draft">Draft</option>
          <option value="changes_requested">Changes Requested</option>
          <option value="rejected">Rejected</option>
        </select>
      </div>

      {/* Table of Papers */}
      {isLoading ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="card p-5 animate-pulse h-20 bg-surface" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="card text-center py-16 text-muted p-8 border border-default bg-surface">
          <FileText className="w-12 h-12 mx-auto mb-3 opacity-20" />
          <p className="font-semibold text-default">No question papers found</p>
          <p className="text-xs mt-1">
            {search || statusFilter
              ? 'No papers match your search criteria. Clear filters to see all.'
              : 'Papers generated in the Generate Paper section will automatically appear here.'}
          </p>
        </div>
      ) : (
        <div className="card overflow-hidden border border-default shadow-sm bg-surface">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-surface-2 border-b border-default text-muted uppercase text-[11px] font-semibold tracking-wide">
                <tr>
                  <th className="text-left px-4 py-3">Course</th>
                  <th className="text-left px-4 py-3">Paper Title</th>
                  <th className="text-left px-4 py-3">Total Marks</th>
                  <th className="text-left px-4 py-3">Status</th>
                  <th className="text-left px-4 py-3">Created</th>
                  <th className="text-right px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-default">
                {filtered.map((p: any) => {
                  const courseCode = p.course_code || p.courses?.code || 'CS301';
                  const courseName = p.course_name || p.courses?.name || 'Algorithms';
                  const isBusy = loadingPaperId === p.id;

                  return (
                    <tr key={p.id} className="hover:bg-surface-2/60 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className="badge badge-primary font-mono text-[11px] font-bold">
                            {courseCode}
                          </span>
                          <span className="text-xs text-muted truncate max-w-44 hidden md:inline">
                            {courseName}
                          </span>
                        </div>
                      </td>

                      <td className="px-4 py-3 font-medium text-default">
                        {p.title || `Paper ${p.id.slice(0, 8)}`}
                        {p.question_count && (
                          <span className="text-[11px] text-muted ml-2">
                            ({p.question_count} Qs)
                          </span>
                        )}
                      </td>

                      <td className="px-4 py-3 font-semibold text-default font-mono">
                        {p.total_marks} Marks
                      </td>

                      <td className="px-4 py-3">
                        <span
                          className={`badge ${
                            STATUS_MAP[p.status] || 'badge-neutral'
                          } capitalize text-[10px] font-semibold`}
                        >
                          {p.status?.replace(/_/g, ' ')}
                        </span>
                      </td>

                      <td className="px-4 py-3 text-xs text-muted">
                        {new Date(p.created_at).toLocaleDateString()}
                      </td>

                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleOpenPreview(p.id)}
                            disabled={isBusy}
                            className="btn btn-secondary text-xs px-2.5 py-1 flex items-center gap-1"
                            title="View Complete Paper"
                          >
                            {isBusy ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <Eye className="w-3.5 h-3.5" />
                            )}
                            <span className="hidden sm:inline">Preview</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleDirectDownload(p.id)}
                            disabled={isBusy}
                            className="btn btn-primary text-xs px-2.5 py-1 flex items-center gap-1"
                            title="Download / Print Complete PDF"
                          >
                            <Download className="w-3.5 h-3.5" />
                            <span className="hidden sm:inline">Download</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Complete Question Paper Preview Modal */}
      {selectedPaperId && fullPaper && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 sm:p-6 print:p-0 print:bg-white print:static">
          <div className="relative w-full max-w-[95vw] bg-surface rounded-brand-lg shadow-2xl border border-default my-4 overflow-hidden print:border-none print:shadow-none print:m-0 print:max-w-none">
            {/* Modal Header (hidden on print) */}
            <div className="no-print flex items-center justify-between px-6 py-4 border-b border-default bg-surface-2">
              <div className="flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-primary" />
                <h3 className="font-bold text-default text-base">Complete Question Paper Preview</h3>
              </div>
              <button
                type="button"
                onClick={handleCloseModal}
                className="p-1 rounded-brand text-muted hover:text-default hover:bg-surface-3 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body: Render Full Printable Document */}
            <div className="p-4 max-h-[82vh] overflow-y-auto print:max-h-none print:overflow-visible print:p-0">
              <QuestionPaperDocument
                paper={fullPaper}
                showActions={true}
                onClose={handleCloseModal}
                editable={fullPaper?.status !== 'approved' && fullPaper?.status !== 'pending_review'}
                onQuestionUpdated={(updatedPq, newPaperStatus) => {
                  setFullPaper((prev: any) => {
                    if (!prev) return prev;
                    const updatedPqs = (prev.paper_questions || []).map((pq: any) =>
                      pq.id === updatedPq.id ? { ...pq, ...updatedPq } : pq
                    );
                    return { ...prev, paper_questions: updatedPqs, status: newPaperStatus };
                  });
                }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
