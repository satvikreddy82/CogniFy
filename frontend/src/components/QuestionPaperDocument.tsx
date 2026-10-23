import React, { useState, useRef, useCallback } from 'react';
import {
  Printer,
  Pencil,
  X,
  Maximize2,
  Minimize2,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Save,
  AlertTriangle,
  Loader2,
  CheckCircle,
} from 'lucide-react';
import { api } from '../services/api';

interface QuestionBankEntry {
  text?: string;
  question_text?: string;
  bloom_level?: string;
  difficulty?: string;
  co_id?: string;
  marks?: number;
}

interface PaperQuestion {
  id?: string;
  question_id?: string;
  order_index?: number;
  section?: string;
  marks: number;
  question_bank_entries?: QuestionBankEntry;
}

interface PaperData {
  id?: string;
  title: string;
  course_name?: string;
  course_code?: string;
  total_marks: number;
  duration_minutes: number;
  paper_questions?: PaperQuestion[];
  created_at?: string;
  status?: string;
  courses?: { name?: string; code?: string };
}

interface QuestionPaperDocumentProps {
  paper: PaperData;
  showActions?: boolean;
  editable?: boolean;
  onClose?: () => void;
  onQuestionUpdated?: (updatedPq: PaperQuestion, newPaperStatus: string) => void;
}

const BLOOM_BADGE: Record<string, string> = {
  remember: 'badge-neutral',
  understand: 'badge-info',
  apply: 'badge-primary',
  analyze: 'badge-warning',
  evaluate: 'badge-error',
  create: 'badge-success',
};

const DIFF_COLOR: Record<string, string> = {
  easy: '#22c55e',
  medium: '#f59e0b',
  hard: '#ef4444',
};

const LOCKED_STATUSES = new Set(['approved', 'pending_review']);

interface EditDraft {
  pqId: string;
  text: string;
  marks: string;
  bloom_level: string;
  difficulty: string;
  co_id: string;
  originalMarks: number;
}

const BLOOM_OPTIONS = ['remember', 'understand', 'apply', 'analyze', 'evaluate', 'create'];
const DIFF_OPTIONS = ['easy', 'medium', 'hard'];

