import { Router, Response, NextFunction } from 'express';
import { z } from 'zod';
import { authenticate, AuthRequest } from '../middleware/auth';
import { authorize } from '../middleware/role';
import { supabase } from '../utils/supabase';
import { mockStore, isSupabaseConfigured } from '../utils/mockStore';

const router = Router();

// All admin routes require admin role
router.use(authenticate, authorize(['admin']));

// GET /api/v1/admin/dean-applications
router.get('/dean-applications', async (_req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (isSupabaseConfigured()) {
      try {
        const { data, error } = await supabase
          .from('registration_applications')
          .select('*, profiles(full_name, email, department_id, created_at)')
          .eq('applicant_role', 'dean')
          .order('created_at', { ascending: false });

        if (!error && data) return res.json(data);
      } catch {}
    }

    // Fallback to mockStore
    const apps = mockStore.applications
      .filter((a) => a.applicant_role === 'dean')
      .map((app) => {
        const profile = mockStore.profiles.find((p) => p.id === app.applicant_id);
        return {
          ...app,
          profiles: profile
            ? {
                full_name: profile.full_name,
                email: profile.email,
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

// POST /api/v1/admin/dean-applications/:id/decide
router.post('/dean-applications/:id/decide', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const input = z.object({
      decision: z.enum(['approved', 'rejected']),
      department_id: z.string().optional(),
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
        if (input.department_id) profile.department_id = input.department_id;
      }
    }

    if (isSupabaseConfigured()) {
      try {
        const { data: application } = await supabase
          .from('registration_applications')
          .select('applicant_id')
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
            ...(input.department_id ? { department_id: input.department_id } : {}),
          }).eq('id', application.applicant_id);
        }
      } catch {}
    }

    mockStore.auditLogs.unshift({
      id: 'log-' + Date.now(),
      actor_id: req.user!.id,
      action: `dean_registration_${input.decision}`,
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

// GET /api/v1/admin/users
router.get('/users', async (_req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (isSupabaseConfigured()) {
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('id, email, full_name, role, department_id, is_active, status, created_at')
          .order('created_at', { ascending: false });

        if (!error && data) return res.json(data);
      } catch {}
    }

    res.json(mockStore.profiles);
  } catch (err) {
    next(err);
  }
});

// PATCH /api/v1/admin/users/:id/status
router.patch('/users/:id/status', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const input = z.object({
      is_active: z.boolean(),
      status: z.enum(['approved', 'suspended', 'revoked']).optional(),
    }).parse(req.body);

    const user = mockStore.profiles.find((p) => p.id === req.params.id);
    if (user) {
      user.is_active = input.is_active;
      if (input.status) user.status = input.status as any;
    }

    if (isSupabaseConfigured()) {
      try {
        await supabase
          .from('profiles')
          .update({ ...input, updated_at: new Date().toISOString() })
          .eq('id', req.params.id);
      } catch {}
    }

    mockStore.auditLogs.unshift({
      id: 'log-' + Date.now(),
      actor_id: req.user!.id,
      action: 'user_status_changed',
      target_table: 'profiles',
      target_id: req.params.id,
      details: input,
      created_at: new Date().toISOString(),
    });

    res.json(user || { id: req.params.id, ...input });
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ error: err.errors });
    next(err);
  }
});

// GET /api/v1/admin/departments
router.get('/departments', async (_req: AuthRequest, res: Response) => {
  if (isSupabaseConfigured()) {
    try {
      const { data, error } = await supabase.from('departments').select('*').order('name');
      if (!error && data && data.length > 0) return res.json(data);
    } catch {}
  }
  res.json(mockStore.departments);
});

// POST /api/v1/admin/departments
router.post('/departments', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const input = z.object({ name: z.string().min(2) }).parse(req.body);
    const newDept = {
      id: 'dept-' + (mockStore.departments.length + 1).toString().padStart(2, '0'),
      name: input.name,
    };
    mockStore.departments.push(newDept);
    res.status(201).json(newDept);
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ error: err.errors });
    next(err);
  }
});

// GET /api/v1/admin/audit-logs
router.get('/audit-logs', async (req: AuthRequest, res: Response) => {
  const { limit = '50', offset = '0' } = req.query as Record<string, string>;
  const parsedLimit = parseInt(limit) || 50;
  const parsedOffset = parseInt(offset) || 0;

  const logs = mockStore.auditLogs.map((log) => {
    const profile = mockStore.profiles.find((p) => p.id === log.actor_id);
    return {
      ...log,
      profiles: profile ? { full_name: profile.full_name, email: profile.email } : null,
    };
  });

  const slice = logs.slice(parsedOffset, parsedOffset + parsedLimit);
  res.json({ data: slice, total: logs.length });
});

export default router;
