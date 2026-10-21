import { Router } from 'express';
import { z } from 'zod';
import { authenticate, AuthRequest } from '../middleware/auth';
import { authorize } from '../middleware/role';
import { supabase } from '../utils/supabase';
import { mockStore, isSupabaseConfigured } from '../utils/mockStore';

const router = Router();

// ─── CSV Parser Helper ────────────────────────────────────────────────────────
function parseCsv(text: string): string[][] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  return lines.map((line) => {
    const row: string[] = [];
    let insideQuotes = false;
    let entry = '';
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        if (insideQuotes && line[i + 1] === '"') {
          entry += '"';
          i++;
        } else {
          insideQuotes = !insideQuotes;
        }
      } else if (char === ',' && !insideQuotes) {
        row.push(entry.trim());
        entry = '';
      } else {
        entry += char;
      }
    }
    row.push(entry.trim());
    return row;
  });
}

// ─── GET /api/v1/assessments/overview — Real Dashboard CO Attainment Overview ─
router.get('/overview', authenticate, async (req: AuthRequest, res, next) => {
  try {
    // Check if any assessments exist
    let assessments = [...mockStore.assessments];

    if (isSupabaseConfigured()) {
      try {
        const { data, error } = await supabase
          .from('assessments')
          .select('id, paper_id, student_id, total_score');
        if (!error && data && data.length > 0) {
          assessments = data;
        }
      } catch {}
    }

    if (assessments.length === 0) {
      return res.json({
        has_data: false,
        co_attainment: [],
        message: 'No CO attainment analysis available yet. Upload student marks and run an analysis to view results.',
      });
    }

    // Find the latest paper that has assessments
    const latestAss = assessments[assessments.length - 1];
    const paperId = latestAss.paper_id;
    const paper = mockStore.papers.find((p) => p.id === paperId);

    // Compute CO attainment for that paper
    const pqs = mockStore.paperQuestions.filter((pq) => pq.paper_id === paperId);
    const paperAssessments = assessments.filter((a) => a.paper_id === paperId);
    const assessmentIds = paperAssessments.map((a) => a.id);
    const marks = mockStore.assessmentMarks.filter((m) => assessmentIds.includes(m.assessment_id));

    const coAttainment: Record<string, { total_max: number; total_scored: number; count: number }> = {};

    pqs.forEach((pq) => {
      const coId = pq.question_bank_entries?.co_id || pq.co_id;
      if (!coId) return;
      if (!coAttainment[coId]) {
        coAttainment[coId] = { total_max: 0, total_scored: 0, count: 0 };
      }
      const qMarks = marks.filter((m) => m.question_id === (pq.question_id || pq.id));
      qMarks.forEach((m) => {
        coAttainment[coId].total_max += pq.marks || 10;
        coAttainment[coId].total_scored += m.score || 0;
        coAttainment[coId].count += 1;
      });
    });

    const coResults = Object.entries(coAttainment)
      .filter(([_, val]) => val.count > 0)
      .map(([co, val]) => ({
        co,
        attainment: val.total_max > 0 ? Math.round((val.total_scored / val.total_max) * 100) : 0,
        student_count: val.count,
      }));

    if (coResults.length === 0) {
      return res.json({
        has_data: false,
        co_attainment: [],
        message: 'No CO attainment analysis available yet. Upload student marks and run an analysis to view results.',
      });
    }

    return res.json({
      has_data: true,
      paper_id: paperId,
      paper_title: paper?.title || 'Assessment',
      course_code: paper?.course_code || paper?.courses?.code || 'CS301',
      student_count: paperAssessments.length,
      co_attainment: coResults,
    });
  } catch (err) {
    next(err);
  }
});

// ─── GET /api/v1/assessments?paper_id= ─────────────────────────────────────────
router.get('/', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const { paper_id } = req.query as Record<string, string>;

    if (isSupabaseConfigured()) {
      try {
        let query = supabase.from('assessments').select('*').order('created_at', { ascending: false });
        if (paper_id) query = query.eq('paper_id', paper_id);
        const { data, error } = await query;
        if (!error && data) return res.json(data);
      } catch {}
    }

    let list = [...mockStore.assessments];
    if (paper_id) list = list.filter((a) => a.paper_id === paper_id);
    res.json(list);
  } catch (err) {
    next(err);
  }
});

