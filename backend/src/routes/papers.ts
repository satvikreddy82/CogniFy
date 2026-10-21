import { Router } from 'express';
import { z } from 'zod';
import { authenticate, AuthRequest } from '../middleware/auth';
import { authorize } from '../middleware/role';
import { supabase } from '../utils/supabase';
import { mockStore, isSupabaseConfigured } from '../utils/mockStore';
import {
  geminiService,
  GeminiValidationError,
  GeminiUnavailableError,
  GeminiQuotaError,
  GeminiTimeoutError,
  GeminiError,
} from '../ai/gemini';

const router = Router();

// In-flight generation tracking to prevent duplicate AI generations on rapid retries
const inFlightGenerations = new Set<string>();

const paperConfigSchema = z.object({
  course_id: z.string().optional(),
  course_name: z.string().min(1, 'Course name is required'),
  course_code: z.string().min(1, 'Course code is required'),
  syllabus: z.string().min(10, 'Syllabus must be at least 10 characters'),
  question_bank_ids: z.array(z.string()).optional(),
  title: z.string().min(3),
  total_marks: z.number().min(1),
  duration_minutes: z.number().min(1),
  sections: z
    .array(
      z.object({
        name: z.string().min(1),
        questions: z.number().min(1),
        marks_per_question: z.number().min(1),
        bloom_levels: z.array(z.string()).optional(),
        difficulty: z.string().optional(),
      }),
    )
    .min(1, 'At least one section is required'),
  co_distribution: z.record(z.number()).optional(),
});

