import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../services/api';
import {
  User,
  Mail,
  Building,
  Briefcase,
  BadgeCheck,
  Calendar,
  ShieldCheck,
  CheckCircle,
  AlertCircle,
  Edit2,
  Save,
  X,
  Loader2,
  Sparkles,
} from 'lucide-react';

interface Department {
  id: string;
  name: string;
}

export default function DeanProfilePage() {
  const { user, updateUser, refreshProfile } = useAuth();

  const [isEditing, setIsEditing] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [fetchingDepartments, setFetchingDepartments] = useState(true);

  const [fullName, setFullName] = useState(user?.full_name || '');
  const [designation, setDesignation] = useState(user?.designation || 'Dean');
  const [departmentId, setDepartmentId] = useState(user?.department_id || '');

  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{ fullName?: string; designation?: string }>({});

  useEffect(() => {
    if (user) {
      setFullName(user.full_name || '');
      setDesignation(user.designation || 'Dean');
      setDepartmentId(user.department_id || '');
    }
  }, [user]);

  useEffect(() => {
    let isMounted = true;
    api
      .get('/auth/departments')
      .then((res) => {
        if (isMounted && Array.isArray(res.data)) {
          setDepartments(res.data);
        }
      })
      .catch(() => {})
      .finally(() => {
        if (isMounted) setFetchingDepartments(false);
      });
    return () => { isMounted = false; };
  }, []);

  const validate = (): boolean => {
    const errors: typeof fieldErrors = {};
    if (!fullName.trim() || fullName.trim().length < 2) {
      errors.fullName = 'Full name must be at least 2 characters.';
    }
    if (!designation.trim()) {
      errors.designation = 'Designation is required.';
    }
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;
    setIsLoading(true);
    setFeedback(null);
    try {
      const payload: Record<string, string> = {
        full_name: fullName.trim(),
        designation: designation.trim(),
      };
      if (departmentId) payload.department_id = departmentId;

      const res = await api.patch('/auth/profile', payload);
      updateUser(res.data);
      await refreshProfile();
      setFeedback({ type: 'success', message: 'Profile updated successfully.' });
      setIsEditing(false);
    } catch (err: any) {
      const msg =
        err.response?.data?.error ||
        err.response?.data?.message ||
        'Failed to update profile. Please try again.';
      setFeedback({ type: 'error', message: msg });
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancel = () => {
    setIsEditing(false);
    setFullName(user?.full_name || '');
    setDesignation(user?.designation || 'Dean');
    setDepartmentId(user?.department_id || '');
    setFieldErrors({});
    setFeedback(null);
  };

  const departmentName =
    departments.find((d) => d.id === (user?.department_id || departmentId))?.name || '—';

  const deanDesignations = [
    'Dean',
    'Associate Dean',
    'Dean of Academics',
    'Dean of Research',
    'Dean of Student Affairs',
    'Dean of Engineering',
    'Dean of Sciences',
    'Director',
  ];

  return (
    <div className="max-w-3xl mx-auto space-y-6 pb-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-default">My Profile</h1>
        <p className="text-sm text-muted mt-1">Manage your personal and institutional information</p>
      </div>

      {/* Feedback Banner */}
      {feedback && (
        <div
          className={`flex items-start gap-3 p-4 rounded-brand border text-sm ${
            feedback.type === 'success'
              ? 'bg-green-50 border-green-200 text-green-800 dark:bg-green-900/20 dark:border-green-700 dark:text-green-300'
              : 'bg-red-50 border-red-200 text-red-800 dark:bg-red-900/20 dark:border-red-700 dark:text-red-300'
          }`}
        >
          {feedback.type === 'success' ? (
            <CheckCircle className="w-4 h-4 mt-0.5 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
          )}
          <span>{feedback.message}</span>
        </div>
      )}

      {/* Profile Card */}
      <div className="card p-6 space-y-6">
        {/* Avatar + Role badge */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <div
              className="w-16 h-16 rounded-full flex items-center justify-center text-2xl font-bold shrink-0"
              style={{ backgroundColor: 'var(--primary)', color: 'var(--text-on-primary)' }}
            >
              {(user?.full_name || 'D').charAt(0).toUpperCase()}
            </div>
            <div>
              <h2 className="text-lg font-semibold text-default">{user?.full_name || 'Dean'}</h2>
              <span className="badge badge-info text-xs capitalize">{user?.role}</span>
              {user?.status && (
                <span className={`badge ml-2 text-xs ${user.status === 'active' ? 'badge-success' : 'badge-warning'}`}>
                  {user.status}
                </span>
              )}
            </div>
          </div>
          {!isEditing && (
            <button className="btn btn-secondary flex items-center gap-2 text-sm" onClick={() => setIsEditing(true)}>
              <Edit2 className="w-4 h-4" />
              Edit Profile
            </button>
          )}
        </div>

        {/* Fields */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Full Name */}
          <div className="space-y-1">
            <label className="flex items-center gap-2 text-xs font-semibold text-muted uppercase tracking-wide">
              <User className="w-3.5 h-3.5" /> Full Name
            </label>
            {isEditing ? (
              <>
                <input
                  className={`input w-full ${fieldErrors.fullName ? 'border-red-500' : ''}`}
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Your full name"
                  maxLength={100}
                />
                {fieldErrors.fullName && (
                  <p className="text-xs text-red-500">{fieldErrors.fullName}</p>
                )}
              </>
            ) : (
              <p className="text-sm text-default font-medium">{user?.full_name || '—'}</p>
            )}
          </div>

          {/* Email (read-only) */}
          <div className="space-y-1">
            <label className="flex items-center gap-2 text-xs font-semibold text-muted uppercase tracking-wide">
              <Mail className="w-3.5 h-3.5" /> Email Address
            </label>
            <p className="text-sm text-default font-medium">{user?.email || '—'}</p>
            <p className="text-xs text-muted">Email cannot be changed</p>
          </div>

          {/* Designation */}
          <div className="space-y-1">
            <label className="flex items-center gap-2 text-xs font-semibold text-muted uppercase tracking-wide">
              <Briefcase className="w-3.5 h-3.5" /> Designation
            </label>
            {isEditing ? (
              <>
                <select
                  className={`input w-full ${fieldErrors.designation ? 'border-red-500' : ''}`}
                  value={designation}
                  onChange={(e) => setDesignation(e.target.value)}
                >
                  {deanDesignations.map((d) => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
                {fieldErrors.designation && (
                  <p className="text-xs text-red-500">{fieldErrors.designation}</p>
                )}
              </>
            ) : (
              <p className="text-sm text-default font-medium">{user?.designation || 'Dean'}</p>
            )}
          </div>

          {/* Department */}
          <div className="space-y-1">
            <label className="flex items-center gap-2 text-xs font-semibold text-muted uppercase tracking-wide">
              <Building className="w-3.5 h-3.5" /> Department
            </label>
            {isEditing ? (
              fetchingDepartments ? (
                <div className="flex items-center gap-2 text-sm text-muted">
                  <Loader2 className="w-4 h-4 animate-spin" /> Loading…
                </div>
              ) : (
                <select
                  className="input w-full"
                  value={departmentId}
                  onChange={(e) => setDepartmentId(e.target.value)}
                >
                  <option value="">— No department selected —</option>
                  {departments.map((d) => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
              )
            ) : (
              <p className="text-sm text-default font-medium">{departmentName}</p>
            )}
          </div>

          {/* Employee ID (read-only) */}
          {user?.employee_id && (
            <div className="space-y-1">
              <label className="flex items-center gap-2 text-xs font-semibold text-muted uppercase tracking-wide">
                <BadgeCheck className="w-3.5 h-3.5" /> Employee ID
              </label>
              <p className="text-sm text-default font-medium font-mono">{user.employee_id}</p>
            </div>
          )}

          {/* Member Since */}
          {user?.created_at && (
            <div className="space-y-1">
              <label className="flex items-center gap-2 text-xs font-semibold text-muted uppercase tracking-wide">
                <Calendar className="w-3.5 h-3.5" /> Member Since
              </label>
              <p className="text-sm text-default font-medium">
                {new Date(user.created_at).toLocaleDateString('en-IN', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                })}
              </p>
            </div>
          )}
        </div>

        {/* Edit actions */}
        {isEditing && (
          <div className="flex items-center gap-3 pt-2 border-t" style={{ borderColor: 'var(--border)' }}>
            <button
              className="btn btn-primary flex items-center gap-2 text-sm"
              onClick={handleSave}
              disabled={isLoading}
            >
              {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {isLoading ? 'Saving…' : 'Save Changes'}
            </button>
            <button
              className="btn btn-secondary flex items-center gap-2 text-sm"
              onClick={handleCancel}
              disabled={isLoading}
            >
              <X className="w-4 h-4" /> Cancel
            </button>
          </div>
        )}
      </div>

      {/* Security card */}
      <div className="card p-6 space-y-3">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-4 h-4" style={{ color: 'var(--primary)' }} />
          <h3 className="font-semibold text-default">Account Security</h3>
        </div>
        <p className="text-sm text-muted">
          Your account is authenticated via CogniFy's secure JWT-based system. To change your
          password, use the <strong>Forgot Password</strong> flow from the login page.
        </p>
        <div className="flex items-center gap-2 text-xs text-muted">
          <Sparkles className="w-3.5 h-3.5" style={{ color: 'var(--primary)' }} />
          <span>Role: <strong className="capitalize">{user?.role}</strong> — Administrative access</span>
        </div>
      </div>
    </div>
  );
}
