import { Response, NextFunction } from 'express';
import { AuthRequest } from './auth';

export const authorize = (allowedRoles: string[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthenticated' });
      return;
    }

    if (!allowedRoles.includes(req.user.role)) {
      res.status(403).json({
        error: `Forbidden: role '${req.user.role}' is not permitted for this action`,
      });
      return;
    }

    next();
  };
};

export const authorizeDepartment = (req: AuthRequest, res: Response, next: NextFunction): void => {
  // Ensures a Dean can only act on their own department
  const requestedDeptId = (req.params.departmentId || req.body?.department_id) as string | undefined;
  if (!requestedDeptId) {
    next();
    return;
  }

  if (req.user?.role === 'admin') {
    next();
    return;
  }

  if (req.user?.department_id && req.user.department_id === requestedDeptId) {
    next();
    return;
  }

  res.status(403).json({ error: 'Forbidden: department mismatch' });
};
