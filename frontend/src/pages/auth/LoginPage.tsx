import React, { useState } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { Eye, EyeOff, BookOpen, ArrowRight, AlertCircle, Shield, CheckCircle2, Sparkles } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { ThemeSelector } from '../../components/ThemeSelector';
import { clsx } from 'clsx';

type RoleTab = 'faculty' | 'dean' | 'admin';

const DEMO_CREDENTIALS: Record<RoleTab, { email: string; pass: string; title: string }> = {
  admin: { email: 'admin@cognify.edu', pass: 'Admin@123', title: 'System Administrator' },
  dean: { email: 'dean@cognify.edu', pass: 'Dean@123', title: 'Academic Dean' },
  faculty: { email: 'faculty@cognify.edu', pass: 'Faculty@123', title: 'Faculty Professor' },
};

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuth();

  const [role, setRole] = useState<RoleTab>('faculty');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const fillDemo = (tab: RoleTab) => {
    setRole(tab);
    setEmail(DEMO_CREDENTIALS[tab].email);
    setPassword(DEMO_CREDENTIALS[tab].pass);
    setError('');
  };

  const handleRoleTabChange = (newRole: RoleTab) => {
    setRole(newRole);
    // If the fields are currently empty or holding another demo email, auto-populate the matching demo account
    if (
      !email ||
      Object.values(DEMO_CREDENTIALS).some((c) => c.email.toLowerCase() === email.toLowerCase())
    ) {
      setEmail(DEMO_CREDENTIALS[newRole].email);
      setPassword(DEMO_CREDENTIALS[newRole].pass);
    }
    setError('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    try {
      const loggedInUser = await login(email, password);

      // Determine appropriate role landing route
      let target = (location.state as any)?.from?.pathname;
      if (!target || target === '/dashboard' || target === '/login' || target === '/') {
        if (loggedInUser.role === 'admin') target = '/admin';
        else if (loggedInUser.role === 'dean') target = '/dean';
        else target = '/dashboard';
      }

      navigate(target, { replace: true });
    } catch (err: any) {
      setError(
        err?.response?.data?.error ||
        err?.message ||
        'Login failed. Please check your email and password.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col relative bg-surface-2 transition-colors duration-200">
      {/* Top Header Bar with Brand and Top-Right Theme Selector */}
      <header className="w-full flex items-center justify-between px-6 py-4 border-b border-default bg-surface shrink-0 z-30">
        <div className="flex items-center gap-2.5">
          <div
            className="w-9 h-9 rounded-brand-lg flex items-center justify-center shadow-sm"
            style={{ backgroundColor: 'var(--primary)' }}
          >
            <BookOpen className="w-5 h-5" style={{ color: 'var(--text-on-primary)' }} />
          </div>
          <div>
            <span className="text-lg font-bold tracking-tight text-default">CogniFy</span>
            <span className="hidden sm:inline-block text-[11px] font-medium text-muted ml-2 px-2 py-0.5 rounded-full bg-surface-2 border border-default">
              OBE & Bloom's Platform
            </span>
          </div>
        </div>

        {/* Top-Right Theme Dropdown & Light/Dark Switcher */}
        <div className="flex items-center gap-3">
          <span className="hidden md:inline text-xs text-muted font-medium">Theme & Mode:</span>
          <ThemeSelector />
        </div>
      </header>

      {/* Main Content Area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Panel — Branding and Highlights (Desktop) */}
        <div
          className="hidden lg:flex flex-col justify-between w-96 p-10 shrink-0 border-r border-default"
          style={{ backgroundColor: 'var(--surface-sidebar)' }}
        >
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold mb-6 bg-surface-2 border border-default text-default">
              <Sparkles className="w-3.5 h-3.5 text-primary" />
              <span>Higher Ed OBE Ecosystem</span>
            </div>
            <h1 className="text-3xl font-extrabold text-on-sidebar mb-3 leading-tight tracking-tight">
              Smarter Assessments.<br />
              <span style={{ color: 'var(--primary)' }}>Empowered Outcomes.</span>
            </h1>
            <p className="text-sm leading-relaxed text-muted mb-8">
              Deterministic Outcome-Based Education platform adhering strictly to Bloom's taxonomy (L1–L6) with automated validation and role approval workflows.
            </p>

            <div className="space-y-4">
              {[
                { title: 'Deterministic Paper Validator', desc: '100% Course Outcome (CO) mapping and section marks consistency' },
                { title: 'Three-Tier Academic Governance', desc: 'Faculty creation → Dean verification → Institutional Admin auditing' },
                { title: 'Continuous Attainment Analysis', desc: 'Student cohort marks analytics with automated AI remediations' },
              ].map((item) => (
                <div key={item.title} className="flex gap-3 items-start">
                  <div
                    className="mt-1 w-5 h-5 rounded-full flex items-center justify-center shrink-0"
                    style={{ backgroundColor: 'var(--primary)' }}
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" style={{ color: 'var(--text-on-primary)' }} />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-on-sidebar">{item.title}</p>
                    <p className="text-xs text-muted mt-0.5 leading-snug">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Quick info note at bottom of sidebar */}
          <div className="p-4 rounded-brand border border-default bg-surface/50 text-xs text-muted space-y-1">
            <p className="font-semibold text-default flex items-center gap-1.5">
              <Shield className="w-3.5 h-3.5 text-primary" /> Institutional Security
            </p>
            <p>Role-based access control, cryptographic password hashing, and immutable audit logs.</p>
          </div>
        </div>

        {/* Right Panel — Login Form Container */}
        <div className="flex-1 flex items-center justify-center p-6 sm:p-10 overflow-y-auto">
          <div className="w-full max-w-md">
            {/* Quick Demo Accounts Banner */}
            <div className="mb-6 p-3 rounded-brand-lg border border-default bg-surface shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-muted uppercase tracking-wider">
                  ⚡ 1-Click Demo Sign-In
                </span>
                <span className="text-[11px] text-muted">Click to auto-fill</span>
              </div>
              <div className="grid grid-cols-3 gap-1.5">
                {(['admin', 'dean', 'faculty'] as RoleTab[]).map((tab) => (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => fillDemo(tab)}
                    className={clsx(
                      'py-1.5 px-2 rounded-brand text-xs font-medium border text-center transition-all capitalize truncate',
                      role === tab && email === DEMO_CREDENTIALS[tab].email
                        ? 'border-primary ring-1 ring-primary bg-primary/10 text-primary font-bold'
                        : 'border-default bg-surface-2 text-default hover:border-primary'
                    )}
                  >
                    {tab}
                  </button>
                ))}
              </div>
            </div>

            {/* Login Card */}
            <div className="card p-8 shadow-card-lg border border-default animate-fade-in bg-surface">
              <h2 className="text-2xl font-bold text-default mb-1 tracking-tight">Sign in</h2>
              <p className="text-sm text-muted mb-6">Select your portal role and enter your credentials</p>

              {/* Role selector tabs */}
              <div
                className="flex rounded-brand border border-default mb-6 p-1 gap-1"
                style={{ backgroundColor: 'var(--surface-2)' }}
              >
                {(['faculty', 'dean', 'admin'] as RoleTab[]).map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => handleRoleTabChange(r)}
                    className={clsx(
                      'flex-1 py-1.5 text-xs font-semibold rounded capitalize transition-all',
                      role === r
                        ? 'shadow-sm text-on-primary'
                        : 'text-muted hover:text-default'
                    )}
                    style={
                      role === r
                        ? { backgroundColor: 'var(--primary)', color: 'var(--text-on-primary)' }
                        : {}
                    }
                  >
                    {r}
                  </button>
                ))}
              </div>

              {/* Credential hint badge */}
              <div className="mb-4 px-3 py-2 rounded-brand text-xs border border-default bg-surface-2 flex items-center justify-between">
                <div>
                  <span className="font-semibold text-default capitalize">{role} Account: </span>
                  <span className="text-muted font-mono">{DEMO_CREDENTIALS[role].email}</span>
                </div>
                <button
                  type="button"
                  onClick={() => fillDemo(role)}
                  className="text-[11px] font-semibold text-primary underline ml-2"
                >
                  Fill
                </button>
              </div>

              {error && (
                <div
                  className="mb-4 flex gap-2.5 items-start p-3 rounded-brand text-xs font-medium"
                  style={{ backgroundColor: '#FEE2E2', color: '#991B1B' }}
                >
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="label text-xs font-semibold text-default uppercase tracking-wider mb-1">
                    Email address
                  </label>
                  <input
                    type="email"
                    className="input w-full"
                    placeholder="user@cognify.edu"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    autoComplete="email"
                  />
                </div>

                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="label text-xs font-semibold text-default uppercase tracking-wider mb-0">
                      Password
                    </label>
                    <Link
                      to="/forgot-password"
                      className="text-xs font-medium hover:underline"
                      style={{ color: 'var(--primary)' }}
                    >
                      Forgot password?
                    </Link>
                  </div>
                  <div className="relative">
                    <input
                      type={showPw ? 'text' : 'password'}
                      className="input w-full pr-10"
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      autoComplete="current-password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPw(!showPw)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-default transition-colors"
                      tabIndex={-1}
                    >
                      {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="btn btn-primary w-full justify-center py-2.5 text-sm font-semibold shadow-md mt-2"
                >
                  {isLoading ? (
                    <>
                      <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin mr-2" />
                      Signing in…
                    </>
                  ) : (
                    <>
                      Sign in as {role} <ArrowRight className="w-4 h-4 ml-1.5" />
                    </>
                  )}
                </button>
              </form>

              {/* Bottom Registration Links */}
              <div className="mt-6 pt-5 border-t border-default text-xs text-center text-muted">
                {role === 'admin' ? (
                  <p>
                    Institutional administrator accounts are managed internally. Need access? Contact the university academic registrar.
                  </p>
                ) : (
                  <div className="flex gap-1.5 justify-center items-center">
                    <span>Don't have a {role} account?</span>
                    <Link
                      to={role === 'dean' ? '/register/dean' : '/register/faculty'}
                      className="font-bold hover:underline"
                      style={{ color: 'var(--primary)' }}
                    >
                      Register as {role}
                    </Link>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
