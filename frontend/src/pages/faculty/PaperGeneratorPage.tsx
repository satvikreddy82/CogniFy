import React, { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import {
  PenTool,
  ChevronRight,
  ChevronLeft,
  Zap,
  CheckCircle,
  AlertTriangle,
  XCircle,
  Send,
  BookOpen,
  FileText,
  FileCheck,
  Image,
  Upload,
  Layers,
  Sparkles,
} from 'lucide-react';
import { api } from '../../services/api';
import { clsx } from 'clsx';

type Step = 1 | 2 | 3 | 4 | 5;

interface Section {
  name: string;
  questions: number | string;
  marks_per_question: number | string;
  difficulty?: string;
  bloom_levels?: string[];
}

import QuestionPaperDocument from '../../components/QuestionPaperDocument';

const SAMPLE_SYLLABUS = `Unit 1: Mathematical Foundations & Asymptotic Complexity
- Growth of functions, Big-Oh, Big-Omega, Big-Theta notations.
- Recurrence relations: Substitution method, Recursion Tree, Master Theorem.

Unit 2: Divide-and-Conquer & Dynamic Programming
- Merge Sort, Quick Sort, Strassen Matrix Multiplication.
- Elements of DP: 0/1 Knapsack, Longest Common Subsequence (LCS), Matrix Chain Multiplication.

Unit 3: Greedy Techniques & Graph Algorithms
- Greedy choice property: Fractional Knapsack, Huffman coding.
- Minimum Spanning Trees (Kruskal, Prim), Shortest Paths (Dijkstra, Bellman-Ford).

Unit 4: Intractability & NP-Completeness
- Class P, NP, NP-Hard, NP-Complete problems.
- Polynomial-time reductions: 3-SAT to Vertex Cover, Hamiltonian Cycle, Traveling Salesperson Problem.`;

export default function PaperGeneratorPage() {
  const [step, setStep] = useState<Step>(1);

  // MANUAL COURSE ENTRY (requested by user)
  const [courseName, setCourseName] = useState('Design and Analysis of Algorithms');
  const [courseCode, setCourseCode] = useState('CS301');

  const [title, setTitle] = useState('Mid-Semester Assessment 2026-27');
  const [totalMarksStr, setTotalMarksStr] = useState('100');
  const totalMarks = parseInt(totalMarksStr) || 0;
  const [durationStr, setDurationStr] = useState('180');
  const duration = parseInt(durationStr) || 0;

  // SYLLABUS SECTION (requested by user)
  const [syllabus, setSyllabus] = useState(SAMPLE_SYLLABUS);

  // QUESTION BANK SOURCES (from uploaded PDFs / JPEGs)
  const [selectedBankIds, setSelectedBankIds] = useState<string[]>([]);
  const [useAllMatchingBanks, setUseAllMatchingBanks] = useState(true);

  // Sections — fields support empty string editing state so users can clear inputs completely
  const [sections, setSections] = useState<Section[]>([
    { name: 'Section A (Short Questions)', questions: 5, marks_per_question: 4, difficulty: 'easy', bloom_levels: ['remember', 'understand'] },
    { name: 'Section B (Analytical Problems)', questions: 5, marks_per_question: 8, difficulty: 'medium', bloom_levels: ['apply', 'analyze'] },
    { name: 'Section C (Comprehensive Design)', questions: 2, marks_per_question: 20, difficulty: 'hard', bloom_levels: ['evaluate', 'create'] },
  ]);

  const [paperId, setPaperId] = useState<string | null>(null);
  const [generatedPaper, setGeneratedPaper] = useState<any>(null);
  const [validation, setValidation] = useState<any>(null);

  // Progress timer for generation feedback
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  // Fetch available real courses from backend
  const { data: courses = [] } = useQuery({
    queryKey: ['courses'],
    queryFn: () => api.get('/courses').then((r) => r.data),
  });

  // Fetch available Question Banks (uploaded PDFs / images)
  const { data: questionBanks = [] } = useQuery({
    queryKey: ['question-banks'],
    queryFn: () => api.get('/questions/banks').then((r) => r.data),
  });

  const computedTotal = sections.reduce(
    (s, sec) => s + (Number(sec.questions) || 0) * (Number(sec.marks_per_question) || 0),
    0
  );

  // Mutation: Generate paper with dedicated 120s timeout and payload sanitation
  const generateMutation = useMutation({
    mutationFn: () =>
      api.post(
        '/papers/generate',
        {
          course_name: courseName.trim(),
          course_code: courseCode.trim().toUpperCase(),
          title: title.trim(),
          total_marks: totalMarks,
          duration_minutes: duration || 180,
          syllabus: syllabus.trim(),
          question_bank_ids: useAllMatchingBanks
            ? questionBanks.map((b: any) => b.id)
            : selectedBankIds,
          sections: sections.map((sec) => ({
            ...sec,
            questions: Math.max(1, Number(sec.questions) || 1),
            marks_per_question: Math.max(1, Number(sec.marks_per_question) || 1),
          })),
        },
        {
          timeout: 120000, // 120s timeout (allows AI retries with exponential backoff)
        }
      ),
    onSuccess: async (res) => {
      setPaperId(res.data.paper_id);
      // Fetch paper details & validation
      try {
        const [paperRes, valRes] = await Promise.all([
          api.get(`/papers/${res.data.paper_id}`),
          api.get(`/papers/${res.data.paper_id}/validate`),
        ]);
        setGeneratedPaper(paperRes.data);
        setValidation(valRes.data);
      } catch {}
      setStep(4);
    },
  });

  useEffect(() => {
    let timer: any;
    if (generateMutation.isPending) {
      setElapsedSeconds(0);
      timer = setInterval(() => {
        setElapsedSeconds((prev) => prev + 1);
      }, 1000);
    } else {
      setElapsedSeconds(0);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [generateMutation.isPending]);

  const getProgressStage = (seconds: number) => {
    if (seconds < 6) return 'Analyzing syllabus topics and matching uploaded question banks…';
    if (seconds < 18) return 'Consulting Google Gemini AI for grounded question synthesis…';
    if (seconds < 32) return "Mapping Bloom's Taxonomy levels (L1–L6) & Course Outcomes…";
    if (seconds < 45) return 'Aligning section marks allocation and verifying OBE criteria…';
    return 'Finalizing paper structure and deterministic outcome validation…';
  };

  // Mutation: Submit for Dean review
  const submitMutation = useMutation({
    mutationFn: () => api.post(`/papers/${paperId}/submit`),
    onSuccess: () => setStep(5),
  });

  const steps = [
    { n: 1, label: 'Course & Syllabus' },
    { n: 2, label: 'Exam Pattern' },
    { n: 3, label: 'Review Scope' },
    { n: 4, label: 'OBE Validation' },
    { n: 5, label: 'Submission' },
  ];

  const handleBankToggle = (id: string) => {
    setUseAllMatchingBanks(false);
    if (selectedBankIds.includes(id)) {
      setSelectedBankIds(selectedBankIds.filter((b) => b !== id));
    } else {
      setSelectedBankIds([...selectedBankIds, id]);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-fade-in pb-12">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-default tracking-tight">Question Paper Generator</h1>
        <p className="text-sm text-muted mt-1">
          Generate OBE-compliant examination papers mapped strictly to your <strong>Syllabus</strong> and sourced from your <strong>uploaded PDF question banks</strong>.
        </p>
      </div>

      {/* Stepper */}
      <div className="flex items-center gap-2 p-3 rounded-brand-lg border border-default bg-surface shadow-sm">
        {steps.map((s, i) => (
          <React.Fragment key={s.n}>
            <div className="flex items-center gap-2">
              <div
                className={clsx(
                  'w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all',
                  step >= s.n
                    ? 'text-on-primary shadow-sm'
                    : 'text-muted bg-surface-2 border border-default'
                )}
                style={step >= s.n ? { backgroundColor: 'var(--primary)' } : {}}
              >
                {step > s.n ? <CheckCircle className="w-4 h-4" /> : s.n}
              </div>
              <span
                className={clsx(
                  'text-xs font-medium hidden md:inline',
                  step >= s.n ? 'text-default font-semibold' : 'text-muted'
                )}
              >
                {s.label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div
                className="flex-1 h-0.5 transition-colors"
                style={{
                  backgroundColor: step > s.n ? 'var(--primary)' : 'var(--border)',
                }}
              />
            )}
          </React.Fragment>
        ))}
      </div>

      {/* ─────────────────── STEP 1: COURSE, SYLLABUS & QUESTION BANK SOURCE ─────────────────── */}
      {step === 1 && (
        <div className="card p-6 sm:p-8 space-y-6 border border-default bg-surface shadow-card-md">
          <div className="flex items-center justify-between pb-3 border-b border-default">
            <div>
              <h2 className="text-lg font-bold text-default">Step 1: Course, Syllabus & Question Bank Scope</h2>
              <p className="text-xs text-muted mt-0.5">
                Specify your course details, paste the syllabus scope, and select the PDF question banks.
              </p>
            </div>
            <span className="badge badge-primary text-xs">Syllabus-Driven</span>
          </div>

          {/* MANUAL COURSE ENTRY (User explicitly requested manual entry instead of dropdown) */}
          <div className="p-4 rounded-brand-lg border border-default bg-surface-2 space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-default flex items-center gap-1.5">
              <BookOpen className="w-4 h-4 text-primary" />
              Manual Course Entry
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="label text-xs font-semibold uppercase tracking-wider mb-1">
                  Course Code *
                </label>
                <input
                  className="input w-full font-mono uppercase text-sm font-bold"
                  placeholder="e.g. CS301"
                  value={courseCode}
                  onChange={(e) => setCourseCode(e.target.value.toUpperCase())}
                  required
                />
              </div>

              <div className="sm:col-span-2">
                <label className="label text-xs font-semibold uppercase tracking-wider mb-1">
                  Course Name *
                </label>
                <input
                  className="input w-full text-sm font-medium"
                  placeholder="e.g. Design & Analysis of Algorithms"
                  value={courseName}
                  onChange={(e) => setCourseName(e.target.value)}
                  required
                />
              </div>
            </div>

            {/* Quick chips */}
            <div>
              <span className="text-[11px] text-muted block mb-1">Quick Select Real Courses:</span>
              {courses.length === 0 ? (
                <p className="text-xs text-muted italic">No courses available. Add a course in the Courses section first.</p>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {courses.map((c: any) => (
                    <button
                      key={c.id || c.code}
                      type="button"
                      onClick={() => {
                        setCourseCode(c.code);
                        setCourseName(c.name);
                      }}
                      className={clsx(
                        'px-2 py-1 rounded text-[11px] border transition-all',
                        courseCode === c.code
                          ? 'border-primary bg-primary/10 text-primary font-bold'
                          : 'border-default bg-surface text-muted hover:text-default'
                      )}
                    >
                      {c.code} — {c.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Paper Title & Marks */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div className="sm:col-span-2">
              <label className="label text-xs font-semibold uppercase tracking-wider mb-1">
                Paper Title *
              </label>
              <input
                className="input w-full text-sm"
                placeholder="e.g. End-Semester Examination December 2026"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
              />
            </div>

            <div>
              <label className="label text-xs font-semibold uppercase tracking-wider mb-1">
                Total Marks *
              </label>
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                className="input w-full text-sm font-mono font-bold"
                placeholder="e.g. 100"
                value={totalMarksStr}
                onChange={(e) => setTotalMarksStr(e.target.value.replace(/[^0-9]/g, ''))}
                required
              />
            </div>

            <div>
              <label className="label text-xs font-semibold uppercase tracking-wider mb-1">
                Duration (minutes) *
              </label>
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                className="input w-full text-sm font-mono"
                placeholder="e.g. 180"
                value={durationStr}
                onChange={(e) => setDurationStr(e.target.value.replace(/[^0-9]/g, ''))}
                onBlur={() => {
                  if (!durationStr || Number(durationStr) < 1) {
                    setDurationStr('180');
                  }
                }}
                required
              />
            </div>
          </div>

          {/* SYLLABUS SECTION (User explicitly requested syllabus input section) */}
          <div className="p-4 rounded-brand-lg border border-default bg-surface-2 space-y-2.5">
            <div className="flex items-center justify-between">
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-default flex items-center gap-1.5">
                  <FileText className="w-4 h-4 text-primary" />
                  Syllabus for Question Paper Generation *
                </label>
                <p className="text-[11px] text-muted mt-0.5">
                  The generation engine extracts questions directly aligned with these units and topics.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setSyllabus(SAMPLE_SYLLABUS)}
                className="text-xs font-semibold text-primary underline hover:text-primary/80"
              >
                Load Sample Syllabus
              </button>
            </div>

            <textarea
              className="input w-full min-h-36 text-xs font-mono leading-relaxed"
              placeholder="Paste course syllabus (Unit 1, Unit 2, Unit 3, Unit 4 with key topics and modules)..."
              value={syllabus}
              onChange={(e) => setSyllabus(e.target.value)}
              required
            />
          </div>

          {/* QUESTION BANK SOURCE SELECTION (PDFs & JPEGs) */}
          <div className="p-4 rounded-brand-lg border border-default bg-surface-2 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-default flex items-center gap-1.5">
                  <Layers className="w-4 h-4 text-primary" />
                  Select Source Question Banks (Uploaded PDFs & JPEGs)
                </h3>
                <p className="text-[11px] text-muted mt-0.5">
                  The generator will pull questions directly from your selected question bank documents.
                </p>
              </div>

              <label className="flex items-center gap-1.5 text-xs font-semibold cursor-pointer text-default">
                <input
                  type="checkbox"
                  checked={useAllMatchingBanks}
                  onChange={(e) => setUseAllMatchingBanks(e.target.checked)}
                  className="rounded"
                />
                Use All Question Banks
              </label>
            </div>

            {questionBanks.length === 0 ? (
              <div className="p-3 rounded-brand border border-default bg-surface text-xs text-muted text-center">
                No uploaded question banks found yet. Questions will be generated directly using the <strong>Syllabus</strong> scope.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto pr-1">
                {questionBanks.map((b: any) => {
                  const isChecked = useAllMatchingBanks || selectedBankIds.includes(b.id);
                  return (
                    <div
                      key={b.id}
                      onClick={() => handleBankToggle(b.id)}
                      className={clsx(
                        'p-2.5 rounded-brand border text-xs cursor-pointer flex items-center justify-between transition-all select-none',
                        isChecked
                          ? 'border-primary bg-primary/5 shadow-xs font-semibold'
                          : 'border-default bg-surface text-muted hover:border-primary'
                      )}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        {b.file_type === 'pdf' ? (
                          <FileText className="w-4 h-4 text-red-500 shrink-0" />
                        ) : (
                          <Image className="w-4 h-4 text-indigo-500 shrink-0" />
                        )}
                        <div className="min-w-0">
                          <p className="text-default font-medium truncate">{b.title}</p>
                          <p className="text-[10px] text-muted truncate">
                            {b.course_code} • {b.question_count} questions
                          </p>
                        </div>
                      </div>
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => {}}
                        className="rounded shrink-0"
                      />
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="flex justify-end pt-3">
            <button
              type="button"
              onClick={() => setStep(2)}
              disabled={!courseCode || !courseName || !title || !syllabus}
              className="btn btn-primary"
            >
              Continue to Exam Pattern <ChevronRight className="w-4 h-4 ml-1" />
            </button>
          </div>
        </div>
      )}

      {/* ─────────────────── STEP 2: EXAMINATION PATTERN ─────────────────── */}
      {step === 2 && (
        <div className="card p-6 sm:p-8 space-y-6 border border-default bg-surface shadow-card-md">
          <div className="flex items-center justify-between pb-3 border-b border-default">
            <div>
              <h2 className="text-lg font-bold text-default">Step 2: Examination Pattern & Marks Allocation</h2>
              <p className="text-xs text-muted mt-0.5">
                Define sections, questions count, and marks per question to match total target marks.
              </p>
            </div>

            <div
              className={clsx(
                'px-3 py-1 rounded-full text-xs font-bold border',
                computedTotal === totalMarks
                  ? 'border-green-500 bg-green-50 text-green-700 dark:bg-green-950/40'
                  : 'border-amber-500 bg-amber-50 text-amber-700 dark:bg-amber-950/40'
              )}
            >
              {computedTotal} / {totalMarks} Total Marks
            </div>
          </div>

          <div className="space-y-3">
            {sections.map((sec, i) => (
              <div
                key={i}
                className="p-4 rounded-brand-lg border border-default bg-surface-2 space-y-3"
              >
                <div className="flex items-center justify-between">
                  <input
                    className="input font-semibold text-sm py-1 px-2 w-64"
                    value={sec.name}
                    onChange={(e) => {
                      const s = [...sections];
                      s[i].name = e.target.value;
                      setSections(s);
                    }}
                  />
                  {sections.length > 1 && (
                    <button
                      type="button"
                      onClick={() => setSections(sections.filter((_, j) => j !== i))}
                      className="text-xs text-muted hover:text-danger font-medium"
                    >
                      Remove Section
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="label text-xs font-semibold mb-1">Number of Questions</label>
                    <input
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      className="input text-xs w-full font-mono"
                      placeholder="e.g. 5"
                      value={sec.questions === '' ? '' : sec.questions}
                      onWheel={(e) => (e.target as HTMLInputElement).blur()}
                      onChange={(e) => {
                        const s = [...sections];
                        s[i].questions = e.target.value.replace(/[^0-9]/g, '');
                        setSections(s);
                      }}
                      onBlur={() => {
                        if (sec.questions === '' || Number(sec.questions) < 1) {
                          const s = [...sections];
                          s[i].questions = 1;
                          setSections(s);
                        }
                      }}
                    />
                  </div>

                  <div>
                    <label className="label text-xs font-semibold mb-1">Marks per Question</label>
                    <input
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      className="input text-xs w-full font-mono"
                      placeholder="e.g. 4"
                      value={sec.marks_per_question === '' ? '' : sec.marks_per_question}
                      onWheel={(e) => (e.target as HTMLInputElement).blur()}
                      onChange={(e) => {
                        const s = [...sections];
                        s[i].marks_per_question = e.target.value.replace(/[^0-9]/g, '');
                        setSections(s);
                      }}
                      onBlur={() => {
                        if (sec.marks_per_question === '' || Number(sec.marks_per_question) < 1) {
                          const s = [...sections];
                          s[i].marks_per_question = 1;
                          setSections(s);
                        }
                      }}
                    />
                  </div>

                  <div>
                    <label className="label text-xs font-semibold mb-1">Cognitive Difficulty</label>
                    <select
                      className="input text-xs w-full capitalize"
                      value={sec.difficulty || 'medium'}
                      onChange={(e) => {
                        const s = [...sections];
                        s[i].difficulty = e.target.value;
                        setSections(s);
                      }}
                    >
                      <option value="easy">Easy (L1-L2)</option>
                      <option value="medium">Medium (L3-L4)</option>
                      <option value="hard">Hard (L5-L6)</option>
                    </select>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-1 text-xs text-muted">
                  <span>
                    Subtotal: <strong>{(Number(sec.questions) || 0) * (Number(sec.marks_per_question) || 0)} Marks</strong>
                  </span>
                  <span className="capitalize">Difficulty: {sec.difficulty}</span>
                </div>
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={() =>
              setSections([
                ...sections,
                {
                  name: `Section ${String.fromCharCode(65 + sections.length)}`,
                  questions: 5,
                  marks_per_question: 5,
                  difficulty: 'medium',
                },
              ])
            }
            className="btn btn-secondary text-xs"
          >
            + Add Another Section
          </button>

          {computedTotal !== totalMarks && (
            <div
              className="p-3 rounded-brand text-xs flex items-center gap-2"
              style={{ backgroundColor: '#FEF3C7', color: '#92400E' }}
            >
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>
                Sum of section marks ({computedTotal}) does not match paper total ({totalMarks}). Please adjust before proceeding.
              </span>
            </div>
          )}

          <div className="flex justify-between pt-4 border-t border-default">
            <button
              type="button"
              onClick={() => setStep(1)}
              className="btn btn-secondary"
            >
              <ChevronLeft className="w-4 h-4 mr-1" /> Back to Syllabus
            </button>
            <button
              type="button"
              onClick={() => {
                const sanitized = sections.map((s) => ({
                  ...s,
                  questions: Math.max(1, Number(s.questions) || 1),
                  marks_per_question: Math.max(1, Number(s.marks_per_question) || 1),
                }));
                setSections(sanitized);
                setStep(3);
              }}
              disabled={
                computedTotal !== totalMarks ||
                sections.some(
                  (s) =>
                    !s.questions ||
                    Number(s.questions) < 1 ||
                    !s.marks_per_question ||
                    Number(s.marks_per_question) < 1
                )
              }
              className="btn btn-primary"
            >
              Review Scope & Generate <ChevronRight className="w-4 h-4 ml-1" />
            </button>
          </div>
        </div>
      )}

      {/* ─────────────────── STEP 3: REVIEW SCOPE & GENERATE ─────────────────── */}
      {step === 3 && (
        <div className="card p-6 sm:p-8 space-y-6 border border-default bg-surface shadow-card-md">
          <div className="pb-3 border-b border-default">
            <h2 className="text-lg font-bold text-default">Step 3: Review Syllabus Scope & Generate Paper</h2>
            <p className="text-xs text-muted mt-0.5">
              Review configuration before the AI and question bank matching engine synthesizes the examination paper.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 rounded-brand-lg border border-default bg-surface-2 space-y-2 text-xs">
              <h4 className="font-bold text-default uppercase tracking-wider">Course & Examination</h4>
              <p><strong className="text-default">Course:</strong> {courseCode} — {courseName}</p>
              <p><strong className="text-default">Paper Title:</strong> {title}</p>
              <p><strong className="text-default">Total Marks:</strong> {totalMarks} Marks</p>
              <p><strong className="text-default">Duration:</strong> {duration} Minutes</p>
            </div>

            <div className="p-4 rounded-brand-lg border border-default bg-surface-2 space-y-2 text-xs">
              <h4 className="font-bold text-default uppercase tracking-wider">Source Material</h4>
              <p>
                <strong className="text-default">Syllabus Scope:</strong>{' '}
                {syllabus ? `${syllabus.split('\n').length} lines / modules defined` : 'None'}
              </p>
              <p>
                <strong className="text-default">Question Banks:</strong>{' '}
                {useAllMatchingBanks
                  ? 'All available PDF/JPEG question banks'
                  : `${selectedBankIds.length} question bank(s) selected`}
              </p>
              <p><strong className="text-default">Sections:</strong> {sections.length} sections defined</p>
            </div>
          </div>

          {/* Syllabus Preview snippet */}
          <div className="p-3.5 rounded-brand border border-default bg-surface-2 space-y-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-muted">
              Syllabus Units Being Tested:
            </span>
            <pre className="text-xs font-mono whitespace-pre-wrap text-default max-h-28 overflow-y-auto">
              {syllabus}
            </pre>
          </div>

          {/* Progressive Generation Loading State */}
          {generateMutation.isPending && (
            <div className="p-4 rounded-brand border border-primary/40 bg-primary/5 space-y-2.5 animate-fade-in shadow-xs">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <span className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                  <span className="text-xs font-bold text-default">
                    Synthesizing Question Paper with Gemini AI…
                  </span>
                </div>
                <span className="text-xs font-mono font-bold text-primary px-2 py-0.5 rounded bg-primary/10">
                  {elapsedSeconds}s elapsed
                </span>
              </div>
              <p className="text-xs text-muted font-medium">
                {getProgressStage(elapsedSeconds)}
              </p>
              <div className="w-full bg-surface-3 h-1.5 rounded-full overflow-hidden">
                <div
                  className="bg-primary h-full transition-all duration-500 rounded-full"
                  style={{ width: `${Math.min(95, Math.max(8, elapsedSeconds * 2.2))}%` }}
                />
              </div>
              <p className="text-[11px] text-muted">
                Questions are synthesized directly from your syllabus topics and mapped to Bloom's taxonomy (L1–L6). When the AI experiences high demand, bounded retries with backoff occur automatically.
              </p>
            </div>
          )}

          {generateMutation.isError && (() => {
            const err = generateMutation.error as any;
            const errData = err?.response?.data;
            const isTimeout = err?.code === 'ECONNABORTED' || err?.message?.toLowerCase().includes('timeout');
            const isTransient = isTimeout || errData?.transient || errData?.code === 'MODEL_UNAVAILABLE' || errData?.code === 'RATE_LIMIT_EXCEEDED';
            const retryAfter = errData?.retry_after_seconds;
            return (
              <div className={`p-3.5 rounded-brand border text-xs flex items-start gap-2 ${isTransient ? 'border-amber-300 bg-amber-50 text-amber-900 dark:bg-amber-950/30 dark:text-amber-200' : 'border-red-300 bg-red-50 text-red-800'}`}>
                <AlertTriangle className={`w-4 h-4 shrink-0 mt-0.5 ${isTransient ? 'text-amber-600' : 'text-red-600'}`} />
                <div className="flex-1 min-w-0">
                  <p className="font-bold">{isTimeout ? 'AI Request Timed Out' : isTransient ? 'AI Temporarily Busy' : 'Generation Failed'}</p>
                  <p className="mt-0.5">
                    {isTimeout
                      ? 'The AI question generation exceeded the allotted duration. Google Gemini might be handling high traffic. Click "Retry Generation" below to retry.'
                      : errData?.error || err?.message || 'Failed to generate question paper'}
                  </p>
                  {errData?.hint && <p className="text-[11px] mt-1 font-mono opacity-80">{errData.hint}</p>}
                  {errData?.validation_issues && (
                    <ul className="list-disc list-inside mt-1 space-y-0.5">
                      {(errData.validation_issues as string[]).map((issue: string, idx: number) => (
                        <li key={idx}>{issue}</li>
                      ))}
                    </ul>
                  )}
                  {retryAfter && <p className="text-[11px] mt-1 opacity-70">Suggested wait: ~{retryAfter}s before retrying.</p>}
                </div>
                {isTransient && (
                  <button
                    type="button"
                    onClick={() => generateMutation.mutate()}
                    className="shrink-0 px-3 py-1.5 rounded-brand text-xs font-bold bg-amber-600 text-white hover:bg-amber-700 transition-colors shadow-xs"
                  >
                    Retry Generation
                  </button>
                )}
              </div>
            );
          })()}


          <div className="flex justify-between pt-4 border-t border-default">
            <button
              type="button"
              onClick={() => setStep(2)}
              className="btn btn-secondary"
            >
              <ChevronLeft className="w-4 h-4 mr-1" /> Back
            </button>
            <button
              type="button"
              onClick={() => generateMutation.mutate()}
              disabled={generateMutation.isPending}
              className="btn btn-primary shadow-md"
            >
              {generateMutation.isPending ? (
                <>
                  <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin mr-2" />
                  Generating from Syllabus & PDF Banks…
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 mr-1.5" />
                  Generate Question Paper Now
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* ─────────────────── STEP 4: GENERATED PAPER & OBE VALIDATION ─────────────────── */}
      {step === 4 && (
        <div className="card p-6 sm:p-8 space-y-6 border border-default bg-surface shadow-card-md animate-fade-in">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-4 border-b border-default">
            <div>
              <div className="flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-success" />
                <h2 className="text-lg font-bold text-default">Question Paper Generated Successfully</h2>
              </div>
              <p className="text-xs text-muted mt-1">
                Paper ID: <span className="font-mono font-bold text-default">{paperId}</span> • Course:{' '}
                <strong>{courseCode}</strong>
              </p>
              {generatedPaper?.ai_metadata && (
                <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-primary/10 text-primary border border-primary/20 mt-1.5">
                  <Sparkles className="w-3.5 h-3.5" />
                  Generated by {generatedPaper.ai_metadata.provider || 'Google Gemini AI'} ({generatedPaper.ai_metadata.model})
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={() => submitMutation.mutate()}
              disabled={submitMutation.isPending}
              className="btn btn-primary text-xs flex items-center gap-1.5 shadow-md"
            >
              <Send className="w-4 h-4" />
              {submitMutation.isPending ? 'Submitting…' : 'Submit for Dean Review'}
            </button>
          </div>

          {/* OBE Validation Report Card */}
          {validation && (
            <div
              className={clsx(
                'p-4 rounded-brand-lg border space-y-2 text-xs',
                validation.status === 'passed'
                  ? 'border-green-300 bg-green-50 text-green-900 dark:bg-green-950/30 dark:text-green-200'
                  : 'border-amber-300 bg-amber-50 text-amber-900 dark:bg-amber-950/30 dark:text-amber-200'
              )}
            >
              <div className="flex items-center justify-between font-bold">
                <span className="flex items-center gap-1.5 text-sm uppercase tracking-wider">
                  {validation.status === 'passed' ? (
                    <CheckCircle className="w-4 h-4 text-green-600" />
                  ) : (
                    <AlertTriangle className="w-4 h-4 text-amber-600" />
                  )}
                  OBE Deterministic Validation: {validation.status.toUpperCase()}
                </span>
                <span>
                  Total Marks: {validation.total_marks} / {validation.expected_marks}
                </span>
              </div>
              <p className="text-[11px] opacity-90">
                100% of questions are verified against Syllabus topics, Course Outcomes, and Bloom's taxonomy coverage.
              </p>
            </div>
          )}

          {/* Generated Paper — Full OBE Question Paper Document with Multi-Page PDF Print */}
          <QuestionPaperDocument
            paper={{
              ...generatedPaper,
              title: title || generatedPaper?.title,
              course_name: courseName || generatedPaper?.course_name,
              course_code: courseCode || generatedPaper?.course_code,
              total_marks: totalMarks || generatedPaper?.total_marks,
              duration_minutes: duration || generatedPaper?.duration_minutes,
              paper_questions: generatedPaper?.paper_questions || [],
            }}
            showActions={true}
          />
        </div>
      )}

      {/* ─────────────────── STEP 5: SUBMITTED CONFIRMATION ─────────────────── */}
      {step === 5 && (
        <div className="card p-10 text-center max-w-lg mx-auto space-y-4 border border-default bg-surface shadow-xl animate-fade-in">
          <CheckCircle className="w-16 h-16 mx-auto text-success" />
          <h2 className="text-2xl font-bold text-default">Submitted for Dean Approval</h2>
          <p className="text-sm text-muted leading-relaxed">
            Your examination paper for <strong>{courseCode} — {courseName}</strong> has been submitted to the Academic Affairs Dean review queue.
          </p>
          <div className="p-3 bg-surface-2 rounded-brand text-xs text-muted">
            The Dean will review Bloom's taxonomy balance, syllabus scope alignment, and Course Outcome attainment targets.
          </div>
          <div className="pt-2 flex gap-2 justify-center">
            <button
              onClick={() => {
                setStep(1);
                setPaperId(null);
                setGeneratedPaper(null);
              }}
              className="btn btn-primary text-xs"
            >
              Generate Another Paper
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
