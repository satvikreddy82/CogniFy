import React, { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  BarChart2,
  Upload,
  FileSpreadsheet,
  Download,
  CheckCircle,
  AlertCircle,
  X,
  FileText,
  Loader2,
  HelpCircle,
  TrendingUp,
} from 'lucide-react';
import { api } from '../../services/api';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';

export default function MarksAnalysisPage() {
  const qc = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [selectedPaper, setSelectedPaper] = useState('');
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadPaperId, setUploadPaperId] = useState('');
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvText, setCsvText] = useState<string>('');
  const [uploadErrors, setUploadErrors] = useState<string[]>([]);
  const [uploadSuccess, setUploadSuccess] = useState<string | null>(null);

  const { data: papers = [] } = useQuery({
    queryKey: ['papers'],
    queryFn: () => api.get('/papers').then((r) => r.data),
  });

  const { data: analytics, isLoading: analyticsLoading } = useQuery({
    queryKey: ['analytics', selectedPaper],
    queryFn: () => api.get(`/assessments/${selectedPaper}/analytics`).then((r) => r.data),
    enabled: !!selectedPaper,
  });

  // Upload mutation
  const uploadMutation = useMutation({
    mutationFn: async () => {
      const targetPaperId = uploadPaperId || selectedPaper;
      if (!targetPaperId) throw new Error('Please select an assessment paper.');
      if (!csvText.trim()) throw new Error('Please select or paste a CSV file.');

      const res = await api.post('/assessments/upload-csv', {
        paper_id: targetPaperId,
        csv_content: csvText,
      });
      return res.data;
    },
    onSuccess: (data) => {
      setUploadSuccess(data.message || 'Marks uploaded and processed successfully.');
      setUploadErrors([]);
      qc.invalidateQueries({ queryKey: ['analytics'] });
      qc.invalidateQueries({ queryKey: ['dashboard-overview'] });
      if (uploadPaperId && uploadPaperId !== selectedPaper) {
        setSelectedPaper(uploadPaperId);
      }
      setTimeout(() => {
        setShowUploadModal(false);
        setCsvFile(null);
        setCsvText('');
        setUploadSuccess(null);
      }, 1500);
    },
    onError: (err: any) => {
      const errResponse = err.response?.data;
      if (errResponse?.row_errors && Array.isArray(errResponse.row_errors)) {
        setUploadErrors(errResponse.row_errors);
      } else {
        setUploadErrors([errResponse?.error || err.message || 'CSV upload failed.']);
      }
    },
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.csv')) {
      setUploadErrors(['Only .csv files are supported.']);
      return;
    }

    setCsvFile(file);
    setUploadErrors([]);

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      setCsvText(text || '');
    };
    reader.readAsText(file);
  };

  const downloadSampleCsv = () => {
    const targetId = uploadPaperId || selectedPaper;
    const currentPaper = papers.find((p: any) => p.id === targetId);
    let sampleContent = 'student_id,student_name,Q1,Q2,Q3,Q4\n';
    sampleContent += '2026-CSE-001,John Doe,8,4,12,16\n';
    sampleContent += '2026-CSE-002,Jane Smith,10,5,14,18\n';
    sampleContent += '2026-CSE-003,Alex Johnson,7,3,10,14\n';

    const blob = new Blob([sampleContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute(
      'download',
      `${currentPaper?.course_code || 'CS301'}_Marks_Sample.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleOpenUpload = (presetPaperId?: string) => {
    setUploadPaperId(presetPaperId || selectedPaper || (papers[0]?.id || ''));
    setCsvFile(null);
    setCsvText('');
    setUploadErrors([]);
    setUploadSuccess(null);
    setShowUploadModal(true);
  };

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="page-title flex items-center gap-2">
            <BarChart2 className="w-6 h-6 text-primary" />
            Marks & Analytics
          </h1>
          <p className="text-sm text-muted mt-1">
            Analyze Course Outcome attainment, student score distributions, and OBE compliance.
          </p>
        </div>

        <button
          type="button"
          onClick={() => handleOpenUpload()}
          className="btn btn-primary self-start sm:self-auto flex items-center gap-2 text-xs"
        >
          <Upload className="w-4 h-4" />
          Upload Marks CSV
        </button>
      </div>

      {/* Assessment Selector */}
      <div className="card p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center gap-4 bg-surface border border-default shadow-sm">
        <label className="text-xs font-bold uppercase tracking-wider text-default shrink-0 flex items-center gap-2">
          <FileText className="w-4 h-4 text-primary" />
          Select Assessment:
        </label>
        <select
          className="input flex-1 w-full text-sm"
          value={selectedPaper}
          onChange={(e) => setSelectedPaper(e.target.value)}
        >
          <option value="">Choose an assessment paper to view analytics…</option>
          {papers.map((p: any) => (
            <option key={p.id} value={p.id}>
              {p.course_code ? `[${p.course_code}] ` : ''}
              {p.title || `Paper ${p.id.slice(0, 8)}`} — ({p.total_marks} Marks)
            </option>
          ))}
        </select>
      </div>

      {/* Content States */}
      {!selectedPaper ? (
        <div className="card text-center py-20 text-muted border border-default bg-surface p-8">
          <BarChart2 className="w-16 h-16 mx-auto mb-3 opacity-20 text-primary" />
          <h2 className="text-base font-bold text-default">Select an assessment to view analytics</h2>
          <p className="text-xs text-muted max-w-md mx-auto mt-1">
            Choose any examination paper above to inspect verified CO attainment percentages, student counts, and question metrics.
          </p>
        </div>
      ) : analyticsLoading ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="card p-6 animate-pulse h-72 bg-surface" />
          <div className="card p-6 animate-pulse h-72 bg-surface" />
        </div>
      ) : !analytics?.has_data || analytics?.co_attainment?.length === 0 ? (
        <div className="card p-12 text-center text-muted border border-default bg-surface space-y-4">
          <FileSpreadsheet className="w-14 h-14 mx-auto text-primary opacity-30" />
          <div className="space-y-1">
            <h2 className="text-base font-bold text-default">No marks recorded yet</h2>
            <p className="text-xs text-muted max-w-md mx-auto">
              No student marks have been uploaded for this paper. Upload a CSV with student scores to compute genuine Course Outcome attainment.
            </p>
          </div>
          <div>
            <button
              type="button"
              onClick={() => handleOpenUpload(selectedPaper)}
              className="btn btn-primary text-xs inline-flex items-center gap-1.5"
            >
              <Upload className="w-3.5 h-3.5" />
              Upload Marks for This Assessment
            </button>
          </div>
        </div>
      ) : (
        /* Analytics Visualizations */
        <div className="space-y-6">
          {/* Summary Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            <div className="card p-4 bg-surface border border-default">
              <span className="text-xs text-muted block">Assessed Students</span>
              <span className="text-2xl font-bold text-default font-mono">
                {analytics.student_count}
              </span>
            </div>
            <div className="card p-4 bg-surface border border-default">
              <span className="text-xs text-muted block">Course Outcomes Mapped</span>
              <span className="text-2xl font-bold text-primary font-mono">
                {analytics.co_attainment?.length || 0}
              </span>
            </div>
            <div className="card p-4 bg-surface border border-default col-span-2 sm:col-span-1">
              <span className="text-xs text-muted block">Status</span>
              <span className="badge badge-success text-[10px] mt-1 font-semibold uppercase">
                Analysis Complete
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Real CO Attainment Chart */}
            <div className="card p-6 bg-surface border border-default shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="section-title text-sm font-bold uppercase tracking-wider text-default">
                    CO Attainment (%)
                  </h2>
                  <p className="text-[11px] text-muted">
                    Based on verified student marks from {analytics.student_count} students
                  </p>
                </div>
              </div>

              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={analytics.co_attainment} barSize={34}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="co_id" tick={{ fontSize: 12, fill: 'var(--text-muted)' }} />
                  <YAxis domain={[0, 100]} unit="%" tick={{ fontSize: 12, fill: 'var(--text-muted)' }} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'var(--surface-card)',
                      border: '1px solid var(--border)',
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                    formatter={(v) => [`${v}%`, 'Attainment']}
                  />
                  <Bar dataKey="attainment_percent" radius={[4, 4, 0, 0]}>
                    {analytics.co_attainment.map((entry: any, i: number) => (
                      <Cell
                        key={i}
                        fill={
                          entry.attainment_percent < 60
                            ? 'var(--error)'
                            : entry.attainment_percent < 75
                            ? 'var(--warning)'
                            : 'var(--primary)'
                        }
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>

              <div className="flex gap-4 text-xs text-muted justify-center border-t border-default pt-3">
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-sm bg-red-500 inline-block" /> Below 60% (Unmet)
                </span>
                <span className="flex items-center gap-1.5">
                  <span
                    className="w-2.5 h-2.5 rounded-sm inline-block"
                    style={{ backgroundColor: 'var(--warning)' }}
                  />{' '}
                  60–75% (Moderate)
                </span>
                <span className="flex items-center gap-1.5">
                  <span
                    className="w-2.5 h-2.5 rounded-sm inline-block"
                    style={{ backgroundColor: 'var(--primary)' }}
                  />{' '}
                  Above 75% (Target Met)
                </span>
              </div>
            </div>

            {/* Question-wise Breakdown */}
            <div className="card p-6 bg-surface border border-default shadow-sm space-y-4">
              <h2 className="section-title text-sm font-bold uppercase tracking-wider text-default">
                Question Performance Breakdown
              </h2>

              <div className="space-y-2 max-h-72 overflow-y-auto divide-y divide-default">
                {analytics.question_stats?.map((q: any, idx: number) => (
                  <div
                    key={q.question_id || idx}
                    className="flex items-center justify-between text-sm py-2.5 first:pt-0"
                  >
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono font-bold text-default">
                          Q{idx + 1}
                        </span>
                        {q.bloom_level && (
                          <span className="badge badge-primary text-[10px] capitalize">
                            {q.bloom_level}
                          </span>
                        )}
                        {q.co_id && (
                          <span className="badge badge-neutral text-[10px] font-mono">
                            {q.co_id}
                          </span>
                        )}
                      </div>
                      <span className="text-[11px] text-muted">
                        Max Marks: {q.max_marks}
                      </span>
                    </div>

                    <div className="flex items-center gap-3">
                      <span className="text-xs font-mono font-bold text-default">
                        Avg: {q.avg_score ?? '—'} / {q.max_marks}
                      </span>
                      <div className="w-24 h-2 bg-surface-3 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{
                            width: `${
                              q.max_marks > 0 && q.avg_score != null
                                ? Math.min(100, (q.avg_score / q.max_marks) * 100)
                                : 0
                            }%`,
                            backgroundColor:
                              q.avg_score != null && q.avg_score / q.max_marks < 0.6
                                ? 'var(--error)'
                                : 'var(--primary)',
                          }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─────────────────── CSV UPLOAD MODAL ─────────────────── */}
      {showUploadModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-surface rounded-brand-lg border border-default shadow-2xl max-w-xl w-full p-6 space-y-5 animate-fade-in">
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-default">
              <div className="flex items-center gap-2">
                <Upload className="w-5 h-5 text-primary" />
                <h3 className="font-bold text-default text-base">Upload Student Marks CSV</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowUploadModal(false)}
                className="text-muted hover:text-default"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Assessment Target Selector */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-default block">
                Target Assessment Paper <span className="text-danger">*</span>
              </label>
              <select
                className="input w-full text-xs"
                value={uploadPaperId}
                onChange={(e) => setUploadPaperId(e.target.value)}
              >
                {papers.map((p: any) => (
                  <option key={p.id} value={p.id}>
                    {p.course_code ? `[${p.course_code}] ` : ''}
                    {p.title || `Paper ${p.id.slice(0, 8)}`} ({p.total_marks} Marks)
                  </option>
                ))}
              </select>
            </div>

            {/* Template & Guidelines */}
            <div className="p-3.5 bg-surface-2 rounded-brand border border-default text-xs space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-default flex items-center gap-1.5">
                  <HelpCircle className="w-3.5 h-3.5 text-primary" /> Supported CSV Format
                </span>
                <button
                  type="button"
                  onClick={downloadSampleCsv}
                  className="text-primary hover:underline flex items-center gap-1 font-medium text-[11px]"
                >
                  <Download className="w-3 h-3" /> Download Sample CSV
                </button>
              </div>
              <p className="text-muted leading-relaxed text-[11px]">
                Headers must include <strong>student_id</strong> (or roll_no), optional <strong>student_name</strong>, and marks columns: <strong>Q1, Q2, Q3...</strong> or <strong>total_marks</strong>.
              </p>
              <div className="bg-surface p-2 rounded border border-default font-mono text-[10px] text-muted overflow-x-auto">
                student_id, student_name, Q1, Q2, Q3, Q4<br />
                2026-CSE-001, John Doe, 8, 4, 12, 16
              </div>
            </div>

            {/* File Drop Area */}
            <div className="space-y-2">
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv, text/csv"
                onChange={handleFileChange}
                className="hidden"
              />
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-default hover:border-primary p-6 rounded-brand text-center cursor-pointer bg-surface-2/40 transition-colors"
              >
                <FileSpreadsheet className="w-8 h-8 mx-auto mb-2 text-primary opacity-60" />
                {csvFile ? (
                  <p className="text-xs font-semibold text-primary">{csvFile.name}</p>
                ) : (
                  <>
                    <p className="text-xs font-semibold text-default">
                      Click to choose CSV file
                    </p>
                    <p className="text-[11px] text-muted mt-0.5">Supports comma-separated values (.csv)</p>
                  </>
                )}
              </div>
            </div>

            {/* Success Feedback */}
            {uploadSuccess && (
              <div className="p-3 bg-success/10 border border-success/30 rounded-brand text-success text-xs flex items-center gap-2">
                <CheckCircle className="w-4 h-4 shrink-0" />
                <span>{uploadSuccess}</span>
              </div>
            )}

            {/* Error Diagnostics Feedback */}
            {uploadErrors.length > 0 && (
              <div className="p-3.5 bg-danger/10 border border-danger/30 rounded-brand text-danger text-xs space-y-1.5 max-h-36 overflow-y-auto">
                <div className="font-bold flex items-center gap-1.5">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  Validation Issues:
                </div>
                <ul className="list-disc pl-5 space-y-0.5 text-[11px]">
                  {uploadErrors.map((err, i) => (
                    <li key={i}>{err}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-default">
              <button
                type="button"
                onClick={() => setShowUploadModal(false)}
                className="btn btn-secondary text-xs"
                disabled={uploadMutation.isPending}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => uploadMutation.mutate()}
                disabled={uploadMutation.isPending || !csvText}
                className="btn btn-primary text-xs flex items-center gap-1.5"
              >
                {uploadMutation.isPending ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Validating & Importing…
                  </>
                ) : (
                  <>
                    <Upload className="w-3.5 h-3.5" />
                    Import Marks
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
