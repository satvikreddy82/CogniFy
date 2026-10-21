import { z } from 'zod';

export const loginSchema = z.object({
  email: z.string().email('Invalid email'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

export const registerFacultySchema = z.object({
  full_name: z.string().trim().min(2, 'Name must be at least 2 characters'),
  employee_id: z.string().trim().min(3, 'Employee ID required'),
  email: z.string().trim().email('Invalid email address'),
  department_id: z.string({ required_error: 'Department is required' }).trim().min(1, 'Please select your academic department'),
  designation: z.string().trim().min(2, 'Designation required'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  confirm_password: z.string(),
}).refine((d) => d.password === d.confirm_password, {
  message: 'Passwords do not match',
  path: ['confirm_password'],
});

export const registerDeanSchema = z.object({
  full_name: z.string().trim().min(2, 'Name must be at least 2 characters'),
  employee_id: z.string().trim().min(3, 'Employee ID required'),
  email: z.string().trim().email('Invalid email address'),
  department_id: z.string({ required_error: 'Department is required' }).trim().min(1, 'Please select the academic department you lead'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  confirm_password: z.string(),
}).refine((d) => d.password === d.confirm_password, {
  message: 'Passwords do not match',
  path: ['confirm_password'],
});

export const requestOtpSchema = z.object({
  email: z.string().email('Invalid email address'),
});

export const verifyOtpSchema = z.object({
  email: z.string().email('Invalid email address'),
  otp: z.string().trim().length(6, 'Verification code must be exactly 6 digits'),
});

export const resetPasswordSchema = z.object({
  email: z.string().email('Invalid email address'),
  otp: z.string().trim().length(6, 'OTP must be 6 digits'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  confirm_password: z.string(),
}).refine((d) => d.password === d.confirm_password, {
  message: 'Passwords do not match',
  path: ['confirm_password'],
});

export const updateProfileSchema = z.object({
  full_name: z.string().trim().min(2, 'Full name must be at least 2 characters').max(100, 'Full name is too long').optional(),
  designation: z.string().trim().min(2, 'Designation must be at least 2 characters').max(100, 'Designation is too long').optional(),
  department_id: z.string().trim().min(1, 'Please select a valid department').optional(),
  theme: z.string().optional(),
  appearance: z.enum(['light', 'dark', 'system']).optional(),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterFacultyInput = z.infer<typeof registerFacultySchema>;
export type RegisterDeanInput = z.infer<typeof registerDeanSchema>;
export type RequestOtpInput = z.infer<typeof requestOtpSchema>;
export type VerifyOtpInput = z.infer<typeof verifyOtpSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
