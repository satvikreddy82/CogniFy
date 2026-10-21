import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { FileText, CheckCircle, XCircle, AlertTriangle, Clock, Search, Eye, MessageSquare, ChevronRight } from 'lucide-react';
import { api } from '../../services/api';

export default function PaperReviewPage() {
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<'all' | 'pending_review' | 'approved' | 'changes_requested'>('pending_review');
  const [search, setSearch] = useState('');
  const [selectedPaper, setSelectedPaper] = useState<any | null>(null);
  const [reviewDecision, setReviewDecision] = useState<'approved' | 'rejected' | 'changes_requested'>('approved');
  const [reviewComment, setReviewComment] = useState('');

  const { data: papers = [], isLoading } = useQuery({
    queryKey: ['dean-papers'],
    queryFn: async () => {
      const res = await api.get('/papers');
      return res.data;
    },
  });

  const { data: paperDetails, isLoading: detailsLoading } = useQuery({
    queryKey: ['paper-detail', selectedPaper?.id],
    queryFn: async () => {
      if (!selectedPaper?.id) return null;
      const res = await api.get(`/papers/${selectedPaper.id}`);
      return res.data;
    },
    enabled: !!selectedPaper?.id,
  });

  const reviewMutation = useMutation({
    mutationFn: async ({ id, decision, comment }: { id: string; decision: string; comment?: string }) => {
      await api.post(`/papers/${id}/approve`, { decision, comment });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dean-papers'] });
      queryClient.invalidateQueries({ queryKey: ['paper-detail', selectedPaper?.id] });
      setSelectedPaper(null);
      setReviewComment('');
    },
  });

  const filtered = papers.filter((p: any) => {
    const matchesFilter = filter === 'all' || p.status === filter;
    const matchesSearch =
      (p.title || '').toLowerCase().includes(search.toLowerCase()) ||
      (p.courses?.name || '').toLowerCase().includes(search.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-default">Question Paper Approvals</h1>
          <p className="text-sm text-muted">Review, validate OBE compliance, and decide on faculty question paper submissions.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="w-4 h-4 text-muted absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search paper or course..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="input pl-9 text-sm w-48 sm:w-64"
            />
          </div>
          <div className="flex bg-surface-2 p-1 rounded-brand text-xs font-semibold">
            {(['pending_review', 'approved', 'changes_requested', 'all'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setFilter(tab)}
                className={`px-3 py-1.5 rounded-brand capitalize transition-colors ${
                  filter === tab ? 'bg-surface shadow text-default' : 'text-muted hover:text-default'
                }`}
              >
                {tab.replace('_', ' ')}
              </button>
            ))}
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="p-12 text-center text-muted">Loading papers...</div>
      ) : filtered.length === 0 ? (
        <div className="card p-12 text-center">
          <FileText className="w-12 h-12 text-muted mx-auto mb-3 opacity-40" />
          <h3 className="font-bold text-default mb-1">No question papers found</h3>
          <p className="text-sm text-muted">
            {filter === 'pending_review'
              ? 'Zero papers awaiting Dean review at this time.'
              : `No papers matching "${filter.replace('_', ' ')}".`}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filtered.map((paper: any) => {
            const isPending = paper.status === 'pending_review';
            return (
              <div key={paper.id} className="card p-5 flex flex-col justify-between space-y-4 border border-border hover:shadow transition-shadow">
                <div>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <span className="badge badge-primary text-xs">{paper.courses?.code || 'COURSE'}</span>
                    <span
                      className={`badge text-xs capitalize ${
                        paper.status === 'approved'
                          ? 'badge-success'
                          : paper.status === 'pending_review'
                          ? 'badge-warning'
                          : 'badge-danger'
                      }`}
                    >
                      {paper.status.replace('_', ' ')}
                    </span>
                  </div>
                  <h3 className="font-bold text-default text-base leading-snug mb-1">{paper.title}</h3>
                  <p className="text-xs text-muted mb-3">{paper.courses?.name}</p>

                  <div className="grid grid-cols-2 gap-2 text-xs text-muted bg-surface-2 p-2.5 rounded-brand">
                    <div>Total Marks: <strong className="text-default">{paper.total_marks}</strong></div>
                    <div>Duration: <strong className="text-default">{paper.duration_minutes}m</strong></div>
                    <div className="col-span-2">Submitted By: <strong className="text-default">{paper.profiles?.full_name || 'Faculty'}</strong></div>
                  </div>
                </div>

                <div className="pt-2 border-t border-border flex items-center justify-between">
                  <span className="text-[11px] text-muted">{new Date(paper.created_at).toLocaleDateString()}</span>
                  <button
                    onClick={() => setSelectedPaper(paper)}
                    className="btn btn-primary text-xs py-1.5 px-3 flex items-center gap-1"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    {isPending ? 'Review Paper' : 'View Details'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Review Modal */}
      {selectedPaper && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 animate-fade-in backdrop-blur-sm overflow-y-auto">
          <div className="card p-6 max-w-3xl w-full max-h-[90vh] flex flex-col my-auto shadow-2xl">
            <div className="flex items-start justify-between border-b border-border pb-4 mb-4">
              <div>
                <span className="badge badge-primary text-xs mb-1">{selectedPaper.courses?.code}</span>
                <h2 className="text-xl font-bold text-default">{selectedPaper.title}</h2>
                <p className="text-xs text-muted">
                  Submitted by {selectedPaper.profiles?.full_name} • Total Marks: {selectedPaper.total_marks} • Duration: {selectedPaper.duration_minutes} mins
                </p>
              </div>
              <button
                onClick={() => setSelectedPaper(null)}
                className="text-muted hover:text-default p-1 text-lg font-bold"
              >
                ✕
              </button>
            </div>

            <div className="flex-1 overflow-y-auto pr-2 space-y-4">
              {detailsLoading ? (
                <div className="py-8 text-center text-muted">Loading paper questions & taxonomy analysis...</div>
              ) : (
                <>
                  <div className="space-y-3">
                    <h3 className="font-semibold text-sm text-default uppercase tracking-wide">Included Questions</h3>
                    {paperDetails?.paper_questions?.length === 0 ? (
                      <p className="text-sm text-muted">No questions found in this paper.</p>
                    ) : (
                      paperDetails?.paper_questions?.map((pq: any, i: number) => {
                        const q = pq.question_bank_entries || {};
                        return (
                          <div key={pq.id || i} className="p-3.5 bg-surface-2 rounded-brand border border-border text-sm space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="font-bold text-default text-xs">
                                Q{i + 1} {pq.section ? `(Section ${pq.section})` : ''}
                              </span>
                              <div className="flex items-center gap-1.5">
                                <span className="badge badge-primary text-[10px]">{q.bloom_level || 'L1'}</span>
                                <span className="badge badge-outline text-[10px] capitalize">{q.difficulty || 'medium'}</span>
                                <span className="badge text-[10px] font-mono">{pq.marks} marks</span>
                              </div>
                            </div>
                            <p className="text-default text-xs leading-relaxed">{q.question_text || 'Question content'}</p>
                          </div>
                        );
                      })
                    )}
                  </div>

                  <div className="p-4 bg-surface-2 rounded-brand border border-border space-y-3 mt-4">
                    <h4 className="font-bold text-sm text-default flex items-center gap-2">
                      <MessageSquare className="w-4 h-4 text-primary" /> Dean Evaluation & Decision
                    </h4>

                    <div className="flex gap-2">
                      {[
                        { id: 'approved', label: 'Approve Paper', color: 'btn-success' },
                        { id: 'changes_requested', label: 'Request Changes', color: 'btn-warning' },
                        { id: 'rejected', label: 'Reject', color: 'btn-danger' },
                      ].map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => setReviewDecision(item.id as any)}
                          className={`text-xs py-1.5 px-3 rounded-brand font-semibold border transition-all ${
                            reviewDecision === item.id
                              ? `${item.color} text-white shadow-sm border-transparent`
                              : 'border-border text-muted hover:text-default bg-surface'
                          }`}
                        >
                          {item.label}
                        </button>
                      ))}
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-muted uppercase tracking-wider mb-1">
                        Feedback / Decision Note
                      </label>
                      <textarea
                        value={reviewComment}
                        onChange={(e) => setReviewComment(e.target.value)}
                        placeholder="Provide notes or specific modifications required by OBE guidelines..."
                        className="input w-full h-20 text-xs"
                      />
                    </div>
                  </div>
                </>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-4 border-t border-border mt-4">
              <button
                onClick={() => setSelectedPaper(null)}
                className="btn btn-outline text-xs"
              >
                Close
              </button>
              <button
                onClick={() =>
                  reviewMutation.mutate({
                    id: selectedPaper.id,
                    decision: reviewDecision,
                    comment: reviewComment,
                  })
                }
                disabled={reviewMutation.isPending}
                className="btn btn-primary text-xs"
              >
                {reviewMutation.isPending ? 'Submitting...' : 'Confirm Decision'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