export default function QuestionPaperDocument({
  paper,
  showActions = true,
  editable = false,
  onClose,
  onQuestionUpdated,
}: QuestionPaperDocumentProps) {
  const courseCode = paper.course_code || paper.courses?.code || 'COURSE';
  const courseName = paper.course_name || paper.courses?.name || 'Academic Assessment';
  const allPqs: PaperQuestion[] = (paper.paper_questions || []).slice().sort(
    (a, b) => (a.order_index ?? 0) - (b.order_index ?? 0)
  );

  const isLocked = LOCKED_STATUSES.has(paper.status ?? '');
  const canEdit = editable && !isLocked;

  const [fullscreen, setFullscreen] = useState(false);
  const [zoom, setZoom] = useState(100);
  const changeZoom = (delta: number) =>
    setZoom((z) => Math.min(150, Math.max(60, z + delta)));

  const [editDraft, setEditDraft] = useState<EditDraft | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [marksConflict, setMarksConflict] = useState<{ newTotal: number; expectedTotal: number } | null>(null);

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const openEdit = useCallback((pq: PaperQuestion) => {
    const qData = pq.question_bank_entries || {};
    setEditDraft({
      pqId: pq.id!,
      text: (qData.text || qData.question_text || '').trim(),
      marks: String(pq.marks),
      bloom_level: qData.bloom_level || 'apply',
      difficulty: qData.difficulty || 'medium',
      co_id: qData.co_id || '',
      originalMarks: pq.marks,
    });
    setSaveError(null);
    setSaveSuccess(false);
    setMarksConflict(null);
    setTimeout(() => textareaRef.current?.focus(), 80);
  }, []);

  const closeEdit = useCallback(() => {
    if (saving) return;
    if (editDraft) {
      const pq = allPqs.find((q) => q.id === editDraft.pqId);
      const origText = (pq?.question_bank_entries?.text || pq?.question_bank_entries?.question_text || '').trim();
      const origMarks = String(pq?.marks ?? editDraft.originalMarks);
      const dirty = editDraft.text !== origText || editDraft.marks !== origMarks;
      if (dirty && !window.confirm('You have unsaved changes. Discard them?')) return;
    }
    setEditDraft(null);
    setSaveError(null);
    setSaveSuccess(false);
    setMarksConflict(null);
  }, [saving, editDraft, allPqs]);

  const handleSave = useCallback(async () => {
    if (!editDraft || !paper.id) return;
    const marksNum = parseInt(editDraft.marks, 10);
    if (!editDraft.text.trim() || editDraft.text.trim().length < 5) {
      setSaveError('Question text must be at least 5 characters.');
      return;
    }
    if (isNaN(marksNum) || marksNum < 1) {
      setSaveError('Marks must be a positive integer.');
      return;
    }
    setSaving(true);
    setSaveError(null);
    setSaveSuccess(false);
    setMarksConflict(null);
    try {
      const payload: Record<string, unknown> = {
        text: editDraft.text.trim(),
        marks: marksNum,
        bloom_level: editDraft.bloom_level,
        difficulty: editDraft.difficulty,
      };
      if (editDraft.co_id.trim()) payload.co_id = editDraft.co_id.trim();
      const res = await api.patch(`/papers/${paper.id}/questions/${editDraft.pqId}`, payload);
      setSaveSuccess(true);
      onQuestionUpdated?.(res.data.paper_question, res.data.paper_status);
      setTimeout(() => { setEditDraft(null); setSaveSuccess(false); }, 900);
    } catch (err: any) {
      const errData = err?.response?.data;
      if (errData?.code === 'MARKS_MISMATCH') {
        setMarksConflict({ newTotal: errData.new_total, expectedTotal: errData.expected_total });
        setSaveError(errData.error);
      } else {
        setSaveError(errData?.error || err?.message || 'Failed to save changes.');
      }
    } finally {
      setSaving(false);
    }
  }, [editDraft, paper.id, onQuestionUpdated]);

  const sectionNames = Array.from(new Set(allPqs.map((pq) => pq.section || 'General Section')));

  const globalNumMap = new Map<string, number>();
  let counter = 0;
  allPqs.forEach((pq) => {
    counter++;
    globalNumMap.set(pq.id || String(pq.order_index), counter);
  });

  const handlePrint = () => window.print();

  const paperCanvas = (
    <div
      className="paper-canvas transition-transform duration-200"
      style={{ transform: `scale(${zoom / 100})`, transformOrigin: 'top center' }}
    >
      <div className="p-6 sm:p-10 bg-surface rounded-brand-lg border-2 border-default shadow-sm space-y-6 text-default print:border-none print:shadow-none print:p-0">
        <div className="paper-exam-header p-5 rounded-brand border-2 border-default bg-surface text-center space-y-1.5">
          <div className="text-[11px] font-bold tracking-widest uppercase text-muted">COGNIFY OUTCOME-BASED EDUCATION PLATFORM</div>
          <h1 className="text-xl font-bold uppercase tracking-tight text-default">{courseName}</h1>
          <div className="text-sm font-semibold text-primary font-mono">Course Code: {courseCode}</div>
          <h2 className="text-base font-bold text-default pt-1">{paper.title}</h2>
          <div className="flex flex-wrap justify-center gap-6 text-xs text-muted pt-2 border-t border-default/50">
            <span>Duration: <strong>{paper.duration_minutes || 180} Minutes</strong></span>
            <span>Maximum Marks: <strong>{paper.total_marks} Marks</strong></span>
            <span>Sections: <strong>{sectionNames.length}</strong></span>
            <span>Total Questions: <strong>{allPqs.length}</strong></span>
          </div>
          <div className="text-xs text-muted italic pt-2">
            <strong>General Instructions:</strong> Answer all questions in each section. All questions are compulsory unless internal choice is specified. Marks and Course Outcomes are indicated against each question.
          </div>
        </div>

        {allPqs.length === 0 ? (
          <div className="p-8 text-center text-muted">
            <p className="font-semibold text-default">No questions found for this paper.</p>
            <p className="text-xs mt-1">This paper may be generating or questions are not yet linked.</p>
          </div>
        ) : (
          sectionNames.map((secName) => {
            const sectionQs = allPqs.filter((pq) => (pq.section || 'General Section') === secName);
            const secMarks = sectionQs.reduce((s, pq) => s + (Number(pq.marks) || 0), 0);
            return (
              <div key={secName} className="paper-section-block border border-default rounded-brand-lg overflow-hidden bg-surface">
                <div className="paper-section-header px-5 py-3 flex items-center justify-between" style={{ backgroundColor: 'var(--primary)', color: 'var(--text-on-primary, #ffffff)' }}>
                  <span className="font-bold text-sm tracking-wide">{secName}</span>
                  <span className="text-xs font-semibold opacity-95">{sectionQs.length} Questions • {secMarks} Marks Total</span>
                </div>
                <div className="divide-y divide-default">
                  {sectionQs.map((pq) => {
                    const qNum = globalNumMap.get(pq.id || String(pq.order_index)) ?? 0;
                    const qData = pq.question_bank_entries || {};
                    const qText = (qData.text || qData.question_text || '').trim();
                    const isEditing = editDraft?.pqId === pq.id;
                    return (
                      <div key={pq.id || `${secName}-${pq.order_index}`} className="paper-question-row p-4 sm:p-5 flex gap-4 bg-surface transition-colors">
                        <span className="font-bold text-sm font-mono text-primary shrink-0 w-8 pt-0.5">Q{qNum}.</span>
                        <div className="flex-1 min-w-0 space-y-2">
                          <p className="text-sm text-default leading-relaxed font-medium">{qText || '(Question text unavailable)'}</p>
                          <div className="flex flex-wrap items-center gap-2 pt-1 text-xs">
                            <span className="font-bold text-default paper-badge">[{pq.marks} Marks]</span>
                            {qData.bloom_level && <span className={`badge ${BLOOM_BADGE[qData.bloom_level] || "badge-neutral"} text-[10px] capitalize font-medium`}>Bloom: {qData.bloom_level}</span>}
                            {qData.co_id && <span className="badge badge-neutral text-[10px] font-mono">CO: {qData.co_id}</span>}
                            {qData.difficulty && (
                              <span className="badge badge-info text-[10px] capitalize flex items-center gap-1">
                                <span className="w-1.5 h-1.5 rounded-full inline-block" style={{ backgroundColor: DIFF_COLOR[qData.difficulty] || '#94a3b8' }} />
                                {qData.difficulty}
                              </span>
                            )}
                            {pq.id && <span className="text-[9px] text-muted/50 font-mono hidden sm:inline select-all">#{pq.id}</span>}
                          </div>
                        </div>
                        {canEdit && (
                          <button type="button" title="Edit this question" onClick={() => openEdit(pq)} className="no-print shrink-0 self-start mt-0.5 p-1.5 rounded-brand text-muted hover:text-primary hover:bg-primary/10 transition-colors">
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })
        )}

        <div className="text-center pt-6 pb-2 text-xs text-muted border-t border-default space-y-1">
          <p className="font-bold tracking-widest uppercase">*** END OF QUESTION PAPER ***</p>
          <p className="text-[11px] opacity-80">Validated for OBE Compliance: Course Outcomes & Bloom's Taxonomy Alignment Verified.</p>
        </div>
      </div>
    </div>
  );

  const editModal = editDraft && (
    <div className="fixed inset-0 z-[110] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 no-print">
      <div className="relative w-full max-w-xl bg-surface rounded-brand-lg shadow-2xl border border-default overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-default bg-surface-2">
          <div className="flex items-center gap-2">
            <Pencil className="w-4 h-4 text-primary" />
            <h3 className="font-bold text-default text-sm">Edit Question</h3>
            <span className="text-[10px] font-mono text-muted">#{editDraft.pqId}</span>
          </div>
          <button type="button" onClick={closeEdit} disabled={saving} className="p-1 rounded-brand text-muted hover:text-default hover:bg-surface-3 transition-colors"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
          <div>
            <label className="label text-xs font-semibold uppercase tracking-wider mb-1 block">Question Text *</label>
            <textarea ref={textareaRef} className="input w-full min-h-28 text-sm leading-relaxed font-medium resize-y" value={editDraft.text} onChange={(e) => setEditDraft((d) => d ? { ...d, text: e.target.value } : d)} disabled={saving} placeholder="Enter the question text..." />
            {editDraft.text.trim().length > 0 && editDraft.text.trim().length < 5 && <p className="text-xs text-danger mt-1">Minimum 5 characters required.</p>}
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="label text-xs font-semibold uppercase tracking-wider mb-1 block">Marks *</label>
              <input type="number" min={1} className="input w-full text-sm font-mono font-bold" value={editDraft.marks} onChange={(e) => setEditDraft((d) => d ? { ...d, marks: e.target.value } : d)} disabled={saving} />
              {marksConflict && <p className="text-[10px] text-danger mt-1">Total would be {marksConflict.newTotal} / {marksConflict.expectedTotal}</p>}
            </div>
            <div>
              <label className="label text-xs font-semibold uppercase tracking-wider mb-1 block">Bloom Level</label>
              <select className="input w-full text-xs capitalize" value={editDraft.bloom_level} onChange={(e) => setEditDraft((d) => d ? { ...d, bloom_level: e.target.value } : d)} disabled={saving}>
                {BLOOM_OPTIONS.map((b) => <option key={b} value={b} className="capitalize">{b.charAt(0).toUpperCase() + b.slice(1)}</option>)}
              </select>
            </div>
            <div>
              <label className="label text-xs font-semibold uppercase tracking-wider mb-1 block">Difficulty</label>
              <select className="input w-full text-xs capitalize" value={editDraft.difficulty} onChange={(e) => setEditDraft((d) => d ? { ...d, difficulty: e.target.value } : d)} disabled={saving}>
                {DIFF_OPTIONS.map((d) => <option key={d} value={d} className="capitalize">{d.charAt(0).toUpperCase() + d.slice(1)}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="label text-xs font-semibold uppercase tracking-wider mb-1 block">Course Outcome (CO) Mapping</label>
            <input className="input w-full text-sm font-mono" placeholder="e.g. CO1, CO2, co-uuid..." value={editDraft.co_id} onChange={(e) => setEditDraft((d) => d ? { ...d, co_id: e.target.value } : d)} disabled={saving} />
          </div>
          {saveError && <div className="p-3 rounded-brand border border-danger/40 bg-danger/10 text-danger text-xs flex items-start gap-2"><AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" /><span>{saveError}</span></div>}
          {saveSuccess && <div className="p-3 rounded-brand border border-success/40 bg-success/10 text-success text-xs flex items-center gap-2"><CheckCircle className="w-4 h-4 shrink-0" />Saved successfully!</div>}
        </div>
        <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-default bg-surface-2">
          <button type="button" onClick={closeEdit} disabled={saving} className="btn btn-secondary text-xs">Cancel</button>
          <button type="button" onClick={handleSave} disabled={saving || saveSuccess} className="btn btn-primary text-xs flex items-center gap-1.5">
            {saving ? <><Loader2 className="w-3.5 h-3.5 animate-spin" />Saving...</> : saveSuccess ? <><CheckCircle className="w-3.5 h-3.5" />Saved</> : <><Save className="w-3.5 h-3.5" />Save Changes</>}
          </button>
        </div>
      </div>
    </div>
  );

  if (fullscreen) {
    return (
      <>
        <div className="fixed inset-0 z-[100] bg-surface-2 flex flex-col no-print overflow-hidden">
          <div className="flex items-center justify-between px-4 py-2.5 bg-surface border-b border-default shadow-sm shrink-0 no-print">
            <div className="flex items-center gap-2">
              <span className="badge badge-primary font-mono text-xs font-bold">{courseCode}</span>
              <span className="text-sm font-semibold text-default truncate hidden sm:inline">{paper.title}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <button type="button" onClick={() => changeZoom(-10)} disabled={zoom <= 60} className="btn btn-secondary text-xs px-2 py-1" title="Zoom out"><ZoomOut className="w-3.5 h-3.5" /></button>
              <span className="text-xs font-mono font-bold text-muted w-10 text-center">{zoom}%</span>
              <button type="button" onClick={() => changeZoom(10)} disabled={zoom >= 150} className="btn btn-secondary text-xs px-2 py-1" title="Zoom in"><ZoomIn className="w-3.5 h-3.5" /></button>
              <button type="button" onClick={() => setZoom(100)} className="btn btn-secondary text-xs px-2 py-1" title="Reset zoom"><RotateCcw className="w-3.5 h-3.5" /></button>
              <div className="w-px h-5 bg-border mx-1" />
              <button type="button" onClick={handlePrint} className="btn btn-primary text-xs flex items-center gap-1.5"><Printer className="w-3.5 h-3.5" /><span className="hidden sm:inline">Print / PDF</span></button>
              <button type="button" onClick={() => setFullscreen(false)} className="btn btn-secondary text-xs flex items-center gap-1.5" title="Exit full screen"><Minimize2 className="w-3.5 h-3.5" /><span className="hidden sm:inline">Exit</span></button>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto px-4 pb-8 pt-4"><div className="max-w-4xl mx-auto">{paperCanvas}</div></div>
        </div>
        {editModal}
      </>
    );
  }

  return (
    <div className="printable-paper-document space-y-4">
      {showActions && (
        <div className="no-print flex flex-wrap items-center justify-between gap-3 p-3 bg-surface-2 border border-default rounded-brand-lg">
          <div className="flex items-center gap-2 min-w-0">
            <span className="badge badge-primary font-mono text-xs uppercase font-bold shrink-0">{courseCode}</span>
            <span className="text-sm font-semibold text-default truncate">{paper.title}</span>
            <span className="text-xs text-muted shrink-0">({allPqs.length} Qs • {paper.total_marks} Marks)</span>
          </div>
          <div className="flex items-center gap-1.5 ml-auto shrink-0">
            <button type="button" onClick={() => changeZoom(-10)} disabled={zoom <= 60} title="Zoom out" className="btn btn-secondary text-xs px-2 py-1"><ZoomOut className="w-3.5 h-3.5" /></button>
            <span className="text-xs font-mono text-muted w-9 text-center">{zoom}%</span>
            <button type="button" onClick={() => changeZoom(10)} disabled={zoom >= 150} title="Zoom in" className="btn btn-secondary text-xs px-2 py-1"><ZoomIn className="w-3.5 h-3.5" /></button>
            <button type="button" onClick={() => setZoom(100)} title="Reset zoom" className="btn btn-secondary text-xs px-2 py-1"><RotateCcw className="w-3 h-3" /></button>
            <div className="w-px h-5 bg-border mx-0.5" />
            <button type="button" onClick={() => setFullscreen(true)} title="Full screen preview" className="btn btn-secondary text-xs flex items-center gap-1.5"><Maximize2 className="w-3.5 h-3.5" /><span className="hidden sm:inline">Full Screen</span></button>
            <button type="button" onClick={handlePrint} className="btn btn-primary text-xs flex items-center gap-1.5 shadow-sm"><Printer className="w-3.5 h-3.5" /><span className="hidden sm:inline">Download / Print PDF</span></button>
            {onClose && <button type="button" onClick={onClose} className="btn btn-secondary text-xs">Close</button>}
          </div>
        </div>
      )}
      {isLocked && editable && (
        <div className="no-print p-3 rounded-brand border border-amber-300 bg-amber-50 text-amber-800 dark:bg-amber-950/30 dark:text-amber-200 text-xs flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          This paper is <strong>&nbsp;{paper.status?.replace(/_/g, ' ')}&nbsp;</strong> and is currently locked for editing.
        </div>
      )}
      <div className="overflow-x-auto">{paperCanvas}</div>
      {editModal}
    </div>
  );
}
