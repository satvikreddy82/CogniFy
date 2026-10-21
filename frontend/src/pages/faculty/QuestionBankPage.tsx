import React, { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  PlusCircle,
  Upload,
  FileText,
  Image,
  Search,
  Filter,
  Trash2,
  CheckCircle,
  AlertCircle,
  Database,
  BookOpen,
  Sparkles,
  Layers,
  FileCheck,
  Zap,
} from 'lucide-react';
import { api } from '../../services/api';
import { clsx } from 'clsx';

const BLOOM_LEVELS = ['remember', 'understand', 'apply', 'analyze', 'evaluate', 'create'];
const DIFFICULTIES = ['easy', 'medium', 'hard'];

const bloomColor: Record<string, string> = {
  remember: 'badge-info',
  understand: 'badge-neutral',
  apply: 'badge-primary',
  analyze: 'badge-warning',
  evaluate: 'badge-success',
  create: 'badge-error',
};

export default function QuestionBankPage() {
  const qc = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [activeTab, setActiveTab] = useState<'banks' | 'questions'>('banks');
  const [search, setSearch] = useState('');
  const [bloomFilter, setBloomFilter] = useState('');
  const [diffFilter, setDiffFilter] = useState('');

  // Modals / Panels
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showAddManual, setShowAddManual] = useState(false);

  // Upload state
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const [fileBase64, setFileBase64] = useState<string | null>(null);
  const [uploadForm, setUploadForm] = useState({
    title: '',
    course_name: 'Design and Analysis of Algorithms',
    course_code: 'CS301',
    syllabus_text: '',
    pasted_content: '',
  });
  const [uploadError, setUploadError] = useState('');

  // Manual single question form
  const [manualForm, setManualForm] = useState({
    course_name: 'Design and Analysis of Algorithms',
    course_code: 'CS301',
    text: '',
    bloom_level: 'apply',
    difficulty: 'medium',
    marks: '10',
    auto_classify: true,
  });

  // Query: Available real courses
  const { data: courses = [] } = useQuery({
    queryKey: ['courses'],
    queryFn: () => api.get('/courses').then((r) => r.data),
  });

  // Query: Question Banks list
  const { data: banks = [], isLoading: banksLoading } = useQuery({
    queryKey: ['question-banks'],
    queryFn: () => api.get('/questions/banks').then((r) => r.data),
  });

  // Query: Individual Questions list
  const { data: result, isLoading: questionsLoading } = useQuery({
    queryKey: ['questions', search, bloomFilter, diffFilter],
    queryFn: () =>
      api
        .get('/questions', {
          params: { search, bloom_level: bloomFilter, difficulty: diffFilter },
        })
        .then((r) => r.data),
    placeholderData: { data: [], total: 0 },
  });

  const questions: any[] = result?.data || [];

  // Mutation: Upload Question Bank (PDF / JPEG)
  const uploadBankMutation = useMutation({
    mutationFn: async (payload: any) => {
      return api.post('/questions/upload-bank', payload);
    },
    onSuccess: (res: any) => {
      qc.invalidateQueries({ queryKey: ['question-banks'] });
      qc.invalidateQueries({ queryKey: ['questions'] });
      setShowUploadModal(false);
      setSelectedFile(null);
      setFilePreview(null);
      setFileBase64(null);
      setUploadForm({
        title: '',
        course_name: 'Design and Analysis of Algorithms',
        course_code: 'CS301',
        syllabus_text: '',
        pasted_content: '',
      });
      setUploadError('');
      if (res?.data?.warning) {
        alert(res.data.warning);
      }
    },
    onError: (err: any) => {
      setUploadError(err?.response?.data?.error || err?.message || 'Failed to process question bank file');
    },
  });

  // Mutation: Add manual single question
  const addManualMutation = useMutation({
    mutationFn: (d: any) => api.post('/questions', d),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['questions'] });
      setShowAddManual(false);
      setManualForm({
        course_name: 'Design and Analysis of Algorithms',
        course_code: 'CS301',
        text: '',
        bloom_level: 'apply',
        difficulty: 'medium',
        marks: '10',
        auto_classify: true,
      });
    },
  });

  // Mutation: Delete question bank + questions
  const deleteBankMutation = useMutation({
    mutationFn: (bankId: string) => api.delete(`/questions/banks/${bankId}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['question-banks'] });
      qc.invalidateQueries({ queryKey: ['questions'] });
    },
  });

  // Mutation: Delete single question
  const deleteQuestionMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/questions/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['questions'] });
      qc.invalidateQueries({ queryKey: ['question-banks'] });
    },
  });

  // Mutation: Clear all questions
  const clearAllMutation = useMutation({
    mutationFn: () => api.delete('/questions?clearAll=true'),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['questions'] });
      qc.invalidateQueries({ queryKey: ['question-banks'] });
    },
  });

  // File handling
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      if (!uploadForm.title) {
        setUploadForm((p) => ({ ...p, title: file.name.replace(/\.[^/.]+$/, '') }));
      }
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        setFileBase64(result);
        if (file.type.startsWith('image/')) {
          setFilePreview(result);
        } else {
          setFilePreview(null);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleUploadSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setUploadError('');

    if (!uploadForm.course_name.trim() || !uploadForm.course_code.trim()) {
      setUploadError('Please enter course name and course code');
      return;
    }

    const fileType = selectedFile?.name.endsWith('.pdf')
      ? 'pdf'
      : selectedFile?.type.includes('image') || selectedFile?.name.match(/\.(jpe?g|png)$/i)
      ? 'jpeg'
      : 'pdf';

    uploadBankMutation.mutate({
      title: uploadForm.title || selectedFile?.name || `${uploadForm.course_code} Question Bank`,
      file_name: selectedFile?.name || `${uploadForm.course_code}_QuestionBank.${fileType}`,
      file_type: fileType,
      file_size: selectedFile?.size || 150000,
      course_name: uploadForm.course_name,
      course_code: uploadForm.course_code,
      syllabus_text: uploadForm.syllabus_text,
      raw_content: uploadForm.pasted_content,
      file_base64: fileBase64,
    });
  };

  return (
    <div className="space-y-6 animate-fade-in max-w-6xl mx-auto">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-default">
        <div>
          <h1 className="text-2xl font-bold text-default tracking-tight">Question Bank Repository</h1>
          <p className="text-sm text-muted mt-1">
            Upload question banks via <strong>PDFs or JPEG images</strong>, or enter questions manually with Course Outcomes & Bloom's classification.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          {/* Upload PDF/JPEG button */}
          <button
            onClick={() => setShowUploadModal(true)}
            className="btn btn-primary text-xs flex items-center gap-1.5 shadow-sm"
          >
            <Upload className="w-4 h-4" /> Upload PDF / Image Bank
          </button>

          {/* Add Manual Question */}
          <button
            onClick={() => setShowAddManual(true)}
            className="btn btn-secondary text-xs flex items-center gap-1.5"
          >
            <PlusCircle className="w-4 h-4" /> Add Single Question
          </button>
        </div>
      </div>

      {/* Tabs: Uploaded Banks vs Individual Questions */}
      <div className="flex items-center justify-between border-b border-default pb-px">
        <div className="flex gap-4">
          <button
            onClick={() => setActiveTab('banks')}
            className={clsx(
              'pb-3 text-sm font-semibold flex items-center gap-2 border-b-2 transition-all',
              activeTab === 'banks'
                ? 'border-primary text-primary'
                : 'border-transparent text-muted hover:text-default'
            )}
          >
            <Layers className="w-4 h-4" />
            Uploaded Question Banks ({banks.length})
          </button>

          <button
            onClick={() => setActiveTab('questions')}
            className={clsx(
              'pb-3 text-sm font-semibold flex items-center gap-2 border-b-2 transition-all',
              activeTab === 'questions'
                ? 'border-primary text-primary'
                : 'border-transparent text-muted hover:text-default'
            )}
          >
            <Database className="w-4 h-4" />
            All Questions ({result?.total ?? 0})
          </button>
        </div>

        {/* Option to clear all if needed */}
        {questions.length > 0 && (
          <button
            onClick={() => {
              if (window.confirm('Are you sure you want to delete all questions and question banks? This cannot be undone.')) {
                clearAllMutation.mutate();
              }
            }}
            className="text-xs text-muted hover:text-danger flex items-center gap-1 transition-colors pb-2"
            title="Wipe question bank clean"
          >
            <Trash2 className="w-3.5 h-3.5" /> Clear All
          </button>
        )}
      </div>

      {/* ─────────────────── TAB 1: QUESTION BANKS (PDF & IMAGE SETS) ─────────────────── */}
      {activeTab === 'banks' && (
        <div className="space-y-4">
          {banksLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[...Array(2)].map((_, i) => (
                <div key={i} className="card p-5 animate-pulse h-32" />
              ))}
            </div>
          ) : banks.length === 0 ? (
            <div className="card p-12 text-center border-dashed border-2 border-default bg-surface/50">
              <Upload className="w-12 h-12 mx-auto mb-3 text-muted/40" />
              <h3 className="text-base font-semibold text-default mb-1">No Question Banks Uploaded Yet</h3>
              <p className="text-sm text-muted max-w-md mx-auto mb-5">
                Upload your departmental question banks in <strong>PDF or JPEG image format</strong>. Questions will be extracted and made available for automated paper generation.
              </p>
              <button
                onClick={() => setShowUploadModal(true)}
                className="btn btn-primary mx-auto text-xs"
              >
                <Upload className="w-4 h-4 mr-1.5" /> Upload First Question Bank (PDF/JPEG)
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {banks.map((b: any) => (
                <div
                  key={b.id}
                  className="card p-5 border border-default hover:shadow-card-md transition-all flex flex-col justify-between bg-surface"
                >
                  <div>
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <div className="flex items-center gap-2.5">
                        <div
                          className="w-10 h-10 rounded-brand-lg flex items-center justify-center shrink-0 shadow-sm"
                          style={{
                            backgroundColor:
                              b.file_type === 'pdf' ? '#FEE2E2' : '#E0E7FF',
                            color: b.file_type === 'pdf' ? '#DC2626' : '#4F46E5',
                          }}
                        >
                          {b.file_type === 'pdf' ? (
                            <FileText className="w-5 h-5" />
                          ) : (
                            <Image className="w-5 h-5" />
                          )}
                        </div>
                        <div>
                          <h4 className="text-sm font-bold text-default line-clamp-1">{b.title}</h4>
                          <p className="text-xs text-muted flex items-center gap-1.5 mt-0.5">
                            <span className="font-mono uppercase font-bold text-primary">
                              {b.file_type}
                            </span>
                            <span>•</span>
                            <span>{b.file_name}</span>
                          </p>
                        </div>
                      </div>

                      {/* Delete Question Bank Button */}
                      <button
                        onClick={() => {
                          if (
                            window.confirm(
                              `Delete question bank "${b.title}" and all its extracted questions?`
                            )
                          ) {
                            deleteBankMutation.mutate(b.id);
                          }
                        }}
                        className="btn btn-ghost p-1.5 hover:text-danger transition-colors text-muted rounded-full"
                        title="Delete question bank"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="mt-3 p-2.5 rounded-brand bg-surface-2 text-xs space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-muted">Course:</span>
                        <span className="font-semibold text-default">
                          {b.course_code} — {b.course_name}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-muted">Questions Extracted:</span>
                        <span className="font-bold text-primary">{b.question_count} questions</span>
                      </div>
                      {b.syllabus_text && (
                        <div className="pt-1 text-[11px] text-muted border-t border-default line-clamp-2">
                          <strong className="text-default">Scope: </strong>
                          {b.syllabus_text}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-default flex items-center justify-between text-xs text-muted">
                    <span>Uploaded: {new Date(b.created_at).toLocaleDateString()}</span>
                    <button
                      onClick={() => {
                        setSearch(b.course_code || b.course_name);
                        setActiveTab('questions');
                      }}
                      className="text-primary font-semibold hover:underline"
                    >
                      View Questions →
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ─────────────────── TAB 2: INDIVIDUAL QUESTIONS LIST ─────────────────── */}
      {activeTab === 'questions' && (
        <div className="space-y-4">
          {/* Filters */}
          <div className="flex flex-wrap gap-3">
            <div className="relative flex-1 min-w-48">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
              <input
                className="input pl-9 w-full"
                placeholder="Search questions or course code…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            <select
              className="input w-auto cursor-pointer"
              value={bloomFilter}
              onChange={(e) => setBloomFilter(e.target.value)}
            >
              <option value="">All Bloom's Levels</option>
              {BLOOM_LEVELS.map((l) => (
                <option key={l} value={l} className="capitalize">
                  {l.charAt(0).toUpperCase() + l.slice(1)}
                </option>
              ))}
            </select>

            <select
              className="input w-auto cursor-pointer"
              value={diffFilter}
              onChange={(e) => setDiffFilter(e.target.value)}
            >
              <option value="">All Difficulties</option>
              {DIFFICULTIES.map((d) => (
                <option key={d} value={d} className="capitalize">
                  {d.charAt(0).toUpperCase() + d.slice(1)}
                </option>
              ))}
            </select>
          </div>

          {/* Question Items */}
          {questionsLoading ? (
            <div className="space-y-3">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="card p-4 animate-pulse h-20" />
              ))}
            </div>
          ) : questions.length === 0 ? (
            <div className="card p-12 text-center text-muted border-dashed border-2 border-default">
              <Database className="w-12 h-12 mx-auto mb-3 opacity-20" />
              <p className="font-semibold text-default">No questions found matching criteria</p>
              <p className="text-xs mt-1">Upload a PDF/JPEG question bank or add questions manually</p>
            </div>
          ) : (
            <div className="space-y-3">
              {questions.map((q: any) => (
                <div
                  key={q.id}
                  className="card p-4 flex items-start gap-4 hover:shadow-card-md transition-all border border-default bg-surface"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                      <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-surface-2 text-default border border-default">
                        {q.course_code || 'GEN'}
                      </span>
                      <span className="text-xs text-muted font-medium truncate max-w-xs">
                        {q.course_name}
                      </span>
                      {q.bank_id && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary font-semibold">
                          From Uploaded Bank
                        </span>
                      )}
                    </div>

                    <p className="text-sm text-default font-medium leading-relaxed">{q.text}</p>

                    <div className="flex flex-wrap gap-2 mt-3 items-center">
                      {q.bloom_level && (
                        <span className={`badge ${bloomColor[q.bloom_level] || 'badge-neutral'} capitalize text-xs`}>
                          {q.bloom_level}
                        </span>
                      )}
                      {q.difficulty && (
                        <span className="badge badge-neutral capitalize text-xs">{q.difficulty}</span>
                      )}
                      {q.marks && (
                        <span className="badge badge-neutral text-xs">{q.marks} marks</span>
                      )}
                      {q.co_id && (
                        <span className="badge badge-primary text-xs">{q.co_id}</span>
                      )}
                    </div>
                  </div>

                  {/* Delete Button */}
                  <button
                    onClick={() => {
                      if (window.confirm('Delete this question?')) {
                        deleteQuestionMutation.mutate(q.id);
                      }
                    }}
                    className="btn btn-ghost p-2 hover:text-danger text-muted transition-colors rounded-full shrink-0"
                    title="Delete question"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ─────────────────── MODAL 1: UPLOAD QUESTION BANK (PDF / JPEG) ─────────────────── */}
      {showUploadModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
          <div className="card p-6 sm:p-8 max-w-xl w-full shadow-2xl border border-default bg-surface max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-default mb-5">
              <div className="flex items-center gap-2">
                <div
                  className="w-8 h-8 rounded-brand flex items-center justify-center"
                  style={{ backgroundColor: 'var(--primary)', color: 'var(--text-on-primary)' }}
                >
                  <Upload className="w-4 h-4" />
                </div>
                <h3 className="text-lg font-bold text-default">Upload Question Bank File</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowUploadModal(false)}
                className="text-muted hover:text-default p-1"
              >
                ✕
              </button>
            </div>

            {uploadError && (
              <div
                className="mb-4 flex gap-2 items-start p-3 rounded-brand text-xs font-medium"
                style={{ backgroundColor: '#FEE2E2', color: '#991B1B' }}
              >
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{uploadError}</span>
              </div>
            )}

            <form onSubmit={handleUploadSubmit} className="space-y-4">
              {/* File Dropzone */}
              <div>
                <label className="label text-xs font-semibold uppercase tracking-wider mb-1">
                  Upload PDF or JPEG / PNG Image *
                </label>
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-default rounded-brand-lg p-6 text-center cursor-pointer hover:border-primary transition-all bg-surface-2"
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf, .jpeg, .jpg, .png, image/*"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                  {selectedFile ? (
                    <div className="space-y-2">
                      <div className="flex items-center justify-center gap-2 text-primary font-bold">
                        <FileCheck className="w-6 h-6" />
                        <span>{selectedFile.name}</span>
                      </div>
                      <p className="text-xs text-muted">
                        {(selectedFile.size / 1024).toFixed(1)} KB • Click to choose another file
                      </p>
                      {filePreview && (
                        <div className="mt-2 max-h-36 overflow-hidden rounded-brand border border-default">
                          <img
                            src={filePreview}
                            alt="Preview"
                            className="w-full h-auto object-cover max-h-36 mx-auto"
                          />
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className="flex justify-center gap-3 text-muted">
                        <FileText className="w-8 h-8" />
                        <Image className="w-8 h-8" />
                      </div>
                      <p className="text-sm font-semibold text-default">
                        Click or drag & drop PDF or JPEG document here
                      </p>
                      <p className="text-xs text-muted">
                        Supports Question Papers, Unit Question Banks (.pdf, .jpeg, .png)
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Title */}
              <div>
                <label className="label text-xs font-semibold uppercase tracking-wider mb-1">
                  Question Bank Title
                </label>
                <input
                  className="input w-full"
                  placeholder="e.g. CS301 Algorithms Unit 1-4 Question Bank.pdf"
                  value={uploadForm.title}
                  onChange={(e) => setUploadForm((p) => ({ ...p, title: e.target.value }))}
                />
              </div>

              {/* MANUAL COURSE ENTRY (Requested by user) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="label text-xs font-semibold uppercase tracking-wider mb-1">
                    Course Code *
                  </label>
                  <input
                    className="input w-full font-mono uppercase"
                    placeholder="e.g. CS301"
                    value={uploadForm.course_code}
                    onChange={(e) =>
                      setUploadForm((p) => ({ ...p, course_code: e.target.value.toUpperCase() }))
                    }
                    required
                  />
                </div>

                <div>
                  <label className="label text-xs font-semibold uppercase tracking-wider mb-1">
                    Course Name *
                  </label>
                  <input
                    className="input w-full"
                    placeholder="e.g. Design & Analysis of Algorithms"
                    value={uploadForm.course_name}
                    onChange={(e) => setUploadForm((p) => ({ ...p, course_name: e.target.value }))}
                    required
                  />
                </div>
              </div>

              {/* Quick Suggestion Chips */}
              <div>
                <span className="text-[11px] text-muted font-medium mb-1.5 block">
                  Quick Select Course:
                </span>
                {courses.length === 0 ? (
                  <p className="text-xs text-muted italic">No courses available. Add a course in Courses section first.</p>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {courses.map((c: any) => (
                      <button
                        key={c.id || c.code}
                        type="button"
                        onClick={() =>
                          setUploadForm((p) => ({ ...p, course_name: c.name, course_code: c.code }))
                        }
                        className={clsx(
                          'px-2 py-1 rounded text-[11px] border transition-all',
                          uploadForm.course_code === c.code
                            ? 'border-primary bg-primary/10 text-primary font-bold'
                            : 'border-default bg-surface-2 text-muted hover:text-default'
                        )}
                      >
                        {c.code} ({c.name})
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Syllabus / Content context */}
              <div>
                <label className="label text-xs font-semibold uppercase tracking-wider mb-1">
                  Optional: Syllabus Context / Text Extract
                </label>
                <textarea
                  className="input w-full min-h-20 text-xs font-mono"
                  placeholder="Paste syllabus modules or raw question text from the PDF/JPEG if you want direct parser extraction..."
                  value={uploadForm.pasted_content}
                  onChange={(e) =>
                    setUploadForm((p) => ({ ...p, pasted_content: e.target.value }))
                  }
                />
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-default">
                <button
                  type="button"
                  onClick={() => setShowUploadModal(false)}
                  className="btn btn-secondary"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={uploadBankMutation.isPending}
                  className="btn btn-primary"
                >
                  {uploadBankMutation.isPending ? 'Processing & Extracting…' : 'Upload & Extract Questions'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─────────────────── MODAL 2: ADD SINGLE QUESTION MANUALLY ─────────────────── */}
      {showAddManual && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
          <div className="card p-6 sm:p-8 max-w-xl w-full shadow-2xl border border-default bg-surface max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-default mb-5">
              <div className="flex items-center gap-2">
                <PlusCircle className="w-5 h-5 text-primary" />
                <h3 className="text-lg font-bold text-default">Add Question Manually</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowAddManual(false)}
                className="text-muted hover:text-default p-1"
              >
                ✕
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                addManualMutation.mutate(manualForm);
              }}
              className="space-y-4"
            >
              {/* MANUAL COURSE ENTRY */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="label text-xs font-semibold uppercase tracking-wider mb-1">
                    Course Code *
                  </label>
                  <input
                    className="input w-full font-mono uppercase"
                    placeholder="e.g. CS301"
                    value={manualForm.course_code}
                    onChange={(e) =>
                      setManualForm((p) => ({ ...p, course_code: e.target.value.toUpperCase() }))
                    }
                    required
                  />
                </div>

                <div>
                  <label className="label text-xs font-semibold uppercase tracking-wider mb-1">
                    Course Name *
                  </label>
                  <input
                    className="input w-full"
                    placeholder="e.g. Design & Analysis of Algorithms"
                    value={manualForm.course_name}
                    onChange={(e) => setManualForm((p) => ({ ...p, course_name: e.target.value }))}
                    required
                  />
                </div>
              </div>

              {/* Question Text */}
              <div>
                <label className="label text-xs font-semibold uppercase tracking-wider mb-1">
                  Question Text *
                </label>
                <textarea
                  className="input w-full min-h-24 text-sm"
                  placeholder="Enter the complete question text..."
                  value={manualForm.text}
                  onChange={(e) => setManualForm((p) => ({ ...p, text: e.target.value }))}
                  required
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="label text-xs font-semibold uppercase tracking-wider mb-1">
                    Bloom's Level
                  </label>
                  <select
                    className="input w-full capitalize cursor-pointer text-xs"
                    value={manualForm.bloom_level}
                    onChange={(e) => setManualForm((p) => ({ ...p, bloom_level: e.target.value }))}
                  >
                    {BLOOM_LEVELS.map((l) => (
                      <option key={l} value={l} className="capitalize">
                        {l}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="label text-xs font-semibold uppercase tracking-wider mb-1">
                    Difficulty
                  </label>
                  <select
                    className="input w-full capitalize cursor-pointer text-xs"
                    value={manualForm.difficulty}
                    onChange={(e) => setManualForm((p) => ({ ...p, difficulty: e.target.value }))}
                  >
                    {DIFFICULTIES.map((d) => (
                      <option key={d} value={d} className="capitalize">
                        {d}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="label text-xs font-semibold uppercase tracking-wider mb-1">
                    Marks
                  </label>
                  <input
                    type="number"
                    min="1"
                    className="input w-full text-xs"
                    value={manualForm.marks}
                    onChange={(e) => setManualForm((p) => ({ ...p, marks: e.target.value }))}
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="auto_classify"
                  checked={manualForm.auto_classify}
                  onChange={(e) =>
                    setManualForm((p) => ({ ...p, auto_classify: e.target.checked }))
                  }
                  className="rounded cursor-pointer"
                />
                <label htmlFor="auto_classify" className="text-xs text-default cursor-pointer flex items-center gap-1 font-medium">
                  <Zap className="w-3.5 h-3.5 text-primary" />
                  Auto-classify Bloom's level and difficulty using AI engine
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-default">
                <button
                  type="button"
                  onClick={() => setShowAddManual(false)}
                  className="btn btn-secondary"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={addManualMutation.isPending}
                  className="btn btn-primary"
                >
                  {addManualMutation.isPending ? 'Saving Question…' : 'Add Question'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