// GET /api/v1/papers/ai/health — Gemini connectivity probe (no API key in response)
router.get('/ai/health', authenticate, async (_req, res, next) => {
  try {
    const result = await geminiService.healthCheck();
    return res.status(result.ok ? 200 : 503).json({
      configured: geminiService.isConfigured,
      model: result.model,
      latencyMs: result.latencyMs,
      ok: result.ok,
      ...(result.error ? { error: result.error } : {}),
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/papers
router.get('/', authenticate, async (req: AuthRequest, res, next) => {
  try {
    if (isSupabaseConfigured()) {
      try {
        let query = supabase
          .from('papers')
          .select('*, courses(name, code), profiles!created_by(full_name)')
          .order('created_at', { ascending: false });

        if (req.user!.role === 'faculty') {
          query = query.eq('created_by', req.user!.id);
        }

        const { data, error } = await query;
        if (!error && data) return res.json(data);
      } catch {}
    }

    // Fallback to mockStore
    let list = [...mockStore.papers];
    if (req.user!.role === 'faculty') {
      list = list.filter((p) => p.created_by === req.user!.id);
    }
    res.json(list);
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/papers/:paperId
router.get('/:paperId', authenticate, async (req, res, next) => {
  try {
    if (isSupabaseConfigured()) {
      try {
        const { data, error } = await supabase
          .from('papers')
          .select(`
            *,
            courses(name, code, department_id),
            paper_questions(*, question_bank_entries(*))
          `)
          .eq('id', req.params.paperId)
          .single();

        if (!error && data) return res.json(data);
      } catch {}
    }

    const paper = mockStore.papers.find((p) => p.id === req.params.paperId);
    if (!paper) return res.status(404).json({ error: 'Paper not found' });
    const pqs = mockStore.paperQuestions.filter((pq) => pq.paper_id === req.params.paperId);
    const resolvedQuestions = pqs.length > 0 ? pqs : (paper.paper_questions || []);
    res.json({ ...paper, paper_questions: resolvedQuestions });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/papers/generate — Real Gemini AI paper generation
router.post('/generate', authenticate, authorize(['faculty']), async (req: AuthRequest, res, next) => {
  try {
    const config = paperConfigSchema.parse(req.body);
    const { course_name, course_code, syllabus, sections, total_marks, duration_minutes, title } = config;
    const selectedBankIds = config.question_bank_ids ?? [];
    const paperId = 'paper-' + Date.now();

    // Validate section marks consistency before calling Gemini
    const sectionTotal = sections.reduce((s, sec) => s + sec.questions * sec.marks_per_question, 0);
    if (sectionTotal !== total_marks) {
      return res.status(400).json({
        error: `Section marks sum (${sectionTotal}) does not equal total_marks (${total_marks}). Adjust sections.`,
      });
    }

    // In-flight deduplication: prevent duplicate concurrent generation for same faculty and course
    const inFlightKey = `${req.user!.id}:${course_code.trim().toUpperCase()}:${total_marks}`;
    if (inFlightGenerations.has(inFlightKey)) {
      return res.status(409).json({
        error: `A question paper generation is already currently in flight for ${course_code.toUpperCase()}. Please wait for it to complete.`,
        code: 'GENERATION_IN_PROGRESS',
      });
    }
    inFlightGenerations.add(inFlightKey);

    try {
      // Require Gemini — do not fall back to mock in the generation path
      if (!geminiService.isConfigured) {
        return res.status(503).json({
          error: 'Gemini AI is not configured. Set GEMINI_API_KEY in backend/.env and restart the server.',
          hint: 'Verify connectivity via GET /api/v1/papers/ai/health after setting the key.',
        });
      }

      // Gather bank questions
      let bankQuestions = [...mockStore.questions];
      if (selectedBankIds.length > 0) {
        bankQuestions = bankQuestions.filter((q) => selectedBankIds.includes(q.bank_id));
      } else {
        const byCode = bankQuestions.filter(
          (q) =>
            (q.course_code && q.course_code.toLowerCase() === course_code.toLowerCase()) ||
            (q.course_name && q.course_name.toLowerCase().includes(course_name.toLowerCase())),
        );
        if (byCode.length > 0) bankQuestions = byCode;
      }

      // Gather course outcomes
      const courseOutcomes = mockStore.courseOutcomes
        .filter((co) =>
          config.course_id
            ? co.course_id === config.course_id
            : co.course_id.toLowerCase().includes(course_code.toLowerCase()),
        )
        .map((co) => ({ code: co.code, description: co.description }));

      console.info(
        `[papers/generate] User=${req.user!.id} course=${course_code} marks=${total_marks} bankQs=${bankQuestions.length} cos=${courseOutcomes.length}`,
      );

      // Call Gemini
      let paperQuestions: any[];
      let aiMetadata: any;

      try {
        const geminiOut = await geminiService.generatePaper({
          course_name,
          course_code,
          title,
          total_marks,
          duration_minutes,
          syllabus,
          sections,
          bank_questions: bankQuestions.map((q) => ({
            id: q.id,
            text: q.text || q.question_text || '',
            marks: q.marks || 10,
            bloom_level: q.bloom_level || 'apply',
            difficulty: q.difficulty || 'medium',
            co_id: q.co_id,
          })),
          course_outcomes: courseOutcomes,
        });

        paperQuestions = geminiOut.questions.map((gq, idx) => ({
          id: `pq-${idx + 1}-${Date.now()}`,
          paper_id: paperId,
          question_id: gq.id || `gen-q-${idx + 1}`,
          order_index: gq.question_number || idx + 1,
          section: gq.section,
          marks: gq.marks,
          question_bank_entries: {
            text: gq.text,
            question_text: gq.text,
            bloom_level: gq.bloom_level,
            difficulty: gq.difficulty,
            co_id: gq.co_id,
            marks: gq.marks,
            source: gq.source,
          },
        }));

        aiMetadata = {
          provider: 'Google Gemini',
          model: geminiOut.metadata.model,
          generated_at: geminiOut.metadata.generated_at,
          is_mock: false,
          syllabus_integrated: true,
          bank_source_count: geminiOut.metadata.bank_questions_used,
          ai_generated_count: geminiOut.metadata.ai_questions_generated,
        };
      } catch (aiErr: any) {
        if (aiErr instanceof GeminiValidationError) {
          console.error('[papers/generate] OBE validation failed:', aiErr.issues);
          return res.status(422).json({
            error: 'The generated paper did not satisfy OBE requirements (marks or section alignment). Please click Retry to regenerate.',
            code: 'OBE_VALIDATION_FAILED',
            validation_issues: aiErr.issues,
            transient: true,
          });
        }
        if (aiErr instanceof GeminiUnavailableError) {
          console.error('[papers/generate] Gemini 503 high demand:', aiErr.message);
          return res.status(503).json({
            error: 'The AI model is currently experiencing high demand. Please try again in a few moments.',
            code: 'MODEL_UNAVAILABLE',
            transient: true,
            retry_after_seconds: aiErr.retryAfterSeconds || 5,
          });
        }
        if (aiErr instanceof GeminiQuotaError) {
          console.error('[papers/generate] Gemini 429 quota:', aiErr.message);
          return res.status(429).json({
            error: 'AI generation rate limit reached. Please wait a moment before trying again.',
            code: 'RATE_LIMIT_EXCEEDED',
            transient: true,
            retry_after_seconds: aiErr.retryAfterSeconds || 30,
          });
        }
        if (aiErr instanceof GeminiTimeoutError) {
          console.error('[papers/generate] Gemini generation timed out:', aiErr.message);
          return res.status(504).json({
            error: `AI generation timed out after ${aiErr.timeoutMs}ms. The model did not complete within the allowed time. Please try again or select a faster model.`,
            code: 'REQUEST_TIMEOUT',
            transient: true,
            timeout_ms: aiErr.timeoutMs,
          });
        }
        const statusCode = aiErr?.statusCode || (aiErr?.isTransient ? 503 : 502);
        const msg = aiErr?.message || 'AI generation failed';
        console.error('[papers/generate] Gemini error:', msg);
        return res.status(statusCode).json({
          error: `AI generation failed: ${msg}`,
          code: aiErr?.code || 'AI_GENERATION_FAILED',
          hint: 'Please try again or select a different model in backend/.env.',
          transient: Boolean(aiErr?.isTransient),
        });
      }

      // Persist paper and questions
      const newPaper = {
        id: paperId, title, course_id: config.course_id || course_code, course_name, course_code,
        syllabus, total_marks, duration_minutes, status: 'validation_required',
        created_by: req.user!.id, created_at: new Date().toISOString(), config,
        question_count: paperQuestions.length, ai_metadata: aiMetadata,
        courses: { name: course_name, code: course_code },
      };

      mockStore.papers.unshift(newPaper);
      paperQuestions.forEach((pq) => mockStore.paperQuestions.push(pq));

      mockStore.auditLogs.unshift({
        id: 'log-' + Date.now(), actor_id: req.user!.id, action: 'paper_generated_gemini',
        target_table: 'papers', target_id: paperId,
        details: { course_name, course_code, total_marks, questions_generated: paperQuestions.length },
        created_at: new Date().toISOString(),
      });

      console.info(`[papers/generate] ✓ Paper ${paperId}: ${paperQuestions.length} Qs, ${total_marks} marks, model=${aiMetadata.model}`);

      return res.status(201).json({
        paper_id: paperId,
        status: 'validation_required',
        questions_count: paperQuestions.length,
        ai_metadata: aiMetadata,
        message: 'Question paper generated successfully using Gemini AI.',
      });
    } finally {
      inFlightGenerations.delete(inFlightKey);
    }
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ error: 'Invalid request', details: err.errors });
    next(err);
  }
});

// GET /api/v1/papers/:paperId/validate — Deterministic OBE Validator
router.get('/:paperId/validate', authenticate, async (req, res, next) => {
  try {
    const paper = mockStore.papers.find((p) => p.id === req.params.paperId);
    if (!paper) return res.status(404).json({ error: 'Paper not found' });

    const questions = mockStore.paperQuestions.filter((pq) => pq.paper_id === req.params.paperId);

    const issues: { type: string; severity: 'error' | 'warning'; message: string }[] = [];

    // Check total marks
    const totalMarks = questions.reduce((s: number, pq: any) => s + (pq.marks || 0), 0);
    if (totalMarks !== paper.total_marks) {
      issues.push({
        type: 'marks_mismatch',
        severity: 'error',
        message: `Total marks mismatch: expected ${paper.total_marks}, got ${totalMarks}`,
      });
    }

    // Check Bloom's taxonomy coverage
    const bloomLevels = questions.map((pq: any) => pq.question_bank_entries?.bloom_level).filter(Boolean);
    const uniqueBloom = new Set(bloomLevels);
    if (uniqueBloom.size < 3) {
      issues.push({
        type: 'bloom_coverage',
        severity: 'warning',
        message: `Low Bloom's taxonomy diversity: only ${uniqueBloom.size} level(s) covered (${Array.from(uniqueBloom).join(', ')})`,
      });
    }

    // Check Course Outcome mapping
    const coIds = questions.map((pq: any) => pq.question_bank_entries?.co_id).filter(Boolean);
    if (coIds.length === 0) {
      issues.push({
        type: 'co_mapping',
        severity: 'error',
        message: 'No questions are mapped to Course Outcomes',
      });
    }

    // Duplicate check
    const qIds = questions.map((pq: any) => pq.question_id);
    const hasDuplicates = qIds.length !== new Set(qIds).size;
    if (hasDuplicates) {
      issues.push({
        type: 'duplicate_questions',
        severity: 'error',
        message: 'Duplicate questions detected in the examination paper',
      });
    }

    const status = issues.some((i) => i.severity === 'error')
      ? 'failed'
      : issues.length > 0
      ? 'warning'
      : 'passed';

    res.json({
      paper_id: paper.id,
      status,
      issues,
      total_marks: totalMarks,
      expected_marks: paper.total_marks,
      questions_count: questions.length,
      bloom_distribution: bloomLevels.reduce((acc: any, b: string) => {
        acc[b] = (acc[b] || 0) + 1;
        return acc;
      }, {}),
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/papers/:paperId/submit — Faculty submits for Dean review
router.post('/:paperId/submit', authenticate, authorize(['faculty']), async (req: AuthRequest, res, next) => {
  try {
    const paper = mockStore.papers.find((p) => p.id === req.params.paperId);
    if (!paper) return res.status(404).json({ error: 'Paper not found' });

    paper.status = 'pending_review';

    // Notify Dean
    mockStore.notifications.unshift({
      id: 'notif-' + Date.now(),
      recipient_role: 'dean',
      type: 'paper_submitted',
      payload: {
        paper_id: paper.id,
        title: paper.title,
        course_name: paper.course_name,
        faculty_name: req.user!.email,
      },
      is_read: false,
      created_at: new Date().toISOString(),
    });

    mockStore.auditLogs.unshift({
      id: 'log-' + Date.now(),
      actor_id: req.user!.id,
      action: 'paper_submitted_for_dean_review',
      target_table: 'papers',
      target_id: paper.id,
      details: { title: paper.title },
      created_at: new Date().toISOString(),
    });

    res.json({ message: 'Paper submitted for Dean review successfully', status: 'pending_review' });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/papers/:paperId/approve — Dean approves or requests changes
router.post('/:paperId/approve', authenticate, authorize(['dean']), async (req: AuthRequest, res, next) => {
  try {
    const input = z.object({
      decision: z.enum(['approved', 'rejected', 'changes_requested']),
      comment: z.string().optional(),
    }).parse(req.body);

    const paper = mockStore.papers.find((p) => p.id === req.params.paperId);
    if (!paper) return res.status(404).json({ error: 'Paper not found' });

    paper.status = input.decision;
    paper.dean_comment = input.comment;
    paper.decided_at = new Date().toISOString();
    paper.decided_by = req.user!.id;

    mockStore.notifications.unshift({
      id: 'notif-' + Date.now(),
      recipient_id: paper.created_by,
      type: `paper_${input.decision}`,
      payload: { paper_id: paper.id, title: paper.title, comment: input.comment },
      is_read: false,
      created_at: new Date().toISOString(),
    });

    res.json({ message: `Paper ${input.decision}`, status: input.decision });
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ error: err.errors });
    next(err);
  }
});

export default router;
