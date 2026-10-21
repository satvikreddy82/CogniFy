import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import {
  loginUser,
  registerFaculty,
  registerDean,
  requestPasswordOtp,
  verifyPasswordOtp,
  resetPassword,
} from '../services/authService';
import {
  loginSchema,
  registerFacultySchema,
  registerDeanSchema,
  requestOtpSchema,
  verifyOtpSchema,
  resetPasswordSchema,
  updateProfileSchema,
} from '../validators/auth';
import { authenticate, AuthRequest } from '../middleware/auth';
import { authorize } from '../middleware/role';
import { supabase } from '../utils/supabase';
import { mockStore, isSupabaseConfigured } from '../utils/mockStore';

const router = Router();

// Rate limiting for auth endpoints (generous in development)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  skip: () => process.env.NODE_ENV !== 'production',
  message: { error: 'Too many requests, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
});

// ─── POST /api/v1/auth/login ──────────────────────────────────────────────────
router.post('/login', authLimiter, async (req, res, next) => {
  try {
    const input = loginSchema.parse(req.body);
    const result = await loginUser(input);
    res.json(result);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: err.errors });
    }
    next(err);
  }
});

// ─── POST /api/v1/auth/register/faculty ───────────────────────────────────────
router.post('/register/faculty', authLimiter, async (req, res, next) => {
  try {
    const input = registerFacultySchema.parse(req.body);
    const result = await registerFaculty(input);
    res.status(201).json(result);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: err.errors });
    }
    next(err);
  }
});

// ─── POST /api/v1/auth/register/dean ─────────────────────────────────────────
router.post('/register/dean', authLimiter, async (req, res, next) => {
  try {
    const input = registerDeanSchema.parse(req.body);
    const result = await registerDean(input);
    res.status(201).json(result);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: err.errors });
    }
    next(err);
  }
});

// ─── POST /api/v1/auth/request-otp ────────────────────────────────────────────
router.post('/request-otp', authLimiter, async (req, res, next) => {
  try {
    const { email } = requestOtpSchema.parse(req.body);
    const result = await requestPasswordOtp(email);
    res.json(result);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: err.errors[0]?.message || 'Invalid email address' });
    }
    next(err);
  }
});

// ─── POST /api/v1/auth/verify-otp ─────────────────────────────────────────────
router.post('/verify-otp', authLimiter, async (req, res, next) => {
  try {
    const { email, otp } = verifyOtpSchema.parse(req.body);
    const result = await verifyPasswordOtp(email, otp);
    res.json(result);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: err.errors[0]?.message || 'Invalid 6-digit OTP' });
    }
    next(err);
  }
});

// ─── POST /api/v1/auth/reset-password ─────────────────────────────────────────
router.post('/reset-password', authLimiter, async (req, res, next) => {
  try {
    const { email, otp, password } = resetPasswordSchema.parse(req.body);
    // Forward session tokens if the client sent them from the verify-otp step
    const sessionTokens = req.body.access_token && req.body.refresh_token
      ? { access_token: req.body.access_token as string, refresh_token: req.body.refresh_token as string }
      : undefined;
    const result = await resetPassword(email, otp, password, sessionTokens);
    res.json(result);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: err.errors[0]?.message || 'Invalid input' });
    }
    next(err);
  }
});

// ─── GET /api/v1/auth/profile ─────────────────────────────────────────────────
router.get('/profile', authenticate, async (req: AuthRequest, res, next) => {
  try {
    if (isSupabaseConfigured()) {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, email, full_name, role, department_id, designation, employee_id, status, created_at, theme, appearance')
        .eq('id', req.user!.id)
        .single();

      if (!error && data) {
        return res.json(data);
      }
    }

    const mockProfile = mockStore.profiles.find((p) => p.id === req.user!.id);
    if (mockProfile) {
      return res.json({
        id: mockProfile.id,
        email: mockProfile.email,
        full_name: mockProfile.full_name,
        role: mockProfile.role,
        department_id: mockProfile.department_id,
        designation: mockProfile.designation || 'Faculty Member',
        employee_id: mockProfile.employee_id || 'FAC-' + mockProfile.id.slice(0, 6).toUpperCase(),
        status: mockProfile.status || 'approved',
        created_at: mockProfile.created_at,
        theme: mockProfile.theme || 'theme-a',
        appearance: mockProfile.appearance || 'system',
      });
    }

    res.json({
      id: req.user!.id,
      email: req.user!.email,
      role: req.user!.role,
      full_name: req.user!.role === 'faculty' ? 'Faculty Member' : 'User',
      department_id: req.user!.department_id,
      designation: 'Faculty Member',
      status: 'approved',
      created_at: new Date().toISOString(),
    });
  } catch (err) {
    next(err);
  }
});

