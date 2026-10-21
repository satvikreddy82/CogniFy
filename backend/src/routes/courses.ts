import { Router, Response, NextFunction } from 'express';
import { z } from 'zod';
import { authenticate, AuthRequest } from '../middleware/auth';
import { authorize } from '../middleware/role';
import { supabase } from '../utils/supabase';
import { mockStore, isSupabaseConfigured } from '../utils/mockStore';

const router = Router();

const courseSchema = z.object({
  code: z.string().trim().min(2, 'Course code must be at least 2 characters').max(20, 'Course code must be 20 characters or less'),
  name: z.string().trim().min(2, 'Course name must be at least 2 characters').max(150, 'Course name must be 150 characters or less'),
  department_id: z.string().optional(),
  term: z.string().optional(),
  description: z.string().optional(),
});

// GET /api/v1/courses
router.get('/', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (isSupabaseConfigured()) {
      try {
        let query = supabase.from('courses').select('*, course_outcomes(*)').order('created_at', { ascending: false });

        if (req.user!.role === 'faculty' || req.user!.role === 'dean') {
          if (req.user!.department_id) {
            query = query.eq('department_id', req.user!.department_id);
          }
        }

        const { data, error } = await query;
        if (!error && data) return res.json(data);
      } catch (sbErr: any) {
        console.warn('[courses] Supabase fetch error, fallback to mockStore:', sbErr?.message);
      }
    }

    // Fallback to mockStore
    let courses = [...mockStore.courses];
    if (req.user!.role === 'faculty' || req.user!.role === 'dean') {
      if (req.user!.department_id) {
        courses = courses.filter(
          (c) => c.department_id === req.user!.department_id || c.created_by === req.user!.id,
        );
      }
    }

    // Enrich courses with outcomes for consistent frontend display
    const enriched = courses.map((c) => ({
      ...c,
      course_outcomes: mockStore.courseOutcomes.filter((co) => co.course_id === c.id),
    }));

    res.json(enriched);
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/courses/:courseId
router.get('/:courseId', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (isSupabaseConfigured()) {
      try {
        const { data, error } = await supabase
          .from('courses')
          .select('*, course_outcomes(*), syllabi(*)')
          .eq('id', req.params.courseId)
          .single();

        if (!error && data) return res.json(data);
      } catch {}
    }

    const course = mockStore.courses.find((c) => c.id === req.params.courseId);
    if (!course) return res.status(404).json({ error: 'Course not found' });

    const outcomes = mockStore.courseOutcomes.filter((co) => co.course_id === req.params.courseId);
    res.json({ ...course, course_outcomes: outcomes, syllabi: [] });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/courses
router.post('/', authenticate, authorize(['faculty', 'admin']), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const input = courseSchema.parse(req.body);
    const normalizedCode = input.code.trim().toUpperCase();
    const targetDeptId = input.department_id || req.user!.department_id || 'dept-01';

    // Duplicate check within department
    const existing = mockStore.courses.find(
      (c) => c.code.toUpperCase() === normalizedCode && c.department_id === targetDeptId,
    );
    if (existing) {
      return res.status(409).json({
        error: `Course with code "${normalizedCode}" already exists in this department.`,
      });
    }

    if (isSupabaseConfigured()) {
      try {
        const { data, error } = await supabase
          .from('courses')
          .insert({
            code: normalizedCode,
            name: input.name.trim(),
            department_id: targetDeptId,
            term: input.term?.trim() || 'Fall 2026',
            description: input.description?.trim() || '',
            created_by: req.user!.id,
          })
          .select('*, course_outcomes(*)')
          .single();

        if (!error && data) return res.status(201).json(data);
        if (error) {
          console.warn('[courses] Supabase insert failed, fallback to mockStore:', error.message);
        }
      } catch (err: any) {
        console.warn('[courses] Supabase exception, fallback to mockStore:', err.message);
      }
    }

    const newCourse = {
      id: 'course-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
      code: normalizedCode,
      name: input.name.trim(),
      department_id: targetDeptId,
      term: input.term?.trim() || 'Fall 2026',
      description: input.description?.trim() || '',
      created_by: req.user!.id,
      created_at: new Date().toISOString(),
      course_outcomes: [],
    };
    mockStore.courses.unshift(newCourse);

    mockStore.auditLogs.unshift({
      id: 'log-' + Date.now(),
      actor_id: req.user!.id,
      action: 'course_created',
      target_table: 'courses',
      target_id: newCourse.id,
      details: { code: normalizedCode, name: newCourse.name, department_id: targetDeptId },
      created_at: new Date().toISOString(),
    });

    return res.status(201).json(newCourse);
  } catch (err) {
    if (err instanceof z.ZodError) {
      const firstError = err.errors[0]?.message || 'Invalid course input';
      return res.status(400).json({ error: firstError, details: err.errors });
    }
    next(err);
  }
});

