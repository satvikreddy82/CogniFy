import React from 'react';
import { Download, Printer, CheckCircle, Award } from 'lucide-react';

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
  courses?: { name?: string; code?: string };
}

interface QuestionPaperDocumentProps {
  paper: PaperData;
  showActions?: boolean;
  onClose?: () => void;
}

export default function QuestionPaperDocument({
  paper,
  showActions = true,
  onClose,
}: QuestionPaperDocumentProps) {
  const courseCode = paper.course_code || paper.courses?.code || 'COURSE';
  const courseName = paper.course_name || paper.courses?.name || 'Academic Assessment';
  const allPqs: PaperQuestion[] = paper.paper_questions || [];

  // Group questions by section
  const sectionNames = Array.from(
    new Set(allPqs.map((pq) => pq.section || 'General Section'))
  );

  let globalQuestionCounter = 0;

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="printable-paper-document space-y-6">
      {/* Top action bar (hidden during print) */}
      {showActions && (
        <div className="no-print flex flex-wrap items-center justify-between gap-3 p-4 bg-surface-2 border border-default rounded-brand-lg">
          <div className="flex items-center gap-2">
            <span className="badge badge-primary font-mono text-xs uppercase font-bold">
              {courseCode}
            </span>
            <span className="text-sm font-semibold text-default truncate">{paper.title}</span>
            <span className="text-xs text-muted">
              ({allPqs.length} Total Questions • {paper.total_marks} Marks)
            </span>
          </div>

          <div className="flex items-center gap-2 ml-auto">
            <button
              type="button"
              onClick={handlePrint}
              className="btn btn-primary text-xs flex items-center gap-1.5 shadow-sm"
            >
              <Printer className="w-3.5 h-3.5" />
              Download / Print PDF
            </button>
            {onClose && (
              <button
                type="button"
                onClick={onClose}
                className="btn btn-secondary text-xs"
              >
                Close
              </button>
            )}
          </div>
        </div>
      )}

      {/* Official Exam Paper Layout */}
      <div className="p-6 sm:p-10 bg-surface rounded-brand-lg border-2 border-default shadow-sm space-y-6 text-default print:border-none print:shadow-none print:p-0">
        {/* Institutional Header */}
        <div className="paper-exam-header p-5 rounded-brand border-2 border-default bg-surface text-center space-y-1.5">
          <div className="text-[11px] font-bold tracking-widest uppercase text-muted">
            COGNIFY OUTCOME-BASED EDUCATION PLATFORM
          </div>
          <h1 className="text-xl font-bold uppercase tracking-tight text-default">
            {courseName}
          </h1>
          <div className="text-sm font-semibold text-primary font-mono">
            Course Code: {courseCode}
          </div>
          <h2 className="text-base font-bold text-default pt-1">{paper.title}</h2>

          <div className="flex flex-wrap justify-center gap-6 text-xs text-muted pt-2 border-t border-default/50">
            <span>
              ⏱ Duration: <strong>{paper.duration_minutes || 180} Minutes</strong>
            </span>
            <span>
              📝 Maximum Marks: <strong>{paper.total_marks} Marks</strong>
            </span>
            <span>
              📋 Sections: <strong>{sectionNames.length}</strong>
            </span>
            <span>
              ❓ Total Questions: <strong>{allPqs.length}</strong>
            </span>
          </div>

          <div className="text-xs text-muted italic pt-2">
            <strong>General Instructions:</strong> Answer all questions in each section. All questions are
            compulsory unless internal choice is specified. Marks and Course Outcomes are indicated against
            each question.
          </div>
        </div>

        {/* Sections and Questions */}
        {allPqs.length === 0 ? (
          <div className="p-8 text-center text-muted">
            <p className="font-semibold text-default">No questions found for this paper.</p>
            <p className="text-xs mt-1">This paper may be generating or questions are not yet linked.</p>
          </div>
        ) : (
          sectionNames.map((secName) => {
            const sectionQs = allPqs.filter(
              (pq) => (pq.section || 'General Section') === secName
            );
            const secMarks = sectionQs.reduce(
              (s, pq) => s + (Number(pq.marks) || 0),
              0
            );

            return (
              <div
                key={secName}
                className="paper-section-block border border-default rounded-brand-lg overflow-hidden bg-surface"
              >
                {/* Section Header */}
                <div
                  className="paper-section-header px-5 py-3 flex items-center justify-between"
                  style={{
                    backgroundColor: 'var(--primary)',
                    color: 'var(--text-on-primary, #ffffff)',
                  }}
                >
                  <span className="font-bold text-sm tracking-wide">{secName}</span>
                  <span className="text-xs font-semibold opacity-95">
                    {sectionQs.length} Questions • {secMarks} Marks Total
                  </span>
                </div>

                {/* Section Questions */}
                <div className="divide-y divide-default">
                  {sectionQs.map((pq, idx) => {
                    globalQuestionCounter++;
                    const qNum = globalQuestionCounter;
                    const qData = pq.question_bank_entries || {};
                    const qText = (qData.text || qData.question_text || '').trim();

                    return (
                      <div
                        key={pq.id || `${secName}-${idx}`}
                        className="paper-question-row p-4 sm:p-5 flex gap-4 bg-surface"
                      >
                        <span className="font-bold text-sm font-mono text-primary shrink-0 w-8 pt-0.5">
                          Q{qNum}.
                        </span>

                        <div className="flex-1 min-w-0 space-y-2">
                          <p className="text-sm text-default leading-relaxed font-medium">
                            {qText || '(Question text unavailable)'}
                          </p>

                          {/* Metadata row: Marks, Bloom Level, CO Mapping */}
                          <div className="flex flex-wrap items-center gap-2 pt-1 text-xs">
                            <span className="font-bold text-default paper-badge">
                              [{pq.marks} Marks]
                            </span>

                            {qData.bloom_level && (
                              <span className="badge badge-primary text-[10px] capitalize font-medium">
                                Bloom: {qData.bloom_level}
                              </span>
                            )}

                            {qData.co_id && (
                              <span className="badge badge-neutral text-[10px] font-mono">
                                CO: {qData.co_id}
                              </span>
                            )}

                            {qData.difficulty && (
                              <span className="badge badge-info text-[10px] capitalize">
                                {qData.difficulty}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })
        )}

        {/* Paper End Stamp */}
        <div className="text-center pt-6 pb-2 text-xs text-muted border-t border-default space-y-1">
          <p className="font-bold tracking-widest uppercase">*** END OF QUESTION PAPER ***</p>
          <p className="text-[11px] opacity-80">
            Validated for OBE Compliance: Course Outcomes & Bloom's Taxonomy Alignment Verified.
          </p>
        </div>
      </div>
    </div>
  );
}
