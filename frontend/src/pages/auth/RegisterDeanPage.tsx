import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { BookOpen, ArrowLeft, Eye, EyeOff, CheckCircle, AlertCircle } from 'lucide-react';
import { api } from '../../services/api';
import { ThemeSelector } from '../../components/ThemeSelector';
import { OFFICIAL_DEPARTMENTS, DepartmentItem } from '../../constants/departments';

export default function RegisterDeanPage() {
  const navigate = useNavigate();
  // Pre-seed with all 14 official departments so dropdown is immediately populated
  const [depts, setDepts] = useState<DepartmentItem[]>(OFFICIAL_DEPARTMENTS);
  const [form, setForm] = useState({
    full_name: '',
    employee_id: '',
    email: '',
    department_id: '',
    password: '',
    confirm_password: '',
  });
  const [showPw, setShowPw] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    api
      .get('/auth/departments')
      .then((r) => {
        if (r.data && Array.isArray(r.data) && r.data.length > 0) {
          setDepts(r.data);
        }
      })
      .catch(() => {
        // Fallback remains the pre-seeded OFFICIAL_DEPARTMENTS
      });
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setForm((p) => ({ ...p, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (form.password !== form.confirm_password) {
      setError('Passwords do not match');
      return;
    }
    if (!form.department_id) {
      setError('Please select the academic department you lead');
      return;
    }

    setIsLoading(true);
    try {
      await api.post('/auth/register/dean', form);
      setSuccess(true);
    } catch (err: any) {
      const msg = err?.response?.data?.error;
      setError(
        Array.isArray(msg)
          ? msg.map((e: any) => e.message).join(', ')
          : msg || err?.message || 'Dean application submission failed'
      );
    } finally {
      setIsLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen flex flex-col bg-surface-2">
        <header className="w-full flex items-center justify-between px-6 py-4 border-b border-default bg-surface shrink-0">
          <div className="flex items-center gap-2.5">
            <div
              className="w-8 h-8 rounded-brand flex items-center justify-center shadow-sm"
              style={{ backgroundColor: 'var(--primary)' }}
            >
              <BookOpen className="w-4 h-4" style={{ color: 'var(--text-on-primary)' }} />
            </div>
            <span className="font-bold text-default">CogniFy</span>
          </div>
          <ThemeSelector />
        </header>

        <div className="flex-1 flex items-center justify-center p-6">
          <div className="card p-10 max-w-md w-full text-center shadow-card-lg border border-default animate-fade-in bg-surface">
            <CheckCircle className="w-12 h-12 mx-auto mb-4" style={{ color: 'var(--success)' }} />
            <h2 className="text-xl font-bold text-default mb-2">Dean Application Submitted</h2>
            <p className="text-sm text-muted mb-6">
              Your Dean appointment request has been submitted to the Institutional Administrator queue. Once verified, you will be granted access to the Dean Academic Governance portal.
            </p>
            <Link to="/login" className="btn btn-primary w-full justify-center">
              Back to Login
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-surface-2">
      {/* Top Header with Theme Selector */}
      <header className="w-full flex items-center justify-between px-6 py-4 border-b border-default bg-surface shrink-0 z-30">
        <div className="flex items-center gap-2.5">
          <div
            className="w-8 h-8 rounded-brand flex items-center justify-center shadow-sm"
            style={{ backgroundColor: 'var(--primary)' }}
          >
            <BookOpen className="w-4 h-4" style={{ color: 'var(--text-on-primary)' }} />
          </div>
          <span className="font-bold text-default">CogniFy</span>
          <span className="text-xs text-muted hidden sm:inline-block border-l border-default pl-2 ml-1">
            Academic Dean Registration
          </span>
        </div>

        {/* Top-Right Theme & Mode Selector */}
        <div className="flex items-center gap-2">
          <ThemeSelector />
        </div>
      </header>

      {/* Form Container */}
      <div className="flex-1 flex items-center justify-center p-6 sm:p-10">
        <div className="w-full max-w-lg">
          <div className="card p-8 shadow-card-lg border border-default animate-fade-in bg-surface">
            <div className="flex items-center gap-2.5 mb-1">
              <Link
                to="/login"
                className="p-1 rounded-brand text-muted hover:text-default hover:bg-surface-2 transition-colors"
                title="Back to login"
              >
                <ArrowLeft className="w-4 h-4" />
              </Link>
              <h2 className="text-xl font-bold text-default">Dean Registration</h2>
            </div>
            <p className="text-xs text-muted mb-6 ml-7">
              Requires subsequent institutional administrator verification and activation.
            </p>

            {error && (
              <div
                className="mb-5 flex gap-2.5 items-start p-3 rounded-brand text-xs font-medium"
                style={{ backgroundColor: '#FEE2E2', color: '#991B1B' }}
              >
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="label text-xs font-semibold text-default uppercase tracking-wider mb-1">
                  Full Name & Title *
                </label>
                <input
                  name="full_name"
                  className="input w-full"
                  placeholder="Dr. Katherine Vance"
                  value={form.full_name}
                  onChange={handleChange}
                  required
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="label text-xs font-semibold text-default uppercase tracking-wider mb-1">
                    Employee ID *
                  </label>
                  <input
                    name="employee_id"
                    className="input w-full"
                    placeholder="DEAN-CSE-01"
                    value={form.employee_id}
                    onChange={handleChange}
                    required
                  />
                </div>

                <div>
                  <label className="label text-xs font-semibold text-default uppercase tracking-wider mb-1">
                    Academic Department *
                  </label>
                  <select
                    name="department_id"
                    className="input w-full cursor-pointer"
                    value={form.department_id}
                    onChange={handleChange}
                    required
                  >
                    <option value="">— Select Department —</option>
                    {depts.map((d, index) => (
                      <option key={d.id} value={d.id}>
                        {index + 1}. {d.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="label text-xs font-semibold text-default uppercase tracking-wider mb-1">
                  Institutional Email *
                </label>
                <input
                  name="email"
                  type="email"
                  className="input w-full"
                  placeholder="dean@cognify.edu"
                  value={form.email}
                  onChange={handleChange}
                  required
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="label text-xs font-semibold text-default uppercase tracking-wider mb-1">
                    Password *
                  </label>
                  <div className="relative">
                    <input
                      name="password"
                      type={showPw ? 'text' : 'password'}
                      className="input w-full pr-10"
                      placeholder="Min. 8 characters"
                      value={form.password}
                      onChange={handleChange}
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPw(!showPw)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-default"
                      tabIndex={-1}
                    >
                      {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="label text-xs font-semibold text-default uppercase tracking-wider mb-1">
                    Confirm Password *
                  </label>
                  <input
                    name="confirm_password"
                    type={showPw ? 'text' : 'password'}
                    className="input w-full"
                    placeholder="Repeat password"
                    value={form.confirm_password}
                    onChange={handleChange}
                    required
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="btn btn-primary w-full justify-center py-2.5 mt-4 text-sm font-semibold shadow-md"
              >
                {isLoading ? (
                  <>
                    <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin mr-2" />
                    Submitting Application…
                  </>
                ) : (
                  'Submit Dean Registration'
                )}
              </button>
            </form>

            <p className="text-xs text-center text-muted mt-5 pt-4 border-t border-default">
              Already have an account?{' '}
              <Link to="/login" className="font-bold hover:underline" style={{ color: 'var(--primary)' }}>
                Sign in
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
