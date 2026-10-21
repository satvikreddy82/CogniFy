import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { supabase } from '../utils/supabase';
import { mockStore, isSupabaseConfigured } from '../utils/mockStore';

import type { ParamsDictionary } from 'express-serve-static-core';
import type { ParsedQs } from 'qs';

export interface AuthUser {
  id: string;
  role: string;
  department_id?: string;
  email?: string;
  full_name?: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

export interface AuthRequest<
  P = ParamsDictionary,
  ResBody = any,
  ReqBody = any,
  ReqQuery = ParsedQs,
  Locals extends Record<string, any> = Record<string, any>
> extends Request<P, ResBody, ReqBody, ReqQuery, Locals> {
  user?: AuthUser;
}

export const authenticate = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing or invalid authorization header' });
    return;
  }

  const token = authHeader.split(' ')[1];

  try {
    const secret = process.env.JWT_SECRET || 'dev_secret_change_in_production';
    const payload = jwt.verify(token, secret) as { sub: string; role: string };

    let userProfile: any = null;

    if (isSupabaseConfigured()) {
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('id, role, department_id, email, full_name, is_active')
          .eq('id', payload.sub)
          .single();
        if (!error && data) {
          userProfile = data;
        }
      } catch {
        // fallback to mockStore
      }
    }

    if (!userProfile) {
      userProfile = mockStore.profiles.find((p) => p.id === payload.sub);
    }

    if (!userProfile) {
      res.status(401).json({ error: 'User not found' });
      return;
    }

    if (!userProfile.is_active) {
      res.status(403).json({ error: 'Account is not active' });
      return;
    }

    req.user = {
      id: userProfile.id,
      role: userProfile.role,
      department_id: userProfile.department_id,
      email: userProfile.email,
      full_name: userProfile.full_name,
    };

    next();
  } catch (err) {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
};