// ─── POST /api/v1/assessments/upload-csv & /:paperId/upload-csv ───────────────
const uploadCsvHandler = async (req: AuthRequest, res: any, next: any) => {
  try {
    const paperId = req.params.paperId || req.body.paper_id;
    const csvContent = req.body.csv_content || req.body.csv_text;

    if (!paperId) {
      return res.status(400).json({ error: 'Assessment paper_id is required for marks upload.' });
    }

    if (!csvContent || typeof csvContent !== 'string' || csvContent.trim().length === 0) {
      return res.status(400).json({ error: 'CSV content is empty. Please provide a valid CSV file.' });
    }

    // Retrieve target paper
    const paper = mockStore.papers.find((p) => p.id === paperId);
    const paperQuestions = mockStore.paperQuestions.filter((pq) => pq.paper_id === paperId);

    const rows = parseCsv(csvContent);
    if (rows.length < 2) {
      return res.status(400).json({
        error: 'CSV must contain at least a header row and one student data row.',
      });
    }

    const headers = rows[0].map((h) => h.toLowerCase().trim());

    // Identify student ID column
    const studentIdIndex = headers.findIndex((h) =>
      ['student_id', 'student id', 'roll_no', 'roll no', 'roll_number', 'roll number', 'reg_no', 'id'].includes(h)
    );

    if (studentIdIndex === -1) {
      return res.status(400).json({
        error: 'Missing required header: Student ID column (e.g. "student_id", "roll_no", "id").',
        expected_headers: ['student_id', 'student_name (optional)', 'q1, q2... or total_marks'],
      });
    }

    // Optional student name column
    const studentNameIndex = headers.findIndex((h) =>
      ['student_name', 'student name', 'name', 'full_name'].includes(h)
    );

    // Identify question columns or total marks column
    const totalScoreIndex = headers.findIndex((h) =>
      ['total_marks', 'total_score', 'total', 'marks', 'score'].includes(h)
    );

    // Look for Q1, Q2, Q3... question columns
    const questionColumnMap: { colIndex: number; qIndex: number; maxMark: number; qId: string }[] = [];

    headers.forEach((h, colIdx) => {
      if (colIdx === studentIdIndex || colIdx === studentNameIndex) return;
      const match = h.match(/^q(?:uestion)?\s*(\d+)$/i);
      if (match) {
        const qNum = parseInt(match[1], 10);
        // Map to paperQuestions (1-indexed)
        const targetPq = paperQuestions[qNum - 1] || paperQuestions[0];
        const maxMark = targetPq?.marks || 10;
        const qId = targetPq?.question_id || targetPq?.id || `q-${qNum}`;
        questionColumnMap.push({ colIndex: colIdx, qIndex: qNum, maxMark, qId });
      }
    });

    // Row-level validation
    const rowErrors: string[] = [];
    const seenStudentIds = new Map<string, number>();
    const validRecords: { studentId: string; studentName?: string; marks: { qId: string; score: number }[]; totalScore: number }[] = [];

    for (let r = 1; r < rows.length; r++) {
      const row = rows[r];
      const rowNum = r + 1; // 1-indexed for human readability

      if (row.length === 0 || (row.length === 1 && !row[0])) continue;

      const studentId = row[studentIdIndex]?.trim();
      if (!studentId) {
        rowErrors.push(`Row ${rowNum}: Student ID is empty.`);
        continue;
      }

      // Check duplicate student IDs
      if (seenStudentIds.has(studentId)) {
        rowErrors.push(
          `Row ${rowNum}: Duplicate student ID "${studentId}" already appeared in Row ${seenStudentIds.get(studentId)}.`
        );
        continue;
      }
      seenStudentIds.set(studentId, rowNum);

      const studentName = studentNameIndex !== -1 ? row[studentNameIndex]?.trim() : undefined;
      const studentMarks: { qId: string; score: number }[] = [];
      let calculatedTotal = 0;

      if (questionColumnMap.length > 0) {
        let hasQuestionError = false;
        for (const qCol of questionColumnMap) {
          const valStr = row[qCol.colIndex]?.trim();
          if (valStr === undefined || valStr === '') {
            rowErrors.push(`Row ${rowNum}: Missing score for Q${qCol.qIndex} for student "${studentId}".`);
            hasQuestionError = true;
            continue;
          }
          const num = Number(valStr);
          if (isNaN(num)) {
            rowErrors.push(`Row ${rowNum}: Invalid numeric mark "${valStr}" for Q${qCol.qIndex}.`);
            hasQuestionError = true;
            continue;
          }
          if (num < 0) {
            rowErrors.push(`Row ${rowNum}: Negative mark "${num}" not allowed for Q${qCol.qIndex}.`);
            hasQuestionError = true;
            continue;
          }
          if (num > qCol.maxMark) {
            rowErrors.push(
              `Row ${rowNum}: Score ${num} exceeds maximum marks (${qCol.maxMark}) for Q${qCol.qIndex}.`
            );
            hasQuestionError = true;
            continue;
          }
          studentMarks.push({ qId: qCol.qId, score: num });
          calculatedTotal += num;
        }
        if (hasQuestionError) continue;
      } else if (totalScoreIndex !== -1) {
        const valStr = row[totalScoreIndex]?.trim();
        const num = Number(valStr);
        if (isNaN(num) || num < 0) {
          rowErrors.push(`Row ${rowNum}: Invalid total score "${valStr}" for student "${studentId}".`);
          continue;
        }
        const maxPaperMarks = paper?.total_marks || 100;
        if (num > maxPaperMarks) {
          rowErrors.push(`Row ${rowNum}: Score ${num} exceeds paper maximum marks of ${maxPaperMarks}.`);
          continue;
        }
        calculatedTotal = num;
        // Distribute proportionally across paper questions if present
        if (paperQuestions.length > 0) {
          const ratio = maxPaperMarks > 0 ? num / maxPaperMarks : 1;
          paperQuestions.forEach((pq) => {
            studentMarks.push({
              qId: pq.question_id || pq.id,
              score: Math.round((pq.marks || 10) * ratio * 10) / 10,
            });
          });
        }
      } else {
        rowErrors.push(
          `Row ${rowNum}: Could not find any valid mark columns (expected "Q1, Q2..." or "total_marks").`
        );
        continue;
      }

      validRecords.push({
        studentId,
        studentName,
        marks: studentMarks,
        totalScore: calculatedTotal,
      });
    }

    if (rowErrors.length > 0) {
      return res.status(400).json({
        error: `CSV validation failed with ${rowErrors.length} error(s). Please review row numbers below.`,
        row_errors: rowErrors,
      });
    }

    if (validRecords.length === 0) {
      return res.status(400).json({
        error: 'No valid student marks records were found in the uploaded CSV.',
      });
    }

    // Persist records into mockStore
    const newAssessments: any[] = [];
    const newMarks: any[] = [];

    // Clear previous marks for this paper to avoid stale duplicates
    mockStore.assessments = mockStore.assessments.filter((a) => a.paper_id !== paperId);

    validRecords.forEach((rec, idx) => {
      const assessmentId = `ass-${Date.now()}-${idx + 1}`;
      const assObj = {
        id: assessmentId,
        paper_id: paperId,
        student_id: rec.studentId,
        student_name: rec.studentName || `Student ${rec.studentId}`,
        total_score: rec.totalScore,
        created_at: new Date().toISOString(),
      };
      newAssessments.push(assObj);
      mockStore.assessments.push(assObj);

      rec.marks.forEach((m) => {
        const markObj = {
          id: `mark-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
          assessment_id: assessmentId,
          question_id: m.qId,
          score: m.score,
        };
        newMarks.push(markObj);
        mockStore.assessmentMarks.push(markObj);
      });
    });

    // Attempt Supabase persistence if configured
    if (isSupabaseConfigured()) {
      try {
        await supabase.from('assessments').insert(
          newAssessments.map((a) => ({
            paper_id: a.paper_id,
            student_id: a.student_id,
            total_score: a.total_score,
          }))
        );
      } catch (sbErr: any) {
        console.warn('[assessments/upload-csv] Supabase insert warning:', sbErr?.message);
      }
    }

    // Audit log
    mockStore.auditLogs.unshift({
      id: 'log-' + Date.now(),
      actor_id: req.user!.id,
      action: 'student_marks_csv_imported',
      target_table: 'assessments',
      target_id: paperId,
      details: {
        paper_id: paperId,
        student_count: validRecords.length,
        total_marks_records: newMarks.length,
      },
      created_at: new Date().toISOString(),
    });

    res.status(201).json({
      success: true,
      message: `Successfully uploaded and validated marks for ${validRecords.length} students.`,
      student_count: validRecords.length,
      records_imported: newMarks.length,
      paper_id: paperId,
    });
  } catch (err) {
    next(err);
  }
};

router.post('/upload-csv', authenticate, authorize(['faculty']), uploadCsvHandler);
router.post('/:paperId/upload-csv', authenticate, authorize(['faculty']), uploadCsvHandler);

// ─── POST /api/v1/assessments/:paperId/marks ──────────────────────────────────
router.post('/:paperId/marks', authenticate, authorize(['faculty']), async (req: AuthRequest, res, next) => {
  try {
    const input = z.object({
      marks: z.array(
        z.object({
          student_id: z.string().min(1),
          question_id: z.string().min(1),
          score: z.number().min(0),
        })
      ),
    }).parse(req.body);

    const paperQuestions = mockStore.paperQuestions.filter((pq) => pq.paper_id === req.params.paperId);
    const maxMarks: Record<string, number> = {};
    paperQuestions.forEach((pq) => {
      maxMarks[pq.question_id || pq.id] = pq.marks;
    });

    const students = [...new Set(input.marks.map((m) => m.student_id))];
    const assessmentIds: Record<string, string> = {};

    for (const studentId of students) {
      let existing = mockStore.assessments.find(
        (a) => a.paper_id === req.params.paperId && a.student_id === studentId
      );
      if (!existing) {
        existing = {
          id: `ass-${Date.now()}-${studentId}`,
          paper_id: req.params.paperId,
          student_id: studentId,
          total_score: 0,
          created_at: new Date().toISOString(),
        };
        mockStore.assessments.push(existing);
      }
      assessmentIds[studentId] = existing.id;
    }

    input.marks.forEach((m) => {
      const aId = assessmentIds[m.student_id];
      if (aId) {
        mockStore.assessmentMarks.push({
          id: `mark-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
          assessment_id: aId,
          question_id: m.question_id,
          score: m.score,
        });
      }
    });

    res.json({ message: 'Marks saved successfully', count: input.marks.length });
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ error: err.errors });
    next(err);
  }
});