// GET /api/v1/courses/:courseId/outcomes
router.get('/:courseId/outcomes', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (isSupabaseConfigured()) {
      try {
        const { data, error } = await supabase
          .from('course_outcomes')
          .select('*')
          .eq('course_id', req.params.courseId)
          .order('code');

        if (!error && data) return res.json(data);
      } catch {}
    }

    const outcomes = mockStore.courseOutcomes.filter((co) => co.course_id === req.params.courseId);
    res.json(outcomes);
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/courses/:courseId/outcomes
router.post('/:courseId/outcomes', authenticate, authorize(['faculty']), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const input = z.object({
      code: z.string().min(2),
      description: z.string().min(5),
      target_attainment: z.number().min(0).max(100).optional(),
    }).parse(req.body);

    if (isSupabaseConfigured()) {
      try {
        const { data, error } = await supabase
          .from('course_outcomes')
          .insert({ ...input, course_id: req.params.courseId })
          .select()
          .single();

        if (!error && data) return res.status(201).json(data);
      } catch {}
    }

    const newOutcome = {
      id: 'co-' + Date.now(),
      course_id: req.params.courseId,
      ...input,
    };
    mockStore.courseOutcomes.push(newOutcome);
    res.status(201).json(newOutcome);
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ error: err.errors });
    next(err);
  }
});

// DELETE /api/v1/courses/:courseId — Safe deletion with academic record protection
router.delete('/:courseId', authenticate, authorize(['faculty', 'admin']), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const courseId = req.params.courseId;

    // Check Supabase if configured
    let course: any = null;
    if (isSupabaseConfigured()) {
      try {
        const { data } = await supabase
          .from('courses')
          .select('*, papers(*), student_marks(*)')
          .eq('id', courseId)
          .maybeSingle();
        if (data) course = data;
      } catch {}
    }

    if (!course) {
      course = mockStore.courses.find((c) => c.id === courseId);
    }

    if (!course) {
      return res.status(404).json({ error: 'Course not found' });
    }

    // Role check: Faculty may only delete courses they created or from their department
    if (req.user!.role === 'faculty') {
      const isOwner = course.created_by === req.user!.id;
      const isSameDept = course.department_id && course.department_id === req.user!.department_id;
      if (!isOwner && !isSameDept) {
        return res.status(403).json({
          error: 'You do not have permission to delete this course. Only the course creator or department faculty/admin can delete it.',
        });
      }
    }

    // Safety policy: Check if course has linked question papers, questions, or assessment records
    const linkedPapers = mockStore.papers.filter(
      (p) =>
        p.course_id === course.id ||
        (p.course_code && p.course_code.toUpperCase() === course.code.toUpperCase()),
    );

    const linkedQuestions = mockStore.questions.filter(
      (q) =>
        q.course_id === course.id ||
        (q.course_code && q.course_code.toUpperCase() === course.code.toUpperCase()),
    );

    const linkedPaperIds = new Set(linkedPapers.map((p) => p.id));
    const linkedAssessments = mockStore.assessments.filter(
      (a) => a.course_id === course.id || linkedPaperIds.has(a.paper_id),
    );

    if (linkedPapers.length > 0 || linkedQuestions.length > 0 || linkedAssessments.length > 0) {
      const recordsSummary: string[] = [];
      if (linkedPapers.length > 0) recordsSummary.push(`${linkedPapers.length} question paper(s)`);
      if (linkedQuestions.length > 0) recordsSummary.push(`${linkedQuestions.length} question bank item(s)`);
      if (linkedAssessments.length > 0) recordsSummary.push(`${linkedAssessments.length} assessment record(s)`);

      return res.status(409).json({
        error: `Cannot delete course "${course.code}": it is linked to ${recordsSummary.join(' and ')}. To preserve academic integrity and accreditation audit trails, courses with existing examination records cannot be deleted.`,
        code: 'COURSE_HAS_LINKED_RECORDS',
        linked_papers: linkedPapers.length,
        linked_questions: linkedQuestions.length,
        linked_assessments: linkedAssessments.length,
      });
    }

    // Clean up outcomes associated with course
    mockStore.courseOutcomes = mockStore.courseOutcomes.filter((co) => co.course_id !== course.id);

    // If Supabase configured, delete from database
    if (isSupabaseConfigured()) {
      try {
        await supabase.from('courses').delete().eq('id', course.id);
      } catch (sbErr: any) {
        console.warn('[courses/delete] Supabase delete error:', sbErr?.message);
      }
    }

    // Remove from mockStore
    mockStore.courses = mockStore.courses.filter((c) => c.id !== course.id);

    // Audit log
    mockStore.auditLogs.unshift({
      id: 'log-' + Date.now(),
      actor_id: req.user!.id,
      action: 'course_deleted',
      target_table: 'courses',
      target_id: course.id,
      details: { code: course.code, name: course.name, department_id: course.department_id },
      created_at: new Date().toISOString(),
    });

    return res.json({
      message: `Course "${course.code} — ${course.name}" has been deleted successfully.`,
      id: course.id,
      course_id: course.id,
    });
  } catch (err) {
    next(err);
  }
});

export default router;
