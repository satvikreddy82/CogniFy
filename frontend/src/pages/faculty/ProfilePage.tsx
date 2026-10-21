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

export default function ProfilePage() {
  const { user, updateUser, refreshProfile } = useAuth();

  const [isEditing, setIsEditing] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [fetchingDepartments, setFetchingDepartments] = useState(true);

  // Form states
  const [fullName, setFullName] = useState(user?.full_name || '');
  const [designation, setDesignation] = useState(user?.designation || 'Associate Professor');
  const [departmentId, setDepartmentId] = useState(user?.department_id || '');

  // Status feedback states
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{ fullName?: string; designation?: string }>({});

  // Sync state when user object changes or loads
  useEffect(() => {
    if (user) {
      setFullName(user.full_name || '');
      setDesignation(user.designation || 'Associate Professor');
      setDepartmentId(user.department_id || '');
    }
  }, [user]);

  // Fetch departments list
  useEffect(() => {
    let isMounted = true;
    api
      .get('/auth/departments')
      .then((res) => {
        if (isMounted && Array.isArray(res.data)) {
          setDepartments(res.data);
        }
      })
      .catch((err) => {
        console.error('Failed to load departments', err);
      })
      .finally(() => {
        if (isMounted) setFetchingDepartments(false);
      });
    return () => {
      isMounted = false;
    };
  }, []);

  const handleStartEdit = () => {
    setFeedback(null);
    setFieldErrors({});
    setFullName(user?.full_name || '');
    setDesignation(user?.designation || 'Associate Professor');
    setDepartmentId(user?.department_id || '');
    setIsEditing(true);
  };

  const handleCancelEdit = () => {
    setFeedback(null);
    setFieldErrors({});
    setFullName(user?.full_name || '');
    setDesignation(user?.designation || 'Associate Professor');
    setDepartmentId(user?.department_id || '');
    setIsEditing(false);
  };

  const validate = (): boolean => {
    const errors: { fullName?: string; designation?: string } = {};
    if (!fullName.trim() || fullName.trim().length < 2) {
      errors.fullName = 'Full name must be at least 2 characters.';
    }
    if (!designation.trim() || designation.trim().length < 2) {
      errors.designation = 'Designation must be at least 2 characters.';
    }
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);

    if (!validate()) return;

    setIsLoading(true);
    try {
      const payload: Record<string, any> = {
        full_name: fullName.trim(),
        designation: designation.trim(),
      };
      if (departmentId) {
        payload.department_id = departmentId;
      }

      const res = await api.patch('/auth/profile', payload);

      if (res.data) {
        updateUser(res.data);
      }
      await refreshProfile();

      setFeedback({ type: 'success', message: 'Profile updated successfully.' });
      setIsEditing(false);
    } catch (err: any) {
      const errMsg =
        err.response?.data?.error ||
        err.response?.data?.message ||
        'Failed to save profile changes. Please try again.';
      setFeedback({ type: 'error', message: errMsg });
    } finally {
      setIsLoading(false);
    }
  };

  const currentDeptName =
    departments.find((d) => d.id === (user?.department_id || departmentId))?.name ||
    user?.department_id ||
    'Not specified';

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-fade-in pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="page-title flex items-center gap-2">
            <User className="w-6 h-6 text-primary" />
            Faculty Profile
          </h1>
          <p className="text-sm text-muted mt-1">
            Manage your personal academic information, credentials, and institutional affiliation.
          </p>
        </div>

        {!isEditing && (
          <button
            type="button"
            onClick={handleStartEdit}
            className="btn btn-primary self-start sm:self-auto flex items-center gap-2 text-xs"
          >
            <Edit2 className="w-3.5 h-3.5" />
            Edit Profile
          </button>
        )}
      </div>

      {/* Feedback banner */}
      {feedback && (
        <div
          className={`p-4 rounded-brand border flex items-start gap-3 animate-fade-in ${
            feedback.type === 'success'
              ? 'bg-success/10 border-success/30 text-success'
              : 'bg-danger/10 border-danger/30 text-danger'
          }`}
        >
          {feedback.type === 'success' ? (
            <CheckCircle className="w-5 h-5 shrink-0 mt-0.5" />
          ) : (
            <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
          )}
          <div className="flex-1 text-sm font-medium">{feedback.message}</div>
          <button
            onClick={() => setFeedback(null)}
            className="text-muted hover:text-default"
            aria-label="Dismiss"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Main Profile Card */}
      <div className="card p-6 sm:p-8 space-y-8 bg-surface border border-default shadow-sm">
        {/* User Hero Row */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5 pb-6 border-b border-default">
          <div className="w-20 h-20 rounded-full bg-primary/10 border-2 border-primary/20 flex items-center justify-center text-primary font-bold text-2xl uppercase tracking-wider shrink-0 shadow-inner">
            {user?.full_name ? user.full_name.charAt(0) : 'F'}
          </div>

          <div className="space-y-1.5 flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-xl font-bold text-default truncate">
                {user?.full_name || 'Faculty Member'}
              </h2>
              <span className="badge badge-primary text-[10px] font-bold uppercase tracking-wider">
                {user?.role || 'faculty'}
              </span>
              <span className="badge badge-success text-[10px] font-semibold capitalize">
                {user?.status || 'Active'}
              </span>
            </div>

            <p className="text-sm font-medium text-muted flex items-center gap-1.5">
              <Briefcase className="w-3.5 h-3.5 text-primary" />
              {user?.designation || 'Associate Professor'}
            </p>

            <p className="text-xs text-muted flex items-center gap-1.5 truncate">
              <Building className="w-3.5 h-3.5" />
              {currentDeptName}
            </p>
          </div>
        </div>

        {/* Edit Form or View Details */}
        {isEditing ? (
          <form onSubmit={handleSave} className="space-y-6">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-primary">
              <Sparkles className="w-4 h-4" />
              Editing Permitted Details
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              {/* Full Name */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-default block">
                  Full Name <span className="text-danger">*</span>
                </label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
                  <input
                    type="text"
                    value={fullName}
                    onChange={(e) => {
                      setFullName(e.target.value);
                      if (fieldErrors.fullName) setFieldErrors((p) => ({ ...p, fullName: undefined }));
                    }}
                    placeholder="e.g. Dr. Alan Turing"
                    className={`input pl-9 w-full ${fieldErrors.fullName ? 'border-danger focus:ring-danger' : ''}`}
                    disabled={isLoading}
                    required
                  />
                </div>
                {fieldErrors.fullName && (
                  <p className="text-xs text-danger mt-1">{fieldErrors.fullName}</p>
                )}
              </div>

              {/* Designation */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-default block">
                  Academic Designation <span className="text-danger">*</span>
                </label>
                <div className="relative">
                  <Briefcase className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
                  <input
                    type="text"
                    value={designation}
                    onChange={(e) => {
                      setDesignation(e.target.value);
                      if (fieldErrors.designation) setFieldErrors((p) => ({ ...p, designation: undefined }));
                    }}
                    placeholder="e.g. Professor / Associate Professor"
                    className={`input pl-9 w-full ${fieldErrors.designation ? 'border-danger focus:ring-danger' : ''}`}
                    disabled={isLoading}
                    required
                  />
                </div>
                {fieldErrors.designation && (
                  <p className="text-xs text-danger mt-1">{fieldErrors.designation}</p>
                )}
              </div>

              {/* Department */}
              <div className="space-y-1.5 sm:col-span-2">
                <label className="text-xs font-semibold text-default block">
                  Department
                </label>
                <div className="relative">
                  <Building className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
                  <select
                    value={departmentId}
                    onChange={(e) => setDepartmentId(e.target.value)}
                    className="input pl-9 w-full"
                    disabled={isLoading || fetchingDepartments}
                  >
                    <option value="">Select your department…</option>
                    {departments.map((dept) => (
                      <option key={dept.id} value={dept.id}>
                        {dept.name}
                      </option>
                    ))}
                  </select>
                </div>
                <p className="text-[11px] text-muted italic mt-1">
                  Department changes align your course and question bank scoping to institutional records.
                </p>
              </div>
            </div>

            {/* Read-Only Account Metadata (Explicitly marked) */}
            <div className="pt-4 border-t border-default space-y-3">
              <span className="text-[11px] font-bold uppercase tracking-wider text-muted block">
                Immutable Account Authentication Details
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div className="p-3 bg-surface-2 rounded-brand border border-default flex items-center justify-between">
                  <span className="text-muted flex items-center gap-1.5">
                    <Mail className="w-3.5 h-3.5" /> Email
                  </span>
                  <span className="font-mono text-default font-medium">{user?.email}</span>
                </div>
                <div className="p-3 bg-surface-2 rounded-brand border border-default flex items-center justify-between">
                  <span className="text-muted flex items-center gap-1.5">
                    <BadgeCheck className="w-3.5 h-3.5" /> Employee ID
                  </span>
                  <span className="font-mono text-default font-medium">
                    {user?.employee_id || 'FAC-101'}
                  </span>
                </div>
              </div>
            </div>

            {/* Form Actions */}
            <div className="flex items-center justify-end gap-3 pt-4 border-t border-default">
              <button
                type="button"
                onClick={handleCancelEdit}
                disabled={isLoading}
                className="btn btn-secondary text-xs flex items-center gap-1.5"
              >
                <X className="w-3.5 h-3.5" />
                Cancel
              </button>

              <button
                type="submit"
                disabled={isLoading}
                className="btn btn-primary text-xs flex items-center gap-1.5"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Saving…
                  </>
                ) : (
                  <>
                    <Save className="w-3.5 h-3.5" />
                    Save Changes
                  </>
                )}
              </button>
            </div>
          </form>
        ) : (
          /* View-only state */
          <div className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              {/* Full Name */}
              <div className="p-4 rounded-brand border border-default bg-surface-2/50 space-y-1">
                <span className="text-xs text-muted flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-primary" /> Full Name
                </span>
                <p className="text-sm font-semibold text-default">{user?.full_name || '—'}</p>
              </div>

              {/* Designation */}
              <div className="p-4 rounded-brand border border-default bg-surface-2/50 space-y-1">
                <span className="text-xs text-muted flex items-center gap-1.5">
                  <Briefcase className="w-3.5 h-3.5 text-primary" /> Academic Designation
                </span>
                <p className="text-sm font-semibold text-default">
                  {user?.designation || 'Associate Professor'}
                </p>
              </div>

              {/* Department */}
              <div className="p-4 rounded-brand border border-default bg-surface-2/50 space-y-1 sm:col-span-2">
                <span className="text-xs text-muted flex items-center gap-1.5">
                  <Building className="w-3.5 h-3.5 text-primary" /> Assigned Academic Department
                </span>
                <p className="text-sm font-semibold text-default">{currentDeptName}</p>
              </div>

              {/* Email (Immutable) */}
              <div className="p-4 rounded-brand border border-default bg-surface-2/50 space-y-1">
                <span className="text-xs text-muted flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5" /> Institutional Email
                </span>
                <p className="text-sm font-mono text-default">{user?.email || '—'}</p>
                <span className="text-[10px] text-muted italic">Managed by institutional auth</span>
              </div>

              {/* Employee ID (Immutable) */}
              <div className="p-4 rounded-brand border border-default bg-surface-2/50 space-y-1">
                <span className="text-xs text-muted flex items-center gap-1.5">
                  <BadgeCheck className="w-3.5 h-3.5" /> Employee ID
                </span>
                <p className="text-sm font-mono text-default">
                  {user?.employee_id || 'FAC-CSE-101'}
                </p>
                <span className="text-[10px] text-muted italic">Verified institutional identifier</span>
              </div>

              {/* Account Status */}
              <div className="p-4 rounded-brand border border-default bg-surface-2/50 space-y-1">
                <span className="text-xs text-muted flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-success" /> Account Status
                </span>
                <p className="text-sm font-semibold text-success capitalize">
                  {user?.status || 'Approved & Active'}
                </p>
              </div>

              {/* Date Joined */}
              <div className="p-4 rounded-brand border border-default bg-surface-2/50 space-y-1">
                <span className="text-xs text-muted flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5" /> Member Since
                </span>
                <p className="text-sm text-default font-medium">
                  {user?.created_at
                    ? new Date(user.created_at).toLocaleDateString(undefined, {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                      })
                    : 'Fall 2026'}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