// ─── GET /api/v1/assessments/:paperId/analytics — Real CO Attainment Analytics ─
router.get('/:paperId/analytics', authenticate, async (req, res, next) => {
  try {
    const paperId = req.params.paperId;

    // Get paper questions
    const pqs = mockStore.paperQuestions.filter((pq) => pq.paper_id === paperId);

    // Get assessments for this paper
    let assessments = mockStore.assessments.filter((a) => a.paper_id === paperId);

    if (assessments.length === 0 && isSupabaseConfigured()) {
      try {
        const { data } = await supabase
          .from('assessments')
          .select('id, student_id')
          .eq('paper_id', paperId);
        if (data && data.length > 0) assessments = data;
      } catch {}
    }

    // STRICT: If no marks recorded, return empty state — NO MOCK OR RANDOM VALUES
    if (assessments.length === 0) {
      return res.json({
        paper_id: paperId,
        student_count: 0,
        has_data: false,
        message: 'No marks recorded yet. Upload a marks CSV file to compute actual CO attainment.',
        co_attainment: [],
        question_stats: [],
      });
    }

    const assessmentIds = assessments.map((a) => a.id);
    const marks = mockStore.assessmentMarks.filter((m) => assessmentIds.includes(m.assessment_id));

    // Question stats
    const questionStats: Record<string, { max: number; scores: number[]; co_id?: string; bloom?: string }> = {};

    pqs.forEach((pq) => {
      const qId = pq.question_id || pq.id;
      questionStats[qId] = {
        max: pq.marks || 10,
        scores: [],
        co_id: pq.question_bank_entries?.co_id || pq.co_id,
        bloom: pq.question_bank_entries?.bloom_level || pq.bloom_level,
      };
    });

    marks.forEach((m) => {
      if (questionStats[m.question_id]) {
        questionStats[m.question_id].scores.push(m.score);
      }
    });

    // CO Attainment calculation
    const coAttainment: Record<string, { total_max: number; total_scored: number; count: number }> = {};

    for (const [qid, qStat] of Object.entries(questionStats)) {
      if (!qStat.co_id) continue;
      if (!coAttainment[qStat.co_id]) {
        coAttainment[qStat.co_id] = { total_max: 0, total_scored: 0, count: 0 };
      }
      qStat.scores.forEach((s) => {
        coAttainment[qStat.co_id!].total_max += qStat.max;
        coAttainment[qStat.co_id!].total_scored += s;
        coAttainment[qStat.co_id!].count += 1;
      });
    }

    const coAttainmentResult = Object.entries(coAttainment)
      .filter(([_, val]) => val.count > 0)
      .map(([co_id, val]) => ({
        co_id,
        attainment_percent: val.total_max > 0 ? Math.round((val.total_scored / val.total_max) * 100) : 0,
        student_count: val.count,
      }));

    const questionStatsResult = Object.entries(questionStats).map(([qid, qStat]) => ({
      question_id: qid,
      max_marks: qStat.max,
      avg_score:
        qStat.scores.length > 0
          ? Math.round((qStat.scores.reduce((a, b) => a + b, 0) / qStat.scores.length) * 10) / 10
          : null,
      co_id: qStat.co_id,
      bloom_level: qStat.bloom,
    }));

    res.json({
      paper_id: paperId,
      student_count: assessments.length,
      has_data: true,
      co_attainment: coAttainmentResult,
      question_stats: questionStatsResult,
    });
  } catch (err) {
    next(err);
  }
});

export default router;