// ─── PATCH /api/v1/auth/profile ───────────────────────────────────────────────
router.patch('/profile', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const input = updateProfileSchema.parse(req.body);

    // If department_id is supplied, validate that it exists
    if (input.department_id) {
      const validDept = mockStore.departments.find(
        (d) => d.id === input.department_id || d.name.toLowerCase() === input.department_id?.toLowerCase()
      );
      if (!validDept && !isSupabaseConfigured()) {
        return res.status(400).json({ error: 'Selected department does not exist in institution records.' });
      }
    }

    const updates: Record<string, any> = {};
    if (input.full_name !== undefined) updates.full_name = input.full_name;
    if (input.designation !== undefined) updates.designation = input.designation;
    if (input.department_id !== undefined) updates.department_id = input.department_id;
    if (input.theme !== undefined) updates.theme = input.theme;
    if (input.appearance !== undefined) updates.appearance = input.appearance;

    // Persist to Supabase if configured
    if (isSupabaseConfigured() && Object.keys(updates).length > 0) {
      try {
        await supabase
          .from('profiles')
          .update({ ...updates, updated_at: new Date().toISOString() })
          .eq('id', req.user!.id);
      } catch (sbErr: any) {
        console.warn('[auth/profile] Supabase update warning:', sbErr?.message);
      }
    }

    // Update in-memory mock profile
    const mockProfile = mockStore.profiles.find((p) => p.id === req.user!.id);
    if (mockProfile) {
      if (input.full_name !== undefined) mockProfile.full_name = input.full_name;
      if (input.designation !== undefined) mockProfile.designation = input.designation;
      if (input.department_id !== undefined) mockProfile.department_id = input.department_id;
      if (input.theme !== undefined) mockProfile.theme = input.theme;
      if (input.appearance !== undefined) mockProfile.appearance = input.appearance;
    }

    // Return the updated profile
    const updatedProfile = {
      id: req.user!.id,
      email: mockProfile?.email || req.user!.email,
      full_name: mockProfile?.full_name || input.full_name || 'Faculty Member',
      role: mockProfile?.role || req.user!.role,
      department_id: mockProfile?.department_id || input.department_id || req.user!.department_id,
      designation: mockProfile?.designation || input.designation || 'Faculty Member',
      employee_id: mockProfile?.employee_id,
      status: mockProfile?.status || 'approved',
      created_at: mockProfile?.created_at,
      theme: mockProfile?.theme || input.theme || 'theme-a',
      appearance: mockProfile?.appearance || input.appearance || 'system',
    };

    res.json(updatedProfile);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: err.errors[0]?.message || 'Validation error', details: err.errors });
    }
    next(err);
  }
});

// ─── GET /api/v1/auth/registration-status ─────────────────────────────────────
router.get('/registration-status', authenticate, async (req: AuthRequest, res) => {
  const mockProfile = mockStore.profiles.find((p) => p.id === req.user!.id);
  res.json({
    status: mockProfile?.status || 'approved',
    is_active: mockProfile?.is_active ?? true,
    role: mockProfile?.role || req.user!.role,
  });
});

// ─── GET /api/v1/auth/departments ─────────────────────────────────────────────
// Public endpoint so registration forms can list all 14 departments
router.get('/departments', async (_req, res) => {
  if (isSupabaseConfigured()) {
    try {
      const { data, error } = await supabase
        .from('departments')
        .select('id, name')
        .order('name');

      if (!error && data && data.length > 0) {
        return res.json(data);
      }
    } catch {}
  }

  // Guaranteed fallback returning all 14 official departments
  res.json(mockStore.departments);
});

export default router;
