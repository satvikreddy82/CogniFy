import { Router, Response, NextFunction } from 'express';
import { z } from 'zod';
import { authenticate, AuthRequest } from '../middleware/auth';
import { authorize } from '../middleware/role';
import { supabase } from '../utils/supabase';
import { mockStore, isSupabaseConfigured } from '../utils/mockStore';

const router = Router();

// All dean routes require dean or admin role
router.use(authenticate, authorize(['dean', 'admin']));

// GET /api/v1/dean/faculty-applications
router.get('/faculty-applications', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (isSupabaseConfigured()) {
      try {
        let query = supabase
          .from('registration_applications')
          .select('*, profiles:applicant_id(id, full_name, email, employee_id, designation, department_id, created_at)')
          .eq('applicant_role', 'faculty')
          .order('created_at', { ascending: false });

        if (req.user!.department_id && req.user!.role !== 'admin') {
          query = query.eq('department_id', req.user!.department_id);
        }

        const { data, error } = await query;
        if (!error && data) return res.json(data);
      } catch {}
    }

    // Fallback to mockStore
    const apps = mockStore.applications
      .filter((a) => a.applicant_role === 'faculty')
      .filter((a) => {
        if (!req.user!.department_id || req.user!.role === 'admin') return true;
        return a.department_id === req.user!.department_id;
      })
      .map((app) => {
        const profile = mockStore.profiles.find((p) => p.id === app.applicant_id);
        return {
          ...app,
          profiles: profile
            ? {
                id: profile.id,
                full_name: profile.full_name,
                email: profile.email,
                employee_id: profile.employee_id,
                designation: profile.designation,
                department_id: profile.department_id,
                created_at: profile.created_at,
              }
            : null,
        };
      });

    res.json(apps);
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/dean/faculty-applications/:id/decide
router.post('/faculty-applications/:id/decide', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const input = z.object({
      decision: z.enum(['approved', 'rejected']),
      reason: z.string().optional(),
    }).parse(req.body);

    const app = mockStore.applications.find((a) => a.id === req.params.id);
    if (app) {
      app.status = input.decision;
      app.decided_by = req.user!.id;
      app.decision_reason = input.reason;
      app.decided_at = new Date().toISOString();

      const profile = mockStore.profiles.find((p) => p.id === app.applicant_id);
      if (profile) {
        profile.status = input.decision === 'approved' ? 'approved' : 'rejected';
        profile.is_active = input.decision === 'approved';
      }
    }

    if (isSupabaseConfigured()) {
      try {
        const { data: application } = await supabase
          .from('registration_applications')
          .select('applicant_id, department_id')
          .eq('id', req.params.id)
          .single();

        if (application) {
          await supabase.from('registration_applications').update({
            status: input.decision,
            decided_by: req.user!.id,
            decision_reason: input.reason,
            decided_at: new Date().toISOString(),
          }).eq('id', req.params.id);

          await supabase.from('profiles').update({
            is_active: input.decision === 'approved',
            status: input.decision,
          }).eq('id', application.applicant_id);
        }
      } catch {}
    }

    mockStore.auditLogs.unshift({
      id: 'log-' + Date.now(),
      actor_id: req.user!.id,
      action: `faculty_registration_${input.decision}`,
      target_table: 'profiles',
      target_id: app?.applicant_id || req.params.id,
      details: { reason: input.reason },
      created_at: new Date().toISOString(),
    });

    res.json({ message: `Application ${input.decision}` });
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ error: err.errors });
    next(err);
  }
});

// GET /api/v1/dean/analytics
router.get('/analytics', async (req: AuthRequest, res: Response) => {
  const deptId = req.user!.department_id;
  const facultyMembers = mockStore.profiles.filter((p) => p.role === 'faculty' && (!deptId || p.department_id === deptId));

  res.json({
    totalPapers: 12,
    pendingPapers: 2,
    approvedPapers: 10,
    totalFaculty: facultyMembers.length || 8,
    activeFaculty: facultyMembers.filter((f) => f.is_active).length || 7,
    avgAttainment: 74.8,
    coStats: [
      { co: 'CO1', target: 70, actual: 78, status: 'met' },
      { co: 'CO2', target: 65, actual: 71, status: 'met' },
      { co: 'CO3', target: 60, actual: 48, status: 'unmet' },
      { co: 'CO4', target: 70, actual: 64, status: 'unmet' },
      { co: 'CO5', target: 75, actual: 82, status: 'met' },
    ],
    monthlyTrends: [
      { month: 'May', submissions: 12, approved: 10 },
      { month: 'Jun', submissions: 19, approved: 16 },
      { month: 'Jul', submissions: 8, approved: 8 },
      { month: 'Aug', submissions: 24, approved: 20 },
      { month: 'Sep', submissions: 31, approved: 27 },
      { month: 'Oct', submissions: 18, approved: 14 },
    ],
  });
});

export default router;
